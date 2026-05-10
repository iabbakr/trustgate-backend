/**
 * services/device.service.js
 *
 * Handles device checks and theft reports.
 *
 * Supports:
 *  - Mobile phones  — identified by IMEI (required) or serial number
 *  - Laptops        — identified by serial number (IMEI not applicable)
 *  - Any device     — brand + model always required
 *
 * Duplicate-report guard:
 *  - If an identical active report already exists (same IMEI or serial,
 *    status = stolen/flagged) the service throws 409 instead of creating
 *    a duplicate entry.
 */

const { deviceRepo } = require("../repositories/device.repository");
const userRepo = require("../repositories/user.repository");
const logger = require("../utils/logger");

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDeviceLabel(brand, model) {
  return [brand, model].filter(Boolean).join(" ");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up a device by IMEI or serial number.
 * Returns the device record (with status) or null if not found.
 */
async function checkDevice({ imei, serialNumber }) {
  if (imei) {
    const record = await deviceRepo.findByImei(imei.replace(/\s|-/g, ""));
    if (record) return record;
  }

  if (serialNumber) {
    const record = await deviceRepo.findBySerial(serialNumber.trim());
    if (record) return record;
  }

  return null;
}

/**
 * Report a device as stolen / flagged.
 *
 * Rules:
 *  1. At least one of IMEI or serial number must be provided.
 *  2. For mobile phones, IMEI must be 15 digits if supplied.
 *  3. No duplicate active reports for the same identifier.
 *  4. deviceType defaults to "mobile"; pass "laptop" for laptops.
 */
async function reportStolen(data, reporterUid) {
  const {
    imei,
    serialNumber,
    brand,
    model,
    color,
    description,
    deviceType = "mobile", // "mobile" | "laptop" | "other"
  } = data;

  // ── Validation ────────────────────────────────────────────────────────────
  const cleanImei = imei ? imei.replace(/\s|-/g, "") : null;
  const cleanSerial = serialNumber ? serialNumber.trim() : null;

  if (!cleanImei && !cleanSerial) {
    throw Object.assign(
      new Error("At least one of IMEI or serial number is required."),
      { status: 400 }
    );
  }

  if (cleanImei && !/^\d{15}$/.test(cleanImei)) {
    throw Object.assign(
      new Error("IMEI must be exactly 15 digits."),
      { status: 400 }
    );
  }

  if (!brand || !model) {
    throw Object.assign(
      new Error("Brand and model are required."),
      { status: 400 }
    );
  }

  if (!description || description.trim().length < 20) {
    throw Object.assign(
      new Error("Description must be at least 20 characters."),
      { status: 400 }
    );
  }

  // ── Duplicate guard ───────────────────────────────────────────────────────
  let existing = null;

  if (cleanImei) {
    existing = await deviceRepo.findByImei(cleanImei);
  }

  if (!existing && cleanSerial) {
    existing = await deviceRepo.findBySerial(cleanSerial);
  }

  if (existing && (existing.status === "stolen" || existing.status === "flagged")) {
    throw Object.assign(
      new Error(
        `An active report already exists for this device (ID: ${existing.id}). ` +
        "Duplicate reports are not allowed."
      ),
      { status: 409, code: "DUPLICATE_REPORT" }
    );
  }

  // ── Fetch reporter profile ────────────────────────────────────────────────
  const reporter = await userRepo.findById(reporterUid);

  // ── Create or update record ───────────────────────────────────────────────
  const payload = {
    imei: cleanImei || null,
    serialNumber: cleanSerial || null,
    brand: brand.trim(),
    model: model.trim(),
    color: color ? color.trim() : null,
    status: "stolen",
    deviceType,
    reportedBy: reporterUid,
    reporterName: reporter?.displayName || "Unknown",
    reporterShop: reporter?.shopName || null,
    description: description.trim(),
    reportedAt: Date.now(),
    transactionId: null, // manually reported, no linked transaction
  };

  let device;
  if (existing) {
    // Existing record was "clean" — re-flag it
    await deviceRepo.update(existing.id, payload);
    device = { ...existing, ...payload };
  } else {
    device = await deviceRepo.create(null, payload);
  }

  // Broadcast notification (fire-and-forget via notification job)
  try {
    const { enqueueNotify } = require("../jobs/notification.job");
    const { db } = require("../config/firebase");
    const { COLLECTIONS } = require("../utils/constants");

    const deviceLabel = buildDeviceLabel(brand, model);

    // Paginated broadcast to all active users
    let lastDoc = null;
    do {
      let q = db
        .collection(COLLECTIONS.USERS)
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

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < 200) break;
    } while (true);
  } catch (err) {
    logger.error(`[deviceService] broadcast failed: ${err.message}`);
  }

  return device;
}

async function getAllDevices(limit = 100) {
  return deviceRepo.findAll(limit);
}

async function deleteDevice(id) {
  await deviceRepo.delete(id);
}

module.exports = {
  checkDevice,
  reportStolen,
  getAllDevices,
  deleteDevice,
};