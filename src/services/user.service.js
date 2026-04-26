const userRepo = require("../repositories/user.repository");
const cache = require("./cache.service");
const { CACHE_KEYS, TTL } = require("../utils/constants");
const { sanitizeUser, generateReferralCode, computeTrustScoreDelta } = require("../utils/helpers");
const logger = require("../utils/logger");

async function getUserProfile(uid) {
  return cache.wrap(CACHE_KEYS.userProfile(uid), TTL.USER_PROFILE, async () => {
    const user = await userRepo.findById(uid);
    return sanitizeUser(user);
  });
}

async function getPublicProfile(uid) {
  const profile = await getUserProfile(uid);
  if (!profile) return null;
  // Strip private fields for public consumption
  const { email, phoneNumber, nin, bvn, ...pub } = profile;
  return pub;
}

async function updateUserProfile(uid, data) {
  await userRepo.update(uid, data);
  await cache.del(CACHE_KEYS.userProfile(uid));
}

async function searchUsers(queryStr) {
  return cache.wrap(
    `tg:search:${queryStr.toLowerCase().slice(0, 20)}`,
    30, // 30s cache for search
    () => userRepo.searchUsers(queryStr)
  );
}

async function getNearbyUsers(area, excludeUid) {
  return cache.wrap(CACHE_KEYS.nearbyUsers(area), TTL.NEARBY_USERS, async () => {
    const users = await userRepo.findByArea(area, 30);
    return users.filter((u) => u.uid !== excludeUid).map(sanitizeUser);
  });
}

async function adjustTrustScore(uid, event) {
  const delta = computeTrustScoreDelta(event);
  if (delta === 0) return;

  const profile = await userRepo.findById(uid);
  if (!profile) return;

  const newScore = Math.max(0, Math.min(100, (profile.trustScore || 50) + delta));
  await userRepo.update(uid, { trustScore: newScore });
  await cache.del(CACHE_KEYS.userProfile(uid));

  logger.info(`Trust score for ${uid}: ${profile.trustScore} → ${newScore} (event: ${event})`);
}

async function applyRating(ratedId, score, transactionId, raterId, raterName, comment) {
  const { db } = require("../config/firebase");
  const { COLLECTIONS } = require("../utils/constants");

  // Record rating
  await db.collection(COLLECTIONS.RATINGS).add({
    raterId,
    raterName,
    ratedId,
    score,
    transactionId,
    comment: comment || null,
    createdAt: Date.now(),
  });

  // Update aggregates atomically
  const profile = await userRepo.findById(ratedId);
  if (!profile) return;

  const oldCount = profile.ratingCount || 0;
  const oldRating = profile.rating || 0;
  const newCount = oldCount + 1;
  const newRating = (oldRating * oldCount + score) / newCount;
  const isBad = score <= 2;
  const badRatingCount = (profile.badRatingCount || 0) + (isBad ? 1 : 0);
  const isFlagged = badRatingCount >= 3;

  const trustDelta = computeTrustScoreDelta(score >= 4 ? "good_rating" : score <= 2 ? "bad_rating" : null);
  const newTrust = Math.max(0, Math.min(100, (profile.trustScore || 50) + trustDelta));

  await userRepo.update(ratedId, {
    rating: Math.round(newRating * 10) / 10,
    ratingCount: newCount,
    badRatingCount,
    isFlagged,
    trustScore: newTrust,
    ...(isFlagged && profile.status === "active" ? { status: "suspended" } : {}),
  });

  await cache.del(CACHE_KEYS.userProfile(ratedId));
  return { isFlagged, newTrust };
}

module.exports = {
  getUserProfile,
  getPublicProfile,
  updateUserProfile,
  searchUsers,
  getNearbyUsers,
  adjustTrustScore,
  applyRating,
};