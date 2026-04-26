const express = require("express");
const router = express.Router();

const txController = require("../controller/transaction.controller");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const schemas = require("../utils/schemas");

// POST /api/v1/transactions
router.post("/", requireAuth, validate(schemas.createTransaction), txController.createTransaction);

// GET  /api/v1/transactions/mine   — transactions where I am the collector
router.get("/mine", requireAuth, txController.getMyTransactions);

// GET  /api/v1/transactions/shop   — transactions where I am the owner
router.get("/shop", requireAuth, txController.getShopTransactions);

// PATCH /api/v1/transactions/:id
router.patch("/:id", requireAuth, validate(schemas.updateTransaction), txController.updateTransaction);

module.exports = router;