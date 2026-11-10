const EmailLog = require('../models/EmailLog');
const HttpError = require('../utils/httpError');
const { createTransporter, fromAddress } = require('../config/email');

const MAX_ATTEMPTS = 3;

let transporter;
let transporterReady = false;
const getTransporter = () => {
  if (!transporterReady) {
    transporter = createTransporter();
    transporterReady = true;
  }
  return transporter;
};
// Dùng cho test: thay transporter giả
const setTransporter = (t) => {
  transporter = t;
  transporterReady = true;
};

// Theo dõi các email đang gửi ngầm (để test chờ được)
const pending = new Set();
const flush = async () => {
  while (pending.size) await Promise.allSettled([...pending]);
};

// Gửi một email theo log đã có, cập nhật trạng thái sent/failed. Không throw.
async function deliver(log) {
  log.attempts += 1;
  try {
    const t = getTransporter();
    if (!t) throw new Error('SMTP chưa được cấu hình');
    await t.sendMail({
      from: fromAddress(),
      to: log.recipientEmail,
      subject: log.subject,
      html: log.html,
    });
    log.status = 'sent';
    log.sentAt = new Date();
    log.errorMessage = '';
  } catch (err) {
    log.status = 'failed';
    // Chỉ lưu thông điệp ngắn, không lộ thông tin nhạy cảm của SMTP
    log.errorMessage = String(err.message || 'Gửi email thất bại').slice(0, 300);
  }
  try {
    await log.save();
  } catch (e) {
    console.error('Không lưu được email log:', e.message);
  }
  return log;
}

// Ghi log pending rồi gửi ngầm (không làm chậm API). Không throw.
async function queueEmail({ to, subject, html, taskId = null, eventType }) {
  try {
    const log = await EmailLog.create({
      taskId,
      recipientEmail: to,
      eventType,
      subject,
      html,
      status: 'pending',
    });
    const job = deliver(log).finally(() => pending.delete(job));
    pending.add(job);
    return log;
  } catch (e) {
    console.error('Không tạo được email log:', e.message);
    return null;
  }
}

// Gửi lại email thất bại (tối đa MAX_ATTEMPTS lần, không gửi lại email đã sent)
async function retryEmail(logId) {
  const log = await EmailLog.findById(logId).select('+html');
  if (!log) throw new HttpError(404, 'Không tìm thấy email');
  if (log.status !== 'failed') {
    throw new HttpError(409, 'Chỉ có thể gửi lại email đã thất bại');
  }
  if (log.attempts >= MAX_ATTEMPTS) {
    throw new HttpError(409, `Đã thử gửi ${MAX_ATTEMPTS} lần, không thể gửi lại nữa`);
  }
  log.status = 'pending'; // chặn bấm lặp trong lúc đang gửi
  await log.save();
  return deliver(log);
}

module.exports = { queueEmail, retryEmail, setTransporter, flush, MAX_ATTEMPTS };
