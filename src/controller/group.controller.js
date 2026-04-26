const groupService = require("../services/group.service");

async function getGroups(req, res, next) {
  try {
    const groups = await groupService.getAvailableGroups(req.profile);
    res.json({ success: true, data: groups });
  } catch (err) {
    next(err);
  }
}

async function createGroup(req, res, next) {
  try {
    const group = await groupService.createGroup(req.body, req.user.uid);
    res.status(201).json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
}

async function joinGroup(req, res, next) {
  try {
    const group = await groupService.joinGroup(req.params.id, req.user.uid);
    res.json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
}

async function leaveGroup(req, res, next) {
  try {
    await groupService.leaveGroup(req.params.id, req.user.uid);
    res.json({ success: true, message: "Left group" });
  } catch (err) {
    next(err);
  }
}

async function deleteGroup(req, res, next) {
  try {
    await groupService.deleteGroup(req.params.id);
    res.json({ success: true, message: "Group deleted" });
  } catch (err) {
    next(err);
  }
}

async function getPosts(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const posts = await groupService.getGroupPosts(req.params.id, page);
    res.json({ success: true, data: posts, page });
  } catch (err) {
    next(err);
  }
}

async function createPost(req, res, next) {
  try {
    const post = await groupService.createPost(req.params.id, req.user.uid, {
      groupId: req.params.id,
      authorId: req.user.uid,
      authorName: req.profile.displayName,
      authorShop: req.profile.shopName,
      text: req.body.text,
      imageUrl: req.body.imageUrl || null,
      createdAt: Date.now(),
    });
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

async function toggleLike(req, res, next) {
  try {
    const { liked } = req.body;
    await groupService.togglePostLike(req.params.groupId, req.params.postId, req.user.uid, liked);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function deletePost(req, res, next) {
  try {
    await groupService.deletePost(req.params.groupId, req.params.postId, req.user.uid);
    res.json({ success: true, message: "Post deleted" });
  } catch (err) {
    next(err);
  }
}

module.exports = { getGroups, createGroup, joinGroup, leaveGroup, deleteGroup, getPosts, createPost, toggleLike, deletePost };