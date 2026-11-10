import 'package:flutter/material.dart';

import '../../models/email_log.dart';
import '../../services/api_client.dart';
import '../../services/notification_service.dart';
import '../../widgets/loading_view.dart';

/// Lịch sử gửi email của một công việc (chỉ chủ sở hữu). Có thể gửi lại email lỗi.
class EmailLogScreen extends StatefulWidget {
  final String taskId;
  const EmailLogScreen({super.key, required this.taskId});

  @override
  State<EmailLogScreen> createState() => _EmailLogScreenState();
}

class _EmailLogScreenState extends State<EmailLogScreen> {
  final _service = NotificationService.instance;
  List<EmailLog> _logs = [];
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _toast(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(m)));
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final logs = await _service.getEmailLogs(widget.taskId);
      if (mounted) setState(() => _logs = logs);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.displayMessage);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _retry(EmailLog log) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await _service.retryEmail(log.id);
      _toast('Đã thử gửi lại');
    } on ApiException catch (e) {
      _toast(e.displayMessage);
    }
    if (mounted) setState(() => _busy = false);
    await _load();
  }

  (String, Color) _statusInfo(String s) {
    switch (s) {
      case 'sent':
        return ('Đã gửi', Colors.green);
      case 'failed':
        return ('Thất bại', Colors.red);
      default:
        return ('Đang gửi', Colors.orange);
    }
  }

  Widget _body() {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);
    if (_logs.isEmpty) return const Center(child: Text('Chưa có email nào được gửi'));
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: _logs.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (_, i) {
          final l = _logs[i];
          final (label, color) = _statusInfo(l.status);
          return ListTile(
            title: Text(l.subject, maxLines: 2, overflow: TextOverflow.ellipsis),
            subtitle: Text(
              '${l.recipientEmail}\n$label • đã thử ${l.attempts} lần'
              '${l.errorMessage.isEmpty ? '' : '\n${l.errorMessage}'}',
            ),
            isThreeLine: true,
            leading: Icon(Icons.mail_outline, color: color),
            trailing: l.status == 'failed'
                ? TextButton(
                    onPressed: _busy ? null : () => _retry(l),
                    child: const Text('Gửi lại'),
                  )
                : null,
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Lịch sử email')),
      body: _body(),
    );
  }
}
