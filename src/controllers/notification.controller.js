const { db } = require("../config/firebase");
const { COLLECTIONS } = require("../utils/constants");
const { savePushToken } = require("../services/notification.service");
const logger = require("../utils/logger");

async function getNotifications(req, res, next) {
  try {
    const snap = await db
      .collection(COLLECTIONS.NOTIFICATIONS)
      .where("recipientId", "==", req.user.uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const notifications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const ref = db.collection(COLLECTIONS.NOTIFICATIONS).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists || snap.data().recipientId !== req.user.uid) {
      return res.status(404).json({ success: false, error: "Notification not found" });
    }
    await ref.update({ read: true });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    const snap = await db
      .collection(COLLECTIONS.NOTIFICATIONS)
      .where("recipientId", "==", req.user.uid)
      .where("read", "==", false)
      .get();

    const batch = db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();

    res.json({ success: true, updated: snap.size });
  } catch (err) {
    next(err);
  }
}

async function registerPushToken(req, res, next) {
  try {
    const { token, platform } = req.body;
    await savePushToken(req.user.uid, token, platform);
    res.json({ success: true, message: "Push token registered" });
  } catch (err) {
    next(err);
  }
}

module.exports = { getNotifications, markRead, markAllRead, registerPushToken };