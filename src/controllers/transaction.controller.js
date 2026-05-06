// controllers/transaction.controller.js
const txService = require("../services/transaction.service");

async function createTransaction(req, res, next) {
  try {
    const tx = await txService.createTransaction(req.user.uid, req.body);
    res.status(201).json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
}

async function updateTransaction(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tx = await txService.updateTransactionStatus(
      id,
      status,
      req.user.uid
    );
    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
}

async function getMyTransactions(req, res, next) {
  try {
    const data = await txService.getMyTransactions(req.user.uid);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getShopTransactions(req, res, next) {
  try {
    const data = await txService.getShopTransactions(req.user.uid);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTransaction,
  updateTransaction,
  getMyTransactions,
  getShopTransactions,
};