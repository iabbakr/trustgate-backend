/**
 * BaseRepository — thin abstraction over Firestore.
 *
 * PURPOSE: When you want to switch to MongoDB or PostgreSQL, you only
 * rewrite this file (and each subclass's custom queries). Controllers
 * and services remain unchanged.
 *
 * Conventions:
 *   - All methods are async.
 *   - Documents are returned as plain objects with an `id` field.
 *   - Timestamps use epoch milliseconds (not Firestore Timestamps).
 */

const { db } = require("../config/firebase");

class BaseRepository {
  constructor(collectionName) {
    this.collection = collectionName;
    this.col = db.collection(collectionName);
  }

  async findById(id) {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  }

  async findOne(filters = {}) {
    let q = this.col;
    for (const [field, value] of Object.entries(filters)) {
      q = q.where(field, "==", value);
    }
    const snap = await q.limit(1).get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  async findMany({ filters = {}, orderField, orderDir = "desc", limitCount = 50, startAfterDoc } = {}) {
    let q = this.col;
    for (const [field, value] of Object.entries(filters)) {
      q = q.where(field, "==", value);
    }
    if (orderField) q = q.orderBy(orderField, orderDir);
    if (startAfterDoc) q = q.startAfter(startAfterDoc);
    q = q.limit(limitCount);
    const snap = await q.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async create(id, data) {
    const docRef = id ? this.col.doc(id) : this.col.doc();
    const payload = { ...data, createdAt: Date.now() };
    await docRef.set(payload);
    return { id: docRef.id, ...payload };
  }

  async update(id, data) {
    await this.col.doc(id).update({ ...data, updatedAt: Date.now() });
  }

  async delete(id) {
    await this.col.doc(id).delete();
  }

  async exists(id) {
    const snap = await this.col.doc(id).get();
    return snap.exists;
  }

  async count(filters = {}) {
    let q = this.col;
    for (const [field, value] of Object.entries(filters)) {
      q = q.where(field, "==", value);
    }
    const snap = await q.count().get();
    return snap.data().count;
  }

  /** Atomic increment using FieldValue */
  async increment(id, field, delta = 1) {
    const { admin } = require("../config/firebase");
    await this.col.doc(id).update({
      [field]: admin.firestore.FieldValue.increment(delta),
    });
  }
}

module.exports = BaseRepository;
