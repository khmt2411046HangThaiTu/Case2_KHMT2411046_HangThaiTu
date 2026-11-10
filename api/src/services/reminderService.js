const Task = require('../models/Task');
const notifications = require('./notificationService');

// Nhắc việc trước hạn REMINDER_HOURS giờ (mặc định 24) - mỗi công việc chỉ nhắc 1 lần.
async function sendDueReminders(now = new Date()) {
  const hours = Number(process.env.REMINDER_HOURS) || 24;
  const limit = new Date(now.getTime() + hours * 3600 * 1000);
  const tasks = await Task.find({
    status: { $ne: 'completed' },
    reminderSentAt: null,
    dueDate: { $gte: now, $lte: limit },
  });
  for (const t of tasks) {
    t.reminderSentAt = now; // đánh dấu trước để không gửi trùng
    await t.save();
    await notifications.notifyReminder(t);
  }
  return tasks.length;
}

// Chạy định kỳ (mặc định mỗi 10 phút)
function startReminderJob() {
  const minutes = Number(process.env.REMINDER_INTERVAL_MINUTES) || 10;
  const run = () =>
    sendDueReminders().catch((e) => console.error('Lỗi nhắc việc:', e.message));
  run();
  const timer = setInterval(run, minutes * 60 * 1000);
  timer.unref();
  return timer;
}

module.exports = { sendDueReminders, startReminderJob };
