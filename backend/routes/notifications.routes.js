const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/notifications.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/',           ctrl.getNotifications);
router.get('/unread',     ctrl.getUnreadCount);
router.patch('/:id/read', ctrl.markRead);
router.patch('/read-all', ctrl.markAllRead);
router.delete('/:id',     ctrl.deleteNotification);

module.exports = router;
