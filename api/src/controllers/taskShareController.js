const mongoose = require('mongoose');
const TaskShare = require('../models/TaskShare');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const service = require('../services/taskService');
const notify = require('../services/notificationService');

const same = (a, b) => String(a) === String(b);

// Chỉ owner được quản lý chia sẻ (403 với người khác, 404 nếu không có quyền xem)
async function loadAsOwner(req) {
  const { task, role } = await service.loadTaskForUser(req.params.id, req.user);
  service.requireAction(role, 'share');
  return task;
}

const respond = async (res, task, status = 200, extra = {}) =>
  res.status(status).json({ shares: await service.toShareDtos(task._id), ...extra });

async function findShare(task, userId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new HttpError(404, 'Không tìm thấy bản ghi chia sẻ');
  }
  const share = await TaskShare.findOne({
    taskId: String(task._id),
    userId: String(userId),
  });
  if (!share) throw new HttpError(404, 'Không tìm thấy bản ghi chia sẻ');
  return share;
}

// GET /tasks/:id/shares
exports.list = async (req, res, next) => {
  try {
    await respond(res, await loadAsOwner(req));
  } catch (err) {
    next(err);
  }
};

// POST /tasks/:id/shares - chia sẻ (nếu đã chia sẻ thì cập nhật quyền)
exports.create = async (req, res, next) => {
  try {
    const task = await loadAsOwner(req);
    const { userId, email } = req.body;
    const permission = req.body.permission || 'viewer';

    const target = userId
      ? await User.findById(userId)
      : await User.findOne({ email: email.trim().toLowerCase() });
    if (!target) throw new HttpError(404, 'Không tìm thấy người dùng');
    if (same(target._id, task.createdBy)) {
      throw new HttpError(400, 'Không thể chia sẻ công việc cho chính chủ sở hữu');
    }

    let share = await TaskShare.findOne({
      taskId: String(task._id),
      userId: String(target._id),
    });
    let status = 200;
    let changed = true;
    if (share) {
      changed = share.permission !== permission;
      share.permission = permission;
      await share.save();
    } else {
      share = await TaskShare.create({
        taskId: task._id,
        userId: target._id,
        permission,
        sharedBy: req.user._id,
      });
      status = 201;
    }
    if (changed) {
      await notify.logActivity(task._id, req.user._id, 'share', {
        userId: String(target._id),
        permission,
      });
      await notify.notifyShared(task, req.user, target._id, permission);
    }
    await respond(res, task, status);
  } catch (err) {
    next(err);
  }
};

// PATCH /tasks/:id/shares/:userId - đổi quyền
exports.update = async (req, res, next) => {
  try {
    const task = await loadAsOwner(req);
    const share = await findShare(task, req.params.userId);
    const changed = share.permission !== req.body.permission;
    share.permission = req.body.permission;
    await share.save();
    if (changed) {
      await notify.logActivity(task._id, req.user._id, 'share_permission', {
        userId: String(req.params.userId),
        permission: share.permission,
      });
      await notify.notifyShared(task, req.user, req.params.userId, share.permission);
    }
    await respond(res, task);
  } catch (err) {
    next(err);
  }
};

// DELETE /tasks/:id/shares/:userId - thu hồi quyền truy cập
exports.remove = async (req, res, next) => {
  try {
    const task = await loadAsOwner(req);
    const share = await findShare(task, req.params.userId);
    await share.deleteOne();
    await notify.logActivity(task._id, req.user._id, 'unshare', {
      userId: String(req.params.userId),
    });
    await respond(res, task);
  } catch (err) {
    next(err);
  }
};
