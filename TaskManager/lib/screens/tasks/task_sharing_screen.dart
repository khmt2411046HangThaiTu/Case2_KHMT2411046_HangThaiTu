import 'package:flutter/material.dart';

import '../../models/task.dart';
import '../../models/task_share.dart';
import '../../services/api_client.dart';
import '../../services/task_share_service.dart';
import '../../widgets/loading_view.dart';
import '../../widgets/user_avatar.dart';
import '../../widgets/user_picker_sheet.dart';

String _permissionLabel(String p) =>
    p == 'editor' ? 'Được chỉnh sửa' : 'Chỉ xem';

/// Quản lý chia sẻ: xem danh sách, thêm người, đổi quyền, thu hồi.
/// Chỉ chủ sở hữu mới mở được màn hình này.
class TaskSharingScreen extends StatefulWidget {
  final Task task;
  const TaskSharingScreen({super.key, required this.task});

  @override
  State<TaskSharingScreen> createState() => _TaskSharingScreenState();
}

class _TaskSharingScreenState extends State<TaskSharingScreen> {
  final _service = TaskShareService.instance;
  List<TaskShare> _shares = [];
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
      final shares = await _service.list(widget.task.id);
      if (mounted) setState(() => _shares = shares);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.displayMessage);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Chạy một thao tác ghi, cập nhật danh sách bằng kết quả trả về.
  Future<void> _run(
    Future<List<TaskShare>> Function() action,
    String successMessage,
  ) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final shares = await action();
      if (mounted) setState(() => _shares = shares);
      _toast(successMessage);
    } on ApiException catch (e) {
      _toast(e.displayMessage);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _add() async {
    final picked = await showUserPicker(
      context,
      title: 'Chia sẻ cho ai?',
      excludeIds: {for (final s in _shares) s.user.id},
    );
    if (picked == null || picked.isEmpty || !mounted) return;
    final user = picked.first;

    final permission = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(
                'Quyền của ${user.fullName}',
                style: Theme.of(ctx).textTheme.titleMedium,
              ),
            ),
            ListTile(
              leading: const Icon(Icons.visibility_outlined),
              title: const Text('Chỉ xem'),
              subtitle: const Text('Xem công việc, không được sửa'),
              onTap: () => Navigator.pop(ctx, 'viewer'),
            ),
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: const Text('Được chỉnh sửa'),
              subtitle: const Text('Sửa, đổi trạng thái và giao việc'),
              onTap: () => Navigator.pop(ctx, 'editor'),
            ),
          ],
        ),
      ),
    );
    if (permission == null) return;
    await _run(
      () => _service.share(widget.task.id, user.id, permission),
      'Đã chia sẻ cho ${user.fullName}',
    );
  }

  Future<void> _revoke(TaskShare s) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Thu hồi quyền truy cập'),
        content: Text('${s.user.fullName} sẽ không còn xem được công việc này.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Thu hồi'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await _run(
      () => _service.revoke(widget.task.id, s.user.id),
      'Đã thu hồi quyền của ${s.user.fullName}',
    );
  }

  Widget _body() {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);
    if (_shares.isEmpty) {
      return const Center(child: Text('Chưa chia sẻ cho ai'));
    }
    return ListView.separated(
      padding: const EdgeInsets.only(bottom: 88),
      itemCount: _shares.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (_, i) {
        final s = _shares[i];
        return ListTile(
          leading: UserAvatar(user: s.user),
          title: Text(s.user.fullName),
          subtitle: Text('${s.user.email}\n${_permissionLabel(s.permission)}'),
          isThreeLine: true,
          trailing: PopupMenuButton<String>(
            enabled: !_busy,
            onSelected: (v) {
              if (v == 'revoke') {
                _revoke(s);
              } else {
                _run(
                  () => _service.changePermission(widget.task.id, s.user.id, v),
                  'Đã đổi quyền của ${s.user.fullName}',
                );
              }
            },
            itemBuilder: (_) => [
              if (s.permission != 'viewer')
                const PopupMenuItem(value: 'viewer', child: Text('Chỉ xem')),
              if (s.permission != 'editor')
                const PopupMenuItem(
                  value: 'editor',
                  child: Text('Được chỉnh sửa'),
                ),
              const PopupMenuItem(value: 'revoke', child: Text('Thu hồi')),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chia sẻ công việc')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _busy ? null : _add,
        icon: const Icon(Icons.person_add_alt),
        label: const Text('Chia sẻ'),
      ),
      body: RefreshIndicator(onRefresh: _load, child: _body()),
    );
  }
}
