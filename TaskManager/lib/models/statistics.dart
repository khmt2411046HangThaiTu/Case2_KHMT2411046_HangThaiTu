class StatusCounts {
  final int total;
  final int todo;
  final int inProgress;
  final int completed;
  final int active;

  const StatusCounts({
    this.total = 0,
    this.todo = 0,
    this.inProgress = 0,
    this.completed = 0,
    this.active = 0,
  });

  factory StatusCounts.fromJson(Map<String, dynamic>? j) {
    int n(String k) => (j?[k] as num?)?.toInt() ?? 0;
    return StatusCounts(
      total: n('total'),
      todo: n('todo'),
      inProgress: n('in_progress'),
      completed: n('completed'),
      active: n('active'),
    );
  }
}

class TaskStats {
  final StatusCounts counts;
  final int completionRate;
  final Map<String, int> byPriority;

  const TaskStats({
    required this.counts,
    required this.completionRate,
    required this.byPriority,
  });

  factory TaskStats.fromJson(Map<String, dynamic> j) {
    final p = j['byPriority'] as Map<String, dynamic>? ?? {};
    return TaskStats(
      counts: StatusCounts.fromJson(j),
      completionRate: (j['completionRate'] as num?)?.toInt() ?? 0,
      byPriority: {
        for (final e in p.entries) e.key: (e.value as num).toInt(),
      },
    );
  }
}

class AssignmentStats {
  final StatusCounts assignedToMe;
  final StatusCounts primaryForMe;
  final StatusCounts assignedByMe;

  const AssignmentStats({
    required this.assignedToMe,
    required this.primaryForMe,
    required this.assignedByMe,
  });

  factory AssignmentStats.fromJson(Map<String, dynamic> j) => AssignmentStats(
        assignedToMe:
            StatusCounts.fromJson(j['assignedToMe'] as Map<String, dynamic>?),
        primaryForMe:
            StatusCounts.fromJson(j['primaryForMe'] as Map<String, dynamic>?),
        assignedByMe:
            StatusCounts.fromJson(j['assignedByMe'] as Map<String, dynamic>?),
      );
}

class DeadlineItem {
  final String id;
  final String title;
  final String priority;
  final DateTime? dueDate;

  const DeadlineItem({
    required this.id,
    required this.title,
    required this.priority,
    this.dueDate,
  });

  factory DeadlineItem.fromJson(Map<String, dynamic> j) {
    final d = j['dueDate'];
    return DeadlineItem(
      id: (j['id'] ?? '').toString(),
      title: j['title'] ?? '',
      priority: j['priority'] ?? 'medium',
      dueDate: d is String ? DateTime.tryParse(d)?.toLocal() : null,
    );
  }
}

class DeadlineStats {
  final int days;
  final List<DeadlineItem> overdue;
  final List<DeadlineItem> dueSoon;
  final int overdueCount;
  final int dueSoonCount;

  const DeadlineStats({
    required this.days,
    required this.overdue,
    required this.dueSoon,
    required this.overdueCount,
    required this.dueSoonCount,
  });

  static List<DeadlineItem> _list(dynamic v) => (v as List<dynamic>? ?? [])
      .whereType<Map<String, dynamic>>()
      .map(DeadlineItem.fromJson)
      .toList();

  factory DeadlineStats.fromJson(Map<String, dynamic> j) => DeadlineStats(
        days: (j['days'] as num?)?.toInt() ?? 7,
        overdue: _list(j['overdue']),
        dueSoon: _list(j['dueSoon']),
        overdueCount: (j['overdueCount'] as num?)?.toInt() ?? 0,
        dueSoonCount: (j['dueSoonCount'] as num?)?.toInt() ?? 0,
      );
}

/// Một dòng lịch sử hoạt động của công việc.
class TaskActivity {
  final String action;
  final String userName;
  final Map<String, dynamic> details;
  final DateTime? createdAt;

  const TaskActivity({
    required this.action,
    required this.userName,
    required this.details,
    this.createdAt,
  });

  factory TaskActivity.fromJson(Map<String, dynamic> j) {
    final u = j['user'];
    final c = j['createdAt'];
    return TaskActivity(
      action: j['action'] ?? '',
      userName: u is Map<String, dynamic> ? (u['fullName'] ?? 'Ai đó') : 'Ai đó',
      details: j['details'] is Map<String, dynamic>
          ? j['details'] as Map<String, dynamic>
          : {},
      createdAt: c is String ? DateTime.tryParse(c)?.toLocal() : null,
    );
  }
}
