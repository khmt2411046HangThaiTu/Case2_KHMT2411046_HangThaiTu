import 'task_share.dart';
import 'user.dart';

class Task {
  final String id;
  final String title;
  final String description;
  final User? createdBy;
  final List<User> assignees;
  final User? primaryAssignee;
  final DateTime? startDate;
  final DateTime? dueDate;
  final String priority; // low, medium, high
  final String status; // todo, in_progress, completed
  final String role; // owner, editor, assignee, viewer
  final DateTime? createdAt;
  /// Chỉ có khi người xem là owner (backend không gửi cho người khác).
  final List<TaskShare> shares;

  const Task({
    required this.id,
    required this.title,
    this.description = '',
    this.createdBy,
    this.assignees = const [],
    this.primaryAssignee,
    this.startDate,
    this.dueDate,
    this.priority = 'medium',
    this.status = 'todo',
    this.role = 'viewer',
    this.createdAt,
    this.shares = const [],
  });

  /// Quyền của người dùng hiện tại (backend vẫn kiểm tra lại).
  bool get canEdit => role == 'owner' || role == 'editor';
  bool get canChangeStatus => canEdit || role == 'assignee';
  bool get canDelete => role == 'owner';
  bool get canAssign => canEdit;
  bool get canShare => role == 'owner';

  bool get isOverdue =>
      dueDate != null &&
      status != 'completed' &&
      dueDate!.isBefore(DateTime.now());

  static DateTime? _date(dynamic v) =>
      v is String ? DateTime.tryParse(v)?.toLocal() : null;

  static User? _user(dynamic v) =>
      v is Map<String, dynamic> ? User.fromJson(v) : null;

  factory Task.fromJson(Map<String, dynamic> json) {
    final rawAssignees = json['assignees'];
    return Task(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      createdBy: _user(json['createdBy']),
      assignees: rawAssignees is List
          ? rawAssignees
              .whereType<Map<String, dynamic>>()
              .map(User.fromJson)
              .toList()
          : const [],
      primaryAssignee: _user(json['primaryAssignee']),
      startDate: _date(json['startDate']),
      dueDate: _date(json['dueDate']),
      priority: json['priority'] ?? 'medium',
      status: json['status'] ?? 'todo',
      role: json['role'] ?? 'viewer',
      createdAt: _date(json['createdAt']),
      shares: json['shares'] is List
          ? (json['shares'] as List)
              .whereType<Map<String, dynamic>>()
              .map(TaskShare.fromJson)
              .toList()
          : const [],
    );
  }
}
