import '../models/task.dart';
import 'api_client.dart';

class AssignmentService {
  AssignmentService._();
  static final AssignmentService instance = AssignmentService._();

  final ApiClient _api = ApiClient.instance;

  /// Thay toàn bộ danh sách người được giao. Trả về công việc đã cập nhật.
  Future<Task> setAssignees(
    String taskId,
    List<String> assigneeIds,
    String? primaryAssigneeId,
  ) async {
    final data = await _api.put('/tasks/$taskId/assignees', {
      'assigneeIds': assigneeIds,
      'primaryAssigneeId': primaryAssigneeId,
    });
    return Task.fromJson(data['task'] as Map<String, dynamic>);
  }
}
