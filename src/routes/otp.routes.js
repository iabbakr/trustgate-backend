// src/routes/otp.routes.js
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const otpController = require("../controllers/otp.controller");

// POST /api/v1/otp/send    — send OTP to the logged-in user's email
router.post("/send", requireAuth, authLimiter, otpController.sendOTP);

// POST /api/v1/otp/verify  — verify OTP code
router.post("/verify", requireAuth, authLimiter, otpController.verifyOTP);

// POST /api/v1/otp/resend  — resend OTP (60s cooldown)
router.post("/resend", requireAuth, authLimiter, otpController.resendOTP);

module.exports = router;