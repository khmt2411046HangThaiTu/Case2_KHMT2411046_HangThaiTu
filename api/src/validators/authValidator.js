const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function checkPassword(password, errors, field = 'password') {
  if (typeof password !== 'string' || password.length < 6) {
    errors[field] = 'Mật khẩu phải có ít nhất 6 ký tự';
  } else if (password.length > 72) {
    // bcrypt chỉ xử lý tối đa 72 byte
    errors[field] = 'Mật khẩu không được dài quá 72 ký tự';
  }
}

exports.validateRegister = (body) => {
  const errors = {};
  if (str(body.fullName).length < 2) errors.fullName = 'Họ tên phải có ít nhất 2 ký tự';
  if (!EMAIL_REGEX.test(str(body.email))) errors.email = 'Email không hợp lệ';
  checkPassword(body.password, errors);
  return errors;
};

exports.validateLogin = (body) => {
  const errors = {};
  if (!EMAIL_REGEX.test(str(body.email))) errors.email = 'Email không hợp lệ';
  if (typeof body.password !== 'string' || body.password.length === 0) {
    errors.password = 'Vui lòng nhập mật khẩu';
  }
  return errors;
};

exports.validateUpdateProfile = (body) => {
  const errors = {};
  if (body.fullName !== undefined && str(body.fullName).length < 2) {
    errors.fullName = 'Họ tên phải có ít nhất 2 ký tự';
  }
  if (body.avatarUrl !== undefined && typeof body.avatarUrl !== 'string') {
    errors.avatarUrl = 'Đường dẫn ảnh không hợp lệ';
  }
  if (body.fullName === undefined && body.avatarUrl === undefined) {
    errors.fullName = 'Không có thông tin nào để cập nhật';
  }
  return errors;
};

exports.validateChangePassword = (body) => {
  const errors = {};
  if (typeof body.currentPassword !== 'string' || body.currentPassword.length === 0) {
    errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
  }
  checkPassword(body.newPassword, errors, 'newPassword');
  if (
    typeof body.currentPassword === 'string' &&
    body.currentPassword === body.newPassword
  ) {
    errors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại';
  }
  return errors;
};
