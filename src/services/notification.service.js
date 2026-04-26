/**
 * notification.service.js
 *
 * This is the canonical notification layer. It:
 *   1. Persists notifications to Firestore (for in-app inbox).
 *   2. Sends Expo push notifications.
 *   3. Exposes a `notify` object used throughout the app.
 *
 * Heavy-traffic apps should route through notification.job.js (Bull queue)
 * instead of calling createNotification directly. Both paths converge here.
 */

const { Expo } = require("expo-server-sdk");
const { db } = require("../config/firebase");
const { COLLECTIONS, NOTIFICATION_TYPES } = require("../utils/constants");
const logger = require("../utils/logger");

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// ── Push token management ─────────────────────────────────────────────────────

async function savePushToken(uid, token, platform) {
  if (!Expo.isExpoPushToken(token)) {
    logger.warn(`Invalid Expo push token for user ${uid}: ${token}`);
    return;
  }
  await db.collection(COLLECTIONS.PUSH_TOKENS).doc(uid).set(
    { uid, token, platform, updatedAt: Date.now() },
    { merge: true }
  );
}

async function getUserPushToken(uid) {
  const snap = await db.collection(COLLECTIONS.PUSH_TOKENS).doc(uid).get();
  if (!snap.exists) return null;
  return snap.data()?.token || null;
}

// ── Push sender ───────────────────────────────────────────────────────────────

async function sendPushNotification({ uids, title, body, data = {}, badge }) {
  try {
    const tokenResults = await Promise.all(uids.map((uid) => getUserPushToken(uid)));
    const tokens = tokenResults.filter(Boolean).filter(Expo.isExpoPushToken);
    if (!tokens.length) return;

    const messages = tokens.map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data,
      badge,
      priority: "high",
      channelId: "default",
    }));

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        receipts.forEach((receipt) => {
          if (receipt.status === "error") {
            logger.warn(`Push error: ${receipt.message} — ${receipt.details?.error}`);
            // DeviceNotRegistered means token is stale; could trigger cleanup here
          }
        });
      } catch (chunkErr) {
        logger.error(`Push chunk failed: ${chunkErr.message}`);
      }
    }
  } catch (err) {
    logger.error(`sendPushNotification failed: ${err.message}`);
  }
}

// ── Core: persist + push ──────────────────────────────────────────────────────

async function createNotification({ recipientId, type, title, body, data = {} }) {
  const notification = {
    recipientId,
    type,
    title,
    body,
    data,
    read: false,
    createdAt: Date.now(),
  };

  // Write to Firestore (in-app inbox)
  await db.collection(COLLECTIONS.NOTIFICATIONS).add(notification);

  // Fire push — don't await, never block the caller
  sendPushNotification({ uids: [recipientId], title, body, data }).catch(() => {});
}

// ── Typed helpers — these are what services call ──────────────────────────────

const notify = {
  newMessage: (recipientId, senderName, convId) =>
    createNotification({
      recipientId,
      type: NOTIFICATION_TYPES.NEW_MESSAGE,
      title: `New message from ${senderName}`,
      body: "Tap to view",
      data: { convId, screen: "conversation" },
    }),

  messageRequest: (recipientId, senderName, convId) =>
    createNotification({
      recipientId,
      type: NOTIFICATION_TYPES.MESSAGE_REQUEST,
      title: `${senderName} wants to message you`,
      body: "Accept or decline the request",
      data: { convId, screen: "conversation" },
    }),

  transactionUpdate: (recipientId, status, deviceModel) =>
    createNotification({
      recipientId,
      type: NOTIFICATION_TYPES.TRANSACTION_UPDATE,
      title: "Transaction Update",
      body: `${deviceModel} marked as ${status}`,
      data: { screen: "transactions" },
    }),

  kycApproved: (recipientId) =>
    createNotification({
      recipientId,
      type: NOTIFICATION_TYPES.KYC_APPROVED,
      title: "KYC Verification Approved 🎉",
      body: "You are now a verified TrustGate dealer",
      data: { screen: "kyc" },
    }),

  kycRejected: (recipientId) =>
    createNotification({
      recipientId,
      type: NOTIFICATION_TYPES.KYC_REJECTED,
      title: "KYC Verification Update",
      body: "Please resubmit your documents",
      data: { screen: "kyc" },
    }),

  accountApproved: (recipientId) =>
    createNotification({
      recipientId,
      type: NOTIFICATION_TYPES.ACCOUNT_APPROVED,
      title: "Account Approved ✅",
      body: "Welcome to TrustGate! You can now start trading.",
      data: { screen: "home" },
    }),

  accountBanned: (recipientId) =>
    createNotification({
      recipientId,
      type: NOTIFICATION_TYPES.ACCOUNT_BANNED,
      title: "Account Banned",
      body: "Your account has been permanently banned.",
      data: {},
    }),

  accountPardoned: (recipientId) =>
    createNotification({
      recipientId,
      type: NOTIFICATION_TYPES.ACCOUNT_PARDONED,
      title: "Account Reinstated",
      body: "Your TrustGate account has been restored.",
      data: { screen: "home" },
    }),

  newFollower: (recipientId, followerName) =>
    createNotification({
      recipientId,
      type: NOTIFICATION_TYPES.NEW_FOLLOWER,
      title: `${followerName} started following you`,
      body: "View their profile",
      data: { screen: "profile" },
    }),

  theftAlert: (recipientId, deviceModel) =>
    createNotification({
      recipientId,
      type: NOTIFICATION_TYPES.THEFT_ALERT,
      title: "⚠️ Theft Alert",
      body: `${deviceModel} in your area has been reported stolen`,
      data: { screen: "checker" },
    }),

  paymentSuccess: (recipientId, plan) =>
    createNotification({
      recipientId,
      type: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      title: "Payment Successful",
      body: `Your ${plan} subscription is now active`,
      data: { screen: "profile" },
    }),
};

module.exports = { savePushToken, getUserPushToken, sendPushNotification, createNotification, notify };