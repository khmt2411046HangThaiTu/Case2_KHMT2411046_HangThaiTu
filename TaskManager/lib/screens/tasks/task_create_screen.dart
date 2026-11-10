import 'package:flutter/material.dart';

import '../../services/task_service.dart';
import '../../widgets/task_form.dart';

class TaskCreateScreen extends StatelessWidget {
  const TaskCreateScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Thêm công việc')),
      body: TaskForm(
        submitLabel: 'Tạo công việc',
        onSubmit: (payload) async {
          await TaskService.instance.createTask(payload);
          if (context.mounted) Navigator.of(context).pop(true);
        },
      ),
    );
  }
}
