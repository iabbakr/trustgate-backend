/**
 * services/transaction.service.js
 *
 * Business logic for device assignment transactions.
 *
 * Key behaviours:
 *  - No duplicate active (assigned) transactions for the same IMEI or serial.
 *  - Cannot assign a device that is already in the stolen registry.
 *  - status → "theft":
 *      • Auto-registers device in the stolen registry.
 *      • Broadcasts a push notification to every active user.
 *  - status → "returned" | "paid" after a theft:
 *      • Clears the stolen flag from the registry.
 *
 * IMPORTANT — all job/queue requires are LAZY (inside helper functions).
 * This means the module loads successfully even when Redis / Bull has not
 * yet initialised at startup, which was the cause of the deploy crash.
 */

const txRepo         = require("../repositories/transaction.repository");
const { deviceRepo } = require("../repositories/device.repository");
const userRepo       = require("../repositories/user.repository");
const { db }         = require("../config/firebase");
const { COLLECTIONS } = require("../utils/constants");
const logger         = require("../utils/logger");

// ── Safe job helpers (lazy require, never throw) ──────────────────────────────

/**
 * Enqueue a notification by method name without crashing if Bull is down.
 * e.g. safeNotify("theftAlert", uid, label)
 */
function safeNotify(method, ...args) {
  try {
    const { enqueueNotify } = require("../jobs/notification.job");
    if (typeof enqueueNotify[method] === "function") {
      return enqueueNotify[method](...args).catch(() => {});
    }
  } catch {
    // Bull / Redis unavailable — skip silently
  }
  return Promise.resolve();
}

function safeTrustScore(uid, event) {
  try {
    const { enqueueTrustScore } = require("../jobs/trustscore.job");
    return enqueueTrustScore(uid, event).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Return any open (status=assigned) transaction that shares this device's
 * IMEI or serial number, or null if none exists.
 */
async function findActiveTransactionForDevice({ imei, serialNumber }) {
  const checks = [];

  if (imei) {
    checks.push(
      db.collection(COLLECTIONS.TRANSACTIONS)
        .where("deviceImei", "==", imei)
        .where("status", "==", "assigned")
        .limit(1)
        .get()
        .then((s) => (s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() }))
    );
  }

  if (serialNumber) {
    checks.push(
      db.collection(COLLECTIONS.TRANSACTIONS)
        .where("deviceSerialNumber", "==", serialNumber)
        .where("status", "==", "assigned")
        .limit(1)
        .get()
        .then((s) => (s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() }))
    );
  }

  if (!checks.length) return null;
  const results = await Promise.all(checks);
  return results.find(Boolean) || null;
}

/**
 * Paginate over all active users and enqueue a theft alert for each.
 * Runs entirely fire-and-forget — never delays the caller.
 */
async function broadcastTheftAlert(reporterUid, deviceLabel) {
  try {
    const { enqueueNotify } = require("../jobs/notification.job");
    let lastDoc   = null;
    let totalSent = 0;

    do {
      let q = db.collection(COLLECTIONS.USERS)
        .where("status", "==", "active")
        .limit(200);

      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      await Promise.all(
        snap.docs
          .filter((d) => d.id !== reporterUid)
          .map((d) => enqueueNotify.theftAlert(d.id, deviceLabel).catch(() => {}))
      );

      totalSent += snap.docs.length;
      lastDoc    = snap.docs[snap.docs.length - 1];
      if (snap.size < 200) break;
    } while (true);

    logger.info(`[txService] theft broadcast sent to ~${totalSent} users for "${deviceLabel}"`);
  } catch (err) {
    logger.error(`[txService] broadcastTheftAlert failed: ${err.message}`);
  }
}

/**
 * Write or update the device in the stolen registry.
 * Idempotent — updates an existing record rather than creating a duplicate.
 */
async function registerDeviceAsStolen(tx, ownerProfile) {
  const payload = {
    imei:          tx.deviceImei         || null,
    serialNumber:  tx.deviceSerialNumber || null,
    brand:         tx.deviceBrand,
    model:         tx.deviceModel,
    color:         tx.deviceColor        || null,
    deviceType:    tx.deviceType         || "mobile",
    status:        "stolen",
    reportedBy:    tx.ownerId,
    reporterName:  ownerProfile?.displayName || "Unknown",
    reporterShop:  ownerProfile?.shopName    || null,
    description:
      `Auto-reported via transaction #${tx.id}. ` +
      `Collector: ${tx.collectorName} (${tx.collectorShop})`,
    transactionId: tx.id,
    reportedAt:    Date.now(),
  };

  let existing = null;
  if (payload.imei)         existing = await deviceRepo.findByImei(payload.imei);
  if (!existing && payload.serialNumber) existing = await deviceRepo.findBySerial(payload.serialNumber);

  if (existing) {
    await deviceRepo.update(existing.id, payload);
    return existing.id;
  }
  const created = await deviceRepo.create(null, payload);
  return created.id;
}

/**
 * Find the registry record linked to this transaction and mark it clean.
 */
async function clearDeviceStolenFlag(tx) {
  const snap = await db.collection(COLLECTIONS.DEVICES)
    .where("transactionId", "==", tx.id)
    .where("status", "==", "stolen")
    .limit(1)
    .get();

  if (snap.empty) return;

  await snap.docs[0].ref.update({
    status:        "clean",
    clearedAt:     Date.now(),
    clearedReason: `Transaction resolved as "${tx.status}"`,
  });

  logger.info(`[txService] cleared stolen flag for txId=${tx.id}`);
}

// ── Public API ────────────────────────────────────────────────────────────────

async function createTransaction(ownerId, data) {
  const {
    collectorId,
    deviceImei,
    deviceSerialNumber,
    deviceBrand,
    deviceModel,
    deviceColor,
    deviceType = "mobile",
    assignedPrice,
    notes,
    agreementAccepted,
  } = data;

  if (!deviceImei && !deviceSerialNumber) {
    throw Object.assign(
      new Error("At least one of IMEI or serial number is required."),
      { status: 400 }
    );
  }

  // Guard: no duplicate open assignment
  const conflict = await findActiveTransactionForDevice({
    imei:         deviceImei,
    serialNumber: deviceSerialNumber,
  });
  if (conflict) {
    throw Object.assign(
      new Error(
        `This device already has an open transaction (ID: ${conflict.id}). ` +
        "Resolve it before creating a new one."
      ),
      { status: 409, code: "DUPLICATE_ASSIGNMENT" }
    );
  }

  // Guard: device not in stolen registry
  const registryRecord = deviceImei
    ? await deviceRepo.findByImei(deviceImei)
    : deviceSerialNumber
    ? await deviceRepo.findBySerial(deviceSerialNumber)
    : null;

  if (registryRecord && registryRecord.status === "stolen") {
    throw Object.assign(
      new Error(
        "This device is listed as stolen in the TrustGate registry and cannot be assigned."
      ),
      { status: 403, code: "DEVICE_STOLEN" }
    );
  }

  const [owner, collector] = await Promise.all([
    userRepo.findById(ownerId),
    userRepo.findById(collectorId),
  ]);
  if (!owner)     throw Object.assign(new Error("Owner not found"),     { status: 404 });
  if (!collector) throw Object.assign(new Error("Collector not found"), { status: 404 });

  const tx = await txRepo.create(null, {
    ownerId,
    ownerName:      owner.displayName,
    ownerShop:      owner.shopName    || "",
    ownerPhone:     owner.phoneNumber || null,
    collectorId,
    collectorName:  collector.displayName,
    collectorShop:  collector.shopName    || "",
    collectorPhone: collector.phoneNumber || null,
    deviceImei:         deviceImei         || null,
    deviceSerialNumber: deviceSerialNumber || null,
    deviceBrand,
    deviceModel,
    deviceColor:  deviceColor || null,
    deviceType,
    assignedPrice,
    notes:             notes || null,
    agreementAccepted: !!agreementAccepted,
    status:     "assigned",
    assignedAt: Date.now(),
  });

  safeNotify("transactionUpdate", collectorId, "assigned", `${deviceBrand} ${deviceModel}`);

  return tx;
}

async function updateTransactionStatus(txId, newStatus, requestorUid) {
  const tx = await txRepo.findById(txId);
  if (!tx) throw Object.assign(new Error("Transaction not found"), { status: 404 });

  if (tx.ownerId !== requestorUid) {
    throw Object.assign(
      new Error("Only the transaction owner may update its status"),
      { status: 403 }
    );
  }

  const transitions = {
    assigned: ["paid", "returned", "theft"],
    theft:    ["paid", "returned"],       // owner recovers the device
  };

  if (!(transitions[tx.status] || []).includes(newStatus)) {
    throw Object.assign(
      new Error(`Cannot transition from "${tx.status}" to "${newStatus}"`),
      { status: 400 }
    );
  }

  const previousStatus = tx.status;
  await txRepo.update(txId, { status: newStatus, resolvedAt: Date.now() });

  const updatedTx   = { ...tx, status: newStatus };
  const deviceLabel = `${tx.deviceBrand} ${tx.deviceModel}`;

  // ── Async side-effects (all fire-and-forget) ──────────────────────────────

  if (newStatus === "theft") {
    const ownerProfile = await userRepo.findById(tx.ownerId).catch(() => null);

    registerDeviceAsStolen(updatedTx, ownerProfile).catch((e) =>
      logger.error(`[txService] registerDeviceAsStolen: ${e.message}`)
    );

    broadcastTheftAlert(tx.ownerId, deviceLabel); // fire-and-forget

    safeNotify("theftAlert", tx.collectorId, deviceLabel);
    safeTrustScore(tx.collectorId, "theft_report_on_user");
  }

  if ((newStatus === "paid" || newStatus === "returned") && previousStatus === "theft") {
    clearDeviceStolenFlag(updatedTx).catch((e) =>
      logger.error(`[txService] clearDeviceStolenFlag: ${e.message}`)
    );
  }

  if (newStatus === "paid") {
    safeTrustScore(tx.collectorId, "transaction_completed");
    safeTrustScore(tx.ownerId,     "transaction_completed");
  }

  safeNotify("transactionUpdate", tx.ownerId,     newStatus, deviceLabel);
  safeNotify("transactionUpdate", tx.collectorId, newStatus, deviceLabel);

  return updatedTx;
}

async function getMyTransactions(uid) {
  return txRepo.findByCollector(uid);
}

async function getShopTransactions(uid) {
  return txRepo.findByOwner(uid);
}

module.exports = {
  createTransaction,
  updateTransactionStatus,
  getMyTransactions,
  getShopTransactions,
};