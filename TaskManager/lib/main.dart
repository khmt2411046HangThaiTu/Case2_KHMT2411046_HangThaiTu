import 'package:flutter/material.dart';

import 'app.dart';
import 'services/auth_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AuthService.instance.restoreSession();
  runApp(const TaskManagerApp());
}
