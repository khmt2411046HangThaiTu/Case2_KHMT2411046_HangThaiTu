import 'package:flutter/material.dart';

const List<String> kStatuses = ['todo', 'in_progress', 'completed'];
const List<String> kPriorities = ['low', 'medium', 'high'];

String statusLabel(String status) {
  switch (status) {
    case 'todo':
      return 'Chưa thực hiện';
    case 'in_progress':
      return 'Đang thực hiện';
    case 'completed':
      return 'Đã hoàn thành';
    default:
      return status;
  }
}

Color statusColor(String status) {
  switch (status) {
    case 'in_progress':
      return Colors.blue;
    case 'completed':
      return Colors.green;
    default:
      return Colors.grey;
  }
}

String priorityLabel(String priority) {
  switch (priority) {
    case 'low':
      return 'Thấp';
    case 'medium':
      return 'Trung bình';
    case 'high':
      return 'Cao';
    default:
      return priority;
  }
}

Color priorityColor(String priority) {
  switch (priority) {
    case 'low':
      return Colors.teal;
    case 'high':
      return Colors.red;
    default:
      return Colors.orange;
  }
}

String roleLabel(String role) {
  switch (role) {
    case 'owner':
      return 'Người tạo';
    case 'editor':
      return 'Được chia sẻ (chỉnh sửa)';
    case 'assignee':
      return 'Người được giao';
    case 'viewer':
      return 'Được chia sẻ (chỉ xem)';
    default:
      return role;
  }
}
