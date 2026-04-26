const userRepo = require("../repositories/user.repository");
const { deviceRepo } = require("../repositories/device.repository");
const { bannedNinRepo, bannedBvnRepo } = require("../repositories/device.repository");
const kycService = require("../services/kyc.service");
const deviceService = require("../services/device.service");
const userService = require("../services/user.service");
const emailService = require("../services/email.service");
const { notify } = require("../services/notification.service");
const { db } = require("../config/firebase");
const { COLLECTIONS } = require("../utils/constants");
const cache = require("../services/cache.service");
const { CACHE_KEYS } = require("../utils/constants");
const logger = require("../utils/logger");

// ── User management ───────────────────────────────────────────────────────────

async function getPendingUsers(req, res, next) {
  try {
    const users = await userRepo.findPending();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

async function getFlaggedUsers(req, res, next) {
  try {
    const users = await userRepo.findFlagged();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

async function getBannedUsers(req, res, next) {
  try {
    const users = await userRepo.findBanned();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

async function approveUser(req, res, next) {
  try {
    const { uid } = req.params;
    const user = await userRepo.findById(uid);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    await userRepo.update(uid, { status: "active" });
    await cache.del(CACHE_KEYS.userProfile(uid));

    notify.accountApproved(uid).catch(() => {});
    emailService.accountApprovedEmail(user).catch(() => {});

    res.json({ success: true, message: "User approved" });
  } catch (err) {
    next(err);
  }
}

async function banUser(req, res, next) {
  try {
    const { uid } = req.params;
    const { reason } = req.body;
    const user = await userRepo.findById(uid);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    await userRepo.update(uid, { status: "banned", isFlagged: false, banReason: reason || null });
    await cache.del(CACHE_KEYS.userProfile(uid));

    // Add NIN + BVN to ban lists if present
    if (user.nin) await bannedNinRepo.ban(user.nin, uid);
    if (user.bvn) await bannedBvnRepo.ban(user.bvn, uid);

    notify.accountBanned(uid).catch(() => {});
    emailService.accountBannedEmail(user).catch(() => {});

    res.json({ success: true, message: "User banned" });
  } catch (err) {
    next(err);
  }
}

async function pardonUser(req, res, next) {
  try {
    const { uid } = req.params;
    await userRepo.update(uid, { status: "active", isFlagged: false, badRatingCount: 0 });
    await cache.del(CACHE_KEYS.userProfile(uid));
    await userService.adjustTrustScore(uid, "account_pardoned");

    res.json({ success: true, message: "User pardoned" });
  } catch (err) {
    next(err);
  }
}

async function suspendUser(req, res, next) {
  try {
    const { uid } = req.params;
    await userRepo.update(uid, { status: "suspended" });
    await cache.del(CACHE_KEYS.userProfile(uid));
    res.json({ success: true, message: "User suspended" });
  } catch (err) {
    next(err);
  }
}

// ── KYC ───────────────────────────────────────────────────────────────────────

async function getPendingKyc(req, res, next) {
  try {
    const snap = await db
      .collection(COLLECTIONS.KYC_REQUESTS)
      .where("status", "==", "pending")
      .orderBy("submittedAt", "asc")
      .limit(50)
      .get();
    const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
}

async function approveKyc(req, res, next) {
  try {
    await kycService.approveKyc(req.params.uid, req.user.uid);
    res.json({ success: true, message: "KYC approved" });
  } catch (err) {
    next(err);
  }
}

async function rejectKyc(req, res, next) {
  try {
    const { reason } = req.body;
    await kycService.rejectKyc(req.params.uid, reason, req.user.uid);
    res.json({ success: true, message: "KYC rejected" });
  } catch (err) {
    next(err);
  }
}

// ── Devices ───────────────────────────────────────────────────────────────────

async function getAllDevices(req, res, next) {
  try {
    const devices = await deviceService.getAllDevices();
    res.json({ success: true, data: devices });
  } catch (err) {
    next(err);
  }
}

async function deleteDevice(req, res, next) {
  try {
    await deviceService.deleteDevice(req.params.id);
    res.json({ success: true, message: "Device deleted" });
  } catch (err) {
    next(err);
  }
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

async function getStats(req, res, next) {
  try {
    const [totalUsers, pendingUsers, bannedUsers, flaggedUsers, kycPendingSnap, devicesSnap] =
      await Promise.all([
        userRepo.count({}),
        userRepo.count({ status: "pending" }),
        userRepo.count({ status: "banned" }),
        userRepo.count({ isFlagged: true }),
        db.collection(COLLECTIONS.KYC_REQUESTS).where("status", "==", "pending").count().get(),
        db.collection(COLLECTIONS.DEVICES).where("status", "==", "stolen").count().get(),
      ]);

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, pending: pendingUsers, banned: bannedUsers, flagged: flaggedUsers },
        kyc: { pending: kycPendingSnap.data().count },
        devices: { stolen: devicesSnap.data().count },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPendingUsers,
  getFlaggedUsers,
  getBannedUsers,
  approveUser,
  banUser,
  pardonUser,
  suspendUser,
  getPendingKyc,
  approveKyc,
  rejectKyc,
  getAllDevices,
  deleteDevice,
  getStats,
};