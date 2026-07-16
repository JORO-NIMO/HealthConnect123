const NotificationModel = require('../models/Notification.model');
const { sendSuccess, sendError } = require('../utils/response.util');

// ─── Get Notifications ────────────────────────────────────────────────────
exports.getNotifications = async (req, res, next) => {
  try {
    const { limit = 30, offset = 0, unreadOnly } = req.query;
    // Optimize: Fetch notifications and unread count in parallel using Promise.all to reduce API latency
    const [notifications, unreadCount] = await Promise.all([
      NotificationModel.listByUser(req.user.id, {
        limit: parseInt(limit), offset: parseInt(offset),
        unreadOnly: unreadOnly === 'true',
      }),
      NotificationModel.unreadCount(req.user.id)
    ]);

    return sendSuccess(res, 200, 'Notifications retrieved.', { notifications, unreadCount });
  } catch (err) { next(err); }
};

// ─── Get Unread Count ─────────────────────────────────────────────────────
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await NotificationModel.unreadCount(req.user.id);
    return sendSuccess(res, 200, 'Unread count.', { count });
  } catch (err) { next(err); }
};

// ─── Mark as Read ─────────────────────────────────────────────────────────
exports.markRead = async (req, res, next) => {
  try {
    await NotificationModel.markRead(req.params.id, req.user.id);
    return sendSuccess(res, 200, 'Notification marked as read.');
  } catch (err) { next(err); }
};

// ─── Mark All Read ────────────────────────────────────────────────────────
exports.markAllRead = async (req, res, next) => {
  try {
    await NotificationModel.markAllRead(req.user.id);
    return sendSuccess(res, 200, 'All notifications marked as read.');
  } catch (err) { next(err); }
};

// ─── Delete Notification ──────────────────────────────────────────────────
exports.deleteNotification = async (req, res, next) => {
  try {
    const deleted = await NotificationModel.delete(req.params.id, req.user.id);
    if (!deleted) return sendError(res, 404, 'Notification not found.');
    return sendSuccess(res, 200, 'Notification deleted.');
  } catch (err) { next(err); }
};
