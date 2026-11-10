// Test API giao việc và chia sẻ (nhóm C). Các model được thay bằng bản giả trong bộ nhớ,
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
// Mongoose trả về query có .limit(); mô phỏng lại cho test
const baseFind = FakeUser.find;
FakeUser.find = (f) => {
  const p = baseFind(f);
  p.limit = (n) => p.then((r) => r.slice(0, n));
  return p;
};
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

let owner, editor, viewer, assignee, other, stranger, taskId;
const T = (u) => u.token;

test.before(async () => {
  owner = await mkUser('Owner');
  editor = await mkUser('Editor');
  viewer = await mkUser('Viewer');
  assignee = await mkUser('Assignee');
  other = await mkUser('Other');
  stranger = await mkUser('Stranger');
  taskId = (await call('POST', '/tasks', { title: 'Việc chung' }, T(owner))).data.task.id;
});

test('tìm người dùng: cần đăng nhập, bỏ qua chính mình, tìm theo tên/email', async () => {
  assert.equal((await call('GET', '/users')).status, 401);
  const all = await call('GET', '/users', null, T(owner));
  assert.equal(all.status, 200);
  assert.ok(!all.data.users.some((u) => u.email === 'owner@x.com'));
  assert.equal(all.data.users[0].passwordHash, undefined);
  const q = await call('GET', '/users?q=ASSIGN', null, T(owner));
  assert.deepEqual(q.data.users.map((u) => u.fullName), ['Assignee']);
  const sp = await call('GET', '/users?q=' + encodeURIComponent('(.*'), null, T(owner));
  assert.equal(sp.status, 200);
  assert.deepEqual(sp.data.users, []);
});

test('giao việc cho nhiều người + người phụ trách chính', async () => {
  const a = assignee.user._id, o = other.user._id;
  const r = await call('PUT', `/tasks/${taskId}/assignees`,
    { assigneeIds: [a, o], primaryAssigneeId: o }, T(owner));
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.assignees.map((u) => u.id), [a, o]);
  assert.equal(r.data.primaryAssignee.id, o);

  // người được giao thấy việc ở scope assigned và đổi được trạng thái
  const l = await call('GET', '/tasks?scope=assigned', null, T(assignee));
  assert.deepEqual(l.data.tasks.map((t) => t.id), [taskId]);
  assert.equal((await call('PATCH', `/tasks/${taskId}/status`, { status: 'in_progress' }, T(assignee))).status, 200);
  // nhưng không được giao thêm người
  assert.equal((await call('PUT', `/tasks/${taskId}/assignees`, { assigneeIds: [] }, T(assignee))).status, 403);
});

test('giao việc: kiểm tra dữ liệu', async () => {
  const put = (b, t = owner) => call('PUT', `/tasks/${taskId}/assignees`, b, T(t));
  const a = assignee.user._id;
  assert.equal((await put({})).status, 400);
  assert.equal((await put({ assigneeIds: 'x' })).status, 400);
  assert.equal((await put({ assigneeIds: ['abc'] })).status, 400);
  assert.equal((await put({ assigneeIds: [a], primaryAssigneeId: other.user._id })).status, 400);
  const ghost = await put({ assigneeIds: ['9'.repeat(24)] });
  assert.equal(ghost.status, 400);
  assert.ok(ghost.data.errors.assigneeIds);
  assert.equal((await put({ assigneeIds: [a] }, stranger)).status, 404);
});

test('trùng id được gộp; không gửi primary thì giữ/tự chọn hợp lệ', async () => {
  const a = assignee.user._id, o = other.user._id;
  const r = await call('PUT', `/tasks/${taskId}/assignees`, { assigneeIds: [a, a, o] }, T(owner));
  assert.deepEqual(r.data.assignees.map((u) => u.id), [a, o]);
  assert.equal(r.data.primaryAssignee.id, o); // giữ người cũ

  const r2 = await call('PUT', `/tasks/${taskId}/assignees`, { assigneeIds: [a] }, T(owner));
  assert.equal(r2.data.primaryAssignee.id, a); // người cũ không còn -> lấy người đầu
});

test('bỏ giao việc từng người; xóa hết thì primary = null', async () => {
  const a = assignee.user._id, o = other.user._id;
  await call('PUT', `/tasks/${taskId}/assignees`, { assigneeIds: [a, o], primaryAssigneeId: a }, T(owner));
  const r = await call('DELETE', `/tasks/${taskId}/assignees/${a}`, null, T(editor));
  assert.equal(r.status, 404); // editor chưa được chia sẻ -> không thấy việc

  const ok = await call('DELETE', `/tasks/${taskId}/assignees/${a}`, null, T(owner));
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.data.assignees.map((u) => u.id), [o]);
  assert.equal(ok.data.primaryAssignee.id, o);
  assert.equal((await call('DELETE', `/tasks/${taskId}/assignees/${a}`, null, T(owner))).status, 404);
  const last = await call('DELETE', `/tasks/${taskId}/assignees/${o}`, null, T(owner));
  assert.deepEqual(last.data.assignees, []);
  assert.equal(last.data.primaryAssignee, null);
  // người vừa bị bỏ giao không còn thấy việc
  assert.equal((await call('GET', `/tasks/${taskId}`, null, T(assignee))).status, 404);
});

test('chia sẻ: viewer, editor, đổi quyền, danh sách', async () => {
  const post = (b, t = owner) => call('POST', `/tasks/${taskId}/shares`, b, T(t));
  const r1 = await post({ userId: viewer.user._id });
  assert.equal(r1.status, 201);
  assert.equal(r1.data.shares[0].permission, 'viewer');
  const r2 = await post({ email: ' EDITOR@x.com ', permission: 'editor' });
  assert.equal(r2.status, 201);
  assert.equal(r2.data.shares.length, 2);

  // chia sẻ lại cho cùng người -> cập nhật quyền, không tạo trùng
  const r3 = await post({ userId: viewer.user._id, permission: 'editor' });
  assert.equal(r3.status, 200);
  assert.equal(r3.data.shares.length, 2);
  assert.ok(r3.data.shares.every((s) => s.permission === 'editor'));

  const patch = await call('PATCH', `/tasks/${taskId}/shares/${viewer.user._id}`, { permission: 'viewer' }, T(owner));
  assert.equal(patch.status, 200);
  assert.equal(patch.data.shares.find((s) => s.userId === viewer.user._id).permission, 'viewer');

  const list = await call('GET', `/tasks/${taskId}/shares`, null, T(owner));
  assert.equal(list.data.shares.length, 2);
  assert.equal(list.data.shares[0].user.email.includes('@'), true);
  assert.equal(list.data.shares[0].user.passwordHash, undefined);
});

test('chi tiết công việc: chỉ owner nhận danh sách shares', async () => {
  const o = (await call('GET', `/tasks/${taskId}`, null, T(owner))).data.task;
  assert.equal(o.shares.length, 2);
  const v = (await call('GET', `/tasks/${taskId}`, null, T(viewer))).data.task;
  assert.equal(v.shares, undefined);
  assert.equal(v.role, 'viewer');
});

test('quyền sau khi chia sẻ: viewer chỉ xem, editor sửa + giao việc', async () => {
  assert.equal((await call('PUT', `/tasks/${taskId}`, { title: 'x' }, T(viewer))).status, 403);
  assert.equal((await call('PATCH', `/tasks/${taskId}/status`, { status: 'completed' }, T(viewer))).status, 403);
  assert.equal((await call('PUT', `/tasks/${taskId}/assignees`, { assigneeIds: [] }, T(viewer))).status, 403);
  assert.equal((await call('PUT', `/tasks/${taskId}`, { title: 'Editor sửa' }, T(editor))).status, 200);
  assert.equal((await call('PUT', `/tasks/${taskId}/assignees`, { assigneeIds: [other.user._id] }, T(editor))).status, 200);
  assert.equal((await call('DELETE', `/tasks/${taskId}`, null, T(editor))).status, 403);
  const sh = await call('GET', `/tasks/${taskId}/shares`, null, T(editor));
  assert.equal(sh.status, 403); // chỉ owner quản lý chia sẻ
  assert.equal((await call('POST', `/tasks/${taskId}/shares`, { userId: stranger.user._id }, T(editor))).status, 403);
});

test('chia sẻ: lỗi dữ liệu', async () => {
  const post = (b, t = owner) => call('POST', `/tasks/${taskId}/shares`, b, T(t));
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ userId: 'abc' })).status, 400);
  assert.equal((await post({ userId: stranger.user._id, permission: 'admin' })).status, 400);
  assert.equal((await post({ userId: '9'.repeat(24) })).status, 404);
  assert.equal((await post({ email: 'nobody@x.com' })).status, 404);
  assert.equal((await post({ userId: owner.user._id })).status, 400); // chính chủ
  assert.equal((await post({ userId: stranger.user._id }, stranger)).status, 404);
  assert.equal((await call('PATCH', `/tasks/${taskId}/shares/${stranger.user._id}`, { permission: 'editor' }, T(owner))).status, 404);
  assert.equal((await call('PATCH', `/tasks/${taskId}/shares/${viewer.user._id}`, { permission: 'x' }, T(owner))).status, 400);
});

test('thu hồi quyền: mất quyền truy cập ngay', async () => {
  const r = await call('DELETE', `/tasks/${taskId}/shares/${viewer.user._id}`, null, T(owner));
  assert.equal(r.status, 200);
  assert.equal(r.data.shares.length, 1);
  assert.equal((await call('GET', `/tasks/${taskId}`, null, T(viewer))).status, 404);
  assert.deepEqual((await call('GET', '/tasks?scope=shared', null, T(viewer))).data.tasks, []);
  assert.equal((await call('DELETE', `/tasks/${taskId}/shares/${viewer.user._id}`, null, T(owner))).status, 404);
});

test('xóa công việc dọn luôn dữ liệu chia sẻ', async () => {
  assert.equal((await call('DELETE', `/tasks/${taskId}`, null, T(owner))).status, 200);
  assert.equal(FakeShare.rows.length, 0);
});
