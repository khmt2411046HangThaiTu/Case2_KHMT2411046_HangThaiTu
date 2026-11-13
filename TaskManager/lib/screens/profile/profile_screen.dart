import 'package:flutter/material.dart';

import '../../models/user.dart';
import '../../services/api_client.dart';
import '../../services/auth_service.dart';
import '../../utils/validators.dart';
import '../statistics/statistics_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  bool _saving = false;

  User get _user => AuthService.instance.currentUser.value!;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: _user.fullName);
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await AuthService.instance.updateProfile(fullName: _nameController.text);
      _toast('Đã cập nhật thông tin cá nhân');
    } on ApiException catch (e) {
      _toast(e.displayMessage);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _changePassword() async {
    final done = await showDialog<bool>(
      context: context,
      builder: (_) => const _ChangePasswordDialog(),
    );
    if (done == true) _toast('Đổi mật khẩu thành công');
  }

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Đăng xuất'),
        content: const Text('Bạn có chắc muốn đăng xuất?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Đăng xuất'),
          ),
        ],
      ),
    );
    if (ok == true) await AuthService.instance.logout();
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;
    final initial =
        user.fullName.isNotEmpty ? user.fullName[0].toUpperCase() : '?';

    return Scaffold(
      appBar: AppBar(title: const Text('Cá nhân')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Center(
            child: CircleAvatar(
              radius: 44,
              backgroundImage:
                  user.avatarUrl.isNotEmpty ? NetworkImage(user.avatarUrl) : null,
              child: user.avatarUrl.isEmpty
                  ? Text(initial, style: const TextStyle(fontSize: 32))
                  : null,
            ),
          ),
          const SizedBox(height: 24),
          Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _nameController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Họ tên',
                    prefixIcon: Icon(Icons.person_outline),
                    border: OutlineInputBorder(),
                  ),
                  validator: Validators.fullName,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  initialValue: user.email,
                  enabled: false,
                  decoration: const InputDecoration(
                    labelText: 'Email (không thể thay đổi)',
                    prefixIcon: Icon(Icons.email_outlined),
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _saving ? null : _saveProfile,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: _saving
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Lưu thay đổi'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.bar_chart),
            title: const Text('Thống kê công việc'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push<void>(
              MaterialPageRoute(builder: (_) => const StatisticsScreen()),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.password),
            title: const Text('Đổi mật khẩu'),
            trailing: const Icon(Icons.chevron_right),
            onTap: _changePassword,
          ),
          ListTile(
            leading: Icon(Icons.logout, color: Theme.of(context).colorScheme.error),
            title: Text(
              'Đăng xuất',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            onTap: _logout,
          ),
        ],
      ),
    );
  }
}

class _ChangePasswordDialog extends StatefulWidget {
  const _ChangePasswordDialog();

  @override
  State<_ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<_ChangePasswordDialog> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await AuthService.instance.changePassword(
        currentPassword: _currentController.text,
        newPassword: _newController.text,
      );
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.displayMessage);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Đổi mật khẩu'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _currentController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Mật khẩu hiện tại'),
                validator: (v) =>
                    Validators.required(v, 'Vui lòng nhập mật khẩu hiện tại'),
              ),
              TextFormField(
                controller: _newController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Mật khẩu mới'),
                validator: (v) {
                  final basic = Validators.password(v);
                  if (basic != null) return basic;
                  if (v == _currentController.text) {
                    return 'Mật khẩu mới phải khác mật khẩu hiện tại';
                  }
                  return null;
                },
              ),
              TextFormField(
                controller: _confirmController,
                obscureText: true,
                decoration:
                    const InputDecoration(labelText: 'Xác nhận mật khẩu mới'),
                validator: (v) =>
                    Validators.confirmPassword(v, _newController.text),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _loading ? null : () => Navigator.pop(context, false),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: _loading ? null : _submit,
          child: _loading
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Đổi mật khẩu'),
        ),
      ],
    );
  }
}
