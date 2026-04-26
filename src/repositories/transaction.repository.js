const BaseRepository = require("./base.repository");
const { COLLECTIONS } = require("../utils/constants");

class TransactionRepository extends BaseRepository {
  constructor() {
    super(COLLECTIONS.TRANSACTIONS);
  }

  async findByCollector(collectorId, limit = 50) {
    return this.findMany({
      filters: { collectorId },
      orderField: "assignedAt",
      limitCount: limit,
    });
  }

  async findByOwner(ownerId, limit = 100) {
    return this.findMany({
      filters: { ownerId },
      orderField: "assignedAt",
      limitCount: limit,
    });
  }

  async findActive(uid) {
    // Items either owned or collected, status=assigned
    const [owned, collected] = await Promise.all([
      this.findMany({ filters: { ownerId: uid, status: "assigned" } }),
      this.findMany({ filters: { collectorId: uid, status: "assigned" } }),
    ]);
    return [...owned, ...collected];
  }
}

module.exports = new TransactionRepository();