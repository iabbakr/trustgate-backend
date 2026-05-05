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

// Initialize background jobs (gracefully — don't crash if Redis is down)
try {
  require("./jobs");
} catch (err) {
  logger.warn(`Background jobs failed to initialize: ${err.message}`);
}

const app = express();
const startTime = Date.now();

// ── Security ─────────────────────────────────────────────────────────────────
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
      : "*",
    credentials: true,
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
// Paystack webhook needs raw body for HMAC verification
app.use("/payments/webhook", express.raw({ type: "application/json" }));
app.use("/api/v1/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.path === "/health" || req.path === "/api/v1/health",
  })
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(globalLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
// Available at both /health and /api/v1/health so the frontend can reach either
const healthHandler = async (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  // Check Firebase connectivity
  let firebaseOk = false;
  try {
    const { db } = require("./config/firebase");
    // Lightweight check — just verify the db object is initialized
    firebaseOk = !!db;
  } catch {
    firebaseOk = false;
  }

  // Check Redis connectivity
  let redisOk = false;
  try {
    const { getRedisClient } = require("./config/redis");
    const client = getRedisClient();
    if (client) {
      await client.ping();
      redisOk = true;
    }
  } catch {
    redisOk = false;
  }

  const healthy = firebaseOk; // Redis is optional
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    uptime: uptimeSeconds,
    ts: Date.now(),
    env: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
    services: {
      firebase: firebaseOk ? "ok" : "error",
      redis: redisOk ? "ok" : "unavailable",
    },
  });
};

app.get("/health", healthHandler);
app.get("/api/v1/health", healthHandler);

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

// Legacy Paystack webhook compatibility
app.use("/payments", paymentRoutes);

// ── 404 & Error ───────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "5000", 10);
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`TrustGate API running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;