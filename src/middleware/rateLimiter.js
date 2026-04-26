const rateLimit = require("express-rate-limit");
const { getRedisClient } = require("../config/redis");

function createLimiter(windowMs, max, message) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: message || "Too many requests. Please try again later." },
    // Use Redis store if available, otherwise in-memory
    skip: () => process.env.NODE_ENV === "test",
  });
}

// Global: 100 req per 15 min per IP
const globalLimiter = createLimiter(15 * 60 * 1000, 100);

// Auth: 10 attempts per 15 min (prevent brute force)
const authLimiter = createLimiter(15 * 60 * 1000, 10, "Too many login attempts. Try again in 15 minutes.");

// Device check: 30 per minute (free tier protection)
const deviceCheckLimiter = createLimiter(60 * 1000, 30, "Too many device checks.");

// Upload: 20 per hour
const uploadLimiter = createLimiter(60 * 60 * 1000, 20, "Upload limit reached. Try again later.");

// KYC: 5 submissions per day
const kycLimiter = createLimiter(24 * 60 * 60 * 1000, 5, "KYC submission limit reached.");

module.exports = { globalLimiter, authLimiter, deviceCheckLimiter, uploadLimiter, kycLimiter };