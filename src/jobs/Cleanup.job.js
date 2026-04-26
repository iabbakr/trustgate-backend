const Bull = require("bull");
const { db } = require("../config/firebase");
const { COLLECTIONS } = require("../utils/constants");
const cache = require("../services/cache.service");
const logger = require("../utils/logger");

const cleanupQueue = new Bull("cleanup", {
  redis: process.env.REDIS_URL,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 10,
    removeOnFail: 20,
  },
});

// ── Processors ────────────────────────────────────────────────────────────────

/**
 * Delete read notifications older than 30 days.
 * Keeps Firestore lean and cuts read costs.
 */
cleanupQueue.process("purge_old_notifications", async () => {
  logger.info("[cleanup.job] purging old notifications...");

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const snap = await db
    .collection(COLLECTIONS.NOTIFICATIONS)
    .where("read", "==", true)
    .where("createdAt", "<", cutoff)
    .limit(500)
    .get();

  if (snap.empty) {
    logger.info("[cleanup.job] no old notifications to purge");
    return;
  }

  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  logger.info(`[cleanup.job] purged ${snap.size} old notifications`);
});

/**
 * Remove stale push tokens — Expo tokens that haven't been updated in 60 days.
 */
cleanupQueue.process("purge_stale_push_tokens", async () => {
  logger.info("[cleanup.job] purging stale push tokens...");

  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const snap = await db
    .collection(COLLECTIONS.PUSH_TOKENS)
    .where("updatedAt", "<", cutoff)
    .limit(200)
    .get();

  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  logger.info(`[cleanup.job] removed ${snap.size} stale push tokens`);
});

/**
 * Auto-flag transactions that have been "assigned" for more than 14 days
 * without resolution. Sends a reminder notification and marks as overdue.
 */
cleanupQueue.process("flag_overdue_transactions", async () => {
  logger.info("[cleanup.job] checking overdue transactions...");

  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const snap = await db
    .collection(COLLECTIONS.TRANSACTIONS)
    .where("status", "==", "assigned")
    .where("assignedAt", "<", cutoff)
    .limit(100)
    .get();

  if (snap.empty) return;

  const { enqueueNotify } = require("./notification.job");
  const batch = db.batch();

  for (const doc of snap.docs) {
    const tx = doc.data();
    batch.update(doc.ref, { overdue: true });

    // Notify both parties
    enqueueNotify
      .transactionUpdate(tx.ownerId, "overdue", tx.deviceModel)
      .catch(() => {});
    enqueueNotify
      .transactionUpdate(tx.collectorId, "overdue", tx.deviceModel)
      .catch(() => {});
  }

  await batch.commit();
  logger.info(`[cleanup.job] flagged ${snap.size} overdue transactions`);
});

// ── Schedules ─────────────────────────────────────────────────────────────────

// Daily at 03:00 UTC
cleanupQueue.add("purge_old_notifications", {}, {
  repeat: { cron: "0 3 * * *" },
  jobId: "purge_notifications_cron",
});

// Every Monday at 04:00 UTC
cleanupQueue.add("purge_stale_push_tokens", {}, {
  repeat: { cron: "0 4 * * 1" },
  jobId: "purge_tokens_cron",
});

// Every 6 hours
cleanupQueue.add("flag_overdue_transactions", {}, {
  repeat: { cron: "0 */6 * * *" },
  jobId: "overdue_tx_cron",
});

cleanupQueue.on("completed", (job) => {
  logger.info(`[cleanup.job] "${job.name}" completed`);
});

cleanupQueue.on("failed", (job, err) => {
  logger.error(`[cleanup.job] "${job.name}" failed: ${err.message}`);
});

module.exports = { cleanupQueue };