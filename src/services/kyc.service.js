const { db } = require("../config/firebase");
const userRepo = require("../repositories/user.repository");
const { bannedNinRepo, bannedBvnRepo } = require("../repositories/device.repository");
const cache = require("./cache.service");
const { CACHE_KEYS, TTL, COLLECTIONS } = require("../utils/constants");
const { adjustTrustScore } = require("./user.service");
const emailService = require("./email.service");
const { notify } = require("./notification.service");
const logger = require("../utils/logger");

async function isNinBanned(nin) {
  return cache.wrap(CACHE_KEYS.bannedNin(nin), TTL.BANNED_DOC, () =>
    bannedNinRepo.isBanned(nin)
  );
}

async function isBvnBanned(bvn) {
  return cache.wrap(CACHE_KEYS.bannedBvn(bvn), TTL.BANNED_DOC, () =>
    bannedBvnRepo.isBanned(bvn)
  );
}

async function isNinUsed(nin, excludeUid) {
  const user = await userRepo.findByNin(nin);
  return user && user.uid !== excludeUid;
}

async function isBvnUsed(bvn, excludeUid) {
  const user = await userRepo.findByBvn(bvn);
  return user && user.uid !== excludeUid;
}

async function submitKyc(uid, nin, bvn) {
  const [ninBanned, bvnBanned, ninUsed, bvnUsed] = await Promise.all([
    isNinBanned(nin),
    isBvnBanned(bvn),
    isNinUsed(nin, uid),
    isBvnUsed(bvn, uid),
  ]);

  if (ninBanned || bvnBanned) {
    return { success: false, error: "BANNED_IDENTITY", message: "This identity has been banned from TrustGate." };
  }
  if (ninUsed) {
    return { success: false, error: "NIN_IN_USE", message: "This NIN is already linked to another account." };
  }
  if (bvnUsed) {
    return { success: false, error: "BVN_IN_USE", message: "This BVN is already linked to another account." };
  }

  await userRepo.update(uid, { nin, bvn, kycStatus: "pending" });
  await cache.del(CACHE_KEYS.userProfile(uid));

  // Log KYC request for admin review
  await db.collection(COLLECTIONS.KYC_REQUESTS).add({
    uid,
    nin,
    bvn,
    status: "pending",
    submittedAt: Date.now(),
  });

  return { success: true };
}

async function approveKyc(uid, adminUid) {
  const user = await userRepo.findById(uid);
  if (!user) throw new Error("User not found");

  await userRepo.update(uid, { kycStatus: "verified" });
  await cache.del(CACHE_KEYS.userProfile(uid));

  // Update KYC request record
  const { db } = require("../config/firebase");
  const snap = await db.collection(COLLECTIONS.KYC_REQUESTS)
    .where("uid", "==", uid)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!snap.empty) {
    await snap.docs[0].ref.update({ status: "approved", reviewedBy: adminUid, reviewedAt: Date.now() });
  }

  // Adjust trust score
  await adjustTrustScore(uid, "kyc_verified");

  // Notify + Email (fire and forget)
  Promise.all([
    notify.kycApproved(uid),
    emailService.kycApprovedEmail(user),
  ]).catch((e) => logger.warn("KYC approved notification error:", e.message));
}

async function rejectKyc(uid, reason, adminUid) {
  const user = await userRepo.findById(uid);
  if (!user) throw new Error("User not found");

  await userRepo.update(uid, { kycStatus: "rejected" });
  await cache.del(CACHE_KEYS.userProfile(uid));

  const snap = await db.collection(COLLECTIONS.KYC_REQUESTS)
    .where("uid", "==", uid)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!snap.empty) {
    await snap.docs[0].ref.update({ status: "rejected", reason, reviewedBy: adminUid, reviewedAt: Date.now() });
  }

  Promise.all([
    notify.kycRejected(uid),
    emailService.kycRejectedEmail(user, reason),
  ]).catch((e) => logger.warn("KYC rejected notification error:", e.message));
}

module.exports = { submitKyc, approveKyc, rejectKyc, isNinBanned, isBvnBanned };