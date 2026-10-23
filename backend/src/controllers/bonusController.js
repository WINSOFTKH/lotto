const db = require('../config/db');

class BonusController {
  /**
   * Helper to fetch dynamic daily bonus coins from system settings
   */
  static async getBonusAmount(clientOrDb = db) {
    try {
      const settingRes = await clientOrDb.query("SELECT value FROM system_settings WHERE key = 'daily_bonus_coins';");
      if (settingRes.rows.length > 0) {
        const val = parseInt(settingRes.rows[0].value, 10);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch (err) {
      console.warn('Failed to query daily_bonus_coins setting, falling back to 10:', err.message);
    }
    return 10;
  }

  /**
   * Get user daily bonus claim eligibility
   */
  static async getBonusStatus(req, res, next) {
    try {
      const userId = req.user.id;
      const bonusCoins = await BonusController.getBonusAmount();

      const query = `
        SELECT 
          last_claim_date,
          (last_claim_date IS NULL OR last_claim_date < CURRENT_DATE) AS can_claim,
          CURRENT_DATE AS today
        FROM users 
        WHERE id = $1;
      `;
      const result = await db.query(query, [userId]);
      const data = result.rows[0];

      return res.json({
        success: true,
        data: {
          canClaim: data.can_claim,
          lastClaimDate: data.last_claim_date,
          today: data.today,
          bonusCoins,
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Claim daily bonus dynamically configured via system settings
   * Guaranteed race-condition free via atomic conditional UPDATE
   */
  static async claimDailyBonus(req, res, next) {
    try {
      const userId = req.user.id;
      const bonusCoins = await BonusController.getBonusAmount();

      const result = await db.withTransaction(async (client) => {
        // Atomic update checking last_claim_date
        const updateQuery = `
          UPDATE users 
          SET 
            coin_balance = coin_balance + $1,
            last_claim_date = CURRENT_DATE,
            updated_at = NOW()
          WHERE id = $2 AND (last_claim_date IS NULL OR last_claim_date < CURRENT_DATE)
          RETURNING coin_balance, last_claim_date;
        `;
        const updateRes = await client.query(updateQuery, [bonusCoins, userId]);

        if (updateRes.rows.length === 0) {
          const err = new Error('Daily bonus already claimed for today. Please come back tomorrow!');
          err.statusCode = 400;
          throw err;
        }

        const newBalance = parseInt(updateRes.rows[0].coin_balance, 10);

        // Record in ledger
        await client.query(`
          INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description)
          VALUES ($1, 'daily_bonus', $2, $3, 'Daily Free Claim')
        `, [userId, bonusCoins, newBalance]);

        return {
          newBalance,
          claimedDate: updateRes.rows[0].last_claim_date,
        };
      });

      return res.json({
        success: true,
        message: `Successfully claimed ${bonusCoins.toLocaleString()} daily bonus coins!`,
        data: {
          bonusAwarded: bonusCoins,
          coinBalance: result.newBalance,
          lastClaimDate: result.claimedDate,
          canClaimBonus: false,
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = BonusController;
