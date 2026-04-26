const userService = require("../services/user.service");

async function getProfile(req, res, next) {
  try {
    const { uid } = req.params;
    const profile = await userService.getPublicProfile(uid);
    if (!profile) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    await userService.updateUserProfile(req.user.uid, req.body);
    const updated = await userService.getUserProfile(req.user.uid);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function searchUsers(req, res, next) {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ success: true, data: [] });
    const results = await userService.searchUsers(q.trim());
    const filtered = results.filter((u) => u.uid !== req.user.uid);
    res.json({ success: true, data: filtered });
  } catch (err) {
    next(err);
  }
}

async function getNearbyUsers(req, res, next) {
  try {
    const area = req.profile.area;
    if (!area) return res.json({ success: true, data: [] });
    const users = await userService.getNearbyUsers(area, req.user.uid);
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

async function submitRating(req, res, next) {
  try {
    const { ratedId, score, transactionId, comment } = req.body;
    if (ratedId === req.user.uid) return res.status(400).json({ success: false, error: "Cannot rate yourself" });

    const result = await userService.applyRating(
      ratedId,
      score,
      transactionId,
      req.user.uid,
      req.profile.displayName,
      comment
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile, searchUsers, getNearbyUsers, submitRating };