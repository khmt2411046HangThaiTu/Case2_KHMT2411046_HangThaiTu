const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskShare = require('../models/TaskShare');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const { PRIORITY_RANK } = require('../utils/taskConstants');

/*
 * Vai trò của người dùng trên một công việc:
 *   owner    - người tạo: toàn quyền (sửa, đổi trạng thái, xóa)
 *   editor   - được chia sẻ quyền chỉnh sửa: sửa và đổi trạng thái, KHÔNG xóa
 *   assignee - người được giao: xem và đổi trạng thái
 *   viewer   - được chia sẻ quyền xem: chỉ xem
 */
const ALLOWED = {
  view: ['owner', 'editor', 'assignee', 'viewer'],
  edit: ['owner', 'editor'],
  status: ['owner', 'editor', 'assignee'],
  delete: ['owner'],
  assign: ['owner', 'editor'], // giao việc / đổi người phụ trách
  share: ['owner'], // chia sẻ và quản lý quyền truy cập
};

const DENIED_MESSAGE = {
  edit: 'Bạn không có quyền chỉnh sửa công việc này',
  status: 'Bạn không có quyền đổi trạng thái công việc này',
  delete: 'Chỉ người tạo mới được xóa công việc',
  assign: 'Bạn không có quyền giao việc cho công việc này',
  share: 'Chỉ người tạo mới được quản lý chia sẻ công việc',
};

const same = (a, b) => String(a) === String(b);

function resolveRole(task, userId, share) {
  if (same(task.createdBy, userId)) return 'owner';
  if (share && share.permission === 'editor') return 'editor';
  if ((task.assigneeIds || []).some((id) => same(id, userId))) return 'assignee';
  if (share) return 'viewer';
  return null;
}

function requireAction(role, action) {
  if (!role || !ALLOWED[action].includes(role)) {
    throw new HttpError(403, DENIED_MESSAGE[action] || 'Không có quyền');
  }
}

// Lấy công việc kèm vai trò của người dùng. Không có quyền xem -> 404
// (không tiết lộ công việc có tồn tại hay không).
async function loadTaskForUser(taskId, user) {
  const notFound = new HttpError(404, 'Không tìm thấy công việc');
  if (!mongoose.isValidObjectId(taskId)) throw notFound;

  const task = await Task.findById(taskId);
  if (!task) throw notFound;

  const share = await TaskShare.findOne({
    taskId: String(task._id),
    userId: String(user._id),
  });
  const role = resolveRole(task, user._id, share);
  if (!role) throw notFound;
  return { task, role };
}

const userDto = (u) =>
  u
    ? {
        id: String(u._id),
        fullName: u.fullName,
        email: u.email,
        avatarUrl: u.avatarUrl || '',
      }
    : null;

// Lấy thông tin người dùng liên quan bằng một truy vấn duy nhất
async function buildUserMap(tasks) {
  const ids = new Set();
  tasks.forEach((t) => {
    if (t.createdBy) ids.add(String(t.createdBy));
    if (t.primaryAssigneeId) ids.add(String(t.primaryAssigneeId));
    (t.assigneeIds || []).forEach((id) => ids.add(String(id)));
  });
  const users = ids.size ? await User.find({ _id: { $in: [...ids] } }) : [];
  return new Map(users.map((u) => [String(u._id), userDto(u)]));
}

function toDto(task, userMap, role) {
  const t = task.toJSON();
  const pick = (id) => (id ? userMap.get(String(id)) || null : null);
  return {
    id: t.id,
    title: t.title,
    description: t.description || '',
    status: t.status,
    priority: t.priority,
    startDate: t.startDate || null,
    dueDate: t.dueDate || null,
    createdBy: pick(t.createdBy),
    assignees: (t.assigneeIds || []).map(pick).filter(Boolean),
    primaryAssignee: pick(t.primaryAssigneeId),
    role,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// Danh sách chia sẻ của một công việc (kèm thông tin người được chia sẻ)
async function toShareDtos(taskId) {
  const shares = await TaskShare.find({ taskId: String(taskId) });
  const ids = shares.map((s) => String(s.userId));
  const users = ids.length ? await User.find({ _id: { $in: ids } }) : [];
  const map = new Map(users.map((u) => [String(u._id), userDto(u)]));
  return shares
    .map((s) => ({
      userId: String(s.userId),
      user: map.get(String(s.userId)) || null,
      permission: s.permission,
      sharedAt: s.createdAt,
    }))
    .filter((s) => s.user);
}

// withShares: chỉ owner mới nhận danh sách chia sẻ
async function toSingleDto(task, role, { withShares = false } = {}) {
  const userMap = await buildUserMap([task]);
  const dto = toDto(task, userMap, role);
  if (withShares && role === 'owner') dto.shares = await toShareDtos(task._id);
  return dto;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compare(a, b, sortBy, dir) {
  if (sortBy === 'dueDate') {
    const x = a.dueDate ? new Date(a.dueDate).getTime() : null;
    const y = b.dueDate ? new Date(b.dueDate).getTime() : null;
    if (x === null && y === null) return 0;
    if (x === null) return 1; // không có hạn luôn xếp cuối
    if (y === null) return -1;
    return (x - y) * dir;
  }
  if (sortBy === 'priority') {
    return (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * dir;
  }
  return (new Date(a.createdAt) - new Date(b.createdAt)) * dir;
}

async function listTasks(user, query) {
  const uid = String(user._id);
  const scope = query.scope || 'all';

  const shares = await TaskShare.find({ userId: uid });
  const shareMap = new Map(shares.map((s) => [String(s.taskId), s]));
  const sharedIds = [...shareMap.keys()];

  let access;
  if (scope === 'created') access = { createdBy: uid };
  else if (scope === 'assigned') access = { assigneeIds: uid };
  else if (scope === 'shared') access = { _id: { $in: sharedIds } };
  else {
    access = {
      $or: [
        { createdBy: uid },
        { assigneeIds: uid },
        { _id: { $in: sharedIds } },
      ],
    };
  }

  const conditions = [access];
  if (query.status) conditions.push({ status: query.status });
  if (query.priority) conditions.push({ priority: query.priority });
  if (query.assigneeId) conditions.push({ assigneeIds: String(query.assigneeId) });
  if (query.q && query.q.trim()) {
    conditions.push({ title: new RegExp(escapeRegex(query.q.trim()), 'i') });
  }

  const tasks = await Task.find({ $and: conditions });

  const sortBy = query.sortBy || 'createdAt';
  const dir = (query.order || 'desc') === 'asc' ? 1 : -1;
  tasks.sort((a, b) => compare(a, b, sortBy, dir));

  const userMap = await buildUserMap(tasks);
  return tasks.map((t) =>
    toDto(t, userMap, resolveRole(t, uid, shareMap.get(String(t._id))))
  );
}

module.exports = {
  resolveRole,
  requireAction,
  loadTaskForUser,
  toSingleDto,
  toShareDtos,
  userDto,
  listTasks,
};
