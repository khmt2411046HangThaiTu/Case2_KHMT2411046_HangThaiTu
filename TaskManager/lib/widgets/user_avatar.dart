import 'package:flutter/material.dart';

import '../models/user.dart';

/// Ảnh đại diện tròn: chữ cái đầu của tên.
class UserAvatar extends StatelessWidget {
  final User user;
  final double radius;
  const UserAvatar({super.key, required this.user, this.radius = 20});

  @override
  Widget build(BuildContext context) {
    final name = user.fullName.trim();
    return CircleAvatar(
      radius: radius,
      child: Text(name.isEmpty ? '?' : name.substring(0, 1).toUpperCase()),
    );
  }
}
