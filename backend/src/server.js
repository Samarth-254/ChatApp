const dotenv = require('dotenv');
dotenv.config();

const http = require('http');
const { Server } = require('socket.io');
const { createApp } = require('./app');
const { ensureMessagesTable } = require('./models/messageModel');
const { ensureUsersTable, ensureRoomsTable } = require('./db');
const { registerChatSocket } = require('./sockets/chatSocket');

const app = createApp();
const server = http.createServer(app);
const frontendUrl = process.env.FRONTEND_URL;

const io = new Server(server, {
  cors: {
    origin: frontendUrl,
    credentials: true,
  },
});

registerChatSocket(io);

const port = process.env.PORT || 5000;

async function start() {
  try {
    await ensureUsersTable();
    await ensureRoomsTable();
    await ensureMessagesTable();

    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Server failed to start:', error);
    process.exit(1);
  }
}

start();
