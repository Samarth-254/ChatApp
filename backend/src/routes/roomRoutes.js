const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { createNewRoom, getRoom } = require('../controllers/roomController');

const router = express.Router();

router.post('/rooms/create', requireAuth, createNewRoom);
router.get('/rooms/:code', requireAuth, getRoom);

module.exports = router;
