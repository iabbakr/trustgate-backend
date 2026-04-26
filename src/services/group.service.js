const groupRepo = require("../repositories/group.repository");
const cache = require("./cache.service");
const { CACHE_KEYS, TTL } = require("../utils/constants");

async function getAvailableGroups(profile) {
  return cache.wrap(CACHE_KEYS.groups(profile.uid), TTL.GROUPS, () =>
    groupRepo.findAvailableForUser(profile)
  );
}

async function createGroup(data, creatorUid) {
  const group = await groupRepo.create(null, {
    ...data,
    members: [],
    memberCount: 0,
    createdBy: creatorUid,
  });
  // Invalidate all groups cache (crude but safe)
  await cache.delPattern("tg:groups:*");
  return group;
}

async function joinGroup(groupId, uid) {
  const group = await groupRepo.findById(groupId);
  if (!group) throw new Error("Group not found");
  if (group.members?.includes(uid)) return group;

  await groupRepo.addMember(groupId, uid);
  await cache.del(CACHE_KEYS.groups(uid));
  return groupRepo.findById(groupId);
}

async function leaveGroup(groupId, uid) {
  const group = await groupRepo.findById(groupId);
  if (!group) throw new Error("Group not found");

  await groupRepo.removeMember(groupId, uid);
  await cache.del(CACHE_KEYS.groups(uid));
}

async function deleteGroup(groupId) {
  await groupRepo.delete(groupId);
  await cache.delPattern("tg:groups:*");
}

async function getGroupPosts(groupId, page = 1, limit = 50) {
  const cacheKey = CACHE_KEYS.groupPosts(groupId, page);
  return cache.wrap(cacheKey, TTL.GROUP_POSTS, () => groupRepo.getPosts(groupId, limit));
}

async function createPost(groupId, uid, data) {
  // Verify user is a member
  const group = await groupRepo.findById(groupId);
  if (!group) throw new Error("Group not found");
  if (!group.members?.includes(uid)) throw new Error("Join the group first");

  const post = await groupRepo.createPost(groupId, data);
  await cache.delPattern(`tg:group:${groupId}:posts:*`);
  return post;
}

async function togglePostLike(groupId, postId, uid, liked) {
  await groupRepo.toggleLike(groupId, postId, uid, liked);
  await cache.delPattern(`tg:group:${groupId}:posts:*`);
}

async function deletePost(groupId, postId, requestingUid) {
  await groupRepo.deletePost(groupId, postId);
  await cache.delPattern(`tg:group:${groupId}:posts:*`);
}

module.exports = {
  getAvailableGroups,
  createGroup,
  joinGroup,
  leaveGroup,
  deleteGroup,
  getGroupPosts,
  createPost,
  togglePostLike,
  deletePost,
};