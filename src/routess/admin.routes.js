const express = require("express");
const router = express.Router();

const adminController = require("../controller/admin.controller");
const { requireAuth } = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");

// All admin routes require auth + admin role
router.use(requireAuth, adminOnly);

// ── Users ─────────────────────────────────────────────────────────────────────
router.get("/users/pending", adminController.getPendingUsers);
router.get("/users/flagged", adminController.getFlaggedUsers);
router.get("/users/banned", adminController.getBannedUsers);
router.post("/users/:uid/approve", adminController.approveUser);
router.post("/users/:uid/ban", adminController.banUser);
router.post("/users/:uid/pardon", adminController.pardonUser);
router.post("/users/:uid/suspend", adminController.suspendUser);

// ── KYC ───────────────────────────────────────────────────────────────────────
router.get("/kyc/pending", adminController.getPendingKyc);
router.post("/kyc/:uid/approve", adminController.approveKyc);
router.post("/kyc/:uid/reject", adminController.rejectKyc);

// ── Devices ───────────────────────────────────────────────────────────────────
router.get("/devices", adminController.getAllDevices);
router.delete("/devices/:id", adminController.deleteDevice);

// ── Dashboard stats ───────────────────────────────────────────────────────────
router.get("/stats", adminController.getStats);

module.exports = router;