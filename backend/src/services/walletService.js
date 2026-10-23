const db = require('../config/db');

class WalletService {
  /**
   * Atomically credits coins to a user's wallet with ledger entry
   * Can be run inside an existing client transaction or standalone
   */
  static async creditCoins(userId, amount, type, referenceId, description, client = null) {
    const executor = client || db;
    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Credit amount must be a positive integer');
    }

    const updateQuery = `
      UPDATE users 
      SET coin_balance = coin_balance + $1, updated_at = NOW()
      WHERE id = $2
      RETURNING coin_balance;
    `;
    const res = await executor.query(updateQuery, [numAmount, userId]);
    if (res.rows.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const newBalance = res.rows[0].coin_balance;

    const ledgerQuery = `
      INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_id, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    await executor.query(ledgerQuery, [userId, type, numAmount, newBalance, referenceId, description]);

    return { newBalance };
  }

  /**
   * Atomically debits coins from a user's wallet with strict balance check and row-level locking
   */
  static async debitCoins(userId, amount, type, referenceId, description, client = null) {
    const runInTransaction = async (conn) => {
      // Lock user row
      const checkRes = await conn.query(
        'SELECT coin_balance FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (checkRes.rows.length === 0) {
        throw new Error(`User with ID ${userId} not found`);
      }

      const currentBalance = BigInt(checkRes.rows[0].coin_balance);
      const debitAmount = BigInt(amount);

      if (currentBalance < debitAmount) {
        const err = new Error('Insufficient coin balance');
        err.statusCode = 400;
        throw err;
      }

      const updateQuery = `
        UPDATE users 
        SET coin_balance = coin_balance - $1, updated_at = NOW()
        WHERE id = $2
        RETURNING coin_balance;
      `;
      const updateRes = await conn.query(updateQuery, [amount, userId]);
      const newBalance = updateRes.rows[0].coin_balance;

      const ledgerQuery = `
        INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_id, description)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      await conn.query(ledgerQuery, [userId, type, -debitAmount, newBalance, referenceId, description]);

      return { newBalance };
    };

    if (client) {
      return runInTransaction(client);
    } else {
      return db.withTransaction(runInTransaction);
    }
  }

  /**
   * Get user wallet balance
   */
  static async getBalance(userId) {
    const res = await db.query('SELECT coin_balance FROM users WHERE id = $1', [userId]);
    if (res.rows.length === 0) throw new Error('User not found');
    return parseInt(res.rows[0].coin_balance, 10);
  }
}

module.exports = WalletService;
