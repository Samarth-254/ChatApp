const messageModel = require('../models/messageModel');

async function getMessages(req, res) {
  try {
    const roomId = typeof req.params?.roomId === 'string' ? req.params.roomId.trim() : '';

    if (!roomId) {
      return res.status(400).json({ message: 'Room is required' });
    }

    const messages = await messageModel.getMessagesByRoomId(roomId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
}

module.exports = { getMessages };
