import 'dart:async';

import 'package:flutter/material.dart';

import '../../models/task.dart';
import '../../services/api_client.dart';
import '../../services/task_service.dart';
import '../../utils/task_labels.dart';
import '../../widgets/loading_view.dart';
import '../../widgets/task_card.dart';
import 'task_create_screen.dart';
import 'task_detail_screen.dart';

const Map<String, String> _scopeLabels = {
  'all': 'Tất cả',
  'created': 'Của tôi',
  'assigned': 'Được giao',
  'shared': 'Được chia sẻ',
};

const Map<String, String> _sortLabels = {
  'createdAt': 'Ngày tạo',
  'dueDate': 'Hạn hoàn thành',
  'priority': 'Mức ưu tiên',
};

class TaskListScreen extends StatefulWidget {
  const TaskListScreen({super.key});

  @override
  State<TaskListScreen> createState() => _TaskListScreenState();
}

class _TaskListScreenState extends State<TaskListScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  List<Task> _tasks = [];
  bool _loading = true;
  String? _error;

  String _scope = 'all';
  String? _status;
  String? _priority;
  String _sortBy = 'createdAt';
  String _order = 'desc';

  bool get _filtersActive =>
      _status != null ||
      _priority != null ||
      _sortBy != 'createdAt' ||
      _order != 'desc';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  /// [silent] = true khi kéo để làm mới: không thay danh sách bằng vòng xoay.
  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final tasks = await TaskService.instance.getTasks(
        scope: _scope,
        status: _status,
        priority: _priority,
        query: _searchController.text,
        sortBy: _sortBy,
        order: _order,
      );
      if (!mounted) return;
      setState(() {
        _tasks = tasks;
        _error = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      if (silent) {
        _toast(e.displayMessage);
      } else {
        setState(() => _error = e.displayMessage);
      }
    } finally {
      if (mounted && _loading) setState(() => _loading = false);
    }
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _load);
    setState(() {}); // cập nhật nút xóa ô tìm kiếm
  }

  Future<void> _create() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const TaskCreateScreen()),
    );
    if (created == true) {
      _toast('Đã tạo công việc');
      _load(silent: true);
    }
  }

  Future<void> _openDetail(Task task) async {
    final deleted = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TaskDetailScreen(taskId: task.id)),
    );
    if (deleted == true) _toast('Đã xóa công việc');
    _load(silent: true);
  }

  Future<void> _openFilters() async {
    var status = _status;
    var priority = _priority;
    var sortBy = _sortBy;
    var order = _order;

    final apply = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          Widget group(
            String title,
            Map<String?, String> options,
            String? selected,
            void Function(String?) onPick,
          ) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 12, bottom: 6),
                  child: Text(
                    title,
                    style: Theme.of(ctx).textTheme.titleSmall,
                  ),
                ),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    for (final e in options.entries)
                      ChoiceChip(
                        label: Text(e.value),
                        selected: selected == e.key,
                        onSelected: (_) => setSheet(() => onPick(e.key)),
                      ),
                  ],
                ),
              ],
            );
          }

          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  group(
                    'Trạng thái',
                    {
                      null: 'Tất cả',
                      for (final s in kStatuses) s: statusLabel(s),
                    },
                    status,
                    (v) => status = v,
                  ),
                  group(
                    'Mức độ ưu tiên',
                    {
                      null: 'Tất cả',
                      for (final p in kPriorities) p: priorityLabel(p),
                    },
                    priority,
                    (v) => priority = v,
                  ),
                  group(
                    'Sắp xếp theo',
                    {for (final e in _sortLabels.entries) e.key: e.value},
                    sortBy,
                    (v) => sortBy = v ?? 'createdAt',
                  ),
                  group(
                    'Thứ tự',
                    {'asc': 'Tăng dần', 'desc': 'Giảm dần'},
                    order,
                    (v) => order = v ?? 'desc',
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => setSheet(() {
                            status = null;
                            priority = null;
                            sortBy = 'createdAt';
                            order = 'desc';
                          }),
                          child: const Text('Đặt lại'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Áp dụng'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );

    if (apply == true) {
      setState(() {
        _status = status;
        _priority = priority;
        _sortBy = sortBy;
        _order = order;
      });
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Công việc'),
        actions: [
          IconButton(
            tooltip: 'Lọc và sắp xếp',
            icon: Badge(
              isLabelVisible: _filtersActive,
              smallSize: 8,
              child: const Icon(Icons.tune),
            ),
            onPressed: _openFilters,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add),
        label: const Text('Thêm'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              onChanged: _onSearchChanged,
              onSubmitted: (_) {
                _debounce?.cancel();
                _load();
              },
              decoration: InputDecoration(
                hintText: 'Tìm theo tên công việc',
                prefixIcon: const Icon(Icons.search),
                border: const OutlineInputBorder(),
                isDense: true,
                suffixIcon: _searchController.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          _debounce?.cancel();
                          setState(() {});
                          _load();
                        },
                      ),
              ),
            ),
          ),
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                for (final e in _scopeLabels.entries)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(e.value),
                      selected: _scope == e.key,
                      onSelected: (_) {
                        if (_scope == e.key) return;
                        setState(() => _scope = e.key);
                        _load();
                      },
                    ),
                  ),
              ],
            ),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView();
    if (_error != null) {
      return ErrorView(message: _error!, onRetry: _load);
    }
    if (_tasks.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _load(silent: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 120),
            Icon(Icons.inbox_outlined, size: 56, color: Colors.grey),
            SizedBox(height: 12),
            Center(child: Text('Không có công việc nào')),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: () => _load(silent: true),
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(top: 4, bottom: 88),
        itemCount: _tasks.length,
        itemBuilder: (_, i) => TaskCard(
          task: _tasks[i],
          onTap: () => _openDetail(_tasks[i]),
        ),
      ),
    );
  }
}
