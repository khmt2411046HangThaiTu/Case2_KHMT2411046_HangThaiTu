const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtDate = (d) => {
  if (!d) return 'Chưa đặt';
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
};

const STATUS = { todo: 'Chưa thực hiện', in_progress: 'Đang thực hiện', completed: 'Đã hoàn thành' };
const PRIORITY = { low: 'Thấp', medium: 'Trung bình', high: 'Cao' };

function layout(heading, intro, task, extraRows = []) {
  const rows = [
    ['Công việc', task.title],
    ['Trạng thái', STATUS[task.status] || task.status],
    ['Mức ưu tiên', PRIORITY[task.priority] || task.priority],
    ['Hạn hoàn thành', fmtDate(task.dueDate)],
    ...extraRows,
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666">${escapeHtml(k)}</td><td style="padding:4px 0"><b>${escapeHtml(v)}</b></td></tr>`
    )
    .join('');
  return `<div style="font-family:Arial,sans-serif;max-width:520px">
<h2 style="color:#3f51b5">${escapeHtml(heading)}</h2>
<p>${escapeHtml(intro)}</p>
<table>${rows}</table>
<p style="color:#888;font-size:12px">Email tự động từ Task Manager. Vui lòng mở ứng dụng để xem chi tiết.</p>
</div>`;
}

// Mỗi mẫu trả về { subject, html }
module.exports = {
  fmtDate,
  task_assigned: ({ task, actor, isPrimary }) => ({
    subject: `Bạn được giao công việc: ${task.title}`,
    html: layout('Bạn được giao công việc mới', `${actor.fullName} đã giao cho bạn một công việc.`, task, [
      ['Vai trò', isPrimary ? 'Người phụ trách chính' : 'Người tham gia'],
    ]),
  }),
  task_shared: ({ task, actor, permission }) => ({
    subject: `${actor.fullName} đã chia sẻ công việc với bạn: ${task.title}`,
    html: layout('Bạn được mời tham gia công việc', `${actor.fullName} đã chia sẻ một công việc với bạn.`, task, [
      ['Quyền', permission === 'editor' ? 'Được chỉnh sửa' : 'Chỉ xem'],
    ]),
  }),
  task_updated: ({ task, actor, changes }) => ({
    subject: `Công việc đã thay đổi: ${task.title}`,
    html: layout('Thông tin công việc đã thay đổi', `${actor.fullName} vừa cập nhật công việc.`, task, [
      ['Thay đổi', changes.join('; ')],
    ]),
  }),
  task_completed: ({ task, actor }) => ({
    subject: `Công việc đã hoàn thành: ${task.title}`,
    html: layout('Công việc đã hoàn thành', `${actor.fullName} đã đánh dấu công việc là hoàn thành.`, task),
  }),
  due_reminder: ({ task }) => ({
    subject: `Nhắc việc: "${task.title}" sắp đến hạn`,
    html: layout('Công việc sắp đến hạn', 'Công việc dưới đây sắp đến hạn hoàn thành.', task),
  }),
};
