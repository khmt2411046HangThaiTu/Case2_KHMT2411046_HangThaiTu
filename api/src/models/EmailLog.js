const mongoose = require('mongoose');

const { Schema } = mongoose;

const emailLogSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null, index: true },
    recipientEmail: { type: String, required: true },
    eventType: { type: String, required: true },
    subject: { type: String, required: true },
    // Nội dung được lưu để có thể gửi lại; không trả về cho client
    html: { type: String, default: '', select: false },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    errorMessage: { type: String, default: '' },
    sentAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

emailLogSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.html;
    return ret;
  },
});

module.exports = mongoose.model('EmailLog', emailLogSchema);
