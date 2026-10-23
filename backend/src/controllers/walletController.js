const db = require('../config/db');

class WalletController {
  /**
   * Get authenticated user's coin balance and latest wallet transactions (default 25 records)
   */
  static async getMyTransactions(req, res, next) {
    try {
      const userId = req.user.id;
      const limit = Math.min(parseInt(req.query.limit || '25', 10), 100);

      // Fetch user's current balance
      const userRes = await db.query(
        'SELECT coin_balance, username, email FROM users WHERE id = $1',
        [userId]
      );
      if (userRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      const coinBalance = parseInt(userRes.rows[0].coin_balance || 0, 10);

      // Fetch latest 50 wallet transactions
      const txRes = await db.query(
        `SELECT 
          id, 
          type, 
          amount, 
          balance_after, 
          reference_id, 
          description, 
          created_at
        FROM wallet_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2;`,
        [userId, limit]
      );

      // Aggregate statistics for the user
      const statsRes = await db.query(
        `SELECT 
          COUNT(*)::int AS total_count,
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::bigint AS total_earned,
          COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)::bigint AS total_spent
        FROM wallet_transactions
        WHERE user_id = $1;`,
        [userId]
      );

      const stats = statsRes.rows[0] || {
        total_count: 0,
        total_earned: 0,
        total_spent: 0,
      };

      return res.json({
        success: true,
        data: {
          coinBalance,
          transactions: txRes.rows,
          summary: {
            totalCount: stats.total_count,
            totalEarned: Number(stats.total_earned),
            totalSpent: Number(stats.total_spent),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = WalletController;
