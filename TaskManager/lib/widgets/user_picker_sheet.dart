import 'dart:async';

import 'package:flutter/material.dart';

import '../models/user.dart';
import '../services/api_client.dart';
import '../services/user_service.dart';
import 'user_avatar.dart';

/// Hộp chọn người dùng: tìm theo tên/email, chọn một hoặc nhiều người.
/// Trả về danh sách người được chọn, hoặc null nếu hủy.
/// [excludeIds]: những người không hiện trong danh sách (ví dụ đã được chia sẻ).
Future<List<User>?> showUserPicker(
  BuildContext context, {
  required String title,
  bool multiple = false,
  List<User> initialSelected = const [],
  Set<String> excludeIds = const {},
}) {
  return showModalBottomSheet<List<User>>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _UserPickerSheet(
      title: title,
      multiple: multiple,
      initialSelected: initialSelected,
      excludeIds: excludeIds,
    ),
  );
}

class _UserPickerSheet extends StatefulWidget {
  final String title;
  final bool multiple;
  final List<User> initialSelected;
  final Set<String> excludeIds;

  const _UserPickerSheet({
    required this.title,
    required this.multiple,
    required this.initialSelected,
    required this.excludeIds,
  });

  @override
  State<_UserPickerSheet> createState() => _UserPickerSheetState();
}

class _UserPickerSheetState extends State<_UserPickerSheet> {
  final _controller = TextEditingController();
  Timer? _debounce;

  List<User> _results = [];
  late final Map<String, User> _selected = {
    for (final u in widget.initialSelected) u.id: u,
  };
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _search();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final users = await UserService.instance.search(_controller.text);
      if (!mounted) return;
      setState(() => _results =
          users.where((u) => !widget.excludeIds.contains(u.id)).toList());
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.displayMessage);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _search);
  }

  void _tap(User u) {
    if (!widget.multiple) {
      Navigator.pop(context, [u]);
      return;
    }
    setState(() {
      if (_selected.containsKey(u.id)) {
        _selected.remove(u.id);
      } else {
        _selected[u.id] = u;
      }
    });
  }

  Widget _list() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(child: Text(_error!, textAlign: TextAlign.center));
    }
    if (_results.isEmpty) {
      return const Center(child: Text('Không tìm thấy người dùng nào'));
    }
    return ListView.builder(
      itemCount: _results.length,
      itemBuilder: (_, i) {
        final u = _results[i];
        final checked = _selected.containsKey(u.id);
        return ListTile(
          leading: UserAvatar(user: u),
          title: Text(u.fullName),
          subtitle: Text(u.email),
          trailing: widget.multiple
              ? Checkbox(value: checked, onChanged: (_) => _tap(u))
              : null,
          onTap: () => _tap(u),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.7,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  if (widget.multiple)
                    FilledButton(
                      onPressed: () =>
                          Navigator.pop(context, _selected.values.toList()),
                      child: Text('Xong (${_selected.length})'),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _controller,
                onChanged: _onChanged,
                decoration: const InputDecoration(
                  hintText: 'Tìm theo tên hoặc email',
                  prefixIcon: Icon(Icons.search),
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(child: _list()),
          ],
        ),
      ),
    );
  }
}
