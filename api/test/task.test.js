// Test API công việc (nhóm B). Các model được thay bằng bản giả trong bộ nhớ,
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
      const { _id, passwordHash, ...rest } = this;
      return { ...rest, id: _id };
    }
    static async create(d) {
      const m = new M(d);
      rows.push(m);
      return m;
    }
    static async find(filter = {}) {
      return rows.filter(sift(filter));
    }
    static async findOne(filter = {}) {
      return rows.find(sift(filter)) || null;
    }
    static async findById(id) {
      return rows.find((r) => r._id === String(id)) || null;
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
}));
const FakeShare = makeModel();

const stub = (rel, exp) => {
  const p = require.resolve(path.join(__dirname, rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
};
stub('../src/models/User.js', FakeUser);
stub('../src/models/Task.js', FakeTask);
stub('../src/models/TaskShare.js', FakeShare);
for (const m of ['Notification', 'EmailLog', 'TaskActivity']) {
  stub(`../src/models/${m}.js`, makeModel());
}

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

let owner, editor, viewer, assignee, stranger;
let taskId;

test.before(async () => {
  owner = await mkUser('Owner');
  editor = await mkUser('Editor');
  viewer = await mkUser('Viewer');
  assignee = await mkUser('Assignee');
  stranger = await mkUser('Stranger');
});

test('chưa đăng nhập -> 401', async () => {
  assert.equal((await call('GET', '/tasks')).status, 401);
  assert.equal((await call('POST', '/tasks', { title: 'a' })).status, 401);
});

test('tạo công việc: mặc định todo/medium, người tạo là owner', async () => {
  const r = await call('POST', '/tasks', { title: '  Làm báo cáo  ' }, owner.token);
  assert.equal(r.status, 201);
  assert.equal(r.data.task.title, 'Làm báo cáo');
  assert.equal(r.data.task.status, 'todo');
  assert.equal(r.data.task.priority, 'medium');
  assert.equal(r.data.task.role, 'owner');
  assert.equal(r.data.task.createdBy.email, 'owner@x.com');
  assert.equal(r.data.task.createdBy.passwordHash, undefined);
  taskId = r.data.task.id;
});

test('tạo công việc dữ liệu sai -> 400 kèm lỗi từng field', async () => {
  const r = await call(
    'POST',
    '/tasks',
    { priority: 'urgent', status: 'x', startDate: '2026-12-10', dueDate: '2026-12-01' },
    owner.token
  );
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.data.errors).sort(), ['dueDate', 'priority', 'status', 'title']);
});

test('phân vai: được giao, được chia sẻ viewer/editor', async () => {
  const t = await FakeTask.find({});
  const task = t.find((x) => x._id === taskId);
  task.assigneeIds = [assignee.user._id];
  await FakeShare.create({ taskId, userId: viewer.user._id, permission: 'viewer', sharedBy: owner.user._id });
  await FakeShare.create({ taskId, userId: editor.user._id, permission: 'editor', sharedBy: owner.user._id });

  const role = async (u) => (await call('GET', `/tasks/${taskId}`, null, u.token)).data.task?.role;
  assert.equal(await role(owner), 'owner');
  assert.equal(await role(editor), 'editor');
  assert.equal(await role(assignee), 'assignee');
  assert.equal(await role(viewer), 'viewer');
});

test('người lạ và id sai -> 404', async () => {
  assert.equal((await call('GET', `/tasks/${taskId}`, null, stranger.token)).status, 404);
  assert.equal((await call('GET', '/tasks/khong-hop-le', null, owner.token)).status, 404);
  assert.equal((await call('GET', `/tasks/${'9'.repeat(24)}`, null, owner.token)).status, 404);
});

test('danh sách theo scope', async () => {
  const ids = async (u, q = '') =>
    (await call('GET', `/tasks${q}`, null, u.token)).data.tasks.map((t) => t.id);
  assert.deepEqual(await ids(owner), [taskId]);
  assert.deepEqual(await ids(owner, '?scope=created'), [taskId]);
  assert.deepEqual(await ids(owner, '?scope=assigned'), []);
  assert.deepEqual(await ids(assignee, '?scope=assigned'), [taskId]);
  assert.deepEqual(await ids(viewer, '?scope=shared'), [taskId]);
  assert.deepEqual(await ids(viewer, '?scope=created'), []);
  assert.deepEqual(await ids(stranger), []);
  assert.equal((await call('GET', '/tasks?scope=abc', null, owner.token)).status, 400);
});

test('tìm kiếm, lọc, sắp xếp', async () => {
  const mk = (b) => call('POST', '/tasks', b, owner.token);
  const a = (await mk({ title: 'Viết code (API)', priority: 'high', dueDate: '2026-12-20T00:00:00Z' })).data.task;
  const b = (await mk({ title: 'Thiết kế UI', priority: 'low', status: 'in_progress', dueDate: '2026-12-05T00:00:00Z' })).data.task;
  const c = (await mk({ title: 'Họp nhóm', priority: 'medium', status: 'completed' })).data.task;
  const get = async (q) =>
    (await call('GET', `/tasks${q}`, null, owner.token)).data.tasks.map((t) => t.id);

  assert.deepEqual(await get('?q=code'), [a.id]);
  assert.deepEqual(await get('?q=CODE'), [a.id]); // không phân biệt hoa thường
  assert.deepEqual(await get('?q=' + encodeURIComponent('(API)')), [a.id]); // ký tự đặc biệt không làm vỡ regex
  assert.deepEqual(await get('?status=in_progress'), [b.id]);
  assert.deepEqual(await get('?priority=high'), [a.id]);
  assert.deepEqual(await get(`?assigneeId=${assignee.user._id}`), [taskId]);

  // hạn gần nhất trước; công việc không có hạn luôn ở cuối
  const byDue = await get('?scope=created&sortBy=dueDate&order=asc');
  assert.deepEqual(byDue.slice(0, 2), [b.id, a.id]);
  assert.ok(byDue.slice(2).includes(c.id));
  const byDueDesc = await get('?scope=created&sortBy=dueDate&order=desc');
  assert.deepEqual(byDueDesc.slice(0, 2), [a.id, b.id]);

  const byPriority = await get('?scope=created&sortBy=priority&order=desc');
  assert.equal(byPriority[0], a.id);
  assert.equal(byPriority[byPriority.length - 1], b.id);

  // mặc định: mới tạo xếp trước
  const byNew = await get('?scope=created');
  assert.deepEqual(byNew.slice(0, 3), [c.id, b.id, a.id]);
});

test('sửa công việc: chỉ owner và editor', async () => {
  const body = { title: 'Báo cáo tuần', priority: 'high', startDate: '2026-12-01', dueDate: '2026-12-10' };
  const ok = await call('PUT', `/tasks/${taskId}`, body, owner.token);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.task.title, 'Báo cáo tuần');
  assert.equal(ok.data.task.priority, 'high');

  assert.equal((await call('PUT', `/tasks/${taskId}`, { title: 'Editor sửa' }, editor.token)).status, 200);
  assert.equal((await call('PUT', `/tasks/${taskId}`, { title: 'x' }, viewer.token)).status, 403);
  assert.equal((await call('PUT', `/tasks/${taskId}`, { title: 'x' }, assignee.token)).status, 403);
  assert.equal((await call('PUT', `/tasks/${taskId}`, { title: 'x' }, stranger.token)).status, 404);
  assert.equal((await call('PUT', `/tasks/${taskId}`, {}, owner.token)).status, 400);
  assert.equal((await call('PUT', `/tasks/${taskId}`, { title: '  ' }, owner.token)).status, 400);
});

test('sửa hạn trước ngày bắt đầu đang có -> 400; xóa ngày bằng null', async () => {
  const bad = await call('PUT', `/tasks/${taskId}`, { dueDate: '2026-11-01' }, owner.token);
  assert.equal(bad.status, 400);
  assert.ok(bad.data.errors.dueDate);

  const clear = await call('PUT', `/tasks/${taskId}`, { dueDate: null }, owner.token);
  assert.equal(clear.status, 200);
  assert.equal(clear.data.task.dueDate, null);
});

test('đổi trạng thái: owner, editor, assignee được; viewer không', async () => {
  const s = (u, status) => call('PATCH', `/tasks/${taskId}/status`, { status }, u.token);
  assert.equal((await s(assignee, 'in_progress')).data.task.status, 'in_progress');
  assert.equal((await s(editor, 'completed')).status, 200);
  assert.equal((await s(owner, 'todo')).status, 200);
  assert.equal((await s(viewer, 'completed')).status, 403);
  assert.equal((await s(stranger, 'completed')).status, 404);
  assert.equal((await s(owner, 'xong')).status, 400);
});

test('xóa: chỉ owner; xóa luôn bản ghi chia sẻ', async () => {
  assert.equal((await call('DELETE', `/tasks/${taskId}`, null, editor.token)).status, 403);
  assert.equal((await call('DELETE', `/tasks/${taskId}`, null, assignee.token)).status, 403);
  assert.equal((await call('DELETE', `/tasks/${taskId}`, null, viewer.token)).status, 403);
  assert.equal((await call('DELETE', `/tasks/${taskId}`, null, stranger.token)).status, 404);

  assert.equal((await call('DELETE', `/tasks/${taskId}`, null, owner.token)).status, 200);
  assert.equal((await call('GET', `/tasks/${taskId}`, null, owner.token)).status, 404);
  assert.equal(FakeShare.rows.filter((s) => s.taskId === taskId).length, 0);
});
