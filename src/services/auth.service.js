const { auth, db } = require("../config/firebase");
const userRepo = require("../repositories/user.repository");
const cache = require("./cache.service");
const { CACHE_KEYS, TTL, COLLECTIONS } = require("../utils/constants");
const { generateReferralCode } = require("../utils/helpers");
const emailService = require("./email.service");
const logger = require("../utils/logger");

/**
 * Verify a Firebase ID token and return the decoded payload.
 * Results are cached for 5 minutes to cut Firebase Auth read costs.
 */
async function verifyToken(idToken) {
  const cacheKey = `tg:token:${idToken.slice(-20)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const decoded = await auth.verifyIdToken(idToken, true /* checkRevoked */);
  await cache.set(cacheKey, decoded, 300); // 5 min
  return decoded;
}

/**
 * Register a new user in Firebase Auth + Firestore.
 * Called by the mobile app ONLY — the app uses Firebase SDK for Auth,
 * then calls this endpoint to create the Firestore profile.
 */
async function createProfile(uid, data) {
  const existing = await userRepo.findById(uid);
  if (existing) return existing;

  const referralCode = generateReferralCode(8);

  const profile = {
    uid,
    email: data.email || null,
    displayName: data.displayName || null,
    phoneNumber: data.phoneNumber || null,
    photoURL: data.photoURL || null,
    role: "user",
    status: "pending",
    emailVerified: false,
    phoneVerified: false,
    kycStatus: "none",
    trustScore: 50,
    rating: 0,
    ratingCount: 0,
    badRatingCount: 0,
    isFlagged: false,
    shopName: data.shopName || null,
    shopNumber: data.shopNumber || null,
    state: data.state || null,
    city: data.city || null,
    area: data.area || null,
    nin: null,
    bvn: null,
    referralCode,
    referredBy: data.referredBy || null,
    followerCount: 0,
    followingCount: 0,
    createdAt: Date.now(),
  };

  await userRepo.create(uid, profile);

  // If referred, note it
  if (data.referredBy) {
    const referrer = await userRepo.findByReferralCode(data.referredBy);
    if (referrer) {
      await db.collection("referrals").add({
        referrerId: referrer.uid,
        referredUid: uid,
        createdAt: Date.now(),
      });
    }
  }

  // Welcome email (async, don't block response)
  emailService.welcomeEmail(profile).catch((e) =>
    logger.warn(`Welcome email failed for ${uid}: ${e.message}`)
  );

  return profile;
}

async function validateReferralCode(code) {
  return cache.wrap(CACHE_KEYS.referralCode(code), TTL.REFERRAL_CODE, () =>
    userRepo.findByReferralCode(code)
  );
}

module.exports = { verifyToken, createProfile, validateReferralCode };