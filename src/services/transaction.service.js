// services/transaction.service.js
const transactionRepo = require("../repositories/transaction.repository");
const userRepo = require("../repositories/user.repository");
const { adjustTrustScore } = require("./user.service");
const { notify } = require("./notification.service");
const emailService = require("./email.service");
const logger = require("../utils/logger");

async function createTransaction(ownerId, data) {
  const [owner, collector] = await Promise.all([
    userRepo.findById(ownerId),
    userRepo.findById(data.collectorId),
  ]);

  if (!collector) throw new Error("Collector not found");
  if (collector.status !== "active")
    throw new Error("Collector account is not active");

  const tx = await transactionRepo.create(null, {
    ownerId,
    ownerName: owner.displayName,
    ownerShop: owner.shopName,
    ownerPhone: owner.phoneNumber || null,
    collectorId: data.collectorId,
    collectorName: collector.displayName,
    collectorShop: collector.shopName,
    collectorPhone: collector.phoneNumber || null, // ← included for contact
    deviceImei: data.deviceImei,
    deviceModel: data.deviceModel,
    deviceBrand: data.deviceBrand,
    assignedPrice: data.assignedPrice,
    status: "assigned",
    notes: data.notes || null,
    agreementAccepted: true,
    assignedAt: Date.now(),
  });

  // Notify collector
  notify
    .transactionUpdate(data.collectorId, "assigned", data.deviceModel)
    .catch(() => {});
  emailService
    .transactionAssignedEmail(owner, collector, tx)
    .catch(() => {});

  return tx;
}

async function updateTransactionStatus(id, status, requestingUid) {
  const tx = await transactionRepo.findById(id);
  if (!tx) throw new Error("Transaction not found");
  if (tx.ownerId !== requestingUid)
    throw new Error("Only the device owner can update this transaction");
  if (tx.status !== "assigned")
    throw new Error("Transaction is already resolved");

  const updates = { status, resolvedAt: Date.now() };
  await transactionRepo.update(id, updates);

  if (status === "theft") {
    await adjustTrustScore(tx.collectorId, "theft_report_on_user");
    notify
      .transactionUpdate(tx.collectorId, "theft", tx.deviceModel)
      .catch(() => {});
  } else if (status === "returned" || status === "paid") {
    await adjustTrustScore(tx.collectorId, "transaction_completed");
  }

  notify
    .transactionUpdate(tx.collectorId, status, tx.deviceModel)
    .catch(() => {});

  return { ...tx, ...updates };
}

async function getMyTransactions(uid) {
  return transactionRepo.findByCollector(uid);
}

async function getShopTransactions(uid) {
  return transactionRepo.findByOwner(uid);
}

module.exports = {
  createTransaction,
  updateTransactionStatus,
  getMyTransactions,
  getShopTransactions,
};