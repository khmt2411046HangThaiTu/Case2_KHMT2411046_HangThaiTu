String _two(int n) => n.toString().padLeft(2, '0');

/// dd/MM/yyyy, hoặc "Chưa đặt" nếu không có ngày.
String formatDate(DateTime? d) {
  if (d == null) return 'Chưa đặt';
  return '${_two(d.day)}/${_two(d.month)}/${d.year}';
}
