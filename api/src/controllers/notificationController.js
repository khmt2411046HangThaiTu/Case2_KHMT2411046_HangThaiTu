const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const HttpError = require('../utils/httpError');

// GET /notifications?unread=true&limit=30&skip=0
exports.list = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
    const filter = { userId: req.user._id };
    if (req.query.unread === 'true') filter.isRead = false;

    const items = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
    });
    res.status(200).json({ notifications: items.map((n) => n.toJSON()), unreadCount });
  } catch (err) {
    next(err);
  }
};

// GET /notifications/unread-count
exports.unreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
    });
    res.status(200).json({ count });
  } catch (err) {
    next(err);
  }
};

// PATCH /notifications/:id/read  (chỉ đánh dấu được thông báo của chính mình)
exports.markRead = async (req, res, next) => {
  try {
    const notFound = new HttpError(404, 'Không tìm thấy thông báo');
    if (!mongoose.isValidObjectId(req.params.id)) throw notFound;
    const n = await Notification.findById(req.params.id);
    if (!n || String(n.userId) !== String(req.user._id)) throw notFound;
    n.isRead = true;
    await n.save();
    res.status(200).json({ notification: n.toJSON() });
  } catch (err) {
    next(err);
  }
};

// PATCH /notifications/read-all
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );
    res.status(200).json({ message: 'Đã đánh dấu tất cả là đã đọc' });
  } catch (err) {
    next(err);
  }
};
