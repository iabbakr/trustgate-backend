const multer = require("multer");

// Store in memory — we stream directly to Cloudinary, never touch disk
const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files are allowed"), false);
  }
  cb(null, true);
};

const documentFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only images and PDFs are allowed for documents"), false);
  }
  cb(null, true);
};

// Avatar uploads — images only, 5MB max
const avatarUpload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("avatar");

// Group post images — 10MB max
const postImageUpload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("image");

// KYC documents — images or PDF, 20MB max
const documentUpload = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
}).single("document");

// Receipt uploads — images or PDF, 10MB max
const receiptUpload = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("receipt");

// Video uploads for chat — 50MB max, 60 seconds enforced server-side
const videoFilter = (req, file, cb) => {
  const allowed = ["video/mp4", "video/quicktime", "video/x-m4v", "video/webm"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only MP4, MOV, and WebM videos are allowed"), false);
  }
  cb(null, true);
};

const videoUpload = multer({
  storage,
  fileFilter: videoFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
}).single("video");

module.exports = { avatarUpload, postImageUpload, documentUpload, receiptUpload, videoUpload };