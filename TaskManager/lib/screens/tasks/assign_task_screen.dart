import 'package:flutter/material.dart';

import '../../models/task.dart';
import '../../models/user.dart';
import '../../services/api_client.dart';
import '../../services/assignment_service.dart';
import '../../widgets/user_avatar.dart';
import '../../widgets/user_picker_sheet.dart';

/// Giao việc cho một hoặc nhiều người và chọn người phụ trách chính.
/// Pop(true) khi lưu thành công.
class AssignTaskScreen extends StatefulWidget {
  final Task task;
  const AssignTaskScreen({super.key, required this.task});

  @override
  State<AssignTaskScreen> createState() => _AssignTaskScreenState();
}

class _AssignTaskScreenState extends State<AssignTaskScreen> {
  late List<User> _assignees = List.of(widget.task.assignees);
  late String? _primaryId = widget.task.primaryAssignee?.id;
  bool _saving = false;

  void _toast(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(m)));
  }

  Future<void> _add() async {
    final picked = await showUserPicker(
      context,
      title: 'Chọn người được giao',
      multiple: true,
      initialSelected: _assignees,
    );
    if (picked == null) return;
    setState(() {
      _assignees = picked;
      if (!_assignees.any((u) => u.id == _primaryId)) {
        _primaryId = _assignees.isEmpty ? null : _assignees.first.id;
      }
    });
  }

  void _remove(User u) {
    setState(() {
      _assignees.removeWhere((x) => x.id == u.id);
      if (_primaryId == u.id) {
        _primaryId = _assignees.isEmpty ? null : _assignees.first.id;
      }
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await AssignmentService.instance.setAssignees(
        widget.task.id,
        _assignees.map((u) => u.id).toList(),
        _primaryId,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      _toast(e.displayMessage);
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Giao việc')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.task.title,
                    style: theme.textTheme.titleMedium,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: _saving ? null : _add,
                  icon: const Icon(Icons.person_add_alt),
                  label: const Text('Chọn người'),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Chạm vào ngôi sao để chọn người phụ trách chính.',
                style: theme.textTheme.bodySmall,
              ),
            ),
          ),
          const Divider(),
          Expanded(
            child: _assignees.isEmpty
                ? const Center(child: Text('Chưa giao cho ai'))
                : ListView(
                    children: [
                      for (final u in _assignees)
                        ListTile(
                          leading: UserAvatar(user: u),
                          title: Text(u.fullName),
                          subtitle: Text(u.email),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                tooltip: 'Người phụ trách chính',
                                icon: Icon(
                                  _primaryId == u.id
                                      ? Icons.star
                                      : Icons.star_border,
                                  color: _primaryId == u.id
                                      ? Colors.amber
                                      : null,
                                ),
                                onPressed: () =>
                                    setState(() => _primaryId = u.id),
                              ),
                              IconButton(
                                tooltip: 'Bỏ giao việc',
                                icon: const Icon(Icons.close),
                                onPressed: () => _remove(u),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Lưu'),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
