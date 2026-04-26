const express = require("express");
const router = express.Router();

const chatController = require("../controller/chat.controller");
const { requireAuth } = require("../middleware/auth");

// POST /api/v1/chat/conversations
router.post("/conversations", requireAuth, chatController.getOrCreateConversation);

// GET  /api/v1/chat/conversations
router.get("/conversations", requireAuth, chatController.getConversations);

// GET  /api/v1/chat/conversations/:id/messages
router.get("/conversations/:id/messages", requireAuth, chatController.getMessages);

// POST /api/v1/chat/conversations/:id/messages
router.post("/conversations/:id/messages", requireAuth, chatController.sendMessage);

// PATCH /api/v1/chat/conversations/:id/accept
router.patch("/conversations/:id/accept", requireAuth, chatController.acceptRequest);

module.exports = router;