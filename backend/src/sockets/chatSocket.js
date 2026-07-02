const messageModel = require('../models/messageModel');
const { findRoomById } = require('../models/roomModel');
const { verifyAuthToken } = require('../utils/auth');

const roomMembersByRoomId = new Map();
const roomTypingByRoomId = new Map();
const readReceiptsByMessageId = new Map();

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getRoomMap(store, roomId) {
  if (!store.has(roomId)) {
    store.set(roomId, new Map());
  }

  return store.get(roomId);
}

function addSocketToRoom(store, roomId, username, socketId) {
  const roomMap = getRoomMap(store, roomId);

  if (!roomMap.has(username)) {
    roomMap.set(username, new Set());
  }

  roomMap.get(username).add(socketId);
}

function removeSocketFromRoom(store, roomId, username, socketId) {
  const roomMap = store.get(roomId);

  if (!roomMap || !roomMap.has(username)) {
    return;
  }

  const socketIds = roomMap.get(username);
  socketIds.delete(socketId);

  if (socketIds.size === 0) {
    roomMap.delete(username);
  }

  if (roomMap.size === 0) {
    store.delete(roomId);
  }
}

function getRoomUsers(store, roomId) {
  const roomMap = store.get(roomId);

  if (!roomMap) {
    return [];
  }

  return [...roomMap.keys()].sort((first, second) => first.localeCompare(second));
}

function getRoomTypingUsers(roomId) {
  return getRoomUsers(roomTypingByRoomId, roomId);
}

function broadcastRoomPresence(io, roomId) {
  io.to(roomId).emit('online_users', getRoomUsers(roomMembersByRoomId, roomId));
  io.to(roomId).emit('typing_users_update', getRoomTypingUsers(roomId));
}

function removeSocketFromCurrentRoom(socket) {
  const previousRoomId = socket.data.currentRoomId;
  const username = socket.data.username;

  if (!previousRoomId || !username) {
    return;
  }

  socket.leave(previousRoomId);
  removeSocketFromRoom(roomMembersByRoomId, previousRoomId, username, socket.id);
  removeSocketFromRoom(roomTypingByRoomId, previousRoomId, username, socket.id);
  socket.data.currentRoomId = null;
}

function registerChatSocket(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const decoded = verifyAuthToken(token);
      socket.user = {
        id: decoded.userId,
        username: decoded.username,
      };

      return next();
    } catch (error) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const username = normalizeText(socket.user?.username);

    if (!username) {
      socket.disconnect(true);
      return;
    }

    socket.data.username = username;
    socket.data.currentRoomId = null;

    socket.on('join_room', async (payload = {}) => {
      try {
        const requestedRoomId = normalizeText(payload.roomId);

        if (!requestedRoomId) {
          return;
        }

        const room = await findRoomById(requestedRoomId);

        if (!room) {
          socket.emit('room_not_found', { roomId: requestedRoomId });
          return;
        }

        if (socket.data.currentRoomId === requestedRoomId) {
          broadcastRoomPresence(io, requestedRoomId);
          return;
        }

        removeSocketFromCurrentRoom(socket);
        socket.join(requestedRoomId);
        socket.data.currentRoomId = requestedRoomId;

        addSocketToRoom(roomMembersByRoomId, requestedRoomId, username, socket.id);
        broadcastRoomPresence(io, requestedRoomId);
        socket.to(requestedRoomId).emit('user_joined', { roomId: requestedRoomId, username });
      } catch (error) {
        console.error('join_room failed:', error);
      }
    });

    socket.on('typing', (payload = {}) => {
      try {
        const roomId = normalizeText(payload.roomId) || socket.data.currentRoomId;

        if (!roomId || roomId !== socket.data.currentRoomId) {
          return;
        }

        addSocketToRoom(roomTypingByRoomId, roomId, username, socket.id);
        socket.to(roomId).emit('typing', { roomId, username });
        broadcastRoomPresence(io, roomId);
      } catch (error) {
        console.error('typing failed:', error);
      }
    });

    socket.on('stop_typing', (payload = {}) => {
      try {
        const roomId = normalizeText(payload.roomId) || socket.data.currentRoomId;

        if (!roomId || roomId !== socket.data.currentRoomId) {
          return;
        }

        removeSocketFromRoom(roomTypingByRoomId, roomId, username, socket.id);
        socket.to(roomId).emit('stop_typing', { roomId, username });
        broadcastRoomPresence(io, roomId);
      } catch (error) {
        console.error('stop_typing failed:', error);
      }
    });

    socket.on('send_message', async (payload = {}) => {
      try {
        const roomId = normalizeText(payload.roomId) || socket.data.currentRoomId;
        const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
        const clientMessageId = typeof payload?.client_message_id === 'string' ? payload.client_message_id : null;

        if (!roomId || roomId !== socket.data.currentRoomId || !content) {
          return;
        }

        const message = await messageModel.createMessage(roomId, username, content);
        io.to(roomId).emit('receive_message', {
          ...message,
          client_message_id: clientMessageId,
        });
      } catch (error) {
        console.error('send_message failed:', error);
      }
    });

    socket.on('message_read', (payload = {}) => {
      try {
        const roomId = normalizeText(payload.roomId) || socket.data.currentRoomId;
        const messageId = Number(payload?.message_id);
        const readerName = username;

        if (!roomId || roomId !== socket.data.currentRoomId || !messageId || !readerName) {
          return;
        }

        if (!readReceiptsByMessageId.has(messageId)) {
          readReceiptsByMessageId.set(messageId, new Set());
        }

        const receipts = readReceiptsByMessageId.get(messageId);

        if (receipts.has(readerName)) {
          return;
        }

        receipts.add(readerName);
        socket.to(roomId).emit('message_read_update', {
          message_id: messageId,
          reader_name: readerName,
        });
      } catch (error) {
        console.error('message_read failed:', error);
      }
    });

    socket.on('disconnect', () => {
      const roomId = socket.data.currentRoomId;

      if (roomId) {
        removeSocketFromRoom(roomMembersByRoomId, roomId, username, socket.id);
        removeSocketFromRoom(roomTypingByRoomId, roomId, username, socket.id);
        broadcastRoomPresence(io, roomId);
      }
    });
  });
}

module.exports = { registerChatSocket };
