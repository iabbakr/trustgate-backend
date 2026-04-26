const Bull = require("bull");
const { sendPushNotification, createNotification } = require("../services/notification.service");
const { NOTIFICATION_TYPES } = require("../utils/constants");
const logger = require("../utils/logger");

const notificationQueue = new Bull("notification", {
  redis: process.env.REDIS_URL,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 3000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

// ── Single processor handles all notification types ───────────────────────────

notificationQueue.process("push", async (job) => {
  const { recipientId, type, title, body, data } = job.data;
  await createNotification({ recipientId, type, title, body, data });
  logger.info(`[notification.job] ${type} → ${recipientId}`);
});

notificationQueue.on("failed", (job, err) => {
  logger.error(`[notification.job] failed (${job.data?.type}): ${err.message}`);
});

// ── Enqueue helpers ───────────────────────────────────────────────────────────

function enqueueNotification(recipientId, type, title, body, data = {}) {
  return notificationQueue.add("push", { recipientId, type, title, body, data });
}

const enqueueNotify = {
  newMessage: (recipientId, senderName, convId) =>
    enqueueNotification(recipientId, NOTIFICATION_TYPES.NEW_MESSAGE, `New message from ${senderName}`, "Tap to view", { convId, screen: "conversation" }),

  messageRequest: (recipientId, senderName, convId) =>
    enqueueNotification(recipientId, NOTIFICATION_TYPES.MESSAGE_REQUEST, `${senderName} wants to message you`, "Accept or decline the request", { convId, screen: "conversation" }),

  transactionUpdate: (recipientId, status, deviceModel) =>
    enqueueNotification(recipientId, NOTIFICATION_TYPES.TRANSACTION_UPDATE, "Transaction Update", `${deviceModel} marked as ${status}`, { screen: "transactions" }),

  kycApproved: (recipientId) =>
    enqueueNotification(recipientId, NOTIFICATION_TYPES.KYC_APPROVED, "KYC Verification Approved 🎉", "You are now a verified TrustGate dealer", { screen: "kyc" }),

  kycRejected: (recipientId) =>
    enqueueNotification(recipientId, NOTIFICATION_TYPES.KYC_REJECTED, "KYC Verification Update", "Please resubmit your documents", { screen: "kyc" }),

  accountApproved: (recipientId) =>
    enqueueNotification(recipientId, NOTIFICATION_TYPES.ACCOUNT_APPROVED, "Account Approved ✅", "Welcome to TrustGate! You can now start trading.", { screen: "home" }),

  accountBanned: (recipientId) =>
    enqueueNotification(recipientId, NOTIFICATION_TYPES.ACCOUNT_BANNED, "Account Banned", "Your account has been permanently banned.", {}),

  newFollower: (recipientId, followerName) =>
    enqueueNotification(recipientId, NOTIFICATION_TYPES.NEW_FOLLOWER, `${followerName} started following you`, "View their profile", { screen: "profile" }),

  theftAlert: (recipientId, deviceModel) =>
    enqueueNotification(recipientId, NOTIFICATION_TYPES.THEFT_ALERT, "⚠️ Theft Alert", `${deviceModel} in your area has been reported stolen`, { screen: "checker" }),

  paymentSuccess: (recipientId, plan) =>
    enqueueNotification(recipientId, NOTIFICATION_TYPES.PAYMENT_SUCCESS, "Payment Successful", `Your ${plan} subscription is now active`, { screen: "profile" }),
};

module.exports = { notificationQueue, enqueueNotify };