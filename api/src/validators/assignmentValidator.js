const mongoose = require('mongoose');
const { PERMISSIONS } = require('../utils/taskConstants');

const isId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);

// PUT /tasks/:id/assignees  { assigneeIds: [...], primaryAssigneeId?: id|null }
exports.validateAssign = (body) => {
  const errors = {};
  if (!Array.isArray(body.assigneeIds)) {
    errors.assigneeIds = 'assigneeIds phải là một mảng id người dùng';
  } else if (body.assigneeIds.length > 50) {
    errors.assigneeIds = 'Giao tối đa 50 người';
  } else if (!body.assigneeIds.every(isId)) {
    errors.assigneeIds = 'Có id người dùng không hợp lệ';
  }
  const p = body.primaryAssigneeId;
  if (p !== undefined && p !== null && !isId(p)) {
    errors.primaryAssigneeId = 'primaryAssigneeId không hợp lệ';
  }
  if (
    !errors.assigneeIds &&
    !errors.primaryAssigneeId &&
    p &&
    !body.assigneeIds.includes(p)
  ) {
    errors.primaryAssigneeId = 'Người phụ trách chính phải nằm trong danh sách được giao';
  }
  return errors;
};

// POST /tasks/:id/shares  { userId | email, permission }
exports.validateShare = (body) => {
  const errors = {};
  const hasId = body.userId !== undefined && body.userId !== null && body.userId !== '';
  const hasEmail = typeof body.email === 'string' && body.email.trim() !== '';
  if (!hasId && !hasEmail) {
    errors.userId = 'Vui lòng chọn người dùng (userId hoặc email)';
  } else if (hasId && !isId(body.userId)) {
    errors.userId = 'userId không hợp lệ';
  }
  if (body.permission !== undefined && !PERMISSIONS.includes(body.permission)) {
    errors.permission = 'Quyền phải là viewer hoặc editor';
  }
  return errors;
};

// PATCH /tasks/:id/shares/:userId  { permission }
exports.validatePermission = (body) => {
  const errors = {};
  if (!PERMISSIONS.includes(body.permission)) {
    errors.permission = 'Quyền phải là viewer hoặc editor';
  }
  return errors;
};
