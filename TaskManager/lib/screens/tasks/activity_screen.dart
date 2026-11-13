import 'package:flutter/material.dart';

import '../../models/statistics.dart';
import '../../services/api_client.dart';
import '../../services/statistics_service.dart';
import '../../utils/task_labels.dart';
import '../../widgets/loading_view.dart';

String _describe(TaskActivity a) {
  final d = a.details;
  switch (a.action) {
    case 'create':
      return 'đã tạo công việc';
    case 'update':
      final changes = d['changes'];
      return changes is List && changes.isNotEmpty
          ? 'đã đổi ${changes.join('; ')}'
          : 'đã cập nhật thông tin';
    case 'status_changed':
      return 'đổi trạng thái: ${statusLabel('${d['from']}')} → ${statusLabel('${d['to']}')}';
    case 'assign':
      final added = (d['added'] as List?)?.length ?? 0;
      final removed = (d['removed'] as List?)?.length ?? 0;
      return 'đã cập nhật người được giao (+$added, -$removed)';
    case 'unassign':
      return 'đã bỏ giao việc cho một người';
    case 'share':
      return 'đã chia sẻ công việc';
    case 'share_permission':
      return 'đã đổi quyền chia sẻ';
    case 'unshare':
      return 'đã thu hồi quyền chia sẻ';
    default:
      return a.action;
  }
}

String _time(DateTime? t) {
  if (t == null) return '';
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(t.day)}/${two(t.month)}/${t.year} ${two(t.hour)}:${two(t.minute)}';
}

/// Lịch sử hoạt động của một công việc (ai có quyền xem đều xem được).
class ActivityScreen extends StatefulWidget {
  final String taskId;
  const ActivityScreen({super.key, required this.taskId});

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  List<TaskActivity> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await StatisticsService.instance.getActivities(widget.taskId);
      if (mounted) setState(() => _items = items);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.displayMessage);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _body() {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);
    if (_items.isEmpty) return const Center(child: Text('Chưa có hoạt động nào'));
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: _items.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (_, i) {
          final a = _items[i];
          return ListTile(
            leading: const Icon(Icons.history),
            title: Text('${a.userName} ${_describe(a)}'),
            subtitle: Text(_time(a.createdAt)),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Lịch sử hoạt động')),
        body: _body(),
      );
}
