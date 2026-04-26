const { deviceRepo } = require("../repositories/device.repository");
const cache = require("./cache.service");
const { CACHE_KEYS, TTL } = require("../utils/constants");
const { notify } = require("./notification.service");
const emailService = require("./email.service");
const userRepo = require("../repositories/user.repository");
const logger = require("../utils/logger");

async function checkDevice({ imei, serialNumber }) {
  if (imei) {
    return cache.wrap(
      CACHE_KEYS.deviceImei(imei),
      TTL.DEVICE_CHECK,
      () => deviceRepo.findByImei(imei)
    );
  }
  if (serialNumber) {
    return cache.wrap(
      CACHE_KEYS.deviceSerial(serialNumber),
      TTL.DEVICE_CHECK,
      () => deviceRepo.findBySerial(serialNumber)
    );
  }
  return null;
}

async function reportStolen(data, reporterUid) {
  const device = await deviceRepo.create(null, {
    ...data,
    reportedBy: reporterUid,
    status: "stolen",
    reportedAt: Date.now(),
  });

  // Invalidate cache
  if (data.imei) await cache.del(CACHE_KEYS.deviceImei(data.imei));
  if (data.serialNumber) await cache.del(CACHE_KEYS.deviceSerial(data.serialNumber));

  // Email reporter confirmation
  const reporter = await userRepo.findById(reporterUid);
  if (reporter) {
    emailService.theftAlertEmail(reporter, data).catch((e) =>
      logger.warn("Theft alert email failed:", e.message)
    );
  }

  return device;
}

async function getAllDevices(limit = 100) {
  return deviceRepo.findAll(limit);
}

async function deleteDevice(id) {
  const device = await deviceRepo.findById(id);
  if (!device) throw new Error("Device not found");
  await deviceRepo.delete(id);
  if (device.imei) await cache.del(CACHE_KEYS.deviceImei(device.imei));
  if (device.serialNumber) await cache.del(CACHE_KEYS.deviceSerial(device.serialNumber));
}

module.exports = { checkDevice, reportStolen, getAllDevices, deleteDevice };