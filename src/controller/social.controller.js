const socialService = require("../services/social.service");

async function follow(req, res, next) {
  try {
    await socialService.followUser(req.user.uid, req.params.uid);
    res.json({ success: true, message: "Followed" });
  } catch (err) {
    next(err);
  }
}

async function unfollow(req, res, next) {
  try {
    await socialService.unfollowUser(req.user.uid, req.params.uid);
    res.json({ success: true, message: "Unfollowed" });
  } catch (err) {
    next(err);
  }
}

async function followingStatus(req, res, next) {
  try {
    const [isFollowing, isMutual] = await Promise.all([
      socialService.isFollowing(req.user.uid, req.params.uid),
      socialService.areMutualFollowers(req.user.uid, req.params.uid),
    ]);
    res.json({ success: true, data: { isFollowing, isMutual } });
  } catch (err) {
    next(err);
  }
}

async function getFollowers(req, res, next) {
  try {
    const followers = await socialService.getFollowers(req.params.uid);
    res.json({ success: true, data: followers });
  } catch (err) {
    next(err);
  }
}

async function getFollowing(req, res, next) {
  try {
    const following = await socialService.getFollowing(req.params.uid);
    res.json({ success: true, data: following });
  } catch (err) {
    next(err);
  }
}

module.exports = { follow, unfollow, followingStatus, getFollowers, getFollowing };