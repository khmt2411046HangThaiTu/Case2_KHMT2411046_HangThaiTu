const nodemailer = require('nodemailer');

// Thông tin SMTP lấy từ biến môi trường (không lưu trong mã nguồn).
// Trả về null nếu chưa cấu hình: email sẽ được ghi log trạng thái failed
// và có thể gửi lại sau khi cấu hình xong.
function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const fromAddress = () =>
  process.env.EMAIL_FROM || `Task Manager <${process.env.SMTP_USER || 'no-reply@example.com'}>`;

module.exports = { createTransporter, fromAddress };
