import 'package:flutter/material.dart';

import '../../models/task.dart';
import '../../services/task_service.dart';
import '../../widgets/task_form.dart';

class TaskEditScreen extends StatelessWidget {
  final Task task;
  const TaskEditScreen({super.key, required this.task});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chỉnh sửa công việc')),
      body: TaskForm(
        initial: task,
        submitLabel: 'Lưu thay đổi',
        onSubmit: (payload) async {
          await TaskService.instance.updateTask(task.id, payload);
          if (context.mounted) Navigator.of(context).pop(true);
        },
      ),
    );
  }
}
