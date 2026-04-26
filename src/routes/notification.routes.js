const express = require("express");
const router = express.Router();

const notificationController = require("../controller/notification.controller");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const schemas = require("../utils/schemas");

// GET  /api/v1/notifications
router.get("/", requireAuth, notificationController.getNotifications);

// PATCH /api/v1/notifications/:id/read
router.patch("/:id/read", requireAuth, notificationController.markRead);

// PATCH /api/v1/notifications/read-all
router.patch("/read-all", requireAuth, notificationController.markAllRead);

// POST /api/v1/notifications/push-token
router.post(
  "/push-token",
  requireAuth,
  validate(schemas.registerPushToken),
  notificationController.registerPushToken
);

module.exports = router;