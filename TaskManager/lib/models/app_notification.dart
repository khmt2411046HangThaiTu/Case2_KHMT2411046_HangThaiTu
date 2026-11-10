class AppNotification {
  final String id;
  final String? taskId;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final DateTime? createdAt;

  const AppNotification({
    required this.id,
    this.taskId,
    required this.type,
    required this.title,
    this.message = '',
    this.isRead = false,
    this.createdAt,
  });

  AppNotification copyWith({bool? isRead}) => AppNotification(
        id: id,
        taskId: taskId,
        type: type,
        title: title,
        message: message,
        isRead: isRead ?? this.isRead,
        createdAt: createdAt,
      );

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    final created = json['createdAt'];
    return AppNotification(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      taskId: json['taskId']?.toString(),
      type: json['type'] ?? '',
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      isRead: json['isRead'] == true,
      createdAt: created is String ? DateTime.tryParse(created)?.toLocal() : null,
    );
  }
}
