const paymentService = require("../services/payment.service");
const { verifyPaystackWebhook } = require("../utils/helpers");
const logger = require("../utils/logger");

async function getPlans(req, res, next) {
  try {
    const plans = await paymentService.getPlans();
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
}

async function initializePayment(req, res, next) {
  try {
    const { planCode, callbackUrl } = req.body;
    const data = await paymentService.initializePayment(req.user.uid, planCode, callbackUrl);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function verifyPayment(req, res, next) {
  try {
    const data = await paymentService.verifyPayment(req.params.reference);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function webhook(req, res) {
  try {
    const signature = req.headers["x-paystack-signature"];
    const body = req.body; // raw buffer from express.raw()
    const parsed = JSON.parse(body.toString());

    if (!verifyPaystackWebhook(parsed, signature)) {
      logger.warn("Paystack webhook: invalid signature");
      return res.status(400).json({ error: "Invalid signature" });
    }

    // Handle async — respond 200 immediately so Paystack doesn't retry
    res.sendStatus(200);
    await paymentService.handleWebhook(parsed);
  } catch (err) {
    logger.error(`Paystack webhook error: ${err.message}`);
    res.sendStatus(200); // Always 200 to stop retries
  }
}

module.exports = { getPlans, initializePayment, verifyPayment, webhook };