const crypto = require('crypto');
const db = require('../config/db');
const KhqrService = require('../services/khqrService');
const WalletService = require('../services/walletService');
const ReferralService = require('../services/referralService');
const socketServer = require('../sockets/socketServer');

class KhqrController {
  /**
   * Get dynamic KHQR top-up configuration (exchange rate and preset coin packages)
   */
  static async getTopupConfig(req, res, next) {
    try {
      const settingsRes = await db.query(
        "SELECT key, value FROM system_settings WHERE key IN ('topup_coins_per_usd', 'topup_coin_presets', 'coins_per_usd');"
      );
      const settingsMap = {};
      settingsRes.rows.forEach((r) => { settingsMap[r.key] = r.value; });

      // Prefer topup_coins_per_usd, fallback to coins_per_usd or 4000
      const coinsPerUsd = parseFloat(settingsMap['topup_coins_per_usd'] || settingsMap['coins_per_usd'] || '4000');
      const presetsStr = settingsMap['topup_coin_presets'] || '50000,100000,200000,5000000';
      const presets = presetsStr
        .split(',')
        .map((p) => parseInt(p.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);

      return res.json({
        success: true,
        data: {
          coinsPerUsd,
          presets: presets.length > 0 ? presets : [50000, 100000, 200000, 5000000],
          presetsRaw: presetsStr,
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Generates a dynamic KHQR top-up code for the requested coin package
   */
  static async generateTopupRequest(req, res, next) {
    try {
      const userId = req.user.id;
      let { coinAmount, amountUsd } = req.body;

      // Fetch dynamic top-up exchange rate from system_settings (independent from withdrawal rate)
      const rateRes = await db.query(
        "SELECT key, value FROM system_settings WHERE key IN ('topup_coins_per_usd', 'coins_per_usd');"
      );
      const settingsMap = {};
      rateRes.rows.forEach((r) => { settingsMap[r.key] = r.value; });
      const coinsPerUsd = parseFloat(settingsMap['topup_coins_per_usd'] || settingsMap['coins_per_usd'] || '4000');

      if (!coinAmount && !amountUsd) {
        return res.status(400).json({ success: false, error: 'Provide either coinAmount or amountUsd' });
      }

      if (coinAmount) {
        coinAmount = parseInt(coinAmount, 10);
        amountUsd = parseFloat((coinAmount / coinsPerUsd).toFixed(2));
      } else {
        amountUsd = parseFloat(Number(amountUsd).toFixed(2));
        coinAmount = Math.round(amountUsd * coinsPerUsd);
      }

      if (amountUsd < 0.5) {
        return res.status(400).json({ success: false, error: 'Minimum buy coins amount is $0.50 USD' });
      }

      const billNumber = `INV-${Date.now().toString().slice(-6)}-${crypto.randomInt(100, 999)}`;
      const khqrData = KhqrService.generateDynamicKhqr({ billNumber, amountUsd });

      // Save pending transaction
      const insertQuery = `
        INSERT INTO khqr_transactions (user_id, amount_usd, coin_amount, khqr_string, md5_hash, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING *;
      `;
      const txRes = await db.query(insertQuery, [
        userId,
        amountUsd,
        coinAmount,
        khqrData.khqrString,
        khqrData.md5Hash,
      ]);

      const tx = txRes.rows[0];

      // Generate Bakong App-to-App Deeplink shortLink for mobile devices
      const deepLink = await KhqrService.generateDeepLink(khqrData.khqrString);

      return res.status(201).json({
        success: true,
        data: {
          transactionId: tx.id,
          billNumber,
          amountUsd,
          coinAmount,
          exchangeRate: `${coinsPerUsd} Coins = $1 USD`,
          khqrString: khqrData.khqrString,
          md5Hash: khqrData.md5Hash,
          deepLink,
          expiresInMinutes: 15,
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Reusable core settlement helper
   * Idempotently marks a top-up transaction completed, credits player wallet,
   * pays referral commissions, and dispatches real-time socket events.
   */
  static async settleTransaction(txIdentifier) {
    if (!txIdentifier) {
      const err = new Error('Transaction identifier is required');
      err.statusCode = 400;
      throw err;
    }

    const settlement = await db.withTransaction(async (client) => {
      // Row-level lock on the transaction
      const findQuery = `
        SELECT kt.*, u.username, u.email 
        FROM khqr_transactions kt
        JOIN users u ON kt.user_id = u.id
        WHERE kt.id::text = $1 OR kt.md5_hash = $1
        FOR UPDATE;
      `;
      const txRes = await client.query(findQuery, [String(txIdentifier).trim()]);

      if (txRes.rows.length === 0) {
        const err = new Error('Transaction record not found');
        err.statusCode = 404;
        throw err;
      }

      const tx = txRes.rows[0];

      // Idempotency check: if already completed, do not credit twice
      if (tx.status === 'completed') {
        return { alreadyCompleted: true, tx, newBalance: null };
      }

      // Mark as completed
      await client.query(
        "UPDATE khqr_transactions SET status = 'completed', paid_at = NOW(), updated_at = NOW() WHERE id = $1",
        [tx.id]
      );

      // Atomically credit coins to user's wallet
      const creditRes = await WalletService.creditCoins(
        tx.user_id,
        tx.coin_amount,
        'khqr_deposit',
        tx.id,
        `Buy Coins $${tx.amount_usd} (${Number(tx.coin_amount).toLocaleString()} Coins)`,
        client
      );

      // Process Multi-Level (3-Tier) Referral Commissions
      try {
        await ReferralService.processTopupCommission(
          tx.user_id,
          tx.coin_amount,
          tx.amount_usd,
          tx.id,
          client
        );
      } catch (refErr) {
        console.warn('[KhqrController] processTopupCommission warning:', refErr.message);
      }

      return {
        alreadyCompleted: false,
        tx,
        newBalance: creditRes.newBalance,
      };
    });

    // Notify the player over Socket.io if newly completed
    if (!settlement.alreadyCompleted && settlement.newBalance !== null) {
      socketServer.emitToUser(settlement.tx.user_id, 'wallet:updated', {
        balance: settlement.newBalance,
        coinsAdded: settlement.tx.coin_amount,
        transactionId: settlement.tx.id,
        message: `Buy coins successful! Credited ${Number(settlement.tx.coin_amount).toLocaleString()} coins.`,
      });
    }

    return settlement;
  }

  /**
   * Check status of a transaction
   * Checks local DB status, and if pending, queries Bakong Open API.
   * If Bakong confirms payment, automatically settles and credits coins.
   */
  static async checkTransactionStatus(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Transaction ID or MD5 hash is required' });
      }

      const txRes = await db.query(
        `SELECT kt.*, u.username, u.coin_balance
         FROM khqr_transactions kt
         JOIN users u ON kt.user_id = u.id
         WHERE kt.id::text = $1 OR kt.md5_hash = $1`,
        [String(id).trim()]
      );

      if (txRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      const tx = txRes.rows[0];

      // Authorization check: owner or admin/finance
      if (tx.user_id !== userId && !['admin', 'finance'].includes(userRole)) {
        return res.status(403).json({ success: false, error: 'Unauthorized to view this transaction' });
      }

      // If already completed, return immediately
      if (tx.status === 'completed') {
        return res.json({
          success: true,
          data: {
            transactionId: tx.id,
            status: 'completed',
            coinAmount: tx.coin_amount,
            amountUsd: tx.amount_usd,
            paidAt: tx.paid_at,
            newBalance: tx.coin_balance,
          }
        });
      }

      // If pending, check with Bakong Open API
      const bakongCheck = await KhqrService.checkBakongPayment(tx.md5_hash);

      if (bakongCheck.paid) {
        const settlement = await KhqrController.settleTransaction(tx.id);
        return res.json({
          success: true,
          message: 'Payment verified successfully via Bakong!',
          data: {
            transactionId: tx.id,
            status: 'completed',
            coinAmount: tx.coin_amount,
            amountUsd: tx.amount_usd,
            paidAt: new Date(),
            newBalance: settlement.newBalance,
          }
        });
      }

      return res.json({
        success: true,
        data: {
          transactionId: tx.id,
          status: tx.status,
          coinAmount: tx.coin_amount,
          amountUsd: tx.amount_usd,
          bakongConfigured: bakongCheck.configured,
          bakongError: bakongCheck.error || null,
          bakongResponse: bakongCheck.responseMessage || null,
          rateLimited: bakongCheck.rateLimited || false,
          isAdmin: ['admin', 'finance'].includes(userRole),
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Webhook endpoint called by Bakong / Payment Gateway upon settlement
   */
  static async handleWebhook(req, res, next) {
    try {
      const { md5Hash, billNumber, status = 'SUCCESS' } = req.body;
      const signature = req.headers['x-bakong-signature'];

      // Webhook signature verification (if signature provided)
      if (signature && !KhqrService.verifyWebhookSignature(req.body, signature)) {
        return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
      }

      if (!md5Hash && !billNumber) {
        return res.status(400).json({ success: false, error: 'Missing md5Hash or billNumber' });
      }

      const txIdentifier = md5Hash || billNumber;

      if (status.toUpperCase() !== 'SUCCESS') {
        await db.query(
          "UPDATE khqr_transactions SET status = 'failed', updated_at = NOW() WHERE md5_hash = $1 OR id::text = $1",
          [txIdentifier]
        );
        return res.json({ success: true, message: 'Transaction marked failed' });
      }

      const settlement = await KhqrController.settleTransaction(txIdentifier);

      return res.json({
        success: true,
        message: 'Payment processed successfully',
        data: {
          transactionId: settlement.tx.id,
          status: 'completed',
          coinsCredited: settlement.tx.coin_amount,
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Sandbox/Simulation endpoint for testing KHQR payments without real bank integration
   */
  static async simulatePayment(req, res, next) {
    try {
      const { transactionId } = req.body;
      if (!transactionId) {
        return res.status(400).json({ success: false, error: 'transactionId is required' });
      }

      const settlement = await KhqrController.settleTransaction(transactionId);
      return res.json({
        success: true,
        message: settlement.alreadyCompleted
          ? 'Transaction was already completed'
          : 'Payment simulated and credited successfully',
        data: {
          transactionId: settlement.tx.id,
          status: 'completed',
          coinsCredited: settlement.tx.coin_amount,
          newBalance: settlement.newBalance,
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get user top-up transaction history
   */
  static async getUserHistory(req, res, next) {
    try {
      const userId = req.user.id;
      const query = `
        SELECT id, amount_usd, coin_amount, status, paid_at, created_at
        FROM khqr_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 20;
      `;
      const result = await db.query(query, [userId]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = KhqrController;
