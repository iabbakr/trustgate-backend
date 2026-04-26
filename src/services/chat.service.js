const chatRepo = require("../repositories/chat.repository");
const { areMutualFollowers } = require("./social.service");
const { notify } = require("./notification.service");

async function getOrCreateConversation(uid1, name1, uid2, name2) {
  const isMutual = await areMutualFollowers(uid1, uid2);
  return chatRepo.getOrCreate(uid1, name1, uid2, name2, isMutual);
}

async function sendMessage(convId, senderId, senderName, text, imageUrl) {
  const conv = await chatRepo.findById(convId);
  if (!conv) throw new Error("Conversation not found");
  if (!conv.participants.includes(senderId)) throw new Error("Not a participant");

  const recipientId = conv.participants.find((p) => p !== senderId);
  const msg = await chatRepo.sendMessage(convId, senderId, senderName, text, imageUrl);

  // Push notification
  if (conv.isRequest && !conv.requestAccepted) {
    notify.messageRequest(recipientId, senderName, convId).catch(() => {});
  } else {
    notify.newMessage(recipientId, senderName, convId).catch(() => {});
  }

  return msg;
}

async function getMessages(convId, uid, limit = 100) {
  const conv = await chatRepo.findById(convId);
  if (!conv || !conv.participants.includes(uid)) throw new Error("Access denied");
  await chatRepo.markRead(convId, uid);
  return chatRepo.getMessages(convId, limit);
}

async function acceptRequest(convId, uid) {
  const conv = await chatRepo.findById(convId);
  if (!conv) throw new Error("Conversation not found");
  if (!conv.participants.includes(uid)) throw new Error("Not a participant");
  await chatRepo.acceptRequest(convId);
}

async function getUserConversations(uid) {
  return chatRepo.getUserConversations(uid);
}

module.exports = { getOrCreateConversation, sendMessage, getMessages, acceptRequest, getUserConversations };