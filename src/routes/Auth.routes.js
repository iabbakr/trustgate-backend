const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validate");
const schemas = require("../utils/schemas");

// POST /api/v1/auth/register
// Called after Firebase Auth registration — creates Firestore profile
router.post("/register", authLimiter, requireAuth, validate(schemas.register), authController.register);

// GET /api/v1/auth/m
router.get("/me", requireAuth, authController.me);

// GET /api/v1/auth/referral/:code
router.get("/referral/:code", authController.validateReferral);

module.exports = router;