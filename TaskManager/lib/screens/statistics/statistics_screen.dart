import 'package:flutter/material.dart';

import '../../models/statistics.dart';
import '../../services/api_client.dart';
import '../../services/statistics_service.dart';
import '../../utils/date_formatter.dart';
import '../../utils/task_labels.dart';
import '../../widgets/loading_view.dart';
import '../tasks/task_detail_screen.dart';

/// Thống kê công việc: theo trạng thái, được giao / phụ trách, hạn hoàn thành.
class StatisticsScreen extends StatefulWidget {
  const StatisticsScreen({super.key});

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> {
  final _service = StatisticsService.instance;
  TaskStats? _tasks;
  AssignmentStats? _assign;
  DeadlineStats? _deadlines;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final results = await Future.wait([
        _service.getTaskStats(),
        _service.getAssignmentStats(),
        _service.getDeadlineStats(),
      ]);
      if (!mounted) return;
      setState(() {
        _tasks = results[0] as TaskStats;
        _assign = results[1] as AssignmentStats;
        _deadlines = results[2] as DeadlineStats;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.displayMessage);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _bar(String label, int value, int total, Color color) {
    final ratio = total == 0 ? 0.0 : value / total;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          SizedBox(width: 110, child: Text(label)),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: ratio,
                minHeight: 12,
                color: color,
                backgroundColor: color.withValues(alpha: 0.15),
              ),
            ),
          ),
          SizedBox(
            width: 36,
            child: Text('$value', textAlign: TextAlign.end),
          ),
        ],
      ),
    );
  }

  Widget _card(String title, List<Widget> children) => Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              ...children,
            ],
          ),
        ),
      );

  Widget _statusCard() {
    final t = _tasks!;
    final c = t.counts;
    return _card('Công việc theo trạng thái', [
      Text('Tổng ${c.total} công việc • hoàn thành ${t.completionRate}%'),
      const SizedBox(height: 8),
      for (final s in kStatuses)
        _bar(
          statusLabel(s),
          s == 'todo'
              ? c.todo
              : s == 'in_progress'
                  ? c.inProgress
                  : c.completed,
          c.total,
          statusColor(s),
        ),
      const Divider(height: 24),
      for (final p in kPriorities)
        _bar(
          'Ưu tiên ${priorityLabel(p).toLowerCase()}',
          t.byPriority[p] ?? 0,
          c.total,
          priorityColor(p),
        ),
    ]);
  }

  Widget _assignmentRow(String label, StatusCounts c) => ListTile(
        dense: true,
        contentPadding: EdgeInsets.zero,
        title: Text(label),
        subtitle: Text(
          'Đang làm: ${c.active} • Hoàn thành: ${c.completed}',
        ),
        trailing: Text(
          '${c.total}',
          style: Theme.of(context).textTheme.titleLarge,
        ),
      );

  Widget _assignmentCard() {
    final a = _assign!;
    return _card('Giao việc', [
      _assignmentRow('Việc được giao cho tôi', a.assignedToMe),
      _assignmentRow('Việc tôi phụ trách chính', a.primaryForMe),
      _assignmentRow('Việc tôi đã giao cho người khác', a.assignedByMe),
    ]);
  }

  Widget _deadlineList(String title, List<DeadlineItem> items, int count, Color color) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(
            '$title ($count)',
            style: TextStyle(color: color, fontWeight: FontWeight.w600),
          ),
        ),
        for (final i in items)
          ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: Text(i.title, maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: Text('Hạn ${formatDate(i.dueDate)}'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () async {
              await Navigator.of(context).push<bool>(
                MaterialPageRoute(builder: (_) => TaskDetailScreen(taskId: i.id)),
              );
              _load(silent: true);
            },
          ),
      ],
    );
  }

  Widget _deadlineCard() {
    final d = _deadlines!;
    return _card('Hạn hoàn thành', [
      if (d.overdueCount == 0 && d.dueSoonCount == 0)
        Text('Không có việc quá hạn hay sắp đến hạn trong ${d.days} ngày tới.'),
      _deadlineList('Đã quá hạn', d.overdue, d.overdueCount,
          Theme.of(context).colorScheme.error),
      _deadlineList('Sắp đến hạn (${d.days} ngày tới)', d.dueSoon,
          d.dueSoonCount, Colors.orange.shade800),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loading) {
      body = const LoadingView();
    } else if (_error != null) {
      body = ErrorView(message: _error!, onRetry: _load);
    } else {
      body = RefreshIndicator(
        onRefresh: () => _load(silent: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [_statusCard(), _assignmentCard(), _deadlineCard()],
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Thống kê')),
      body: body,
    );
  }
}
