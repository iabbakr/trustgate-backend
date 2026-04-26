const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const { uploadLimiter } = require("../middleware/rateLimiter");
const { avatarUpload, postImageUpload } = require("../middleware/upload");
const uploadService = require("../services/upload.service");
const userService = require("../services/user.service");

// POST /api/v1/upload/avatar
router.post("/avatar", requireAuth, uploadLimiter, avatarUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });
    const url = await uploadService.uploadAvatar(req.user.uid, req.file.buffer);
    // Persist URL to user profile
    await userService.updateUserProfile(req.user.uid, { photoURL: url });
    res.json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/upload/post-image
router.post("/post-image", requireAuth, uploadLimiter, postImageUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });
    const groupId = req.query.groupId || "general";
    const url = await uploadService.uploadGroupPostImage(groupId, req.file.buffer);
    res.json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;