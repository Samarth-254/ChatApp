const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const messageRoutes = require('./routes/messageRoutes');

function createApp() {
  const app = express();
  const frontendUrl = process.env.FRONTEND_URL;

  app.use(
    cors({
      origin: frontendUrl,
      credentials: true,
    })
  );
  app.use(express.json());

  app.use(authRoutes);
  app.use(roomRoutes);
  app.use(messageRoutes);

  return app;
}

module.exports = { createApp };
