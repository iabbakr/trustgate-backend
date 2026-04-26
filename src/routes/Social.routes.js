const express = require("express");
const router = express.Router();

const socialController = require("../controllers/social.controller");
const { requireAuth } = require("../middleware/auth");

// POST /api/v1/social/follow/:uid
router.post("/follow/:uid", requireAuth, socialController.follow);

// DELETE /api/v1/social/follow/:uid
router.delete("/follow/:uid", requireAuth, socialController.unfollow);

// GET /api/v1/social/following-status/:uid
router.get("/following-status/:uid", requireAuth, socialController.followingStatus);

// GET /api/v1/social/:uid/followers
router.get("/:uid/followers", requireAuth, socialController.getFollowers);

// GET /api/v1/social/:uid/following
router.get("/:uid/following", requireAuth, socialController.getFollowing);

module.exports = router;