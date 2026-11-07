// Test API xác thực. Model User được thay bằng bản giả trong bộ nhớ
// (không cần MongoDB) - route, validator, bcrypt, JWT chạy thật.
// Chạy: node --test
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const rows = [];
let seq = 0;
class FakeUser {
  constructor(d) {
    Object.assign(this, d);
    const id = String(++seq).padStart(24, '0');
    this._id = { toString: () => id };
    this.avatarUrl = d.avatarUrl || '';
  }
  async save() { return this; }
  toJSON() {
    const { passwordHash, ...rest } = this;
    const { _id, ...others } = rest;
    return { ...others, id: _id.toString() };
  }
  static async exists({ email }) { return rows.some((u) => u.email === email) ? { _id: 1 } : null; }
  static async create(d) { const u = new FakeUser(d); rows.push(u); return u; }
  static async findOne({ email }) { return rows.find((u) => u.email === email) || null; }
  static async findById(id) { return rows.find((u) => u._id.toString() === id) || null; }
}
const modelPath = require.resolve(path.join(__dirname, '../src/models/User.js'));
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: FakeUser };

const app = require('../src/app');
let server, base;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}/api`; r(); }); }));
test.after(() => server.close());

const call = async (method, url, body, token) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
};

let token;
const creds = { fullName: 'Nguyen Van A', email: 'A@Example.com', password: 'abc123' };

test('đăng ký thành công, không trả passwordHash', async () => {
  const r = await call('POST', '/auth/register', creds);
  assert.equal(r.status, 201);
  assert.ok(r.data.token);
  assert.equal(r.data.user.email, 'a@example.com');
  assert.equal(r.data.user.passwordHash, undefined);
  assert.notEqual(rows[0].passwordHash, 'abc123'); // đã băm
  assert.ok(rows[0].passwordHash.startsWith('$2'));
});
test('đăng ký trùng email (khác hoa thường) -> 409', async () => {
  const r = await call('POST', '/auth/register', { ...creds, email: 'a@example.com' });
  assert.equal(r.status, 409);
  assert.ok(r.data.errors.email);
});
test('đăng ký dữ liệu sai -> 400 kèm lỗi từng field', async () => {
  const r = await call('POST', '/auth/register', { fullName: 'A', email: 'xx', password: '12' });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.data.errors).sort(), ['email', 'fullName', 'password']);
});
test('đăng nhập đúng -> 200 + token', async () => {
  const r = await call('POST', '/auth/login', { email: 'a@example.com', password: 'abc123' });
  assert.equal(r.status, 200);
  token = r.data.token;
});
test('đăng nhập sai mật khẩu / sai email -> cùng thông báo 401', async () => {
  const a = await call('POST', '/auth/login', { email: 'a@example.com', password: 'sai' });
  const b = await call('POST', '/auth/login', { email: 'khong@co.com', password: 'abc123' });
  assert.equal(a.status, 401); assert.equal(b.status, 401);
  assert.equal(a.data.message, b.data.message);
});
test('GET /auth/me cần token', async () => {
  assert.equal((await call('GET', '/auth/me')).status, 401);
  assert.equal((await call('GET', '/auth/me', null, 'token-rac')).status, 401);
  const r = await call('GET', '/auth/me', null, token);
  assert.equal(r.status, 200);
  assert.equal(r.data.user.fullName, 'Nguyen Van A');
  assert.equal(r.data.user.passwordHash, undefined);
});
test('PUT /auth/me cập nhật họ tên, không đổi được email', async () => {
  const r = await call('PUT', '/auth/me', { fullName: '  Tran B  ', email: 'hack@x.com' }, token);
  assert.equal(r.status, 200);
  assert.equal(r.data.user.fullName, 'Tran B');
  assert.equal(r.data.user.email, 'a@example.com');
  assert.equal((await call('PUT', '/auth/me', { fullName: '' }, token)).status, 400);
});
test('đổi mật khẩu: sai mật khẩu cũ / trùng mật khẩu cũ / thành công', async () => {
  assert.equal((await call('PUT', '/auth/change-password', { currentPassword: 'sai', newPassword: 'newpass1' }, token)).status, 400);
  assert.equal((await call('PUT', '/auth/change-password', { currentPassword: 'abc123', newPassword: 'abc123' }, token)).status, 400);
  assert.equal((await call('PUT', '/auth/change-password', { currentPassword: 'abc123', newPassword: 'newpass1' }, token)).status, 200);
  assert.equal((await call('POST', '/auth/login', { email: 'a@example.com', password: 'abc123' })).status, 401);
  assert.equal((await call('POST', '/auth/login', { email: 'a@example.com', password: 'newpass1' })).status, 200);
});
test('route không tồn tại -> 404 JSON', async () => {
  assert.equal((await call('GET', '/khong-co')).status, 404);
});
