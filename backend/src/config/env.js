require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DB: {
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "kh_lotto",
    max: parseInt(process.env.DB_POOL_MAX || "20", 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
    connectionTimeoutMillis: parseInt(
      process.env.DB_CONN_TIMEOUT || "2000",
      10,
    ),
  },
  REDIS: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  JWT_SECRET:
    process.env.JWT_SECRET || "kh-lotto-secure-jwt-secret-key-32charsmin",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  BAKONG: {
    accountId: process.env.BAKONG_ACCOUNT_ID || "phearom_moeu@bkrt",
    merchantName: process.env.MERCHANT_NAME || "LOTTO 4U",
    merchantCity: process.env.MERCHANT_CITY || "Phnom Penh",
    webhookSecret: process.env.WEBHOOK_SECRET || "khqr-webhook-secret-token",
    apiUrl: "https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5",
  },
};
