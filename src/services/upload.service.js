const { cloudinary, UPLOAD_PRESETS } = require("../config/cloudinary");
const logger = require("../utils/logger");

/**
 * Upload a file buffer to Cloudinary using the appropriate preset.
 * Presets live in the Cloudinary dashboard — no transformation code here.
 */
async function uploadBuffer(buffer, preset, fileName, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        upload_preset: preset,
        public_id: fileName,
        overwrite: true,
        invalidate: true,
        ...options,
      },
      (error, result) => {
        if (error) {
          logger.error(`Cloudinary upload failed: ${error.message}`);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    stream.end(buffer);
  });
}

async function uploadAvatar(uid, buffer) {
  const result = await uploadBuffer(buffer, UPLOAD_PRESETS.AVATAR, `avatars/${uid}`);
  return result.secure_url;
}

async function uploadGroupPostImage(groupId, buffer) {
  const timestamp = Date.now();
  const result = await uploadBuffer(
    buffer,
    UPLOAD_PRESETS.GROUP_POST,
    `posts/${groupId}/${timestamp}`
  );
  return result.secure_url;
}

async function uploadKycDocument(uid, type, buffer) {
  const result = await uploadBuffer(
    buffer,
    UPLOAD_PRESETS.KYC,
    `kyc/${uid}/${type}`
  );
  return result.secure_url;
}

async function uploadReceipt(txId, buffer) {
  const result = await uploadBuffer(buffer, UPLOAD_PRESETS.RECEIPT, `receipts/${txId}`);
  return result.secure_url;
}

/**
 * Upload a chat image. Returns the full Cloudinary result (includes width/height).
 */
async function uploadChatImage(uid, buffer) {
  const timestamp = Date.now();
  const result = await uploadBuffer(
    buffer,
    UPLOAD_PRESETS.CHAT,
    `chat/${uid}/${timestamp}`
  );
  return result; // full result so route can access dimensions
}

/**
 * Upload a chat video. Uses resource_type: video for Cloudinary streaming.
 */
async function uploadChatVideo(uid, buffer) {
  const timestamp = Date.now();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        upload_preset: UPLOAD_PRESETS.CHAT_VIDEO,
        public_id: `chat-video/${uid}/${timestamp}`,
        resource_type: "video",
        overwrite: true,
        eager: [{ format: "jpg", transformation: [{ start_offset: "0" }] }], // thumbnail
        eager_async: true,
      },
      (error, result) => {
        if (error) {
          logger.error(`Cloudinary video upload failed: ${error.message}`);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    stream.end(buffer);
  });
}

/**
 * Upload a chat file (PDF, doc, etc.). Uses resource_type: raw.
 */
async function uploadChatFile(uid, buffer, fileName) {
  const timestamp = Date.now();
  const safeName = String(fileName).replace(/[^a-z0-9._-]/gi, "_");
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        upload_preset: UPLOAD_PRESETS.CHAT,
        public_id: `chat-files/${uid}/${timestamp}_${safeName}`,
        resource_type: "raw",
        overwrite: false,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function deleteFile(publicId, resourceType = "image") {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

module.exports = {
  uploadAvatar,
  uploadGroupPostImage,
  uploadKycDocument,
  uploadReceipt,
  uploadChatImage,
  uploadChatVideo,
  uploadChatFile,
  deleteFile,
};