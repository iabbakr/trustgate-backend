const { getRedisClient } = require("../config/redis");
const logger = require("../utils/logger");

/**
 * CacheService — thin wrapper around Redis.
 * Falls back to a no-op when Redis is unavailable so the app never crashes.
 */
class CacheService {
  constructor() {
    this.client = getRedisClient();
  }

  async get(key) {
    if (!this.client) return null;
    try {
      const val = await this.client.get(key);
      if (!val) return null;
      return JSON.parse(val);
    } catch (err) {
      logger.warn(`Cache GET failed for ${key}: ${err.message}`);
      return null;
    }
  }

  async set(key, value, ttlSeconds) {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
      logger.warn(`Cache SET failed for ${key}: ${err.message}`);
    }
  }

  async del(key) {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (err) {
      logger.warn(`Cache DEL failed for ${key}: ${err.message}`);
    }
  }

  /** Delete all keys matching a pattern (use sparingly — O(N)) */
  async delPattern(pattern) {
    if (!this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length) await this.client.del(...keys);
    } catch (err) {
      logger.warn(`Cache DEL pattern failed for ${pattern}: ${err.message}`);
    }
  }

  /** Wrap a function with cache-aside logic */
  async wrap(key, ttl, fn) {
    const cached = await this.get(key);
    if (cached !== null) return cached;
    const result = await fn();
    if (result !== null && result !== undefined) {
      await this.set(key, result, ttl);
    }
    return result;
  }

  async increment(key, ttlSeconds) {
    if (!this.client) return 0;
    try {
      const val = await this.client.incr(key);
      if (val === 1 && ttlSeconds) await this.client.expire(key, ttlSeconds);
      return val;
    } catch {
      return 0;
    }
  }
}

module.exports = new CacheService();
