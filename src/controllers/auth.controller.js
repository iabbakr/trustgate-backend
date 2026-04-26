const authService = require("../services/auth.service");
const userService = require("../services/user.service");

async function register(req, res, next) {
  try {
    const uid = req.user.uid; // set by requireAuth
    const profile = await authService.createProfile(uid, req.body);
    res.status(201).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const profile = await userService.getUserProfile(req.user.uid);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

async function validateReferral(req, res, next) {
  try {
    const { code } = req.params;
    const referrer = await authService.validateReferralCode(code.toUpperCase());
    if (!referrer) return res.json({ success: true, valid: false });
    res.json({ success: true, valid: true, referrer: { uid: referrer.uid, displayName: referrer.displayName } });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, me, validateReferral };