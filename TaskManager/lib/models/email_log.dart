class EmailLog {
  final String id;
  final String recipientEmail;
  final String subject;
  final String status; // pending | sent | failed
  final int attempts;
  final String errorMessage;
  final DateTime? createdAt;

  const EmailLog({
    required this.id,
    required this.recipientEmail,
    required this.subject,
    required this.status,
    this.attempts = 0,
    this.errorMessage = '',
    this.createdAt,
  });

  factory EmailLog.fromJson(Map<String, dynamic> json) {
    final created = json['createdAt'];
    return EmailLog(
      id: (json['id'] ?? '').toString(),
      recipientEmail: json['recipientEmail'] ?? '',
      subject: json['subject'] ?? '',
      status: json['status'] ?? 'pending',
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
      errorMessage: json['errorMessage'] ?? '',
      createdAt: created is String ? DateTime.tryParse(created)?.toLocal() : null,
    );
  }
}
