import 'user.dart';

/// Một bản ghi chia sẻ công việc cho người dùng khác.
class TaskShare {
  final User user;
  final String permission; // viewer | editor

  const TaskShare({required this.user, required this.permission});

  factory TaskShare.fromJson(Map<String, dynamic> json) {
    final u = json['user'];
    return TaskShare(
      user: u is Map<String, dynamic>
          ? User.fromJson(u)
          : User(id: (json['userId'] ?? '').toString(), fullName: '', email: ''),
      permission: json['permission'] ?? 'viewer',
    );
  }
}
