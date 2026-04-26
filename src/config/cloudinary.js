const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload presets — configured in the Cloudinary dashboard.
 * Changing transformations = just update the dashboard preset, no code deploy.
 *
 * Presets to create in Cloudinary dashboard:
 *   trustgate_avatars      → folder: tg/avatars, w_200,h_200,c_fill,q_auto,f_auto
 *   trustgate_kyc_docs     → folder: tg/kyc, access_mode: authenticated
 *   trustgate_group_posts  → folder: tg/posts, w_1080,q_auto,f_auto
 *   trustgate_receipts     → folder: tg/receipts, access_mode: authenticated
 *   trustgate_chat         → folder: tg/chat, q_auto,f_auto (images + raw files)
 *   trustgate_chat_video   → folder: tg/chat-video, resource_type: video, q_auto
 */
const UPLOAD_PRESETS = {
  AVATAR: process.env.CLOUDINARY_PRESET_AVATARS || "trustgate_avatars",
  KYC: process.env.CLOUDINARY_PRESET_KYC_DOCS || "trustgate_kyc_docs",
  GROUP_POST: process.env.CLOUDINARY_PRESET_GROUP_POSTS || "trustgate_group_posts",
  RECEIPT: process.env.CLOUDINARY_PRESET_RECEIPT || "trustgate_receipts",
  CHAT: process.env.CLOUDINARY_PRESET_CHAT || "trustgate_chat",
  CHAT_VIDEO: process.env.CLOUDINARY_PRESET_CHAT_VIDEO || "trustgate_chat_video",
};

module.exports = { cloudinary, UPLOAD_PRESETS };