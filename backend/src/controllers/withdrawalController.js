const db = require('../config/db');
const WalletService = require('../services/walletService');
const socketServer = require('../sockets/socketServer');
const AuditService = require('../services/auditService');

const DEFAULT_SUPPORTED_BANKS = [
  { name: 'ABA Bank (Advanced Bank of Asia)', logo: '/banks/aba.png' },
  { name: 'ACLEDA Bank Plc.', logo: '/banks/acleda.png' },
  { name: 'Wing Bank (Cambodia) Plc', logo: '/banks/wing.png' },
  { name: 'Canadia Bank PLC', logo: '/banks/canadia.png' },
  { name: 'Sathapana Bank Plc', logo: '/banks/sathapana.png' },
  { name: 'Prince Bank Plc', logo: '/banks/prince.png' },
  { name: 'Chip Mong Commercial Bank', logo: '/banks/chipmong.png' },
];

function normalizeBankList(raw) {
  if (!raw) return [...DEFAULT_SUPPORTED_BANKS];
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [...DEFAULT_SUPPORTED_BANKS];
    }
  }
  if (!Array.isArray(list) || list.length === 0) return [...DEFAULT_SUPPORTED_BANKS];
  return list
    .map((item) => {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        const def = DEFAULT_SUPPORTED_BANKS.find(
          (d) => d.name.toLowerCase() === trimmed.toLowerCase()
        );
        return { name: trimmed, logo: def ? def.logo : null };
      }
      if (item && typeof item === 'object') {
        const name = (item.name || item.bankName || '').trim();
        const logo = item.logo || item.bankLogo || null;
        return { name, logo };
      }
      return null;
    })
    .filter((b) => b && b.name);
}

let tableEnsured = false;
async function ensurePaymentMethodsTable() {
  if (tableEnsured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS player_payment_methods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bank_name VARCHAR(100) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        account_name VARCHAR(150) NOT NULL,
        label VARCHAR(100) DEFAULT NULL,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON player_payment_methods(user_id, is_default DESC, created_at DESC);
    `);
    tableEnsured = true;
  } catch (err) {
    console.warn('Could not ensure player_payment_methods table:', err.message);
  }
}

class WithdrawalController {
  /**
   * Get dynamic withdrawal configuration (coins_per_usd, min_withdrawal_coins, and user's saved payment methods)
   */
  static async getWithdrawalConfig(req, res, next) {
    try {
      await ensurePaymentMethodsTable();
      const userId = req.user?.id;

      const [settingsRes, pmRes] = await Promise.all([
        db.query("SELECT key, value FROM system_settings WHERE key IN ('coins_per_usd', 'min_withdrawal_coins', 'supported_bank_names')"),
        userId
          ? db.query(
              'SELECT * FROM player_payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
              [userId]
            )
          : Promise.resolve({ rows: [] }),
      ]);

      const settingsMap = {};
      settingsRes.rows.forEach((r) => { settingsMap[r.key] = r.value; });

      const coinsPerUsd = parseFloat(settingsMap['coins_per_usd'] || '4000');
      const minWithdrawalCoins = parseInt(settingsMap['min_withdrawal_coins'] || '1500', 10);
      const supportedBanks = normalizeBankList(settingsMap['supported_bank_names']);

      return res.json({
        success: true,
        data: {
          coinsPerUsd,
          minWithdrawalCoins,
          supportedBanks,
          paymentMethods: pmRes.rows,
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get supported bank names list for players
   */
  static async getSupportedBanks(req, res, next) {
    try {
      const resDb = await db.query("SELECT value FROM system_settings WHERE key = 'supported_bank_names'");
      const banks = normalizeBankList(resDb.rows[0]?.value);
      return res.json({ success: true, data: banks });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get all saved payment methods for the authenticated player
   */
  static async getPaymentMethods(req, res, next) {
    try {
      await ensurePaymentMethodsTable();
      const userId = req.user.id;
      const result = await db.query(
        'SELECT * FROM player_payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
        [userId]
      );
      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create a new saved payment method (one-time or multi-account setup)
   */
  static async createPaymentMethod(req, res, next) {
    try {
      await ensurePaymentMethodsTable();
      const userId = req.user.id;
      const { bankName, accountNumber, accountName, label, isDefault } = req.body;

      if (!bankName || !bankName.trim() || !accountNumber || !accountNumber.trim() || !accountName || !accountName.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Bank Name, Account Number, and Account Holder Name are required',
        });
      }

      const created = await db.withTransaction(async (client) => {
        const countRes = await client.query(
          'SELECT COUNT(*)::int AS cnt FROM player_payment_methods WHERE user_id = $1',
          [userId]
        );
        const existingCount = countRes.rows[0]?.cnt || 0;
        if (existingCount >= 1) {
          const err = new Error('You can only add one bank account. Please edit your existing payment method.');
          err.statusCode = 400;
          throw err;
        }

        const insertRes = await client.query(
          `INSERT INTO player_payment_methods (user_id, bank_name, account_number, account_name, label, is_default)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           RETURNING *;`,
          [
            userId,
            bankName.trim(),
            accountNumber.trim(),
            accountName.trim().toUpperCase(),
            label ? label.trim() : null,
          ]
        );
        return insertRes.rows[0];
      });

      return res.status(201).json({
        success: true,
        message: 'Payment method saved successfully',
        data: created,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update an existing saved payment method
   */
  static async updatePaymentMethod(req, res, next) {
    try {
      await ensurePaymentMethodsTable();
      const userId = req.user.id;
      const { id } = req.params;
      const { bankName, accountNumber, accountName, label, isDefault } = req.body;

      if (!bankName || !bankName.trim() || !accountNumber || !accountNumber.trim() || !accountName || !accountName.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Bank Name, Account Number, and Account Holder Name are required',
        });
      }

      const updated = await db.withTransaction(async (client) => {
        const checkRes = await client.query(
          'SELECT * FROM player_payment_methods WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [id, userId]
        );
        if (checkRes.rows.length === 0) {
          const err = new Error('Payment method not found');
          err.statusCode = 404;
          throw err;
        }

        const current = checkRes.rows[0];
        const makeDefault = isDefault !== undefined ? Boolean(isDefault) : current.is_default;

        if (makeDefault) {
          await client.query(
            'UPDATE player_payment_methods SET is_default = FALSE, updated_at = NOW() WHERE user_id = $1 AND id != $2',
            [userId, id]
          );
        }

        const updRes = await client.query(
          `UPDATE player_payment_methods
           SET bank_name = $1, account_number = $2, account_name = $3, label = $4, is_default = $5, updated_at = NOW()
           WHERE id = $6 AND user_id = $7
           RETURNING *;`,
          [
            bankName.trim(),
            accountNumber.trim(),
            accountName.trim().toUpperCase(),
            label ? label.trim() : null,
            makeDefault,
            id,
            userId,
          ]
        );
        return updRes.rows[0];
      });

      return res.json({
        success: true,
        message: 'Payment method updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Set a saved payment method as default
   */
  static async setDefaultPaymentMethod(req, res, next) {
    try {
      await ensurePaymentMethodsTable();
      const userId = req.user.id;
      const { id } = req.params;

      const updated = await db.withTransaction(async (client) => {
        const checkRes = await client.query(
          'SELECT * FROM player_payment_methods WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [id, userId]
        );
        if (checkRes.rows.length === 0) {
          const err = new Error('Payment method not found');
          err.statusCode = 404;
          throw err;
        }

        await client.query(
          'UPDATE player_payment_methods SET is_default = FALSE, updated_at = NOW() WHERE user_id = $1',
          [userId]
        );

        const updRes = await client.query(
          'UPDATE player_payment_methods SET is_default = TRUE, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *;',
          [id, userId]
        );
        return updRes.rows[0];
      });

      return res.json({
        success: true,
        message: 'Default payment method updated',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete a saved payment method
   */
  static async deletePaymentMethod(req, res, next) {
    try {
      await ensurePaymentMethodsTable();
      const userId = req.user.id;
      const { id } = req.params;

      await db.withTransaction(async (client) => {
        const checkRes = await client.query(
          'SELECT * FROM player_payment_methods WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [id, userId]
        );
        if (checkRes.rows.length === 0) {
          const err = new Error('Payment method not found');
          err.statusCode = 404;
          throw err;
        }

        const wasDefault = checkRes.rows[0].is_default;
        await client.query('DELETE FROM player_payment_methods WHERE id = $1 AND user_id = $2', [id, userId]);

        if (wasDefault) {
          const nextRes = await client.query(
            'SELECT id FROM player_payment_methods WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
            [userId]
          );
          if (nextRes.rows.length > 0) {
            await client.query(
              'UPDATE player_payment_methods SET is_default = TRUE, updated_at = NOW() WHERE id = $1',
              [nextRes.rows[0].id]
            );
          }
        }
      });

      return res.json({
        success: true,
        message: 'Payment method removed',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Submit a new withdrawal request
   * Verifies balance, locks row, deducts coins into escrow, and queues request for Admin/Finance approval
   */
  static async requestWithdrawal(req, res, next) {
    try {
      await ensurePaymentMethodsTable();
      const userId = req.user.id;
      let { coinAmount, paymentMethodId, bankName, accountNumber, accountName } = req.body;

      const coins = parseInt(coinAmount, 10);
      if (isNaN(coins) || coins <= 0) {
        return res.status(400).json({ success: false, error: 'Valid coin amount required' });
      }

      // If paymentMethodId is provided, resolve bank details from saved payment method
      if (paymentMethodId) {
        const pmRes = await db.query(
          'SELECT * FROM player_payment_methods WHERE id = $1 AND user_id = $2',
          [paymentMethodId, userId]
        );
        if (pmRes.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Selected payment method not found',
          });
        }
        const pm = pmRes.rows[0];
        bankName = pm.bank_name;
        accountNumber = pm.account_number;
        accountName = pm.account_name;
      }

      if (!bankName || !accountNumber || !accountName) {
        return res.status(400).json({
          success: false,
          error: 'Please select or set up a payment method (Bank Name, Account Number, and Account Name)'
        });
      }

      // Fetch dynamic exchange rate & min withdrawal from system_settings
      const settingsRes = await db.query(
        "SELECT key, value FROM system_settings WHERE key IN ('coins_per_usd', 'min_withdrawal_coins')"
      );
      const settingsMap = {};
      settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });

      const coinsPerUsd = parseFloat(settingsMap['coins_per_usd'] || '1500');
      const minCoins = parseInt(settingsMap['min_withdrawal_coins'] || '1500', 10);

      if (coins < minCoins) {
        return res.status(400).json({
          success: false,
          error: `Minimum sell coins is ${minCoins} coins ($${(minCoins / coinsPerUsd).toFixed(2)} USD)`
        });
      }

      const amountUsd = parseFloat((coins / coinsPerUsd).toFixed(2));

      const withdrawal = await db.withTransaction(async (client) => {
        // Debit coins instantly into escrow
        const debitRes = await WalletService.debitCoins(
          userId,
          coins,
          'withdrawal_deduct',
          null,
          `Sell Coins Request to ${bankName} (${accountNumber})`,
          client
        );

        // Create pending withdrawal record
        const insertQuery = `
          INSERT INTO withdrawals (
            user_id, coin_amount, amount_usd, bank_name, account_number, account_name, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'pending')
          RETURNING *;
        `;
        const resWithdrawal = await client.query(insertQuery, [
          userId,
          coins,
          amountUsd,
          bankName.trim(),
          accountNumber.trim(),
          accountName.trim().toUpperCase(),
        ]);

        return {
          record: resWithdrawal.rows[0],
          newBalance: debitRes.newBalance,
        };
      });

      // Real-time private wallet update to the user
      socketServer.emitToUser(userId, 'wallet:updated', {
        balance: withdrawal.newBalance,
        coinsDebited: coins,
      });

      return res.status(201).json({
        success: true,
        message: 'Sell coins request submitted for approval',
        data: {
          id: withdrawal.record.id,
          coinAmount: coins,
          amountUsd,
          bankName,
          accountNumber,
          accountName,
          status: 'pending',
          remainingCoins: withdrawal.newBalance,
          createdAt: withdrawal.record.created_at,
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get user's own withdrawal history
   */
  static async getUserWithdrawals(req, res, next) {
    try {
      const userId = req.user.id;
      const query = `
        SELECT id, coin_amount, amount_usd, bank_name, account_number, account_name, status, rejection_reason, created_at, processed_at
        FROM withdrawals
        WHERE user_id = $1
        ORDER BY created_at DESC;
      `;
      const result = await db.query(query, [userId]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cancel a pending withdrawal request
   * Atomically updates status to 'cancelled' and refunds coins back to user wallet
   */
  static async cancelWithdrawal(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const result = await db.withTransaction(async (client) => {
        // 1. Lock withdrawal row
        const wRes = await client.query(
          'SELECT * FROM withdrawals WHERE id = $1 AND user_id = $2 FOR UPDATE;',
          [id, userId]
        );

        if (wRes.rows.length === 0) {
          const err = new Error('Sell coins request not found');
          err.statusCode = 404;
          throw err;
        }

        const withdrawal = wRes.rows[0];

        if (withdrawal.status !== 'pending') {
          const err = new Error(`Cannot cancel a sell coins request that is already ${withdrawal.status}`);
          err.statusCode = 400;
          throw err;
        }

        // 2. Update withdrawal status to 'cancelled'
        await client.query(`
          UPDATE withdrawals
          SET status = 'cancelled', updated_at = NOW(), rejection_reason = 'Cancelled by player'
          WHERE id = $1;
        `, [id]);

        // 3. Atomically refund coins back to user wallet
        const refundRes = await WalletService.creditCoins(
          userId,
          withdrawal.coin_amount,
          'withdrawal_refund',
          withdrawal.id,
          `Cancelled sell coins request: ${withdrawal.bank_name} (${withdrawal.account_number})`,
          client
        );

        return {
          withdrawalId: id,
          refundedCoins: withdrawal.coin_amount,
          newBalance: refundRes.newBalance,
        };
      });

      // 4. Emit real-time wallet update to the user
      socketServer.emitToUser(userId, 'wallet:updated', {
        balance: result.newBalance,
        coinsCredited: result.refundedCoins,
      });

      // 5. Audit log
      await AuditService.log({
        adminId: null,
        action: 'PLAYER_CANCEL_WITHDRAWAL',
        targetType: 'WITHDRAWAL',
        targetId: id,
        details: { userId, coinAmount: result.refundedCoins },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        message: `Sell coins request cancelled. ${Number(result.refundedCoins).toLocaleString()} coins refunded to your balance.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = WithdrawalController;
