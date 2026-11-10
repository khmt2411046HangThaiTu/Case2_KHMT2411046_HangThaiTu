const Notification = require('../models/Notification');
const TaskShare = require('../models/TaskShare');
const TaskActivity = require('../models/TaskActivity');
const User = require('../models/User');
const emailService = require('./emailService');
const templates = require('../utils/emailTemplates');

const same = (a, b) => String(a) === String(b);

// Ghi lịch sử hoạt động của công việc. Không throw.
async function logActivity(taskId, userId, action, details = {}) {
  try {
    await TaskActivity.create({ taskId, userId, action, details });
  } catch (e) {
    console.error('Không ghi được hoạt động:', e.message);
  }
}

// Những người liên quan tới công việc: owner + người được giao + người được chia sẻ
async function participantIds(task) {
  const shares = await TaskShare.find({ taskId: String(task._id) });
  const ids = [task.createdBy, ...(task.assigneeIds || []), ...shares.map((s) => s.userId)];
  return [...new Set(ids.map(String))];
}

/*
 * Tạo thông báo trong ứng dụng và (nếu có `template`) gửi email cho từng người.
 * Không bao giờ gửi cho chính người thực hiện. Không throw để không làm hỏng API chính.
 */
async function notifyUsers({ userIds, actor, task, type, title, message, template, templateData = {} }) {
  try {
    const targets = [...new Set(userIds.map(String))].filter((id) => !same(id, actor._id));
    if (!targets.length) return;
    const users = await User.find({ _id: { $in: targets } });

    for (const u of users) {
      await Notification.create({ userId: u._id, taskId: task._id, type, title, message });
      if (template && templates[template]) {
        const mail = templates[template]({ task, actor, ...templateData, ...(templateData[String(u._id)] || {}) });
        await emailService.queueEmail({
          to: u.email,
          subject: mail.subject,
          html: mail.html,
          taskId: task._id,
          eventType: type,
        });
      }
    }
  } catch (e) {
    console.error('Lỗi gửi thông báo:', e.message);
  }
}

// Được giao việc (chỉ gọi cho người mới được thêm)
const notifyAssigned = (task, actor, userIds) =>
  notifyUsers({
    userIds,
    actor,
    task,
    type: 'task_assigned',
    title: 'Bạn được giao công việc mới',
    message: `${actor.fullName} đã giao cho bạn: ${task.title}`,
    template: 'task_assigned',
    templateData: Object.fromEntries(
      userIds.map((id) => [String(id), { isPrimary: same(task.primaryAssigneeId, id) }])
    ),
  });

const notifyShared = (task, actor, userId, permission) =>
  notifyUsers({
    userIds: [userId],
    actor,
    task,
    type: 'task_shared',
    title: 'Có công việc được chia sẻ với bạn',
    message: `${actor.fullName} đã chia sẻ "${task.title}" (${permission === 'editor' ? 'được chỉnh sửa' : 'chỉ xem'})`,
    template: 'task_shared',
    templateData: { permission },
  });

// Thông tin quan trọng thay đổi: email cho tất cả người liên quan
const notifyUpdated = async (task, actor, changes) =>
  notifyUsers({
    userIds: await participantIds(task),
    actor,
    task,
    type: 'task_updated',
    title: 'Công việc có thay đổi',
    message: `${actor.fullName} đã đổi: ${changes.join('; ')} ("${task.title}")`,
    template: 'task_updated',
    templateData: { changes },
  });

// Đổi trạng thái: thông báo trong app; hoàn thành thì gửi thêm email
const notifyStatusChanged = async (task, actor, oldStatus) => {
  const done = task.status === 'completed';
  return notifyUsers({
    userIds: await participantIds(task),
    actor,
    task,
    type: done ? 'task_completed' : 'status_changed',
    title: done ? 'Công việc đã hoàn thành' : 'Trạng thái công việc thay đổi',
    message: done
      ? `${actor.fullName} đã hoàn thành "${task.title}"`
      : `${actor.fullName} đổi trạng thái "${task.title}" (${oldStatus} → ${task.status})`,
    template: done ? 'task_completed' : null,
  });
};

// Nhắc việc: không có "người thực hiện" nên dùng actor giả để gửi cho tất cả
const notifyReminder = async (task) => {
  const ids = [task.createdBy, ...(task.assigneeIds || [])];
  return notifyUsers({
    userIds: ids,
    actor: { _id: null, fullName: 'Hệ thống' },
    task,
    type: 'due_reminder',
    title: 'Công việc sắp đến hạn',
    message: `"${task.title}" sắp đến hạn hoàn thành`,
    template: 'due_reminder',
  });
};

module.exports = {
  logActivity,
  participantIds,
  notifyAssigned,
  notifyShared,
  notifyUpdated,
  notifyStatusChanged,
  notifyReminder,
};
