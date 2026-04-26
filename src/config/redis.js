const Redis = require("ioredis");
const logger = require("../utils/logger");

let client;

function getRedisClient() {
  if (client) return client;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn("REDIS_URL not set — Redis caching disabled. Using no-op cache.");
    return null;
  }

  const tlsEnabled = process.env.REDIS_TLS === "true";

  client = new Redis(redisUrl, {
    tls: tlsEnabled ? {} : undefined,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 5) {
        logger.error("Redis: too many retries, giving up.");
        return null;
      }
      return Math.min(times * 100, 2000);
    },
    lazyConnect: true,
  });

  client.on("connect", () => logger.info("Redis connected"));
  client.on("error", (err) => logger.error("Redis error:", err.message));
  client.on("close", () => logger.warn("Redis connection closed"));

  return client;
}

module.exports = { getRedisClient };
