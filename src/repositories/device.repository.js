const BaseRepository = require("./base.repository");
const { COLLECTIONS } = require("../utils/constants");

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

  async findAll(limit = 100) {
    return this.findMany({ orderField: "reportedAt", limitCount: limit });
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