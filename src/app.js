require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");

const logger = require("./utils/logger");
const { globalLimiter } = require("./middleware/rateLimiter");
const { errorHandler, notFound } = require("./middleware/errorHandler");

// Route imports
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const kycRoutes = require("./routes/kyc.routes");
const deviceRoutes = require("./routes/device.routes");
const transactionRoutes = require("./routes/transaction.routes");
const groupRoutes = require("./routes/group.routes");
const chatRoutes = require("./routes/chat.routes");
const socialRoutes = require("./routes/social.routes");
const uploadRoutes = require("./routes/upload.routes");
const paymentRoutes = require("./routes/payment.routes");
const notificationRoutes = require("./routes/notification.routes");
const adminRoutes = require("./routes/admin.routes");
const otpRoutes = require("./routes/otp.routes");

// Initialize background jobs
require("./jobs");

const app = express();

// ── Security ─────────────────────────────────────────────────────────────────
app.set("trust proxy", 1); // Render sits behind a proxy
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : "*",
    credentials: true,
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
// Paystack webhook needs raw body for HMAC verification
app.use("/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.path === "/health",
  })
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(globalLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", ts: Date.now(), env: process.env.NODE_ENV });
});

// ── API routes ────────────────────────────────────────────────────────────────
const v1 = express.Router();

v1.use("/auth", authRoutes);
v1.use("/users", userRoutes);
v1.use("/kyc", kycRoutes);
v1.use("/devices", deviceRoutes);
v1.use("/transactions", transactionRoutes);
v1.use("/groups", groupRoutes);
v1.use("/chat", chatRoutes);
v1.use("/social", socialRoutes);
v1.use("/upload", uploadRoutes);
v1.use("/payments", paymentRoutes);
v1.use("/notifications", notificationRoutes);
v1.use("/admin", adminRoutes);
v1.use("/otp", otpRoutes);

app.use("/api/v1", v1);

// Legacy root routes (for backward compat)
app.use("/payments", paymentRoutes); // Paystack webhook uses /payments/webhook

// ── 404 & Error ───────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`TrustGate API running on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = app;