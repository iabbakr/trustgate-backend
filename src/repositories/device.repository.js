/**
 * repositories/device.repository.js
 *
 * Extended to support:
 *  - findBySerial  — needed for laptop lookups (no IMEI)
 *  - findByTransactionId — used by txService to clear stolen flag
 *  - findAll with optional status filter
 */

const BaseRepository = require("./base.repository");
const { COLLECTIONS } = require("../utils/constants");
const { db } = require("../config/firebase");

class DeviceRepository extends BaseRepository {
  constructor() {
    super(COLLECTIONS.DEVICES);
  }

  async findByImei(imei) {
    return this.findOne({ imei });
  }

  async findBySerial(serialNumber) {
    return this.findOne({ serialNumber });
  }

  /**
   * Find a device record linked to a specific transaction.
   * Used when clearing the stolen flag after a transaction resolves.
   */
  async findByTransactionId(transactionId) {
    return this.findOne({ transactionId });
  }

  /**
   * List all devices, optionally filtered by status.
   * @param {number} limitCount
   * @param {"stolen"|"flagged"|"clean"|null} status
   */
  async findAll(limitCount = 100, status = null) {
    const filters = status ? { status } : {};
    return this.findMany({
      filters,
      orderField: "reportedAt",
      orderDir: "desc",
      limitCount,
    });
  }

  /**
   * Find all stolen/flagged records in a given area (for locality-based alerts).
   * Useful for future "devices stolen near you" feature.
   */
  async findStolenByArea(area) {
    const snap = await db
      .collection(COLLECTIONS.DEVICES)
      .where("status", "==", "stolen")
      .where("reporterArea", "==", area)
      .orderBy("reportedAt", "desc")
      .limit(50)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

class BannedNinRepository extends BaseRepository {
  constructor() {
    super(COLLECTIONS.BANNED_NIN);
  }

  async isBanned(nin) {
    return this.exists(nin);
  }

  async ban(nin, uid) {
    return this.create(nin, { uid, bannedAt: Date.now() });
  }
}

class BannedBvnRepository extends BaseRepository {
  constructor() {
    super(COLLECTIONS.BANNED_BVN);
  }

  async isBanned(bvn) {
    return this.exists(bvn);
  }

  async ban(bvn, uid) {
    return this.create(bvn, { uid, bannedAt: Date.now() });
  }
}

module.exports = {
  deviceRepo: new DeviceRepository(),
  bannedNinRepo: new BannedNinRepository(),
  bannedBvnRepo: new BannedBvnRepository(),
};