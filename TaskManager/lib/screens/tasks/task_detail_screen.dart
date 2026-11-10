import 'package:flutter/material.dart';

import '../../models/task.dart';
import '../../services/api_client.dart';
import '../../services/task_service.dart';
import '../../utils/date_formatter.dart';
import '../../utils/task_labels.dart';
import '../../widgets/loading_view.dart';
import '../../widgets/priority_badge.dart';
import '../../widgets/status_badge.dart';
import '../../widgets/user_avatar.dart';
import 'assign_task_screen.dart';
import 'email_log_screen.dart';
import 'task_edit_screen.dart';
import 'task_sharing_screen.dart';

class TaskDetailScreen extends StatefulWidget {
  final String taskId;
  const TaskDetailScreen({super.key, required this.taskId});

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  Task? _task;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final task = await TaskService.instance.getTask(widget.taskId);
      if (!mounted) return;
      setState(() => _task = task);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.displayMessage);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit() async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TaskEditScreen(task: _task!)),
    );
    if (changed == true) {
      _toast('Đã cập nhật công việc');
      _load();
    }
  }

  Future<void> _assign() async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => AssignTaskScreen(task: _task!)),
    );
    if (changed == true) {
      _toast('Đã cập nhật người được giao');
      _load();
    }
  }

  Future<void> _share() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => TaskSharingScreen(task: _task!)),
    );
    _load(); // danh sách chia sẻ có thể đã thay đổi
  }

  Future<void> _changeStatus(String status) async {
    final task = _task!;
    if (status == task.status || _busy) return;
    setState(() => _busy = true);
    try {
      final updated = await TaskService.instance.updateStatus(task.id, status);
      if (mounted) setState(() => _task = updated);
      _toast('Đã đổi trạng thái: ${statusLabel(status)}');
    } on ApiException catch (e) {
      _toast(e.displayMessage);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa công việc'),
        content: Text('Bạn có chắc muốn xóa "${_task!.title}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    setState(() => _busy = true);
    try {
      await TaskService.instance.deleteTask(_task!.id);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      _toast(e.displayMessage);
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final task = _task;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết công việc'),
        actions: [
          if (task != null && task.canEdit)
            IconButton(
              tooltip: 'Chỉnh sửa',
              icon: const Icon(Icons.edit_outlined),
              onPressed: _busy ? null : _edit,
            ),
          if (task != null && task.canDelete)
            IconButton(
              tooltip: 'Xóa',
              icon: const Icon(Icons.delete_outline),
              onPressed: _busy ? null : _delete,
            ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading && _task == null) return const LoadingView();
    if (_error != null && _task == null) {
      return ErrorView(message: _error!, onRetry: _load);
    }
    final task = _task!;
    final theme = Theme.of(context);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            task.title,
            style: theme.textTheme.headlineSmall
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              StatusBadge(status: task.status),
              PriorityBadge(priority: task.priority),
              if (task.isOverdue)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.errorContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Quá hạn',
                    style: TextStyle(
                      color: theme.colorScheme.onErrorContainer,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            task.description.isEmpty ? 'Không có mô tả' : task.description,
            style: theme.textTheme.bodyLarge?.copyWith(
              fontStyle:
                  task.description.isEmpty ? FontStyle.italic : FontStyle.normal,
            ),
          ),
          const Divider(height: 32),
          _InfoRow(
            icon: Icons.play_arrow_outlined,
            label: 'Ngày bắt đầu',
            value: formatDate(task.startDate),
          ),
          _InfoRow(
            icon: Icons.event,
            label: 'Hạn hoàn thành',
            value: formatDate(task.dueDate),
            valueColor: task.isOverdue ? theme.colorScheme.error : null,
          ),
          _InfoRow(
            icon: Icons.person_outline,
            label: 'Người tạo',
            value: task.createdBy?.fullName ?? 'Không rõ',
          ),
          _InfoRow(
            icon: Icons.star_outline,
            label: 'Người phụ trách chính',
            value: task.primaryAssignee?.fullName ?? 'Chưa chỉ định',
          ),
          _InfoRow(
            icon: Icons.group_outlined,
            label: 'Người được giao',
            value: task.assignees.isEmpty
                ? 'Chưa giao cho ai'
                : task.assignees.map((u) => u.fullName).join(', '),
          ),
          _InfoRow(
            icon: Icons.badge_outlined,
            label: 'Vai trò của bạn',
            value: roleLabel(task.role),
          ),
          if (task.canAssign || task.canShare) ...[
            const Divider(height: 32),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (task.canAssign)
                  OutlinedButton.icon(
                    onPressed: _busy ? null : _assign,
                    icon: const Icon(Icons.assignment_ind_outlined),
                    label: const Text('Giao việc'),
                  ),
                if (task.canShare)
                  OutlinedButton.icon(
                    onPressed: _busy ? null : _share,
                    icon: const Icon(Icons.share_outlined),
                    label: const Text('Chia sẻ'),
                  ),
                if (task.role == 'owner')
                  OutlinedButton.icon(
                    onPressed: () => Navigator.of(context).push<void>(
                      MaterialPageRoute(
                        builder: (_) => EmailLogScreen(taskId: task.id),
                      ),
                    ),
                    icon: const Icon(Icons.mail_outline),
                    label: const Text('Lịch sử email'),
                  ),
              ],
            ),
          ],
          if (task.canShare && task.shares.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Đã chia sẻ cho', style: theme.textTheme.titleSmall),
            for (final s in task.shares)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                leading: UserAvatar(user: s.user, radius: 16),
                title: Text(s.user.fullName),
                trailing: Text(
                  s.permission == 'editor' ? 'Chỉnh sửa' : 'Chỉ xem',
                  style: theme.textTheme.bodySmall,
                ),
              ),
          ],
          const Divider(height: 32),
          if (task.canChangeStatus) ...[
            Text('Cập nhật trạng thái', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                for (final s in kStatuses)
                  ChoiceChip(
                    label: Text(statusLabel(s)),
                    selected: task.status == s,
                    onSelected: _busy ? null : (_) => _changeStatus(s),
                  ),
              ],
            ),
          ] else
            Text(
              'Bạn chỉ có quyền xem công việc này.',
              style: theme.textTheme.bodySmall,
            ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: theme.colorScheme.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: theme.textTheme.bodySmall),
                Text(
                  value,
                  style: theme.textTheme.bodyLarge?.copyWith(color: valueColor),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
