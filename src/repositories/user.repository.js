const BaseRepository = require("./base.repository");
const { COLLECTIONS } = require("../utils/constants");
const { db } = require("../config/firebase");

class UserRepository extends BaseRepository {
  constructor() {
    super(COLLECTIONS.USERS);
  }

  async findByEmail(email) {
    return this.findOne({ email });
  }

  async findByReferralCode(code) {
    return this.findOne({ referralCode: code });
  }

  async findByNin(nin) {
    return this.findOne({ nin });
  }

  async findByBvn(bvn) {
    return this.findOne({ bvn });
  }

  async findByArea(area, limit = 20) {
    return this.findMany({ filters: { area, status: "active" }, limitCount: limit });
  }

  async searchUsers(queryStr, limit = 50) {
    // Firestore has no full-text search — we fetch active users
    // and filter in memory. For production scale, use Algolia or Typesense.
    const all = await this.findMany({ filters: { status: "active" }, limitCount: 200 });
    const q = queryStr.toLowerCase();
    return all
      .filter(
        (u) =>
          u.displayName?.toLowerCase().includes(q) ||
          u.shopName?.toLowerCase().includes(q) ||
          u.area?.toLowerCase().includes(q) ||
          u.city?.toLowerCase().includes(q)
      )
      .slice(0, limit);
  }

  async findFlagged() {
    return this.findMany({ filters: { isFlagged: true }, limitCount: 100 });
  }

  async findPending() {
    return this.findMany({ filters: { status: "pending" }, limitCount: 100 });
  }

  async findBanned() {
    return this.findMany({ filters: { status: "banned" }, limitCount: 100 });
  }
}

module.exports = new UserRepository();