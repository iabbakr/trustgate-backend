const express = require("express");
const router = express.Router();

const kycController = require("../controller/kyc.controller");
const { requireAuth } = require("../middleware/auth");
const { kycLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validate");
const schemas = require("../utils/schemas");
const { avatarUpload, documentUpload } = require("../middleware/upload");
const uploadService = require("../services/upload.service");

// GET  /api/v1/kyc/status
router.get("/status", requireAuth, kycController.getKycStatus);

// POST /api/v1/kyc/submit  — NIN + BVN text data
router.post("/submit", requireAuth, kycLimiter, validate(schemas.submitKyc), kycController.submitKyc);

// POST /api/v1/kyc/document  — upload KYC image doc (NIN card, etc.)
router.post("/document", requireAuth, kycLimiter, documentUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });
    const url = await uploadService.uploadKycDocument(req.user.uid, req.query.type || "id", req.file.buffer);
    res.json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;