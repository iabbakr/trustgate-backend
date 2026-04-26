// src/controllers/otp.controller.js
const otpService = require("../services/otp.service");
const userRepo = require("../repositories/user.repository");
const cache = require("../services/cache.service");
const { CACHE_KEYS } = require("../utils/constants");
const logger = require("../utils/logger");

async function sendOTP(req, res, next) {
  try {
    const { email, displayName } = req.profile;
    if (!email) return res.status(400).json({ success: false, error: "No email on profile" });

    if (req.profile.emailVerified) {
      return res.json({ success: true, message: "Email already verified" });
    }

    await otpService.sendOTP(email, displayName);
    res.json({ success: true, message: `Verification code sent to ${email}` });
  } catch (err) {
    next(err);
  }
}

async function verifyOTP(req, res, next) {
  try {
    const { code } = req.body;
    if (!code) return res.status(422).json({ success: false, error: "Code is required" });

    const { email } = req.profile;
    const result = await otpService.verifyOTP(email, code);

    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Mark email as verified on user profile
    await userRepo.update(req.user.uid, { emailVerified: true });
    await cache.del(CACHE_KEYS.userProfile(req.user.uid));

    logger.info(`Email verified for ${email}`);
    res.json({ success: true, message: "Email verified successfully" });
  } catch (err) {
    next(err);
  }
}

async function resendOTP(req, res, next) {
  try {
    const { email, displayName } = req.profile;
    const result = await otpService.resendOTP(email, displayName);

    if (!result.sent) {
      return res.status(429).json({ success: false, error: result.error });
    }

    res.json({ success: true, message: "New verification code sent" });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendOTP, verifyOTP, resendOTP };