const chatService = require("../services/chat.service");

async function getOrCreateConversation(req, res, next) {
  try {
    const { uid2, name2 } = req.body;
    if (!uid2) {
      return res
        .status(400)
        .json({ success: false, error: "uid2 is required" });
    }
    const result = await chatService.getOrCreateConversation(
      req.user.uid,
      req.profile?.displayName || "User",
      uid2,
      name2 || "Dealer"
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getConversations(req, res, next) {
  try {
    const convs = await chatService.getUserConversations(req.user.uid);
    res.json({ success: true, data: convs });
  } catch (err) {
    next(err);
  }
}

async function getMessages(req, res, next) {
  try {
    const messages = await chatService.getMessages(
      req.params.id,
      req.user.uid
    );
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    // Support text + media (imageUrl, videoUrl, fileUrl, fileType, fileName)
    const { text, imageUrl, videoUrl, fileUrl, fileType, fileName, mimeType } =
      req.body;

    if (!text && !imageUrl && !videoUrl && !fileUrl) {
      return res
        .status(400)
        .json({ success: false, error: "Message must have text or media" });
    }

    const msg = await chatService.sendMessage(
      req.params.id,
      req.user.uid,
      req.profile?.displayName || "User",
      text,
      imageUrl,
      videoUrl,
      fileUrl,
      fileType,
      fileName,
      mimeType
    );
    res.status(201).json({ success: true, data: msg });
  } catch (err) {
    next(err);
  }
}

async function acceptRequest(req, res, next) {
  try {
    await chatService.acceptRequest(req.params.id, req.user.uid);
    res.json({ success: true, message: "Request accepted" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  acceptRequest,
};