const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const { uploadLimiter } = require("../middleware/rateLimiter");
const { avatarUpload, postImageUpload, documentUpload, videoUpload } = require("../middleware/upload");
const uploadService = require("../services/upload.service");
const userService = require("../services/user.service");

// POST /api/v1/upload/avatar
router.post("/avatar", requireAuth, uploadLimiter, avatarUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });
    const url = await uploadService.uploadAvatar(req.user.uid, req.file.buffer);
    await userService.updateUserProfile(req.user.uid, { photoURL: url });
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
});

// POST /api/v1/upload/post-image
router.post("/post-image", requireAuth, uploadLimiter, postImageUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });
    const groupId = req.query.groupId || "general";
    const url = await uploadService.uploadGroupPostImage(groupId, req.file.buffer);
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
});

// POST /api/v1/upload/chat-image
router.post("/chat-image", requireAuth, uploadLimiter, postImageUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });
    const result = await uploadService.uploadChatImage(req.user.uid, req.file.buffer);
    res.json({
      success: true,
      data: {
        url: result.secure_url,
        type: "image",
        name: req.file.originalname || "image.jpg",
        mimeType: req.file.mimetype,
        width: result.width,
        height: result.height,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/v1/upload/chat-video  (max 50MB, 60s)
router.post("/chat-video", requireAuth, uploadLimiter, videoUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });
    const result = await uploadService.uploadChatVideo(req.user.uid, req.file.buffer);
    // Cloudinary auto-generates thumbnail at second 0
    const thumbnailUrl = result.secure_url
      .replace("/upload/", "/upload/so_0,f_jpg/")
      .replace(/\.\w+$/, ".jpg");
    res.json({
      success: true,
      data: {
        url: result.secure_url,
        type: "video",
        name: req.file.originalname || "video.mp4",
        mimeType: req.file.mimetype,
        duration: result.duration,
        thumbnailUrl,
        width: result.width,
        height: result.height,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/v1/upload/chat-file  (PDF, doc, etc.)
router.post("/chat-file", requireAuth, uploadLimiter, documentUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });
    const fileName = req.query.name || req.file.originalname || "file";
    const result = await uploadService.uploadChatFile(req.user.uid, req.file.buffer, fileName);
    res.json({
      success: true,
      data: {
        url: result.secure_url,
        type: "file",
        name: fileName,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;