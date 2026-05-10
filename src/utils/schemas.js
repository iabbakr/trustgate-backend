/**
 * utils/schemas.js
 *
 * Changes from previous version:
 *  - createTransaction: deviceImei is now optional; deviceSerialNumber added;
 *    deviceColor and deviceType added; .or() ensures at least one identifier.
 *  - reportDevice: deviceType added ("mobile" | "laptop" | "other").
 *  - Everything else is unchanged.
 */

const Joi = require("joi");

// ── Shared primitives ─────────────────────────────────────────────────────────

const nigerianPhone = Joi.string()
  .pattern(/^(\+234|0)[789][01]\d{8}$/)
  .messages({ "string.pattern.base": "Enter a valid Nigerian phone number" });

const imei = Joi.string()
  .pattern(/^\d{15}$/)
  .messages({ "string.pattern.base": "IMEI must be exactly 15 digits" });

const nin = Joi.string()
  .pattern(/^\d{11}$/)
  .messages({ "string.pattern.base": "NIN must be exactly 11 digits" });

const bvn = Joi.string()
  .pattern(/^\d{11}$/)
  .messages({ "string.pattern.base": "BVN must be exactly 11 digits" });

// Serial numbers can contain letters + digits; laptops often have dashes
// which we strip client-side, so we accept alphanumeric 4–30 chars.
const serialNumber = Joi.string().alphanum().min(4).max(30);

// ── Schemas ───────────────────────────────────────────────────────────────────

const schemas = {

  // ── Auth ──────────────────────────────────────────────────────────────────
  register: Joi.object({
    email:       Joi.string().email().required(),
    displayName: Joi.string().min(2).max(60).required(),
    phoneNumber: nigerianPhone.required(),
    state:       Joi.string().required(),
    city:        Joi.string().required(),
    area:        Joi.string().required(),
    shopName:    Joi.string().min(2).max(80).required(),
    shopNumber:  Joi.string().max(40).optional().allow("", null),
    referredBy:  Joi.string().optional().allow(null),
  }),

  // ── Users ─────────────────────────────────────────────────────────────────
  updateProfile: Joi.object({
    displayName: Joi.string().min(2).max(60),
    phoneNumber: nigerianPhone,
    shopName:    Joi.string().min(2).max(80),
    shopNumber:  Joi.string().max(40).allow("", null),
    state:       Joi.string(),
    city:        Joi.string(),
    area:        Joi.string(),
  }),

  submitRating: Joi.object({
    ratedId:       Joi.string().required(),
    score:         Joi.number().integer().min(1).max(5).required(),
    transactionId: Joi.string().required(),
    comment:       Joi.string().max(300).optional().allow(""),
  }),

  // ── KYC ──────────────────────────────────────────────────────────────────
  submitKyc: Joi.object({
    nin: nin.required(),
    bvn: bvn.required(),
  }),

  // ── Devices ───────────────────────────────────────────────────────────────

  /**
   * reportDevice — at least one of imei / serialNumber required.
   * deviceType defaults to "mobile"; use "laptop" / "other" for non-phones.
   */
  reportDevice: Joi.object({
    imei:         imei.optional().allow("", null),
    serialNumber: serialNumber.optional().allow("", null),
    brand:        Joi.string().min(1).max(60).required(),
    model:        Joi.string().min(1).max(80).required(),
    color:        Joi.string().max(40).optional().allow("", null),
    deviceType:   Joi.string().valid("mobile", "laptop", "other").default("mobile"),
    description:  Joi.string().min(20).max(1000).required().messages({
      "string.min": "Description must be at least 20 characters.",
    }),
  })
    .or("imei", "serialNumber")
    .messages({ "object.missing": "At least one of IMEI or serial number is required." }),

  checkDevice: Joi.object({
    imei:         imei.optional(),
    serialNumber: serialNumber.optional(),
  })
    .or("imei", "serialNumber")
    .messages({ "object.missing": "Provide imei or serialNumber." }),

  // ── Transactions ──────────────────────────────────────────────────────────

  /**
   * createTransaction — either deviceImei or deviceSerialNumber must be
   * present (or both).  IMEI is required for mobiles but not for laptops.
   * deviceType defaults to "mobile".
   */
  createTransaction: Joi.object({
    collectorId: Joi.string().required(),

    deviceImei: Joi.string()
      .pattern(/^\d{14,17}$/)
      .optional()
      .allow("", null)
      .messages({ "string.pattern.base": "IMEI must be 14–17 digits." }),

    deviceSerialNumber: serialNumber.optional().allow("", null),

    deviceBrand: Joi.string().min(1).max(60).required(),
    deviceModel: Joi.string().min(1).max(80).required(),
    deviceColor: Joi.string().max(40).optional().allow("", null),

    deviceType: Joi.string()
      .valid("mobile", "laptop", "other")
      .default("mobile"),

    assignedPrice:     Joi.number().positive().required(),
    notes:             Joi.string().max(500).optional().allow("", null),
    agreementAccepted: Joi.boolean().valid(true).required().messages({
      "any.only": "You must accept the agreement to proceed.",
    }),
  })
    .or("deviceImei", "deviceSerialNumber")
    .messages({
      "object.missing": "At least one of deviceImei or deviceSerialNumber is required.",
    }),

  updateTransaction: Joi.object({
    status: Joi.string().valid("returned", "paid", "theft").required(),
  }),

  // ── Groups ────────────────────────────────────────────────────────────────
  createGroup: Joi.object({
    name:        Joi.string().min(2).max(80).required(),
    description: Joi.string().min(10).max(500).required(),
    scope:       Joi.string().valid("all", "state", "city", "area").required(),
    targetState: Joi.string().optional(),
    targetCity:  Joi.string().optional(),
    targetArea:  Joi.string().optional(),
  }),

  createPost: Joi.object({
    text:     Joi.string().min(1).max(1000).required(),
    imageUrl: Joi.string().uri().optional().allow("", null),
  }),

  // ── Payments ──────────────────────────────────────────────────────────────
  initializePayment: Joi.object({
    planCode:    Joi.string().required(),
    callbackUrl: Joi.string().uri().optional(),
  }),

  // ── Push notifications ────────────────────────────────────────────────────
  registerPushToken: Joi.object({
    token:    Joi.string().required(),
    platform: Joi.string().valid("ios", "android").required(),
  }),
};

module.exports = schemas;