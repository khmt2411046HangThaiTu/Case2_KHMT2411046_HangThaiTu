import 'dart:async';

import 'package:flutter/material.dart';

import '../services/notification_service.dart';
import 'notifications/notification_screen.dart';
import 'profile/profile_screen.dart';
import 'tasks/task_list_screen.dart';

/// Khung màn hình chính sau khi đăng nhập.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _notifKey = GlobalKey<NotificationScreenState>();
  final _service = NotificationService.instance;
  Timer? _poll;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _service.refreshUnreadCount();
    // Hỏi server số thông báo chưa đọc mỗi 30 giây để cập nhật huy hiệu
    _poll = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _service.refreshUnreadCount(),
    );
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          const TaskListScreen(),
          NotificationScreen(key: _notifKey),
          const ProfileScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) {
          setState(() => _index = i);
          if (i == 1) _notifKey.currentState?.reload(silent: true);
        },
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.checklist),
            label: 'Công việc',
          ),
          NavigationDestination(
            icon: ValueListenableBuilder<int>(
              valueListenable: _service.unreadCount,
              builder: (_, count, __) => Badge(
                isLabelVisible: count > 0,
                label: Text(count > 99 ? '99+' : '$count'),
                child: const Icon(Icons.notifications_outlined),
              ),
            ),
            label: 'Thông báo',
          ),
          const NavigationDestination(icon: Icon(Icons.person), label: 'Cá nhân'),
        ],
      ),
    );
  }
}
