class User {
  final String id;
  final String fullName;
  final String email;
  final String avatarUrl;

  const User({
    required this.id,
    required this.fullName,
    required this.email,
    this.avatarUrl = '',
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      fullName: json['fullName'] ?? '',
      email: json['email'] ?? '',
      avatarUrl: json['avatarUrl'] ?? '',
    );
  }
}
