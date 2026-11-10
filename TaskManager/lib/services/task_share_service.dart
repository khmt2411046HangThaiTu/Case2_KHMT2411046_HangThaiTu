import '../models/task_share.dart';
import 'api_client.dart';

class TaskShareService {
  TaskShareService._();
  static final TaskShareService instance = TaskShareService._();

  final ApiClient _api = ApiClient.instance;

  List<TaskShare> _parse(Map<String, dynamic> data) =>
      (data['shares'] as List<dynamic>? ?? [])
          .map((e) => TaskShare.fromJson(e as Map<String, dynamic>))
          .toList();

  Future<List<TaskShare>> list(String taskId) async =>
      _parse(await _api.get('/tasks/$taskId/shares'));

  /// Chia sẻ (nếu người này đã được chia sẻ thì chỉ cập nhật quyền).
  Future<List<TaskShare>> share(
    String taskId,
    String userId,
    String permission,
  ) async =>
      _parse(await _api.post('/tasks/$taskId/shares', {
        'userId': userId,
        'permission': permission,
      }));

  Future<List<TaskShare>> changePermission(
    String taskId,
    String userId,
    String permission,
  ) async =>
      _parse(await _api.patch('/tasks/$taskId/shares/$userId', {
        'permission': permission,
      }));

  Future<List<TaskShare>> revoke(String taskId, String userId) async =>
      _parse(await _api.delete('/tasks/$taskId/shares/$userId'));
}
