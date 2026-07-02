const { createRoom, findRoomByCode, normalizeRoomCode } = require('../models/roomModel');

function normalizeRoomName(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function createNewRoom(req, res) {
  try {
    const room = await createRoom({
      name: normalizeRoomName(req.body?.name),
      createdBy: req.user?.username,
    });

    return res.status(201).json({
      room_id: room.room_id,
      code: room.code,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create room' });
  }
}

async function getRoom(req, res) {
  try {
    const code = normalizeRoomCode(req.params?.code);

    if (!code) {
      return res.status(400).json({ message: 'Invalid room code' });
    }

    const room = await findRoomByCode(code);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    return res.json({
      room_id: room.room_id,
      name: room.name,
      code: room.code,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load room' });
  }
}

module.exports = {
  createNewRoom,
  getRoom,
};
