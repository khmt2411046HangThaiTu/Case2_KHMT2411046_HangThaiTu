import 'package:flutter/material.dart';

/// Placeholder: danh sách công việc sẽ làm ở nhóm B.
class TaskListScreen extends StatelessWidget {
  const TaskListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Công việc')),
      body: const Center(child: Text('Danh sách công việc (nhóm B)')),
    );
  }
}
