import 'package:flutter/foundation.dart';

import '../models/user.dart';
import 'api_client.dart';

/// Quản lý phiên đăng nhập. [currentUser] thay đổi thì giao diện tự chuyển
/// giữa màn hình đăng nhập và màn hình chính (xem AuthGate trong app.dart).
class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  final ApiClient _api = ApiClient.instance;
  final ValueNotifier<User?> currentUser = ValueNotifier<User?>(null);

  /// Gọi khi mở app: đọc token đã lưu và lấy lại thông tin người dùng.
  Future<void> restoreSession() async {
    await _api.loadToken();
    if (!_api.hasToken) return;
    try {
      final data = await _api.get('/auth/me');
      currentUser.value = User.fromJson(data['user'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      // Token hết hạn/không hợp lệ thì xóa; lỗi mạng thì giữ token để lần sau thử lại.
      if (e.statusCode == 401) await _api.setToken(null);
    }
  }

  Future<void> register({
    required String fullName,
    required String email,
    required String password,
  }) async {
    final data = await _api.post('/auth/register', {
      'fullName': fullName.trim(),
      'email': email.trim(),
      'password': password,
    });
    await _saveSession(data);
  }

  Future<void> login({required String email, required String password}) async {
    final data = await _api.post('/auth/login', {
      'email': email.trim(),
      'password': password,
    });
    await _saveSession(data);
  }

  /// Đăng xuất: xóa token phía thiết bị (JWT không trạng thái nên server không cần xử lý).
  Future<void> logout() async {
    await _api.setToken(null);
    currentUser.value = null;
  }

  Future<void> updateProfile({required String fullName}) async {
    final data = await _guard(
      () => _api.put('/auth/me', {'fullName': fullName.trim()}),
    );
    currentUser.value = User.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _guard(
      () => _api.put('/auth/change-password', {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      }),
    );
  }

  Future<void> _saveSession(Map<String, dynamic> data) async {
    await _api.setToken(data['token'] as String);
    currentUser.value = User.fromJson(data['user'] as Map<String, dynamic>);
  }

  /// Nếu token hết hạn giữa chừng (401) thì tự đăng xuất.
  Future<Map<String, dynamic>> _guard(
    Future<Map<String, dynamic>> Function() call,
  ) async {
    try {
      return await call();
    } on ApiException catch (e) {
      if (e.statusCode == 401) await logout();
      rethrow;
    }
  }
}
