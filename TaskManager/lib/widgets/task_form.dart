import 'package:flutter/material.dart';

import '../models/task.dart';
import '../services/api_client.dart';
import '../utils/date_formatter.dart';
import '../utils/task_labels.dart';

/// Form dùng chung cho màn hình Thêm và Chỉnh sửa công việc.
/// [onSubmit] nhận dữ liệu đã gom sẵn; nếu ném ApiException thì form hiện lỗi.
class TaskForm extends StatefulWidget {
  final Task? initial;
  final String submitLabel;
  final Future<void> Function(Map<String, dynamic> payload) onSubmit;

  const TaskForm({
    super.key,
    this.initial,
    required this.submitLabel,
    required this.onSubmit,
  });

  @override
  State<TaskForm> createState() => _TaskFormState();
}

class _TaskFormState extends State<TaskForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleController;
  late final TextEditingController _descController;
  DateTime? _start;
  DateTime? _due;
  late String _priority;
  late String _status;

  bool _saving = false;
  String? _error;
  String? _dateError;

  @override
  void initState() {
    super.initState();
    final t = widget.initial;
    _titleController = TextEditingController(text: t?.title ?? '');
    _descController = TextEditingController(text: t?.description ?? '');
    _start = t?.startDate;
    _due = t?.dueDate;
    _priority = t?.priority ?? 'medium';
    _status = t?.status ?? 'todo';
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<DateTime?> _pickDate(DateTime? current) {
    final now = DateTime.now();
    return showDatePicker(
      context: context,
      initialDate: current ?? now,
      firstDate: DateTime(now.year - 5),
      lastDate: DateTime(now.year + 10),
    );
  }

  Future<void> _pickStart() async {
    final d = await _pickDate(_start);
    if (d == null) return;
    setState(() {
      _start = DateTime(d.year, d.month, d.day);
      _dateError = null;
    });
  }

  Future<void> _pickDue() async {
    final d = await _pickDate(_due);
    if (d == null) return;
    setState(() {
      // Hạn hoàn thành tính đến hết ngày được chọn
      _due = DateTime(d.year, d.month, d.day, 23, 59);
      _dateError = null;
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_start != null && _due != null && _due!.isBefore(_start!)) {
      setState(() => _dateError = 'Hạn hoàn thành phải sau ngày bắt đầu');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    final payload = <String, dynamic>{
      'title': _titleController.text.trim(),
      'description': _descController.text.trim(),
      'priority': _priority,
      'status': _status,
      // null để xóa ngày (khi sửa) hoặc bỏ trống (khi tạo)
      'startDate': _start?.toUtc().toIso8601String(),
      'dueDate': _due?.toUtc().toIso8601String(),
    };
    try {
      await widget.onSubmit(payload);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.displayMessage);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _dateField({
    required String label,
    required DateTime? value,
    required VoidCallback onTap,
    required VoidCallback onClear,
    String? errorText,
  }) {
    return InkWell(
      onTap: _saving ? null : onTap,
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: const Icon(Icons.event),
          border: const OutlineInputBorder(),
          errorText: errorText,
          suffixIcon: value == null
              ? null
              : IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: _saving ? null : onClear,
                ),
        ),
        child: Text(value == null ? 'Chọn ngày' : formatDate(value)),
      ),
    );
  }

  Widget _chips({
    required List<String> values,
    required String selected,
    required String Function(String) label,
    required void Function(String) onSelected,
  }) {
    return Wrap(
      spacing: 8,
      runSpacing: 4,
      children: [
        for (final v in values)
          ChoiceChip(
            label: Text(label(v)),
            selected: selected == v,
            onSelected: _saving ? null : (_) => onSelected(v),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: _titleController,
              textCapitalization: TextCapitalization.sentences,
              textInputAction: TextInputAction.next,
              maxLength: 200,
              decoration: const InputDecoration(
                labelText: 'Tên công việc *',
                prefixIcon: Icon(Icons.title),
                border: OutlineInputBorder(),
              ),
              validator: (v) => (v ?? '').trim().isEmpty
                  ? 'Vui lòng nhập tên công việc'
                  : null,
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _descController,
              minLines: 3,
              maxLines: 6,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Mô tả',
                alignLabelWithHint: true,
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            _dateField(
              label: 'Ngày bắt đầu',
              value: _start,
              onTap: _pickStart,
              onClear: () => setState(() {
                _start = null;
                _dateError = null;
              }),
            ),
            const SizedBox(height: 16),
            _dateField(
              label: 'Hạn hoàn thành',
              value: _due,
              onTap: _pickDue,
              onClear: () => setState(() {
                _due = null;
                _dateError = null;
              }),
              errorText: _dateError,
            ),
            const SizedBox(height: 20),
            Text('Mức độ ưu tiên', style: theme.textTheme.titleSmall),
            const SizedBox(height: 6),
            _chips(
              values: kPriorities,
              selected: _priority,
              label: priorityLabel,
              onSelected: (v) => setState(() => _priority = v),
            ),
            const SizedBox(height: 16),
            Text('Trạng thái', style: theme.textTheme.titleSmall),
            const SizedBox(height: 6),
            _chips(
              values: kStatuses,
              selected: _status,
              label: statusLabel,
              onSelected: (v) => setState(() => _status = v),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _error!,
                  style: TextStyle(color: theme.colorScheme.onErrorContainer),
                ),
              ),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : _submit,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(widget.submitLabel),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
