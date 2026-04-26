const kycService = require("../services/kyc.service");

async function submitKyc(req, res, next) {
  try {
    const { nin, bvn } = req.body;
    const result = await kycService.submitKyc(req.user.uid, nin, bvn);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message, code: result.error });
    }
    res.json({ success: true, message: "KYC submitted successfully. Under review." });
  } catch (err) {
    next(err);
  }
}

async function getKycStatus(req, res, next) {
  try {
    const profile = req.profile;
    res.json({
      success: true,
      data: {
        kycStatus: profile.kycStatus,
        nin: profile.nin ? "***" + profile.nin.slice(-4) : null,
        bvn: profile.bvn ? "***" + profile.bvn.slice(-4) : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { submitKyc, getKycStatus };