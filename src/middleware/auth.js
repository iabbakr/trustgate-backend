const { verifyToken } = require("../services/auth.service");
const userRepo = require("../repositories/user.repository");
const logger = require("../utils/logger");

/**
 * requireAuth — verifies Firebase ID token, attaches user + profile to req.
 *
 * Common failure reasons on Render:
 *  - FIREBASE_PRIVATE_KEY has literal \n instead of newlines → fixed in config/firebase.js
 *  - Token expired (client must refresh every hour)
 *  - Wrong Firebase project
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ success: false, error: "No token provided" });
  }

  try {
    const decoded = await verifyToken(token);
    const profile = await userRepo.findById(decoded.uid);

    if (!profile) {
      // User authenticated with Firebase but has no backend profile yet
      // Allow them through so /auth/register can create one
      req.user = decoded;
      req.profile = null;
      return next();
    }

    if (profile.status === "banned") {
      return res.status(403).json({ success: false, error: "Account banned" });
    }

    req.user = decoded;
    req.profile = profile;
    next();
  } catch (err) {
    logger.warn(`Auth failed: ${err.code || err.message}`);

    if (
      err.code === "auth/id-token-expired" ||
      err.code === "auth/argument-error"
    ) {
      return res.status(401).json({
        success: false,
        error: "Token expired. Please sign in again.",
        code: "TOKEN_EXPIRED",
      });
    }
    if (err.code === "auth/id-token-revoked") {
      return res.status(401).json({
        success: false,
        error: "Token revoked. Please sign in again.",
        code: "TOKEN_REVOKED",
      });
    }
    if (err.code === "auth/invalid-credential") {
      return res.status(401).json({
        success: false,
        error:
          "Firebase credentials misconfigured on server. Check FIREBASE_PRIVATE_KEY env var.",
        code: "SERVER_CONFIG_ERROR",
      });
    }

    return res
      .status(401)
      .json({ success: false, error: "Invalid or malformed token" });
  }
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    req.user = null;
    req.profile = null;
    return next();
  }

  try {
    const decoded = await verifyToken(token);
    const profile = await userRepo.findById(decoded.uid);
    req.user = decoded;
    req.profile = profile;
  } catch {
    req.user = null;
    req.profile = null;
  }
  next();
}

module.exports = { requireAuth, optionalAuth };