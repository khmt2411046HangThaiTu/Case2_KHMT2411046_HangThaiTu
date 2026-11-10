// Test thông báo, email và nhắc việc (nhóm D). Các model được thay bằng bản giả trong bộ nhớ,
// dùng thư viện sift (có sẵn cùng mongoose) để mô phỏng truy vấn MongoDB.
// Route, validator, phân quyền, JWT chạy thật. Chạy: node --test
process.env.JWT_SECRET = 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const jwt = require('jsonwebtoken');
const sift = require('sift');

let seq = 0;
const newId = () => String(++seq).padStart(24, '0');

function makeModel(defaults = () => ({})) {
  const rows = [];
  class M {
    constructor(d) {
      Object.assign(this, defaults(), d);
      this._id = newId();
      this.createdAt = new Date(Date.now() + seq); // đảm bảo thứ tự tăng dần
      this.updatedAt = this.createdAt;
    }
    async save() {
      this.updatedAt = new Date();
      return this;
    }
    async deleteOne() {
      rows.splice(rows.indexOf(this), 1);
    }
    toJSON() {
      const { _id, passwordHash, html, ...rest } = this;
      return { ...rest, id: _id };
    }
    static async create(d) {
      const m = new M(d);
      rows.push(m);
      return m;
    }
    static find(filter = {}) {
      let list = rows.filter(sift(filter));
      const q = {
        sort(spec) {
          const [k, dir] = Object.entries(spec)[0];
          list = [...list].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * dir);
          return q;
        },
        skip(n) { list = list.slice(n); return q; },
        limit(n) { list = list.slice(0, n); return q; },
        select() { return q; },
        then: (res, rej) => Promise.resolve(list).then(res, rej),
      };
      return q;
    }
    static async countDocuments(filter = {}) {
      return rows.filter(sift(filter)).length;
    }
    static async updateMany(filter, upd) {
      rows.filter(sift(filter)).forEach((r) => Object.assign(r, upd.$set));
    }
    static async findOne(filter = {}) {
      return rows.find(sift(filter)) || null;
    }
    static findById(id) {
      const p = Promise.resolve(rows.find((r) => r._id === String(id)) || null);
      p.select = () => p;
      return p;
    }
    static async deleteMany(filter = {}) {
      rows.filter(sift(filter)).forEach((r) => rows.splice(rows.indexOf(r), 1));
    }
  }
  M.rows = rows;
  return M;
}

const FakeUser = makeModel(() => ({ avatarUrl: '' }));
const FakeTask = makeModel(() => ({
  description: '',
  assigneeIds: [],
  primaryAssigneeId: null,
  startDate: null,
  dueDate: null,
  priority: 'medium',
  status: 'todo',
  reminderSentAt: null,
}));
const FakeShare = makeModel();

const stub = (rel, exp) => {
  const p = require.resolve(path.join(__dirname, rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
};
stub('../src/models/User.js', FakeUser);
stub('../src/models/Task.js', FakeTask);
stub('../src/models/TaskShare.js', FakeShare);
const FakeNotif = makeModel(() => ({ isRead: false }));
const FakeEmail = makeModel(() => ({ attempts: 0, errorMessage: '', sentAt: null }));
const FakeActivity = makeModel();
stub('../src/models/Notification.js', FakeNotif);
stub('../src/models/EmailLog.js', FakeEmail);
stub('../src/models/TaskActivity.js', FakeActivity);

// Transporter giả: ghi lại email, có thể bật chế độ lỗi
const emailService = require('../src/services/emailService');
const sent = [];
let failMode = false;
emailService.setTransporter({
  sendMail: async (m) => {
    if (failMode) throw new Error('SMTP down');
    sent.push(m);
  },
});

const app = require('../src/app');
let server;
let base;
test.before(
  () =>
    new Promise((r) => {
      server = app.listen(0, () => {
        base = `http://127.0.0.1:${server.address().port}/api`;
        r();
      });
    })
);
test.after(() => server.close());

const call = async (method, url, body, token) => {
  const res = await fetch(base + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
};

const mkUser = async (name) => {
  const u = await FakeUser.create({
    fullName: name,
    email: `${name.toLowerCase()}@x.com`,
    passwordHash: 'x',
  });
  return { user: u, token: jwt.sign({ sub: u._id }, 'test-secret') };
};

let owner, editor, assignee, other, taskId;
const T = (u) => u.token;
const notifs = async (u, q = '') => (await call('GET', `/notifications${q}`, null, T(u))).data;

test.before(async () => {
  owner = await mkUser('Owner');
  editor = await mkUser('Editor');
  assignee = await mkUser('Assignee');
  other = await mkUser('Other');
  taskId = (await call('POST', '/tasks', { title: 'Báo cáo', dueDate: '2030-01-10T00:00:00Z' }, T(owner))).data.task.id;
  await call('POST', `/tasks/${taskId}/shares`, { userId: editor.user._id, permission: 'editor' }, T(owner));
  await emailService.flush();
  sent.length = 0;
  FakeNotif.rows.length = 0;
  FakeEmail.rows.length = 0;
});

test('API thông báo cần đăng nhập', async () => {
  assert.equal((await call('GET', '/notifications')).status, 401);
  assert.equal((await call('GET', '/notifications/unread-count')).status, 401);
});

test('giao việc: thông báo + email cho người mới, không gửi cho chính mình', async () => {
  const r = await call('PUT', `/tasks/${taskId}/assignees`,
    { assigneeIds: [assignee.user._id, owner.user._id], primaryAssigneeId: assignee.user._id }, T(owner));
  assert.equal(r.status, 200);
  await emailService.flush();

  const n = await notifs(assignee);
  assert.equal(n.notifications.length, 1);
  assert.equal(n.notifications[0].type, 'task_assigned');
  assert.equal(n.notifications[0].taskId, taskId);
  assert.equal(n.unreadCount, 1);
  assert.equal((await notifs(owner)).notifications.length, 0); // không tự báo cho mình

  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'assignee@x.com');
  assert.match(sent[0].subject, /Báo cáo/);
  assert.match(sent[0].html, /Người phụ trách chính/);
  assert.equal(FakeEmail.rows[0].status, 'sent');
  assert.equal(FakeEmail.rows[0].attempts, 1);
  assert.ok(FakeEmail.rows[0].sentAt);
});

test('giao lại cùng danh sách không gửi trùng', async () => {
  await call('PUT', `/tasks/${taskId}/assignees`,
    { assigneeIds: [assignee.user._id, owner.user._id] }, T(owner));
  await emailService.flush();
  assert.equal(sent.length, 1);
  assert.equal((await notifs(assignee)).notifications.length, 1);
});

test('chia sẻ: thông báo + email; đổi quyền báo lại; cùng quyền thì không', async () => {
  const before = sent.length;
  await call('POST', `/tasks/${taskId}/shares`, { userId: other.user._id, permission: 'viewer' }, T(owner));
  await emailService.flush();
  assert.equal(sent.length, before + 1);
  assert.equal(sent.at(-1).to, 'other@x.com');
  assert.match(sent.at(-1).html, /Chỉ xem/);
  assert.equal((await notifs(other)).notifications[0].type, 'task_shared');

  await call('POST', `/tasks/${taskId}/shares`, { userId: other.user._id, permission: 'viewer' }, T(owner));
  await emailService.flush();
  assert.equal(sent.length, before + 1); // không đổi -> không gửi lại

  await call('PATCH', `/tasks/${taskId}/shares/${other.user._id}`, { permission: 'editor' }, T(owner));
  await emailService.flush();
  assert.equal(sent.length, before + 2);
  assert.match(sent.at(-1).html, /Được chỉnh sửa/);
});

test('đổi hạn hoàn thành: báo mọi người liên quan trừ người sửa', async () => {
  const before = sent.length;
  const r = await call('PUT', `/tasks/${taskId}`, { dueDate: '2030-02-20T00:00:00Z' }, T(editor));
  assert.equal(r.status, 200);
  await emailService.flush();
  const recips = sent.slice(before).map((m) => m.to).sort();
  assert.deepEqual(recips, ['assignee@x.com', 'other@x.com', 'owner@x.com']);
  assert.match(sent.at(-1).html, /20\/02\/2030/);
  assert.equal((await notifs(editor)).notifications.length, 0);
  assert.equal((await notifs(owner)).notifications.at(-1).type, 'task_updated');

  // sửa mô tả (không quan trọng) thì không báo
  const n = sent.length;
  await call('PUT', `/tasks/${taskId}`, { description: 'ghi chú' }, T(owner));
  await emailService.flush();
  assert.equal(sent.length, n);
});

test('đổi trạng thái: chỉ thông báo trong app; hoàn thành thì có email', async () => {
  const before = sent.length;
  await call('PATCH', `/tasks/${taskId}/status`, { status: 'in_progress' }, T(assignee));
  await emailService.flush();
  assert.equal(sent.length, before);
  const types = (await notifs(owner)).notifications.map((n) => n.type);
  assert.ok(types.includes('status_changed'));

  await call('PATCH', `/tasks/${taskId}/status`, { status: 'completed' }, T(assignee));
  await emailService.flush();
  const recips = sent.slice(before).map((m) => m.to).sort();
  assert.deepEqual(recips, ['editor@x.com', 'other@x.com', 'owner@x.com']);
  assert.match(sent.at(-1).subject, /hoàn thành/);

  // đặt lại trạng thái cũ -> không có thay đổi -> không thông báo
  const n = (await notifs(owner)).notifications.length;
  await call('PATCH', `/tasks/${taskId}/status`, { status: 'completed' }, T(assignee));
  assert.equal((await notifs(owner)).notifications.length, n);
});

test('danh sách thông báo: lọc chưa đọc, phân trang, mới nhất trước', async () => {
  const all = await notifs(owner);
  assert.ok(all.notifications.length >= 3);
  const times = all.notifications.map((n) => new Date(n.createdAt).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => b - a));
  assert.equal((await notifs(owner, '?limit=1')).notifications.length, 1);
  assert.equal((await notifs(owner, '?unread=true')).notifications.length, all.unreadCount);
});

test('đánh dấu đã đọc: một thông báo, tất cả, và không đụng thông báo người khác', async () => {
  const mine = (await notifs(owner)).notifications;
  const before = (await call('GET', '/notifications/unread-count', null, T(owner))).data.count;
  assert.equal(before, mine.length);

  const r = await call('PATCH', `/notifications/${mine[0].id}/read`, null, T(owner));
  assert.equal(r.status, 200);
  assert.equal(r.data.notification.isRead, true);
  assert.equal((await call('GET', '/notifications/unread-count', null, T(owner))).data.count, before - 1);

  // người khác không đọc hộ được; id sai -> 404
  assert.equal((await call('PATCH', `/notifications/${mine[1].id}/read`, null, T(other))).status, 404);
  assert.equal((await call('PATCH', '/notifications/abc/read', null, T(owner))).status, 404);

  assert.equal((await call('PATCH', '/notifications/read-all', null, T(owner))).status, 200);
  assert.equal((await call('GET', '/notifications/unread-count', null, T(owner))).data.count, 0);
  assert.ok((await notifs(assignee)).unreadCount > 0); // người khác không bị ảnh hưởng
});

test('email lỗi: ghi log failed, gửi lại tối đa 3 lần, không gửi lại email đã gửi', async () => {
  failMode = true;
  const sc = sent.length;
  await call('PUT', `/tasks/${taskId}/assignees`,
    { assigneeIds: [assignee.user._id, owner.user._id, other.user._id] }, T(owner));
  await emailService.flush();
  assert.equal(sent.length, sc);
  const log = FakeEmail.rows.at(-1);
  assert.equal(log.recipientEmail, 'other@x.com');
  assert.equal(log.status, 'failed');
  assert.equal(log.attempts, 1);
  assert.match(log.errorMessage, /SMTP down/);

  // người không phải owner không thấy / không gửi lại được
  assert.equal((await call('POST', `/email-logs/${log._id}/retry`, null, T(editor))).status, 404);
  assert.equal((await call('GET', `/tasks/${taskId}/email-logs`, null, T(editor))).status, 403);

  // owner xem lịch sử: có trạng thái, không lộ nội dung html
  const list = await call('GET', `/tasks/${taskId}/email-logs`, null, T(owner));
  assert.equal(list.status, 200);
  assert.ok(list.data.emailLogs.some((l) => l.status === 'failed'));
  assert.equal(list.data.emailLogs[0].html, undefined);

  // thử lại vẫn lỗi (lần 2), rồi thành công khi SMTP hoạt động lại (lần 3)
  let r = await call('POST', `/email-logs/${log._id}/retry`, null, T(owner));
  assert.equal(r.status, 200);
  assert.equal(r.data.emailLog.status, 'failed');
  assert.equal(r.data.emailLog.attempts, 2);
  failMode = false;
  r = await call('POST', `/email-logs/${log._id}/retry`, null, T(owner));
  assert.equal(r.data.emailLog.status, 'sent');
  assert.equal(r.data.emailLog.attempts, 3);
  assert.equal(sent.at(-1).to, 'other@x.com');

  // đã gửi rồi thì không gửi lại (tránh trùng)
  r = await call('POST', `/email-logs/${log._id}/retry`, null, T(owner));
  assert.equal(r.status, 409);
});

test('giới hạn số lần gửi lại', async () => {
  failMode = true;
  await call('PUT', `/tasks/${taskId}/assignees`, { assigneeIds: [assignee.user._id, owner.user._id] }, T(owner));
  await call('PUT', `/tasks/${taskId}/assignees`, { assigneeIds: [assignee.user._id, owner.user._id, editor.user._id] }, T(owner));
  await emailService.flush();
  const log = FakeEmail.rows.at(-1);
  assert.equal(log.status, 'failed');
  await call('POST', `/email-logs/${log._id}/retry`, null, T(owner));
  await call('POST', `/email-logs/${log._id}/retry`, null, T(owner));
  const r = await call('POST', `/email-logs/${log._id}/retry`, null, T(owner));
  assert.equal(r.status, 409);
  assert.equal(log.attempts, 3);
  failMode = false;
});

test('lịch sử hoạt động: người có quyền xem được, người lạ thì không', async () => {
  const r = await call('GET', `/tasks/${taskId}/activities`, null, T(assignee));
  assert.equal(r.status, 200);
  const actions = r.data.activities.map((a) => a.action);
  for (const a of ['create', 'share', 'assign', 'update', 'status_changed']) {
    assert.ok(actions.includes(a), a);
  }
  assert.equal(r.data.activities[0].user.passwordHash, undefined);
  const stranger = await mkUser('Stranger');
  assert.equal((await call('GET', `/tasks/${taskId}/activities`, null, T(stranger))).status, 404);
});

test('nhắc việc trước hạn: gửi 1 lần, bỏ qua việc đã hoàn thành; đổi hạn thì nhắc lại', async () => {
  const { sendDueReminders } = require('../src/services/reminderService');
  const mk = async (title, hoursAhead, status) =>
    (await FakeTask.create({
      title, createdBy: owner.user._id, assigneeIds: [assignee.user._id],
      dueDate: new Date(Date.now() + hoursAhead * 3600e3), status,
    }));
  const soon = await mk('Sắp hạn', 5, 'todo');
  await mk('Còn xa', 100, 'todo');
  await mk('Đã xong', 5, 'completed');
  await mk('Quá hạn', -5, 'todo');

  const sc = sent.length;
  assert.equal(await sendDueReminders(), 1);
  await emailService.flush();
  assert.deepEqual(sent.slice(sc).map((m) => m.to).sort(), ['assignee@x.com', 'owner@x.com']);
  assert.match(sent.at(-1).subject, /Sắp hạn/);
  assert.ok(soon.reminderSentAt);
  assert.equal(
    (await notifs(assignee)).notifications.filter((n) => n.type === 'due_reminder').length, 1);

  assert.equal(await sendDueReminders(), 0); // không gửi trùng

  // đổi hạn qua API sẽ đặt lại cờ nhắc
  await call('PUT', `/tasks/${soon._id}`, { dueDate: new Date(Date.now() + 6 * 3600e3).toISOString() }, T(owner));
  assert.equal(soon.reminderSentAt, null);
  assert.equal(await sendDueReminders(), 1);
});
