import 'package:flutter/material.dart';

import '../../models/app_notification.dart';
import '../../services/api_client.dart';
import '../../services/notification_service.dart';
import '../../widgets/loading_view.dart';
import '../tasks/task_detail_screen.dart';

IconData _iconFor(String type) {
  switch (type) {
    case 'task_assigned':
      return Icons.assignment_ind_outlined;
    case 'task_shared':
      return Icons.share_outlined;
    case 'task_updated':
      return Icons.edit_calendar_outlined;
    case 'task_completed':
      return Icons.check_circle_outline;
    case 'due_reminder':
      return Icons.alarm;
    default:
      return Icons.notifications_none;
  }
}

String _timeAgo(DateTime? t) {
  if (t == null) return '';
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return 'Vừa xong';
  if (d.inMinutes < 60) return '${d.inMinutes} phút trước';
  if (d.inHours < 24) return '${d.inHours} giờ trước';
  if (d.inDays < 7) return '${d.inDays} ngày trước';
  return '${t.day.toString().padLeft(2, '0')}/${t.month.toString().padLeft(2, '0')}/${t.year}';
}

/// Danh sách thông báo: đánh dấu đã đọc và mở công việc liên quan.
class NotificationScreen extends StatefulWidget {
  const NotificationScreen({super.key});

  @override
  State<NotificationScreen> createState() => NotificationScreenState();
}

class NotificationScreenState extends State<NotificationScreen> {
  final _service = NotificationService.instance;
  List<AppNotification> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    reload();
  }

  /// Home gọi hàm này mỗi khi người dùng chuyển sang tab thông báo.
  Future<void> reload({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = _items.isEmpty;
        _error = null;
      });
    }
    try {
      final items = await _service.getNotifications();
      if (mounted) setState(() => _items = items);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (_items.isEmpty) {
        setState(() => _error = e.displayMessage);
      } else {
        _toast(e.displayMessage);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _toast(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(m)));
  }

  Future<void> _markAll() async {
    try {
      await _service.markAllRead();
      if (mounted) {
        setState(() => _items = [for (final n in _items) n.copyWith(isRead: true)]);
      }
    } on ApiException catch (e) {
      _toast(e.displayMessage);
    }
  }

  Future<void> _open(AppNotification n) async {
    if (!n.isRead) {
      setState(() {
        _items = [for (final x in _items) x.id == n.id ? x.copyWith(isRead: true) : x];
      });
      try {
        await _service.markRead(n.id);
      } on ApiException {
        // vẫn mở công việc dù đánh dấu lỗi
      }
    }
    if (n.taskId == null || !mounted) return;
    await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TaskDetailScreen(taskId: n.taskId!)),
    );
    reload(silent: true);
  }

  Widget _body() {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: reload);
    if (_items.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => reload(silent: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 120),
            Icon(Icons.notifications_off_outlined, size: 56, color: Colors.grey),
            SizedBox(height: 12),
            Center(child: Text('Chưa có thông báo nào')),
          ],
        ),
      );
    }
    final theme = Theme.of(context);
    return RefreshIndicator(
      onRefresh: () => reload(silent: true),
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: _items.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (_, i) {
          final n = _items[i];
          return ListTile(
            tileColor:
                n.isRead ? null : theme.colorScheme.primaryContainer.withValues(alpha: 0.35),
            leading: Icon(_iconFor(n.type), color: theme.colorScheme.primary),
            title: Text(
              n.title,
              style: TextStyle(
                fontWeight: n.isRead ? FontWeight.normal : FontWeight.bold,
              ),
            ),
            subtitle: Text('${n.message}\n${_timeAgo(n.createdAt)}'),
            isThreeLine: true,
            trailing: n.isRead
                ? null
                : Icon(Icons.circle, size: 10, color: theme.colorScheme.primary),
            onTap: () => _open(n),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thông báo'),
        actions: [
          ValueListenableBuilder<int>(
            valueListenable: _service.unreadCount,
            builder: (_, count, __) => IconButton(
              tooltip: 'Đánh dấu tất cả đã đọc',
              icon: const Icon(Icons.done_all),
              onPressed: count == 0 ? null : _markAll,
            ),
          ),
        ],
      ),
      body: _body(),
    );
  }
}
