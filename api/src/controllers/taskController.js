const Task = require('../models/Task');
const TaskShare = require('../models/TaskShare');
const HttpError = require('../utils/httpError');
const service = require('../services/taskService');
const notify = require('../services/notificationService');

// '' hoặc null -> null (xóa ngày); chuỗi ISO -> Date
const toDate = (v) => (v === null || v === '' ? null : new Date(v));

const { fmtDate } = require('../utils/emailTemplates');

const checkDateOrder = (start, due) => {
  if (start && due && due < start) {
    throw new HttpError(400, 'Dữ liệu không hợp lệ', {
      dueDate: 'Hạn hoàn thành phải sau hoặc bằng ngày bắt đầu',
    });
  }
};

// GET /tasks
exports.list = async (req, res, next) => {
  try {
    const tasks = await service.listTasks(req.user, req.query);
    res.status(200).json({ count: tasks.length, tasks });
  } catch (err) {
    next(err);
  }
};

// POST /tasks
exports.create = async (req, res, next) => {
  try {
    const b = req.body;
    const data = { title: b.title.trim(), createdBy: req.user._id };
    if (b.description !== undefined && b.description !== null) {
      data.description = b.description.trim();
    }
    if (b.priority !== undefined) data.priority = b.priority;
    if (b.status !== undefined) data.status = b.status;
    if (b.startDate !== undefined) data.startDate = toDate(b.startDate);
    if (b.dueDate !== undefined) data.dueDate = toDate(b.dueDate);
    checkDateOrder(data.startDate, data.dueDate);

    const task = await Task.create(data);
    await notify.logActivity(task._id, req.user._id, 'create', { title: task.title });
    res.status(201).json({ task: await service.toSingleDto(task, 'owner') });
  } catch (err) {
    next(err);
  }
};

// GET /tasks/:id
exports.getOne = async (req, res, next) => {
  try {
    const { task, role } = await service.loadTaskForUser(req.params.id, req.user);
    res.status(200).json({
      task: await service.toSingleDto(task, role, { withShares: true }),
    });
  } catch (err) {
    next(err);
  }
};

// PUT /tasks/:id
exports.update = async (req, res, next) => {
  try {
    const { task, role } = await service.loadTaskForUser(req.params.id, req.user);
    service.requireAction(role, 'edit');

    const b = req.body;
    const before = {
      title: task.title,
      priority: task.priority,
      due: task.dueDate ? new Date(task.dueDate).getTime() : null,
    };
    if (b.title !== undefined) task.title = b.title.trim();
    if (b.description !== undefined) task.description = (b.description || '').trim();
    if (b.priority !== undefined) task.priority = b.priority;
    if (b.status !== undefined) task.status = b.status;
    if (b.startDate !== undefined) task.startDate = toDate(b.startDate);
    if (b.dueDate !== undefined) task.dueDate = toDate(b.dueDate);
    checkDateOrder(task.startDate, task.dueDate);

    // Các thay đổi quan trọng cần thông báo
    const changes = [];
    const dueNow = task.dueDate ? new Date(task.dueDate).getTime() : null;
    if (dueNow !== before.due) {
      changes.push(`hạn hoàn thành thành ${fmtDate(task.dueDate)}`);
      task.reminderSentAt = null; // đổi hạn thì nhắc việc lại từ đầu
    }
    if (task.title !== before.title) changes.push(`tên thành "${task.title}"`);
    if (task.priority !== before.priority) changes.push(`mức ưu tiên thành ${task.priority}`);

    await task.save();
    await notify.logActivity(task._id, req.user._id, 'update', {
      fields: Object.keys(b),
      changes,
    });
    if (changes.length) await notify.notifyUpdated(task, req.user, changes);
    res.status(200).json({ task: await service.toSingleDto(task, role) });
  } catch (err) {
    next(err);
  }
};

// PATCH /tasks/:id/status
exports.updateStatus = async (req, res, next) => {
  try {
    const { task, role } = await service.loadTaskForUser(req.params.id, req.user);
    service.requireAction(role, 'status');

    const oldStatus = task.status;
    task.status = req.body.status;
    await task.save();
    if (oldStatus !== task.status) {
      await notify.logActivity(task._id, req.user._id, 'status_changed', {
        from: oldStatus,
        to: task.status,
      });
      await notify.notifyStatusChanged(task, req.user, oldStatus);
    }
    res.status(200).json({ task: await service.toSingleDto(task, role) });
  } catch (err) {
    next(err);
  }
};

// DELETE /tasks/:id
exports.remove = async (req, res, next) => {
  try {
    const { task, role } = await service.loadTaskForUser(req.params.id, req.user);
    service.requireAction(role, 'delete');

    await task.deleteOne();
    await TaskShare.deleteMany({ taskId: String(task._id) });
    res.status(200).json({ message: 'Đã xóa công việc' });
  } catch (err) {
    next(err);
  }
};
