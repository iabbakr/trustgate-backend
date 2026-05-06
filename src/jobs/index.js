/**
 * Background jobs — Bull queues backed by Redis.
 * If Redis is unavailable, jobs are silently skipped (no crash).
 *
 * Queues:
 *   - emailQueue      : transactional emails
 *   - notificationQueue : push notifications
 *   - trustScoreQueue : trust score recalculation
 *   - cleanupQueue    : scheduled maintenance tasks
 */

const { getRedisClient } = require("../config/redis");
const logger = require("../utils/logger");

let queues = {};

function initJobs() {
  const redis = getRedisClient();
  if (!redis) {
    logger.warn("Jobs: Redis unavailable — background jobs disabled.");
    return;
  }

  try {
    require("./email.job");
    require("./notification.job");
    require("./trustscore.job");
    require("./cleanup.job");
    logger.info("Background jobs initialized.");
  } catch (err) {
    logger.error(`Jobs init failed: ${err.message}`);
  }
}

initJobs();

module.exports = queues;