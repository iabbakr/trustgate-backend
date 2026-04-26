const express = require("express");
const router = express.Router();

const groupController = require("../controller/group.controller");
const { requireAuth } = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");
const validate = require("../middleware/validate");
const schemas = require("../utils/schemas");

// GET  /api/v1/groups
router.get("/", requireAuth, groupController.getGroups);

// POST /api/v1/groups  (admin only)
router.post("/", requireAuth, adminOnly, validate(schemas.createGroup), groupController.createGroup);

// POST /api/v1/groups/:id/join
router.post("/:id/join", requireAuth, groupController.joinGroup);

// DELETE /api/v1/groups/:id/leave
router.delete("/:id/leave", requireAuth, groupController.leaveGroup);

// DELETE /api/v1/groups/:id  (admin only)
router.delete("/:id", requireAuth, adminOnly, groupController.deleteGroup);

// ── Posts ─────────────────────────────────────────────────────────────────────
// GET  /api/v1/groups/:id/posts?page=
router.get("/:id/posts", requireAuth, groupController.getPosts);

// POST /api/v1/groups/:id/posts
router.post("/:id/posts", requireAuth, validate(schemas.createPost), groupController.createPost);

// POST /api/v1/groups/:groupId/posts/:postId/like
router.post("/:groupId/posts/:postId/like", requireAuth, groupController.toggleLike);

// DELETE /api/v1/groups/:groupId/posts/:postId
router.delete("/:groupId/posts/:postId", requireAuth, groupController.deletePost);

module.exports = router;