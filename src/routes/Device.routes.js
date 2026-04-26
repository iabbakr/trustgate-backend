const express = require("express");
const router = express.Router();

const deviceController = require("../controllers/device.controller");
const { requireAuth } = require("../middleware/auth");
const { deviceCheckLimiter, uploadLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validate");
const schemas = require("../utils/schemas");

// GET  /api/v1/devices/check?imei=&serialNumber=
router.get("/check", requireAuth, deviceCheckLimiter, deviceController.checkDevice);

// POST /api/v1/devices/report
router.post("/report", requireAuth, validate(schemas.reportDevice), deviceController.reportDevice);

module.exports = router;