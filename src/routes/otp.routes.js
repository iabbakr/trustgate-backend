// src/routes/otp.routes.js
const express  = require("express");
const router   = express.Router();
const { requireAuth } = require("../middleware/auth");
const { authLimiter }  = require("../middleware/rateLimiter");
const otpController    = require("../controllers/otp.controller");

// ── Authenticated OTP (post-registration email verification) ──────────────────

// POST /api/v1/otp/send    — send OTP to the logged-in user's email
router.post("/send",   requireAuth, authLimiter, otpController.sendOTP);

// POST /api/v1/otp/verify  — verify OTP code for logged-in user
router.post("/verify", requireAuth, authLimiter, otpController.verifyOTP);

// POST /api/v1/otp/resend  — resend OTP (60 s cooldown)
router.post("/resend", requireAuth, authLimiter, otpController.resendOTP);

// ── Public forgot-password OTP flow (no Firebase token required) ──────────────

// POST /api/v1/otp/forgot-password/send
//   body: { email }
//   Sends a 6-digit reset code to the supplied email if it exists.
router.post("/forgot-password/send",   authLimiter, otpController.sendForgotPasswordOTP);

// POST /api/v1/otp/forgot-password/verify
//   body: { email, code }
//   Returns { resetToken } if valid; token is short-lived (15 min).
router.post("/forgot-password/verify", authLimiter, otpController.verifyForgotPasswordOTP);

// POST /api/v1/otp/forgot-password/reset
//   body: { resetToken, newPassword }
//   Updates password in Firebase Auth and clears the reset token.
router.post("/forgot-password/reset",  authLimiter, otpController.resetPassword);

module.exports = router;