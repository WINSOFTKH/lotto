const Redis = require('ioredis');
const config = require('./env');

let redisClient = null;
let redisPubClient = null;
let redisSubClient = null;
let isRedisAvailable = false;

try {
  redisClient = new Redis({
    host: config.REDIS.host,
    port: config.REDIS.port,
    password: config.REDIS.password,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('⚠️  Redis connection failed after 3 retries. Falling back to in-memory mode.');
        return null; // Stop retrying
      }
      return Math.min(times * 100, 1000);
    },
    lazyConnect: true,
  });

  redisClient.connect().then(() => {
    isRedisAvailable = true;
    console.log('✅ Connected to Redis successfully');
  }).catch((err) => {
    console.warn('⚠️  Redis server is not running at', `${config.REDIS.host}:${config.REDIS.port}`, '- Continuing in single-node in-memory mode.');
  });

  redisPubClient = redisClient.duplicate();
  redisSubClient = redisClient.duplicate();
} catch (error) {
  console.warn('⚠️  Failed to initialize Redis:', error.message);
}

module.exports = {
  redisClient,
  redisPubClient,
  redisSubClient,
  isRedisAvailable: () => isRedisAvailable,
};
