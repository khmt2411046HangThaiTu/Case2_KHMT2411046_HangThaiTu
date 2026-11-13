const taskService = require('./taskService');

const emptyCounts = () => ({ todo: 0, in_progress: 0, completed: 0 });

function countByStatus(tasks) {
  const c = emptyCounts();
  tasks.forEach((t) => {
    if (c[t.status] !== undefined) c[t.status] += 1;
  });
  return { total: tasks.length, ...c };
}

const brief = (t) => ({
  id: t.id,
  title: t.title,
  status: t.status,
  priority: t.priority,
  dueDate: t.dueDate,
  role: t.role,
});

// Mọi thống kê tính trên các công việc mà người dùng có quyền truy cập
const accessible = (user) => taskService.listTasks(user, {});

async function taskStats(user) {
  const tasks = await accessible(user);
  const byPriority = { low: 0, medium: 0, high: 0 };
  const byRole = { owner: 0, editor: 0, assignee: 0, viewer: 0 };
  tasks.forEach((t) => {
    if (byPriority[t.priority] !== undefined) byPriority[t.priority] += 1;
    if (byRole[t.role] !== undefined) byRole[t.role] += 1;
  });
  const done = tasks.filter((t) => t.status === 'completed').length;
  return {
    ...countByStatus(tasks),
    byPriority,
    byRole,
    completionRate: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  };
}

async function assignmentStats(user) {
  const uid = String(user._id);
  const tasks = await accessible(user);
  const assignedToMe = tasks.filter((t) => t.assignees.some((u) => u.id === uid));
  const primaryForMe = tasks.filter((t) => t.primaryAssignee && t.primaryAssignee.id === uid);
  const assignedByMe = tasks.filter(
    (t) => t.role === 'owner' && t.assignees.some((u) => u.id !== uid)
  );
  const active = (list) => list.filter((t) => t.status !== 'completed').length;
  return {
    assignedToMe: { ...countByStatus(assignedToMe), active: active(assignedToMe) },
    primaryForMe: { ...countByStatus(primaryForMe), active: active(primaryForMe) },
    assignedByMe: { ...countByStatus(assignedByMe), active: active(assignedByMe) },
    primaryTasks: primaryForMe.filter((t) => t.status !== 'completed').map(brief),
  };
}

// days: số ngày tới được tính là "sắp đến hạn" (mặc định 7)
async function deadlineStats(user, days = 7, now = new Date()) {
  const tasks = await accessible(user);
  const limit = new Date(now.getTime() + days * 86400000);
  const open = tasks.filter((t) => t.status !== 'completed' && t.dueDate);
  const byDue = (a, b) => new Date(a.dueDate) - new Date(b.dueDate);

  const overdue = open.filter((t) => new Date(t.dueDate) < now).sort(byDue);
  const dueSoon = open
    .filter((t) => new Date(t.dueDate) >= now && new Date(t.dueDate) <= limit)
    .sort(byDue);
  return {
    days,
    overdueCount: overdue.length,
    dueSoonCount: dueSoon.length,
    overdue: overdue.slice(0, 20).map(brief),
    dueSoon: dueSoon.slice(0, 20).map(brief),
  };
}

module.exports = { taskStats, assignmentStats, deadlineStats };
