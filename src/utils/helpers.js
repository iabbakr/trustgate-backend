const crypto = require("crypto");

function generateReferralCode(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generateId() {
  return crypto.randomUUID();
}

function maskSensitive(value = "") {
  if (!value) return "";
  return "***" + String(value).slice(-4);
}

function sanitizeUser(profile) {
  if (!profile) return null;
  const { nin, bvn, ...safe } = profile;
  return safe;
}

function verifyPaystackWebhook(body, signature) {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_WEBHOOK_SECRET || "")
    .update(JSON.stringify(body))
    .digest("hex");
  return hash === signature;
}

function paginate(query, page = 1, limit = 20) {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const safePage = Math.max(parseInt(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;
  return { limit: safeLimit, offset, page: safePage };
}

function computeTrustScoreDelta(event) {
  const deltas = {
    kyc_verified: 20,
    good_rating: 2,
    bad_rating: -5,
    transaction_completed: 3,
    theft_report_on_user: -20,
    account_pardoned: 5,
  };
  return deltas[event] || 0;
}

module.exports = {
  generateReferralCode,
  generateId,
  maskSensitive,
  sanitizeUser,
  verifyPaystackWebhook,
  paginate,
  computeTrustScoreDelta,
};