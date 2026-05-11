/**
 * services/otp.service.js
 *
 * Email OTP for two purposes:
 *   "verify" (default) — post-registration email verification
 *   "reset"            — forgot-password flow
 *
 * Keys are namespaced by purpose so codes never cross-contaminate.
 */

const cache       = require("./cache.service");
const { sendEmail } = require("./email.service");
const logger      = require("../utils/logger");

const OTP_TTL      = 10 * 60; // 10 minutes
const MAX_ATTEMPTS = 3;

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpKey(email, purpose = "verify") {
  return `tg:otp:${purpose}:${email.toLowerCase()}`;
}

function attemptsKey(email, purpose = "verify") {
  return `tg:otp:attempts:${purpose}:${email.toLowerCase()}`;
}

function cooldownKey(email, purpose = "verify") {
  return `tg:otp:cooldown:${purpose}:${email.toLowerCase()}`;
}

/**
 * Generate and email an OTP.
 * @param {string} email
 * @param {string} displayName
 * @param {"verify"|"reset"} purpose
 */
async function sendOTP(email, displayName, purpose = "verify") {
  const otp = generateOTP();
  await cache.set(otpKey(email, purpose), otp, OTP_TTL);
  await cache.del(attemptsKey(email, purpose));

  const isReset   = purpose === "reset";
  const subject   = isReset ? "Reset Your TrustGate Password" : "Your TrustGate Verification Code";
  const heading   = isReset ? "Password Reset Code" : "Email Verification";
  const bodyLine  = isReset
    ? `Hi ${displayName || "there"},<br>Use the code below to reset your password.`
    : `Hi ${displayName || "there"},<br>Enter this code in the app to verify your email address.`;
  const footNote  = isReset
    ? "This code expires in <strong>10 minutes</strong>.<br>If you didn't request a password reset, ignore this email."
    : "This code expires in <strong>10 minutes</strong>.<br>If you didn't request this, ignore this email.";

  await sendEmail({
    to: email,
    subject,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8fafc;">
        <div style="background:#1e40af;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">🛡️ TrustGate</h1>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;text-align:center;">
          <h2 style="color:#1e293b;margin-bottom:8px;">${heading}</h2>
          <p style="color:#64748b;margin-bottom:24px;">${bodyLine}</p>
          <div style="background:#f1f5f9;border-radius:12px;padding:24px;margin:0 auto 24px;display:inline-block;">
            <span style="font-size:42px;font-weight:700;letter-spacing:10px;color:#1e40af;">${otp}</span>
          </div>
          <p style="color:#94a3b8;font-size:13px;">${footNote}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
          <p style="color:#94a3b8;font-size:11px;">TrustGate — Nigeria's Trusted Dealer Network</p>
        </div>
      </div>
    `,
  });

  logger.info(`[otp] ${purpose} OTP sent to ${email}`);
  return true;
}

/**
 * Verify an OTP.
 * @param {string} email
 * @param {string} inputOtp
 * @param {"verify"|"reset"} purpose
 */
async function verifyOTP(email, inputOtp, purpose = "verify") {
  const storedOtp = await cache.get(otpKey(email, purpose));

  if (!storedOtp) {
    return { valid: false, error: "Code has expired or was never sent. Request a new code." };
  }

  const attemptsRaw = await cache.get(attemptsKey(email, purpose));
  const attempts    = attemptsRaw ? parseInt(attemptsRaw) : 0;

  if (attempts >= MAX_ATTEMPTS) {
    await cache.del(otpKey(email, purpose));
    await cache.del(attemptsKey(email, purpose));
    return { valid: false, error: "Too many failed attempts. Please request a new code." };
  }

  if (storedOtp !== String(inputOtp).trim()) {
    await cache.set(attemptsKey(email, purpose), String(attempts + 1), OTP_TTL);
    const remaining = MAX_ATTEMPTS - attempts - 1;
    return { valid: false, error: `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.` };
  }

  // Valid — clean up
  await cache.del(otpKey(email, purpose));
  await cache.del(attemptsKey(email, purpose));
  return { valid: true };
}

/**
 * Resend OTP with 60 s cooldown.
 */
async function resendOTP(email, displayName, purpose = "verify") {
  const ck       = cooldownKey(email, purpose);
  const onCooldown = await cache.get(ck);
  if (onCooldown) {
    return { sent: false, error: "Please wait 60 seconds before requesting a new code." };
  }
  await cache.set(ck, "1", 60);
  await sendOTP(email, displayName, purpose);
  return { sent: true };
}

module.exports = { sendOTP, verifyOTP, resendOTP };