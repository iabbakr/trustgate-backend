const Bull = require("bull");
const userRepo = require("../repositories/user.repository");
const { adjustTrustScore } = require("../services/user.service");
const logger = require("../utils/logger");

const trustScoreQueue = new Bull("trustScore", {
  redis: process.env.REDIS_URL,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 20,
    removeOnFail: 50,
  },
});

// ── Processor ─────────────────────────────────────────────────────────────────

trustScoreQueue.process("recalculate", async (job) => {
  const { uid, event } = job.data;
  await adjustTrustScore(uid, event);
  logger.info(`[trustScore.job] recalculated for ${uid} (event: ${event})`);
});

/**
 * Weekly decay: inactive users with no recent transactions
 * lose 1 trust point to incentivize active participation.
 * Runs every Sunday at 02:00 UTC.
 */
trustScoreQueue.process("weekly_decay", async () => {
  logger.info("[trustScore.job] running weekly decay...");

  // Find active users with trustScore > 50 (only decay if above baseline)
  const users = await userRepo.findMany({
    filters: { status: "active" },
    limitCount: 500,
  });

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days
  let decayed = 0;

  for (const user of users) {
    if ((user.trustScore || 50) > 50 && (user.updatedAt || user.createdAt) < cutoff) {
      const newScore = Math.max(50, (user.trustScore || 50) - 1);
      await userRepo.update(user.uid, { trustScore: newScore });
      decayed++;
    }
  }

  logger.info(`[trustScore.job] weekly decay complete — ${decayed} users affected`);
});

// ── Schedule weekly decay ─────────────────────────────────────────────────────

trustScoreQueue.add(
  "weekly_decay",
  {},
  {
    repeat: { cron: "0 2 * * 0" }, // Every Sunday 02:00 UTC
    jobId: "weekly_decay_cron",
  }
);

trustScoreQueue.on("failed", (job, err) => {
  logger.error(`[trustScore.job] "${job.name}" failed: ${err.message}`);
});

// ── Helper ────────────────────────────────────────────────────────────────────

function enqueueTrustScore(uid, event) {
  return trustScoreQueue.add("recalculate", { uid, event });
}

module.exports = { trustScoreQueue, enqueueTrustScore };