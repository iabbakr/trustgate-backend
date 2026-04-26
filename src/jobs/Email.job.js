const Bull = require("bull");
const emailService = require("../services/email.service");
const logger = require("../utils/logger");

const emailQueue = new Bull("email", {
  redis: process.env.REDIS_URL,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

// ── Processors ────────────────────────────────────────────────────────────────

emailQueue.process("welcome", async (job) => {
  const { user } = job.data;
  await emailService.welcomeEmail(user);
  logger.info(`[email.job] welcome sent to ${user.email}`);
});

emailQueue.process("account_approved", async (job) => {
  const { user } = job.data;
  await emailService.accountApprovedEmail(user);
});

emailQueue.process("kyc_approved", async (job) => {
  const { user } = job.data;
  await emailService.kycApprovedEmail(user);
});

emailQueue.process("kyc_rejected", async (job) => {
  const { user, reason } = job.data;
  await emailService.kycRejectedEmail(user, reason);
});

emailQueue.process("account_banned", async (job) => {
  const { user } = job.data;
  await emailService.accountBannedEmail(user);
});

emailQueue.process("transaction_assigned", async (job) => {
  const { owner, collector, tx } = job.data;
  await emailService.transactionAssignedEmail(owner, collector, tx);
});

emailQueue.process("theft_alert", async (job) => {
  const { reporter, device } = job.data;
  await emailService.theftAlertEmail(reporter, device);
});

// ── Event listeners ───────────────────────────────────────────────────────────

emailQueue.on("failed", (job, err) => {
  logger.error(`[email.job] "${job.name}" failed (attempt ${job.attemptsMade}): ${err.message}`);
});

emailQueue.on("stalled", (job) => {
  logger.warn(`[email.job] "${job.name}" stalled`);
});

// ── Helper to enqueue emails anywhere in the app ──────────────────────────────

const enqueueEmail = {
  welcome: (user) => emailQueue.add("welcome", { user }),
  accountApproved: (user) => emailQueue.add("account_approved", { user }),
  kycApproved: (user) => emailQueue.add("kyc_approved", { user }),
  kycRejected: (user, reason) => emailQueue.add("kyc_rejected", { user, reason }),
  accountBanned: (user) => emailQueue.add("account_banned", { user }),
  transactionAssigned: (owner, collector, tx) =>
    emailQueue.add("transaction_assigned", { owner, collector, tx }),
  theftAlert: (reporter, device) => emailQueue.add("theft_alert", { reporter, device }),
};

module.exports = { emailQueue, enqueueEmail };