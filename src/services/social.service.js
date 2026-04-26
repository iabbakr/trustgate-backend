const { db, admin } = require("../config/firebase");
const userRepo = require("../repositories/user.repository");
const cache = require("./cache.service");
const { CACHE_KEYS, TTL, COLLECTIONS } = require("../utils/constants");
const { notify } = require("./notification.service");

function followDocId(followerId, followingId) {
  return `${followerId}_${followingId}`;
}

async function followUser(followerId, followingId) {
  if (followerId === followingId) throw new Error("Cannot follow yourself");

  const docId = followDocId(followerId, followingId);
  const ref = db.collection(COLLECTIONS.FOLLOWS).doc(docId);
  const snap = await ref.get();
  if (snap.exists) return; // already following

  await ref.set({ followerId, followingId, createdAt: Date.now() });
  await Promise.all([
    userRepo.increment(followerId, "followingCount"),
    userRepo.increment(followingId, "followerCount"),
  ]);

  await Promise.all([
    cache.del(CACHE_KEYS.userProfile(followerId)),
    cache.del(CACHE_KEYS.userProfile(followingId)),
  ]);

  const follower = await userRepo.findById(followerId);
  notify.newFollower(followingId, follower?.displayName || "Someone").catch(() => {});
}

async function unfollowUser(followerId, followingId) {
  const docId = followDocId(followerId, followingId);
  const ref = db.collection(COLLECTIONS.FOLLOWS).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return;

  await ref.delete();
  await Promise.all([
    userRepo.increment(followerId, "followingCount", -1),
    userRepo.increment(followingId, "followerCount", -1),
  ]);

  await Promise.all([
    cache.del(CACHE_KEYS.userProfile(followerId)),
    cache.del(CACHE_KEYS.userProfile(followingId)),
  ]);
}

async function isFollowing(followerId, followingId) {
  const cacheKey = `tg:following:${followerId}:${followingId}`;
  const cached = await cache.get(cacheKey);
  if (cached !== null) return cached;

  const snap = await db.collection(COLLECTIONS.FOLLOWS).doc(followDocId(followerId, followingId)).get();
  const result = snap.exists;
  await cache.set(cacheKey, result, 60);
  return result;
}

async function areMutualFollowers(uid1, uid2) {
  const [f1, f2] = await Promise.all([isFollowing(uid1, uid2), isFollowing(uid2, uid1)]);
  return f1 && f2;
}

async function getFollowers(uid, limit = 50) {
  const snap = await db.collection(COLLECTIONS.FOLLOWS)
    .where("followingId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data());
}

async function getFollowing(uid, limit = 50) {
  const snap = await db.collection(COLLECTIONS.FOLLOWS)
    .where("followerId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data());
}

module.exports = { followUser, unfollowUser, isFollowing, areMutualFollowers, getFollowers, getFollowing };