function adminOnly(req, res, next) {
  if (!req.profile || req.profile.role !== "admin") {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  next();
}

module.exports = adminOnly;

