const TaskActivity = require('../models/TaskActivity');
const User = require('../models/User');
const service = require('../services/taskService');

// GET /tasks/:id/activities - ai xem được công việc thì xem được lịch sử
exports.list = async (req, res, next) => {
  try {
    const { task } = await service.loadTaskForUser(req.params.id, req.user);
    const items = await TaskActivity.find({ taskId: String(task._id) }).sort({ createdAt: -1 }).limit(100);
    const ids = [...new Set(items.map((a) => String(a.userId)))];
    const users = ids.length ? await User.find({ _id: { $in: ids } }) : [];
    const map = new Map(users.map((u) => [String(u._id), service.userDto(u)]));
    res.status(200).json({
      activities: items.map((a) => {
        const j = a.toJSON();
        return { ...j, user: map.get(String(a.userId)) || null };
      }),
    });
  } catch (err) {
    next(err);
  }
};
