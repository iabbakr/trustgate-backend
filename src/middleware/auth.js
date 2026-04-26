const { verifyToken } = require("../services/auth.service");
const userRepo = require("../repositories/user.repository");
const logger = require("../utils/logger");

/**
 * requireAuth — verifies Firebase ID token, attaches user profile to req.
 * All protected routes use this middleware.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: "No token provided" });
  }

  try {
    const decoded = await verifyToken(token);
    const profile = await userRepo.findById(decoded.uid);

    if (!profile) {
      return res.status(401).json({ success: false, error: "User profile not found" });
    }

    if (profile.status === "banned") {
      return res.status(403).json({ success: false, error: "Account banned" });
    }

    req.user = decoded;
    req.profile = profile;
    next();
  } catch (err) {
    logger.warn(`Auth failed: ${err.message}`);
    if (err.code === "auth/id-token-expired") {
      return res.status(401).json({ success: false, error: "Token expired" });
    }
    return res.status(401).json({ success: false, error: "Invalid token" });
  }
}

/**
 * optionalAuth — attaches user if token present, but doesn't block if not.
 */
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

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