/**
 * services/transaction.service.js
 *
 * Business logic for phone/laptop assignment transactions.
 *
 * Key behaviours:
 *  - No two active (status=assigned) transactions can share the same IMEI
 *    or serial number — enforced before creation.
 *  - When status → "theft":
 *      • Device is auto-registered in the stolen-device registry.
 *      • Every active user receives a push notification (broadcast).
 *      • transactionRef is stored on the device record so the owner can
 *        later clear the theft flag.
 *  - When status → "returned" or "paid" after a previous "theft":
 *      • The device record is removed from the registry (or marked clean).
 *  - Trust score events are enqueued asynchronously — never block the response.
 */

const txRepo = require("../repositories/transaction.repository");
const { deviceRepo } = require("../repositories/device.repository");
const userRepo = require("../repositories/user.repository");
const { db } = require("../config/firebase");
const { COLLECTIONS } = require("../utils/constants");
const { enqueueNotify } = require("../jobs/notification.job");
const { enqueueTrustScore } = require("../jobs/trustscore.job");
const logger = require("../utils/logger");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Check whether a device identifier is already tied to an open (assigned)
 * transaction. Returns the conflicting transaction or null.
 */
async function findActiveTransactionForDevice({ imei, serialNumber }) {
  const checks = [];

  if (imei) {
    checks.push(
      db
        .collection(COLLECTIONS.TRANSACTIONS)
        .where("deviceImei", "==", imei)
        .where("status", "==", "assigned")
        .limit(1)
        .get()
        .then((s) => (s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() }))
    );
  }

  if (serialNumber) {
    checks.push(
      db
        .collection(COLLECTIONS.TRANSACTIONS)
        .where("deviceSerialNumber", "==", serialNumber)
        .where("status", "==", "assigned")
        .limit(1)
        .get()
        .then((s) => (s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() }))
    );
  }

  const results = await Promise.all(checks);
  return results.find(Boolean) || null;
}

/**
 * Broadcast a theft notification to every active user except the reporter.
 * Runs fire-and-forget so it never delays the API response.
 */
async function broadcastTheftAlert(reporterUid, deviceLabel) {
  try {
    // Fetch active users in batches of 200
    let lastDoc = null;
    let totalSent = 0;

    do {
      let q = db
        .collection(COLLECTIONS.USERS)
        .where("status", "==", "active")
        .limit(200);

      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      const jobs = snap.docs
        .filter((d) => d.id !== reporterUid)
        .map((d) =>
          enqueueNotify.theftAlert(d.id, deviceLabel).catch(() => {})
        );

      await Promise.all(jobs);
      totalSent += jobs.length;
      lastDoc = snap.docs[snap.docs.length - 1];

      if (snap.size < 200) break; // last page
    } while (true);

    logger.info(
      `[txService] broadcastTheftAlert: sent to ${totalSent} users for "${deviceLabel}"`
    );
  } catch (err) {
    logger.error(`[txService] broadcastTheftAlert failed: ${err.message}`);
  }
}

/**
 * Register a device in the stolen-device registry on behalf of a transaction.
 * Idempotent — if a record already exists for the same IMEI / serial, it
 * updates the existing one instead of creating a duplicate.
 */
async function registerDeviceAsStolen(tx, reporterProfile) {
  const identifier = tx.deviceImei
    ? { imei: tx.deviceImei }
    : { serialNumber: tx.deviceSerialNumber };

  // Check for existing record
  let existing = null;
  if (identifier.imei) {
    existing = await deviceRepo.findByImei(identifier.imei);
  } else if (identifier.serialNumber) {
    existing = await deviceRepo.findBySerial(identifier.serialNumber);
  }

  const payload = {
    ...identifier,
    brand: tx.deviceBrand,
    model: tx.deviceModel,
    color: tx.deviceColor || null,
    status: "stolen",
    reportedBy: tx.ownerId,
    reporterName: reporterProfile?.displayName || "Unknown",
    reporterShop: reporterProfile?.shopName || null,
    description: `Auto-reported via transaction #${tx.id}. Collector: ${tx.collectorName} (${tx.collectorShop})`,
    transactionId: tx.id, // link back so owner can clear it
    reportedAt: Date.now(),
    // Device type — "mobile" | "laptop" | "other"
    deviceType: tx.deviceType || "mobile",
  };

  if (existing) {
    await deviceRepo.update(existing.id, payload);
    return existing.id;
  }

  const created = await deviceRepo.create(null, payload);
  return created.id;
}

/**
 * Clear the stolen flag from a device record that was created by a transaction.
 * Only the owner of the originating transaction may do this.
 */
async function clearDeviceStolenFlag(tx) {
  // Find device record linked to this transaction
  const snap = await db
    .collection(COLLECTIONS.DEVICES)
    .where("transactionId", "==", tx.id)
    .where("status", "==", "stolen")
    .limit(1)
    .get();

  if (snap.empty) return; // already cleared or was never set

  const ref = snap.docs[0].ref;
  await ref.update({
    status: "clean",
    clearedAt: Date.now(),
    clearedReason: `Transaction resolved as ${tx.status}`,
  });

  logger.info(`[txService] cleared stolen flag for device (txId=${tx.id})`);
}

// ── Public API ────────────────────────────────────────────────────────────────

async function createTransaction(ownerId, data) {
  const {
    collectorId,
    deviceImei,
    deviceSerialNumber, // laptops often only have serial numbers
    deviceBrand,
    deviceModel,
    deviceColor,
    deviceType = "mobile", // "mobile" | "laptop" | "other"
    assignedPrice,
    notes,
    agreementAccepted,
  } = data;

  // ── Guard: need at least one identifier ──────────────────────────────────
  if (!deviceImei && !deviceSerialNumber) {
    const err = new Error("At least one of IMEI or serial number is required.");
    err.status = 400;
    throw err;
  }

  // ── Guard: no duplicate active assignment ────────────────────────────────
  const conflict = await findActiveTransactionForDevice({
    imei: deviceImei,
    serialNumber: deviceSerialNumber,
  });

  if (conflict) {
    const err = new Error(
      `This device is already assigned in an open transaction (ID: ${conflict.id}). ` +
      "Resolve the existing transaction before creating a new one."
    );
    err.status = 409;
    throw err;
  }

  // ── Guard: device not flagged/stolen in registry ─────────────────────────
  const existingDeviceRecord = deviceImei
    ? await deviceRepo.findByImei(deviceImei)
    : deviceSerialNumber
    ? await deviceRepo.findBySerial(deviceSerialNumber)
    : null;

  if (existingDeviceRecord && existingDeviceRecord.status === "stolen") {
    const err = new Error(
      "This device is currently listed as stolen in the TrustGate registry. " +
      "You cannot assign a stolen device."
    );
    err.status = 403;
    throw err;
  }

  // ── Fetch both parties ───────────────────────────────────────────────────
  const [owner, collector] = await Promise.all([
    userRepo.findById(ownerId),
    userRepo.findById(collectorId),
  ]);

  if (!owner) throw Object.assign(new Error("Owner profile not found"), { status: 404 });
  if (!collector) throw Object.assign(new Error("Collector profile not found"), { status: 404 });

  // ── Create transaction ───────────────────────────────────────────────────
  const tx = await txRepo.create(null, {
    ownerId,
    ownerName: owner.displayName,
    ownerShop: owner.shopName || "",
    ownerPhone: owner.phoneNumber || null,
    collectorId,
    collectorName: collector.displayName,
    collectorShop: collector.shopName || "",
    collectorPhone: collector.phoneNumber || null,
    deviceImei: deviceImei || null,
    deviceSerialNumber: deviceSerialNumber || null,
    deviceBrand,
    deviceModel,
    deviceColor: deviceColor || null,
    deviceType,
    assignedPrice,
    notes: notes || null,
    agreementAccepted: !!agreementAccepted,
    status: "assigned",
    assignedAt: Date.now(),
  });

  // ── Notify collector ─────────────────────────────────────────────────────
  enqueueNotify
    .transactionUpdate(collectorId, "assigned", `${deviceBrand} ${deviceModel}`)
    .catch(() => {});

  return tx;
}

async function updateTransactionStatus(txId, newStatus, requestorUid) {
  const tx = await txRepo.findById(txId);
  if (!tx) throw Object.assign(new Error("Transaction not found"), { status: 404 });

  // Only the owner may change status
  if (tx.ownerId !== requestorUid) {
    throw Object.assign(new Error("Only the transaction owner may update its status"), { status: 403 });
  }

  const validTransitions = {
    assigned: ["paid", "returned", "theft"],
    // Allow owner to resolve a theft (e.g. phone was recovered)
    theft: ["paid", "returned"],
  };

  const allowed = validTransitions[tx.status] || [];
  if (!allowed.includes(newStatus)) {
    throw Object.assign(
      new Error(`Cannot transition from "${tx.status}" to "${newStatus}"`),
      { status: 400 }
    );
  }

  const previousStatus = tx.status;

  await txRepo.update(txId, {
    status: newStatus,
    resolvedAt: Date.now(),
  });

  const updatedTx = { ...tx, status: newStatus };

  // ── Side effects ─────────────────────────────────────────────────────────

  if (newStatus === "theft") {
    // 1. Auto-register in stolen device registry
    const ownerProfile = await userRepo.findById(tx.ownerId).catch(() => null);
    await registerDeviceAsStolen(updatedTx, ownerProfile).catch((err) =>
      logger.error(`[txService] registerDeviceAsStolen failed: ${err.message}`)
    );

    // 2. Broadcast to all active users
    const deviceLabel = `${tx.deviceBrand} ${tx.deviceModel}`;
    broadcastTheftAlert(tx.ownerId, deviceLabel); // fire-and-forget

    // 3. Notify both parties directly
    enqueueNotify
      .theftAlert(tx.collectorId, deviceLabel)
      .catch(() => {});

    // 4. Trust score penalty for collector
    enqueueTrustScore(tx.collectorId, "theft_reported").catch(() => {});
  }

  if ((newStatus === "paid" || newStatus === "returned") && previousStatus === "theft") {
    // Owner recovered the device — clear stolen flag
    await clearDeviceStolenFlag(updatedTx).catch((err) =>
      logger.error(`[txService] clearDeviceStolenFlag failed: ${err.message}`)
    );
  }

  if (newStatus === "paid") {
    enqueueTrustScore(tx.collectorId, "transaction_paid").catch(() => {});
    enqueueTrustScore(tx.ownerId, "transaction_paid").catch(() => {});
  }

  // Notify both parties of status change
  const deviceLabel = `${tx.deviceBrand} ${tx.deviceModel}`;
  enqueueNotify.transactionUpdate(tx.ownerId, newStatus, deviceLabel).catch(() => {});
  enqueueNotify.transactionUpdate(tx.collectorId, newStatus, deviceLabel).catch(() => {});

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