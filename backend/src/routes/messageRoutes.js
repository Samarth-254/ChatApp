const express = require('express');
const { getMessages } = require('../controllers/messageController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/rooms/:roomId/messages', requireAuth, getMessages);

module.exports = router;
