const mongoose = require('mongoose');
const EmailLog = require('../models/EmailLog');
const Task = require('../models/Task');
const HttpError = require('../utils/httpError');
const service = require('../services/taskService');
const emailService = require('../services/emailService');

// GET /tasks/:id/email-logs - chỉ owner xem lịch sử gửi email
exports.listForTask = async (req, res, next) => {
  try {
    const { task, role } = await service.loadTaskForUser(req.params.id, req.user);
    service.requireAction(role, 'share');
    const logs = await EmailLog.find({ taskId: String(task._id) }).sort({ createdAt: -1 });
    res.status(200).json({ emailLogs: logs.map((l) => l.toJSON()) });
  } catch (err) {
    next(err);
  }
};

// POST /email-logs/:id/retry - owner của công việc gửi lại email thất bại
exports.retry = async (req, res, next) => {
  try {
    const notFound = new HttpError(404, 'Không tìm thấy email');
    if (!mongoose.isValidObjectId(req.params.id)) throw notFound;
    const log = await EmailLog.findById(req.params.id);
    if (!log || !log.taskId) throw notFound;

    const task = await Task.findById(log.taskId);
    if (!task) throw notFound;
    if (String(task.createdBy) !== String(req.user._id)) {
      // không tiết lộ email của công việc người khác
      throw notFound;
    }
    const updated = await emailService.retryEmail(log._id);
    res.status(200).json({ emailLog: updated.toJSON() });
  } catch (err) {
    next(err);
  }
};
