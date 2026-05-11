/**
 * controllers/otp.controller.js
 *
 * Handles both:
 *  - Authenticated OTP (post-registration email verification)
 *  - Public forgot-password OTP flow
 */

const otpService  = require("../services/otp.service");
const userRepo    = require("../repositories/user.repository");
const cache       = require("../services/cache.service");
const logger      = require("../utils/logger");
const crypto      = require("crypto");

// ── Authenticated OTP ─────────────────────────────────────────────────────────

async function sendOTP(req, res, next) {
  try {
    const { uid } = req.user;
    const profile = req.profile || await userRepo.findById(uid);
    if (!profile?.email) {
      return res.status(400).json({ success: false, error: "No email on file" });
    }
    await otpService.sendOTP(profile.email, profile.displayName);
    res.json({ success: true, message: "Verification code sent to your email" });
  } catch (err) {
    next(err);
  }
}

async function verifyOTP(req, res, next) {
  try {
    const { code } = req.body;
    const { uid }  = req.user;
    const profile  = req.profile || await userRepo.findById(uid);

    if (!profile?.email) {
      return res.status(400).json({ success: false, error: "No email on file" });
    }

    const result = await otpService.verifyOTP(profile.email, code);
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Mark email as verified in Firestore
    await userRepo.update(uid, { emailVerified: true });

    res.json({ success: true, message: "Email verified successfully" });
  } catch (err) {
    next(err);
  }
}

async function resendOTP(req, res, next) {
  try {
    const { uid } = req.user;
    const profile = req.profile || await userRepo.findById(uid);
    if (!profile?.email) {
      return res.status(400).json({ success: false, error: "No email on file" });
    }
    const result = await otpService.resendOTP(profile.email, profile.displayName);
    if (!result.sent) {
      return res.status(429).json({ success: false, error: result.error });
    }
    res.json({ success: true, message: "New verification code sent" });
  } catch (err) {
    next(err);
  }
}

// ── Forgot-password OTP (public, no Firebase token) ───────────────────────────

/**
 * POST /api/v1/otp/forgot-password/send
 * body: { email }
 *
 * Silently succeeds even if email doesn't exist (prevents enumeration).
 */
async function sendForgotPasswordOTP(req, res, next) {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: "Valid email is required" });
    }

    const user = await userRepo.findByEmail(email.toLowerCase().trim());

    // Always respond OK to prevent account enumeration
    if (!user) {
      return res.json({ success: true, message: "If that email exists, a reset code has been sent" });
    }

    if (user.status === "banned") {
      return res.json({ success: true, message: "If that email exists, a reset code has been sent" });
    }

    await otpService.sendOTP(user.email, user.displayName, "reset");
    logger.info(`[otp] forgot-password OTP sent to ${email}`);

    res.json({ success: true, message: "If that email exists, a reset code has been sent" });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/otp/forgot-password/verify
 * body: { email, code }
 *
 * Returns a short-lived resetToken (UUID stored in Redis for 15 min).
 */
async function verifyForgotPasswordOTP(req, res, next) {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, error: "email and code are required" });
    }

    const result = await otpService.verifyOTP(email.toLowerCase().trim(), code, "reset");
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Issue a short-lived reset token
    const resetToken = crypto.randomUUID();
    const tokenKey   = `tg:pwreset:${resetToken}`;
    await cache.set(tokenKey, email.toLowerCase().trim(), 15 * 60); // 15 min

    res.json({ success: true, resetToken });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/otp/forgot-password/reset
 * body: { resetToken, newPassword }
 *
 * Updates the user's password in Firebase Auth.
 */
async function resetPassword(req, res, next) {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, error: "resetToken and newPassword are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
    }

    const tokenKey = `tg:pwreset:${resetToken}`;
    const email    = await cache.get(tokenKey);

    if (!email) {
      return res.status(400).json({ success: false, error: "Reset token is invalid or has expired. Please start over." });
    }

    const user = await userRepo.findByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, error: "Account not found" });
    }

    // Update password via Firebase Admin SDK
    const { auth } = require("../config/firebase");
    await auth.updateUser(user.uid, { password: newPassword });

    // Invalidate reset token immediately
    await cache.del(tokenKey);

    logger.info(`[otp] password reset for ${email}`);
    res.json({ success: true, message: "Password updated successfully. Please sign in." });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sendOTP,
  verifyOTP,
  resendOTP,
  sendForgotPasswordOTP,
  verifyForgotPasswordOTP,
  resetPassword,
};