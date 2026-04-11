const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/support.controller');
const { optionalAuth } = require('../middleware/auth.middleware');
const { supportChatLimiter } = require('../middleware/rateLimiter.middleware');

router.post('/chat', optionalAuth, supportChatLimiter, ctrl.chat);

module.exports = router;
