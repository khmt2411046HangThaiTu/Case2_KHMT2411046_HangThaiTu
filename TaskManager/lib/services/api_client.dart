import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../utils/constants.dart';

/// Lỗi trả về từ API hoặc lỗi mạng.
class ApiException implements Exception {
  final int? statusCode;
  final String message;
  final Map<String, String> fieldErrors;

  ApiException(this.message, {this.statusCode, this.fieldErrors = const {}});

  /// Thông báo hiển thị cho người dùng (gộp lỗi từng trường nếu có).
  String get displayMessage {
    if (fieldErrors.isEmpty) return message;
    return fieldErrors.values.join('\n');
  }

  @override
  String toString() => displayMessage;
}

/// Gửi HTTP request tới backend, tự gắn token và đọc JSON.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  String? _token;
  bool get hasToken => _token != null && _token!.isNotEmpty;

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(kTokenKey);
  }

  Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token == null) {
      await prefs.remove(kTokenKey);
    } else {
      await prefs.setString(kTokenKey, token);
    }
  }

  Future<Map<String, dynamic>> get(String path) => _send('GET', path);

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) =>
      _send('POST', path, body: body);

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) =>
      _send('PUT', path, body: body);

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final request = http.Request(method, Uri.parse('$kApiBaseUrl$path'));
    request.headers['Content-Type'] = 'application/json';
    request.headers['Accept'] = 'application/json';
    if (hasToken) request.headers['Authorization'] = 'Bearer $_token';
    if (body != null) request.body = jsonEncode(body);

    http.Response response;
    try {
      final streamed = await request.send().timeout(const Duration(seconds: 15));
      response = await http.Response.fromStream(streamed);
    } on TimeoutException {
      throw ApiException('Máy chủ phản hồi quá chậm, vui lòng thử lại');
    } catch (_) {
      throw ApiException(
        'Không thể kết nối máy chủ. Kiểm tra server và địa chỉ API.',
      );
    }

    Map<String, dynamic> data = {};
    if (response.body.isNotEmpty) {
      try {
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        if (decoded is Map<String, dynamic>) data = decoded;
      } catch (_) {
        // body không phải JSON: giữ data rỗng
      }
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    }

    final fieldErrors = <String, String>{};
    final errors = data['errors'];
    if (errors is Map) {
      errors.forEach((k, v) => fieldErrors[k.toString()] = v.toString());
    }
    throw ApiException(
      (data['message'] ?? 'Có lỗi xảy ra (${response.statusCode})').toString(),
      statusCode: response.statusCode,
      fieldErrors: fieldErrors,
    );
  }
}
