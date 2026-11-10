const mongoose = require('mongoose');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const service = require('../services/taskService');

const same = (a, b) => String(a) === String(b);

async function assigneeResponse(task, role) {
  const dto = await service.toSingleDto(task, role);
  return { assignees: dto.assignees, primaryAssignee: dto.primaryAssignee, task: dto };
}

// Chọn người phụ trách chính hợp lệ: ưu tiên giá trị gửi lên, sau đó giữ
// người cũ nếu còn trong danh sách, cuối cùng lấy người đầu tiên.
function pickPrimary(requested, current, ids) {
  if (ids.length === 0) return null;
  if (requested && ids.some((i) => same(i, requested))) return String(requested);
  if (current && ids.some((i) => same(i, current))) return String(current);
  return ids[0];
}

// GET /tasks/:id/assignees
exports.list = async (req, res, next) => {
  try {
    const { task, role } = await service.loadTaskForUser(req.params.id, req.user);
    res.status(200).json(await assigneeResponse(task, role));
  } catch (err) {
    next(err);
  }
};

// PUT /tasks/:id/assignees - thay toàn bộ danh sách người được giao
exports.replace = async (req, res, next) => {
  try {
    const { task, role } = await service.loadTaskForUser(req.params.id, req.user);
    service.requireAction(role, 'assign');

    const ids = [...new Set(req.body.assigneeIds.map(String))];
    if (ids.length) {
      const found = await User.find({ _id: { $in: ids } });
      const known = new Set(found.map((u) => String(u._id)));
      const missing = ids.filter((i) => !known.has(i));
      if (missing.length) {
        throw new HttpError(400, 'Dữ liệu không hợp lệ', {
          assigneeIds: 'Có người dùng không tồn tại',
        });
      }
    }

    task.assigneeIds = ids;
    task.primaryAssigneeId = pickPrimary(
      req.body.primaryAssigneeId,
      task.primaryAssigneeId,
      ids
    );
    await task.save();
    res.status(200).json(await assigneeResponse(task, role));
  } catch (err) {
    next(err);
  }
};

// DELETE /tasks/:id/assignees/:userId - bỏ giao việc cho một người
exports.removeOne = async (req, res, next) => {
  try {
    const { task, role } = await service.loadTaskForUser(req.params.id, req.user);
    service.requireAction(role, 'assign');

    const target = req.params.userId;
    if (!mongoose.isValidObjectId(target) || !(task.assigneeIds || []).some((i) => same(i, target))) {
      throw new HttpError(404, 'Người này chưa được giao công việc');
    }
    const rest = task.assigneeIds.map(String).filter((i) => !same(i, target));
    task.assigneeIds = rest;
    task.primaryAssigneeId = pickPrimary(null, same(task.primaryAssigneeId, target) ? null : task.primaryAssigneeId, rest);
    await task.save();
    res.status(200).json(await assigneeResponse(task, role));
  } catch (err) {
    next(err);
  }
};
