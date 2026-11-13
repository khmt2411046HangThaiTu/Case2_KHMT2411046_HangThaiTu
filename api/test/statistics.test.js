// Test thống kê (nhóm E). Các model được thay bằng bản giả trong bộ nhớ,
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

let a, b, c;
const T = (u) => u.token;
const day = 86400000;

test.before(async () => {
  a = await mkUser('Ann');
  b = await mkUser('Bob');
  c = await mkUser('Cat');
  const mk = (u, body) => call('POST', '/tasks', body, T(u));
  const iso = (d) => new Date(Date.now() + d * day).toISOString();
  // Ann tạo 5 việc
  const t1 = (await mk(a, { title: 'Quá hạn', priority: 'high', dueDate: iso(-2) })).data.task;
  const t2 = (await mk(a, { title: 'Mai đến hạn', dueDate: iso(1), status: 'in_progress' })).data.task;
  const t3 = (await mk(a, { title: 'Xa', dueDate: iso(30), priority: 'low' })).data.task;
  const t4 = (await mk(a, { title: 'Xong rồi', status: 'completed', dueDate: iso(-5) })).data.task;
  await mk(a, { title: 'Không hạn' });
  // Bob tạo 1 việc rồi chia sẻ cho Ann
  const tb = (await mk(b, { title: 'Của Bob', dueDate: iso(3) })).data.task;
  await call('POST', `/tasks/${tb.id}/shares`, { userId: a.user._id }, T(b));
  // Ann giao t1, t2 cho Bob (Bob phụ trách chính t1), t4 cho Bob
  await call('PUT', `/tasks/${t1.id}/assignees`, { assigneeIds: [b.user._id], primaryAssigneeId: b.user._id }, T(a));
  await call('PUT', `/tasks/${t2.id}/assignees`, { assigneeIds: [b.user._id, a.user._id], primaryAssigneeId: a.user._id }, T(a));
  await call('PUT', `/tasks/${t4.id}/assignees`, { assigneeIds: [b.user._id] }, T(a));
});

test('thống kê cần đăng nhập', async () => {
  for (const p of ['tasks', 'assignments', 'deadlines']) {
    assert.equal((await call('GET', `/statistics/${p}`)).status, 401);
  }
});

test('thống kê theo trạng thái (gồm việc được chia sẻ)', async () => {
  const r = await call('GET', '/statistics/tasks', null, T(a));
  assert.equal(r.status, 200);
  const d = r.data;
  assert.equal(d.total, 6);
  assert.equal(d.todo, 4);
  assert.equal(d.in_progress, 1);
  assert.equal(d.completed, 1);
  assert.equal(d.todo + d.in_progress + d.completed, d.total);
  assert.equal(d.completionRate, 17);
  assert.deepEqual(d.byPriority, { low: 1, medium: 4, high: 1 });
  assert.deepEqual(d.byRole, { owner: 5, editor: 0, assignee: 0, viewer: 1 });
  // người không có việc nào
  const z = (await call('GET', '/statistics/tasks', null, T(c))).data;
  assert.equal(z.total, 0);
  assert.equal(z.completionRate, 0);
});

test('thống kê giao việc: được giao, phụ trách chính, đã giao cho người khác', async () => {
  const bob = (await call('GET', '/statistics/assignments', null, T(b))).data;
  assert.equal(bob.assignedToMe.total, 3);
  assert.equal(bob.assignedToMe.completed, 1);
  assert.equal(bob.assignedToMe.active, 2);
  assert.equal(bob.primaryForMe.total, 2); // t4 chỉ có Bob nên tự là phụ trách chính
  assert.equal(bob.primaryForMe.active, 1);
  assert.deepEqual(bob.primaryTasks.map((t) => t.title), ['Quá hạn']);
  assert.equal(bob.assignedByMe.total, 0);

  const ann = (await call('GET', '/statistics/assignments', null, T(a))).data;
  assert.equal(ann.assignedToMe.total, 1);   // chỉ "Mai đến hạn"
  assert.equal(ann.primaryForMe.total, 1);
  assert.equal(ann.assignedByMe.total, 3);   // t1, t2, t4 giao cho Bob
});

test('thống kê hạn: quá hạn, sắp đến hạn, bỏ qua việc đã xong/không hạn', async () => {
  const d = (await call('GET', '/statistics/deadlines', null, T(a))).data;
  assert.equal(d.days, 7);
  assert.deepEqual(d.overdue.map((t) => t.title), ['Quá hạn']);
  assert.deepEqual(d.dueSoon.map((t) => t.title), ['Mai đến hạn', 'Của Bob']); // gần nhất trước
  assert.equal(d.overdueCount, 1);
  assert.equal(d.dueSoonCount, 2);

  const d2 = (await call('GET', '/statistics/deadlines?days=60', null, T(a))).data;
  assert.equal(d2.dueSoonCount, 3);
  const d3 = (await call('GET', '/statistics/deadlines?days=1', null, T(a))).data;
  assert.deepEqual(d3.dueSoon.map((t) => t.title), ['Mai đến hạn']);
});

test('days không hợp lệ -> 400', async () => {
  for (const q of ['0', 'abc', '91', '1.5']) {
    assert.equal((await call('GET', `/statistics/deadlines?days=${q}`, null, T(a))).status, 400, q);
  }
});
