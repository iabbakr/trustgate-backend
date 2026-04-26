const { cloudinary, UPLOAD_PRESETS } = require("../config/cloudinary");
const logger = require("../utils/logger");

/**
 * Upload a file buffer to Cloudinary using the appropriate preset.
 * Using presets keeps transformation logic in the Cloudinary dashboard —
 * easy to change without code deploys.
 */
async function uploadBuffer(buffer, preset, fileName) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        upload_preset: preset,
        public_id: fileName,
        overwrite: true,
        invalidate: true,
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
  return result.secure_url; // Note: KYC preset should be set to authenticated access
}

async function uploadReceipt(txId, buffer) {
  const result = await uploadBuffer(buffer, UPLOAD_PRESETS.RECEIPT, `receipts/${txId}`);
  return result.secure_url;
}

async function deleteFile(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

module.exports = { uploadAvatar, uploadGroupPostImage, uploadKycDocument, uploadReceipt, deleteFile };