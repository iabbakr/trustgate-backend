/**
 * repositories/transaction.repository.js
 */

const BaseRepository = require("./base.repository");
const { COLLECTIONS } = require("../utils/constants");
const { db } = require("../config/firebase");

class TransactionRepository extends BaseRepository {
  constructor() {
    super(COLLECTIONS.TRANSACTIONS);
  }

  async findByCollector(collectorId, limit = 50) {
    return this.findMany({
      filters: { collectorId },
      orderField: "assignedAt",
      orderDir: "desc",
      limitCount: limit,
    });
  }

  async findByOwner(ownerId, limit = 100) {
    return this.findMany({
      filters: { ownerId },
      orderField: "assignedAt",
      orderDir: "desc",
      limitCount: limit,
    });
  }

  async findActive(uid) {
    const [owned, collected] = await Promise.all([
      this.findMany({ filters: { ownerId: uid, status: "assigned" } }),
      this.findMany({ filters: { collectorId: uid, status: "assigned" } }),
    ]);
    return [...owned, ...collected];
  }

  /**
   * Find an open (assigned) transaction for a given IMEI.
   * Used to prevent duplicate assignments of the same device.
   */
  async findActiveByImei(imei) {
    const snap = await db
      .collection(COLLECTIONS.TRANSACTIONS)
      .where("deviceImei", "==", imei)
      .where("status", "==", "assigned")
      .limit(1)
      .get();

    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  /**
   * Find an open (assigned) transaction for a given serial number.
   */
  async findActiveBySerial(serialNumber) {
    const snap = await db
      .collection(COLLECTIONS.TRANSACTIONS)
      .where("deviceSerialNumber", "==", serialNumber)
      .where("status", "==", "assigned")
      .limit(1)
      .get();

    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
}

module.exports = new TransactionRepository();