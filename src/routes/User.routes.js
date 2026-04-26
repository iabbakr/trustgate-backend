const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const schemas = require("../utils/schemas");

// GET  /api/v1/users/search?q=
router.get("/search", requireAuth, userController.searchUsers);

// GET  /api/v1/users/nearby
router.get("/nearby", requireAuth, userController.getNearbyUsers);

// POST /api/v1/users/rate
router.post("/rate", requireAuth, validate(schemas.submitRating), userController.submitRating);

// GET  /api/v1/users/:uid
router.get("/:uid", requireAuth, userController.getProfile);

// PATCH /api/v1/users/:uid  (own profile only — enforced in controller)
router.patch("/", requireAuth, validate(schemas.updateProfile), userController.updateProfile);

module.exports = router;