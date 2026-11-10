import '../models/user.dart';
import 'api_client.dart';

class UserService {
  UserService._();
  static final UserService instance = UserService._();

  /// Tìm người dùng theo tên hoặc email (không gồm chính mình).
  Future<List<User>> search(String query) async {
    final path = Uri(
      path: '/users',
      queryParameters: {'q': query.trim()},
    ).toString();
    final data = await ApiClient.instance.get(path);
    final list = data['users'] as List<dynamic>? ?? [];
    return list.map((e) => User.fromJson(e as Map<String, dynamic>)).toList();
  }
}
