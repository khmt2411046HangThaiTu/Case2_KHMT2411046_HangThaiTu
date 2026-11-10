const mongoose = require('mongoose');
const { STATUSES, PRIORITIES } = require('../utils/taskConstants');

const { Schema } = mongoose;

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', trim: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Nhóm C sẽ dùng 2 trường này để giao việc
    assigneeIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      index: true,
    },
    primaryAssigneeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    status: { type: String, enum: STATUSES, default: 'todo' },
    // Đã gửi nhắc việc trước hạn chưa (đặt lại khi đổi hạn)
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

taskSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.reminderSentAt;
    return ret;
  },
});

module.exports = mongoose.model('Task', taskSchema);
