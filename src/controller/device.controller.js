const deviceService = require("../services/device.service");

async function checkDevice(req, res, next) {
  try {
    const { imei, serialNumber } = req.query;
    if (!imei && !serialNumber) {
      return res.status(400).json({ success: false, error: "Provide imei or serialNumber" });
    }
    const device = await deviceService.checkDevice({ imei, serialNumber });
    res.json({ success: true, data: device || null, status: device ? device.status : "clean" });
  } catch (err) {
    next(err);
  }
}

async function reportDevice(req, res, next) {
  try {
    const device = await deviceService.reportStolen(req.body, req.user.uid);
    res.status(201).json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
}

async function getAllDevices(req, res, next) {
  try {
    const devices = await deviceService.getAllDevices();
    res.json({ success: true, data: devices });
  } catch (err) {
    next(err);
  }
}

async function deleteDevice(req, res, next) {
  try {
    await deviceService.deleteDevice(req.params.id);
    res.json({ success: true, message: "Device record deleted" });
  } catch (err) {
    next(err);
  }
}

module.exports = { checkDevice, reportDevice, getAllDevices, deleteDevice };