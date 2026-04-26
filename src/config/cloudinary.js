const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload presets — each preset is configured in the Cloudinary dashboard.
 * When migrating (MongoDB/PostgreSQL), only the storageService changes,
 * not these preset names.
 *
 * Preset settings you should configure in Cloudinary dashboard:
 *   trustgate_avatars      → folder: tg/avatars, transformations: w_200,h_200,c_fill,q_auto,f_auto
 *   trustgate_kyc_docs     → folder: tg/kyc, access_mode: authenticated (private)
 *   trustgate_group_posts  → folder: tg/posts, transformations: w_1080,q_auto,f_auto
 *   trustgate_receipts     → folder: tg/receipts, access_mode: authenticated
 */
const UPLOAD_PRESETS = {
  AVATAR: process.env.CLOUDINARY_PRESET_AVATARS || "trustgate_avatars",
  KYC: process.env.CLOUDINARY_PRESET_KYC_DOCS || "trustgate_kyc_docs",
  GROUP_POST: process.env.CLOUDINARY_PRESET_GROUP_POSTS || "trustgate_group_posts",
  RECEIPT: process.env.CLOUDINARY_PRESET_RECEIPT || "trustgate_receipts",
};

module.exports = { cloudinary, UPLOAD_PRESETS };
