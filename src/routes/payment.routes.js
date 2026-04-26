const express = require("express");
const router = express.Router();

const paymentController = require("../controller/payment.controller");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const schemas = require("../utils/schemas");

// GET  /api/v1/payments/plans
router.get("/plans", requireAuth, paymentController.getPlans);

// POST /api/v1/payments/initialize
router.post(
  "/initialize",
  requireAuth,
  validate(schemas.initializePayment),
  paymentController.initializePayment
);

// GET  /api/v1/payments/verify/:reference
router.get("/verify/:reference", requireAuth, paymentController.verifyPayment);

// POST /api/v1/payments/webhook  — Paystack webhook (no auth, verified by HMAC)
// Also mounted at /payments/webhook for legacy compat
router.post("/webhook", express.raw({ type: "application/json" }), paymentController.webhook);

module.exports = router;