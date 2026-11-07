const mongoose = require('mongoose');
const { PERMISSIONS } = require('../utils/taskConstants');

const { Schema } = mongoose;

// Nhóm B chỉ đọc collection này để biết ai được xem/sửa công việc.
// Nhóm C sẽ làm các API chia sẻ.
const taskShareSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    permission: { type: String, enum: PERMISSIONS, default: 'viewer' },
    sharedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Mỗi người chỉ có một bản ghi chia sẻ cho mỗi công việc
taskShareSchema.index({ taskId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('TaskShare', taskShareSchema);
