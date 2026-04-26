const { paystackHttp } = require("../config/paystack");
const { db } = require("../config/firebase");
const userRepo = require("../repositories/user.repository");
const cache = require("./cache.service");
const { CACHE_KEYS, TTL, COLLECTIONS } = require("../utils/constants");
const { notify } = require("./notification.service");
const logger = require("../utils/logger");

async function initializePayment(uid, planCode, callbackUrl) {
  const user = await userRepo.findById(uid);
  if (!user) throw new Error("User not found");

  const response = await paystackHttp.post("/transaction/initialize", {
    email: user.email,
    amount: undefined, // Plan handles amount
    plan: planCode,
    callback_url: callbackUrl || `${process.env.API_BASE_URL}/payments/callback`,
    metadata: { uid, planCode },
  });

  return response.data.data; // { authorization_url, access_code, reference }
}

async function verifyPayment(reference) {
  const response = await paystackHttp.get(`/transaction/verify/${reference}`);
  return response.data.data;
}

async function getPlans() {
  return cache.wrap(CACHE_KEYS.paystackPlans(), TTL.PAYSTACK_PLANS, async () => {
    const response = await paystackHttp.get("/plan");
    return response.data.data;
  });
}

async function handleWebhook(event) {
  logger.info(`Paystack webhook: ${event.event}`);

  if (event.event === "charge.success" || event.event === "subscription.create") {
    const { metadata, customer, plan, amount } = event.data;
    const uid = metadata?.uid;
    if (!uid) return;

    await db.collection(COLLECTIONS.PAYMENTS).add({
      uid,
      reference: event.data.reference,
      amount: amount / 100, // kobo → naira
      plan: plan?.name,
      planCode: plan?.plan_code,
      customerEmail: customer?.email,
      status: "success",
      paystackData: event.data,
      createdAt: Date.now(),
    });

    await userRepo.update(uid, {
      subscriptionPlan: plan?.name,
      subscriptionActive: true,
      subscriptionExpiry: event.data.paid_at
        ? Date.now() + 30 * 24 * 60 * 60 * 1000 // +30 days
        : null,
    });

    notify.paymentSuccess(uid, plan?.name || "Pro").catch(() => {});
  }

  if (event.event === "subscription.disable" || event.event === "invoice.payment_failed") {
    const uid = event.data?.metadata?.uid || event.data?.customer?.metadata?.uid;
    if (!uid) return;
    await userRepo.update(uid, { subscriptionActive: false });
  }
}

module.exports = { initializePayment, verifyPayment, getPlans, handleWebhook };