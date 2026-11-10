import '../models/task.dart';
import 'api_client.dart';

class TaskService {
  TaskService._();
  static final TaskService instance = TaskService._();

  final ApiClient _api = ApiClient.instance;

  /// scope: all | created | assigned | shared
  /// sortBy: createdAt | dueDate | priority ; order: asc | desc
  Future<List<Task>> getTasks({
    String scope = 'all',
    String? status,
    String? priority,
    String? query,
    String sortBy = 'createdAt',
    String order = 'desc',
  }) async {
    final params = <String, String>{
      'scope': scope,
      'sortBy': sortBy,
      'order': order,
    };
    if (status != null) params['status'] = status;
    if (priority != null) params['priority'] = priority;
    if (query != null && query.trim().isNotEmpty) params['q'] = query.trim();

    final path = Uri(path: '/tasks', queryParameters: params).toString();
    final data = await _api.get(path);
    final list = (data['tasks'] as List<dynamic>? ?? []);
    return list
        .map((e) => Task.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Task> getTask(String id) async {
    final data = await _api.get('/tasks/$id');
    return Task.fromJson(data['task'] as Map<String, dynamic>);
  }

  Future<Task> createTask(Map<String, dynamic> payload) async {
    final data = await _api.post('/tasks', payload);
    return Task.fromJson(data['task'] as Map<String, dynamic>);
  }

  Future<Task> updateTask(String id, Map<String, dynamic> payload) async {
    final data = await _api.put('/tasks/$id', payload);
    return Task.fromJson(data['task'] as Map<String, dynamic>);
  }

  Future<Task> updateStatus(String id, String status) async {
    final data = await _api.patch('/tasks/$id/status', {'status': status});
    return Task.fromJson(data['task'] as Map<String, dynamic>);
  }

  Future<void> deleteTask(String id) async {
    await _api.delete('/tasks/$id');
  }
}
