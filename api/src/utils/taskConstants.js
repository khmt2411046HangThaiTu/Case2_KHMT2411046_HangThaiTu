exports.STATUSES = ['todo', 'in_progress', 'completed'];
exports.PRIORITIES = ['low', 'medium', 'high'];
exports.PERMISSIONS = ['viewer', 'editor'];

// Dùng để sắp xếp theo mức độ ưu tiên
exports.PRIORITY_RANK = { low: 1, medium: 2, high: 3 };

exports.SCOPES = ['all', 'created', 'assigned', 'shared'];
exports.SORT_FIELDS = ['dueDate', 'priority', 'createdAt'];
exports.ORDERS = ['asc', 'desc'];
