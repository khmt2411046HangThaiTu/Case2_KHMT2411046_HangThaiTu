import 'package:flutter/foundation.dart';

import '../models/app_notification.dart';
import '../models/email_log.dart';
import 'api_client.dart';

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final ApiClient _api = ApiClient.instance;

  /// Số thông báo chưa đọc, để hiện huy hiệu trên thanh điều hướng.
  final ValueNotifier<int> unreadCount = ValueNotifier<int>(0);

  Future<List<AppNotification>> getNotifications({bool unreadOnly = false}) async {
    final path = Uri(
      path: '/notifications',
      queryParameters: {
        'limit': '50',
        if (unreadOnly) 'unread': 'true',
      },
    ).toString();
    final data = await _api.get(path);
    unreadCount.value = (data['unreadCount'] as num?)?.toInt() ?? 0;
    return (data['notifications'] as List<dynamic>? ?? [])
        .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Cập nhật huy hiệu; lỗi mạng thì bỏ qua (không làm phiền người dùng).
  Future<void> refreshUnreadCount() async {
    try {
      final data = await _api.get('/notifications/unread-count');
      unreadCount.value = (data['count'] as num?)?.toInt() ?? 0;
    } on ApiException {
      // bỏ qua
    }
  }

  Future<void> markRead(String id) async {
    await _api.patch('/notifications/$id/read', {});
    await refreshUnreadCount();
  }

  Future<void> markAllRead() async {
    await _api.patch('/notifications/read-all', {});
    unreadCount.value = 0;
  }

  Future<List<EmailLog>> getEmailLogs(String taskId) async {
    final data = await _api.get('/tasks/$taskId/email-logs');
    return (data['emailLogs'] as List<dynamic>? ?? [])
        .map((e) => EmailLog.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> retryEmail(String logId) async {
    await _api.post('/email-logs/$logId/retry', {});
  }
}
