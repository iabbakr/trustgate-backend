const Joi = require("joi");

const nigerianPhone = Joi.string()
  .pattern(/^(\+234|0)[789][01]\d{8}$/)
  .messages({
    "string.pattern.base": "Enter a valid Nigerian phone number",
  });

const imei = Joi.string().pattern(/^\d{15}$/).messages({
  "string.pattern.base": "IMEI must be exactly 15 digits",
});

const nin = Joi.string().pattern(/^\d{11}$/).messages({
  "string.pattern.base": "NIN must be exactly 11 digits",
});

const bvn = Joi.string().pattern(/^\d{11}$/).messages({
  "string.pattern.base": "BVN must be exactly 11 digits",
});

const serialNumber = Joi.string().alphanum().min(6).max(20);

const schemas = {
  // ── Auth ───────────────────────────────────────────────────────────────────
  register: Joi.object({
    email: Joi.string().email().required(),
    displayName: Joi.string().min(2).max(60).required(),
    phoneNumber: nigerianPhone.required(),
    state: Joi.string().required(),
    city: Joi.string().required(),
    area: Joi.string().required(),
    shopName: Joi.string().min(2).max(80).required(),
    shopNumber: Joi.string().max(40).optional().allow("", null),
    referredBy: Joi.string().optional().allow(null),
  }),

  // ── Users ──────────────────────────────────────────────────────────────────
  updateProfile: Joi.object({
    displayName: Joi.string().min(2).max(60),
    phoneNumber: nigerianPhone,
    shopName: Joi.string().min(2).max(80),
    shopNumber: Joi.string().max(40).allow("", null),
    state: Joi.string(),
    city: Joi.string(),
    area: Joi.string(),
  }),

  submitRating: Joi.object({
    ratedId: Joi.string().required(),
    score: Joi.number().integer().min(1).max(5).required(),
    transactionId: Joi.string().required(),
    comment: Joi.string().max(300).optional().allow(""),
  }),

  // ── KYC ────────────────────────────────────────────────────────────────────
  submitKyc: Joi.object({
    nin: nin.required(),
    bvn: bvn.required(),
  }),

  // ── Devices ────────────────────────────────────────────────────────────────
  reportDevice: Joi.object({
    imei: imei.optional().allow("", null),
    serialNumber: serialNumber.optional().allow("", null),
    brand: Joi.string().min(1).max(40).required(),
    model: Joi.string().min(1).max(60).required(),
    color: Joi.string().max(30).optional().allow(""),
    description: Joi.string().min(20).max(1000).required(),
  }).or("imei", "serialNumber"),

  checkDevice: Joi.object({
    imei: imei.optional(),
    serialNumber: serialNumber.optional(),
  }).or("imei", "serialNumber"),

  // ── Transactions ───────────────────────────────────────────────────────────
  createTransaction: Joi.object({
    collectorId: Joi.string().required(),
    deviceImei: Joi.string().required(),
    deviceModel: Joi.string().required(),
    deviceBrand: Joi.string().required(),
    assignedPrice: Joi.number().positive().required(),
    notes: Joi.string().max(500).optional().allow(""),
    agreementAccepted: Joi.boolean().valid(true).required(),
  }),

  updateTransaction: Joi.object({
    status: Joi.string().valid("returned", "paid", "theft").required(),
  }),

  // ── Groups ─────────────────────────────────────────────────────────────────
  createGroup: Joi.object({
    name: Joi.string().min(2).max(80).required(),
    description: Joi.string().min(10).max(500).required(),
    scope: Joi.string().valid("all", "state", "city", "area").required(),
    targetState: Joi.string().optional(),
    targetCity: Joi.string().optional(),
    targetArea: Joi.string().optional(),
  }),

  createPost: Joi.object({
    text: Joi.string().min(1).max(1000).required(),
    imageUrl: Joi.string().uri().optional().allow("", null),
  }),

  // ── Payments ───────────────────────────────────────────────────────────────
  initializePayment: Joi.object({
    planCode: Joi.string().required(),
    callbackUrl: Joi.string().uri().optional(),
  }),

  // ── Push notifications ─────────────────────────────────────────────────────
  registerPushToken: Joi.object({
    token: Joi.string().required(),
    platform: Joi.string().valid("ios", "android").required(),
  }),
};

module.exports = schemas;

