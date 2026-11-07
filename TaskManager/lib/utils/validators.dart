class Validators {
  static final RegExp _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  static String? fullName(String? v) {
    if ((v ?? '').trim().length < 2) return 'Họ tên phải có ít nhất 2 ký tự';
    return null;
  }

  static String? email(String? v) {
    final value = (v ?? '').trim();
    if (value.isEmpty) return 'Vui lòng nhập email';
    if (!_email.hasMatch(value)) return 'Email không hợp lệ';
    return null;
  }

  static String? password(String? v) {
    final value = v ?? '';
    if (value.isEmpty) return 'Vui lòng nhập mật khẩu';
    if (value.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự';
    return null;
  }

  static String? required(String? v, String message) {
    if ((v ?? '').isEmpty) return message;
    return null;
  }

  static String? confirmPassword(String? v, String original) {
    if ((v ?? '').isEmpty) return 'Vui lòng xác nhận mật khẩu';
    if (v != original) return 'Mật khẩu xác nhận không khớp';
    return null;
  }
}
