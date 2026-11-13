import '../models/statistics.dart';
import 'api_client.dart';

class StatisticsService {
  StatisticsService._();
  static final StatisticsService instance = StatisticsService._();

  final ApiClient _api = ApiClient.instance;

  Future<TaskStats> getTaskStats() async =>
      TaskStats.fromJson(await _api.get('/statistics/tasks'));

  Future<AssignmentStats> getAssignmentStats() async =>
      AssignmentStats.fromJson(await _api.get('/statistics/assignments'));

  Future<DeadlineStats> getDeadlineStats({int days = 7}) async =>
      DeadlineStats.fromJson(await _api.get('/statistics/deadlines?days=$days'));

  Future<List<TaskActivity>> getActivities(String taskId) async {
    final data = await _api.get('/tasks/$taskId/activities');
    return (data['activities'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(TaskActivity.fromJson)
        .toList();
  }
}
