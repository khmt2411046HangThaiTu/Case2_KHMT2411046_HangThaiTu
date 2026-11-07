const mongoose = require('mongoose');
const {
  STATUSES,
  PRIORITIES,
  SCOPES,
  SORT_FIELDS,
  ORDERS,
} = require('../utils/taskConstants');

const isEmpty = (v) => v === null || v === '';
const isDateInput = (v) =>
  isEmpty(v) || (typeof v === 'string' && !Number.isNaN(Date.parse(v)));

function checkFields(body, errors) {
  if (body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (title.length < 1) errors.title = 'Tên công việc không được để trống';
    else if (title.length > 200) errors.title = 'Tên công việc tối đa 200 ký tự';
  }
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.description = 'Mô tả không hợp lệ';
    } else if (body.description.length > 5000) {
      errors.description = 'Mô tả tối đa 5000 ký tự';
    }
  }
  if (body.priority !== undefined && !PRIORITIES.includes(body.priority)) {
    errors.priority = 'Mức độ ưu tiên phải là low, medium hoặc high';
  }
  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    errors.status = 'Trạng thái phải là todo, in_progress hoặc completed';
  }
  if (body.startDate !== undefined && !isDateInput(body.startDate)) {
    errors.startDate = 'Ngày bắt đầu không hợp lệ';
  }
  if (body.dueDate !== undefined && !isDateInput(body.dueDate)) {
    errors.dueDate = 'Hạn hoàn thành không hợp lệ';
  }
  if (
    !errors.startDate &&
    !errors.dueDate &&
    !isEmpty(body.startDate) &&
    !isEmpty(body.dueDate) &&
    body.startDate !== undefined &&
    body.dueDate !== undefined &&
    new Date(body.dueDate) < new Date(body.startDate)
  ) {
    errors.dueDate = 'Hạn hoàn thành phải sau hoặc bằng ngày bắt đầu';
  }
}

exports.validateCreateTask = (body) => {
  const errors = {};
  if (body.title === undefined) errors.title = 'Vui lòng nhập tên công việc';
  checkFields(body, errors);
  return errors;
};

exports.validateUpdateTask = (body) => {
  const errors = {};
  const keys = [
    'title',
    'description',
    'startDate',
    'dueDate',
    'priority',
    'status',
  ];
  if (!keys.some((k) => body[k] !== undefined)) {
    errors.title = 'Không có thông tin nào để cập nhật';
  }
  checkFields(body, errors);
  return errors;
};

exports.validateStatus = (body) => {
  const errors = {};
  if (!STATUSES.includes(body.status)) {
    errors.status = 'Trạng thái phải là todo, in_progress hoặc completed';
  }
  return errors;
};

exports.validateListQuery = (query) => {
  const errors = {};
  if (query.scope !== undefined && !SCOPES.includes(query.scope)) {
    errors.scope = 'scope phải là all, created, assigned hoặc shared';
  }
  if (query.status !== undefined && !STATUSES.includes(query.status)) {
    errors.status = 'status không hợp lệ';
  }
  if (query.priority !== undefined && !PRIORITIES.includes(query.priority)) {
    errors.priority = 'priority không hợp lệ';
  }
  if (query.sortBy !== undefined && !SORT_FIELDS.includes(query.sortBy)) {
    errors.sortBy = 'sortBy phải là dueDate, priority hoặc createdAt';
  }
  if (query.order !== undefined && !ORDERS.includes(query.order)) {
    errors.order = 'order phải là asc hoặc desc';
  }
  if (query.q !== undefined && typeof query.q !== 'string') {
    errors.q = 'q không hợp lệ';
  }
  if (
    query.assigneeId !== undefined &&
    !mongoose.isValidObjectId(query.assigneeId)
  ) {
    errors.assigneeId = 'assigneeId không hợp lệ';
  }
  return errors;
};
