const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('./env');

const pool = config.DB.connectionString
  ? new Pool({
      connectionString: config.DB.connectionString,
      max: config.DB.max,
      idleTimeoutMillis: config.DB.idleTimeoutMillis,
      connectionTimeoutMillis: config.DB.connectionTimeoutMillis,
    })
  : new Pool({
      host: config.DB.host,
      port: config.DB.port,
      user: config.DB.user,
      password: config.DB.password,
      database: config.DB.database,
      max: config.DB.max,
      idleTimeoutMillis: config.DB.idleTimeoutMillis,
      connectionTimeoutMillis: config.DB.connectionTimeoutMillis,
    });

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

/**
 * Execute a single query
 */
const query = (text, params) => pool.query(text, params);

/**
 * Execute operations within an atomic PostgreSQL transaction with auto-rollback on failure
 */
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Initialize DB schema from schema.sql
 */
const initDb = async () => {
  try {
    const schemaPath = path.join(__dirname, '../../schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Applying database schema from schema.sql...');
    await pool.query(sql);
    console.log('Database schema successfully applied!');
  } catch (error) {
    console.error('Error applying database schema:', error);
    throw error;
  }
};

module.exports = {
  pool,
  query,
  withTransaction,
  initDb,
};
