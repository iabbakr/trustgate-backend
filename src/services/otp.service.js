/**
 * otp.service.js
 *
 * Email OTP verification using Redis for temporary storage.
 * OTPs expire after 10 minutes. Max 3 attempts per OTP before invalidation.
 *
 * Flow:
 *   1. User registers → backend sends OTP email
 *   2. User enters 6-digit code in app
 *   3. Backend verifies OTP → marks emailVerified: true on user profile
 */

const cache = require("./cache.service");
const { sendEmail } = require("./email.service");
const logger = require("../utils/logger");

const OTP_TTL = 10 * 60; // 10 minutes
const MAX_ATTEMPTS = 3;

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

function otpKey(email) {
  return `tg:otp:${email.toLowerCase()}`;
}

function attemptsKey(email) {
  return `tg:otp:attempts:${email.toLowerCase()}`;
}

/**
 * Generate and send an OTP to the given email.
 * Replaces any existing OTP for this email.
 */
async function sendOTP(email, displayName) {
  const otp = generateOTP();

  // Store OTP in Redis with TTL
  await cache.set(otpKey(email), otp, OTP_TTL);
  // Reset attempts
  await cache.del(attemptsKey(email));

  // Send email
  await sendEmail({
    to: email,
    subject: "Your TrustGate Verification Code",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8fafc;">
        <div style="background:#1e40af;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">🛡️ TrustGate</h1>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;text-align:center;">
          <h2 style="color:#1e293b;margin-bottom:8px;">Email Verification</h2>
          <p style="color:#64748b;margin-bottom:24px;">Hi ${displayName || "there"},<br>Enter this code in the app to verify your email address.</p>
          <div style="background:#f1f5f9;border-radius:12px;padding:24px;margin:0 auto 24px;display:inline-block;">
            <span style="font-size:42px;font-weight:700;letter-spacing:10px;color:#1e40af;">${otp}</span>
          </div>
          <p style="color:#94a3b8;font-size:13px;">This code expires in <strong>10 minutes</strong>.<br>If you didn't request this, ignore this email.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
          <p style="color:#94a3b8;font-size:11px;">TrustGate — Nigeria's Trusted Dealer Network</p>
        </div>
      </div>
    `,
  });

  logger.info(`OTP sent to ${email}`);
  return true;
}

/**
 * Verify an OTP for the given email.
 * Returns { valid: true } or { valid: false, error: string }
 */
async function verifyOTP(email, inputOtp) {
  const storedOtp = await cache.get(otpKey(email));

  if (!storedOtp) {
    return { valid: false, error: "OTP has expired or was never sent. Request a new code." };
  }

  // Track attempts
  const attemptsRaw = await cache.get(attemptsKey(email));
  const attempts = attemptsRaw ? parseInt(attemptsRaw) : 0;

  if (attempts >= MAX_ATTEMPTS) {
    await cache.del(otpKey(email));
    await cache.del(attemptsKey(email));
    return { valid: false, error: "Too many failed attempts. Please request a new code." };
  }

  if (storedOtp !== String(inputOtp).trim()) {
    await cache.set(attemptsKey(email), String(attempts + 1), OTP_TTL);
    const remaining = MAX_ATTEMPTS - attempts - 1;
    return { valid: false, error: `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.` };
  }

  // Valid — clean up
  await cache.del(otpKey(email));
  await cache.del(attemptsKey(email));

  return { valid: true };
}

/**
 * Resend OTP. Rate-limited by checking if a recent OTP exists.
 */
async function resendOTP(email, displayName) {
  const existing = await cache.get(otpKey(email));
  if (existing) {
    // Allow resend only after 60 seconds (by checking TTL indirectly via a cooldown key)
    const cooldownKey = `tg:otp:cooldown:${email.toLowerCase()}`;
    const onCooldown = await cache.get(cooldownKey);
    if (onCooldown) {
      return { sent: false, error: "Please wait 60 seconds before requesting a new code." };
    }
  }

  // Set 60-second cooldown
  const cooldownKey = `tg:otp:cooldown:${email.toLowerCase()}`;
  await cache.set(cooldownKey, "1", 60);

  await sendOTP(email, displayName);
  return { sent: true };
}

module.exports = { sendOTP, verifyOTP, resendOTP };