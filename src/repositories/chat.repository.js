const BaseRepository = require("./base.repository");
const { COLLECTIONS } = require("../utils/constants");
const { db, admin } = require("../config/firebase");

class ChatRepository extends BaseRepository {
  constructor() {
    super(COLLECTIONS.CONVERSATIONS);
  }

  conversationId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
  }

  messagesCol(convId) {
    return db.collection(
      `${COLLECTIONS.CONVERSATIONS}/${convId}/${COLLECTIONS.MESSAGES}`
    );
  }

  async getOrCreate(uid1, name1, uid2, name2, isMutual) {
    const convId = this.conversationId(uid1, uid2);
    const existing = await this.findById(convId);
    if (existing) return { id: convId, isNew: false, data: existing };

    const payload = {
      participants: [uid1, uid2],
      participantNames: { [uid1]: name1, [uid2]: name2 },
      lastMessage: "",
      lastMessageAt: Date.now(),
      isRequest: !isMutual,
      requestBy: !isMutual ? uid1 : null,
      requestAccepted: isMutual,
      unread: { [uid1]: 0, [uid2]: 0 },
    };
    await this.create(convId, payload);
    return { id: convId, isNew: true, data: payload };
  }

  /**
   * Send a message with optional media attachments.
   * Supports: text, imageUrl, videoUrl, fileUrl, fileType, fileName, mimeType
   */
  async sendMessage(
    convId,
    senderId,
    senderName,
    text,
    imageUrl,
    videoUrl,
    fileUrl,
    fileType,
    fileName,
    mimeType
  ) {
    // Build the last-message preview
    let preview = text || null;
    if (!preview && imageUrl) preview = "📷 Photo";
    if (!preview && videoUrl) preview = "🎥 Video";
    if (!preview && fileUrl) preview = `📎 ${fileName || "File"}`;

    const msg = {
      senderId,
      senderName,
      text: text || null,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      fileUrl: fileUrl || null,
      fileType: fileType || null, // "image" | "video" | "file"
      fileName: fileName || null,
      mimeType: mimeType || null,
      createdAt: Date.now(),
    };

    // Remove null fields to keep Firestore clean
    Object.keys(msg).forEach((k) => msg[k] === null && delete msg[k]);

    const ref = await this.messagesCol(convId).add(msg);

    await this.col.doc(convId).update({
      lastMessage: preview || "Message",
      lastMessageAt: msg.createdAt,
      [`unread.${senderId}`]: 0,
    });

    return { id: ref.id, ...msg };
  }

  async getMessages(convId, limitCount = 100) {
    const snap = await this.messagesCol(convId)
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async getUserConversations(uid, limitCount = 50) {
    const snap = await this.col
      .where("participants", "array-contains", uid)
      .orderBy("lastMessageAt", "desc")
      .limit(limitCount)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async acceptRequest(convId) {
    await this.col
      .doc(convId)
      .update({ isRequest: false, requestAccepted: true });
  }

  async markRead(convId, uid) {
    await this.col.doc(convId).update({ [`unread.${uid}`]: 0 });
  }
}

module.exports = new ChatRepository();