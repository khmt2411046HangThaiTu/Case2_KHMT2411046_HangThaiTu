const User = require('../models/User');
const service = require('../services/taskService');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /users?q=... - tìm người dùng theo tên hoặc email để giao việc / chia sẻ.
// Không trả về chính người đang đăng nhập; tối đa 20 kết quả.
exports.search = async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filter = { _id: { $ne: req.user._id } };
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ fullName: re }, { email: re }];
    }
    const users = await User.find(filter).limit(20);
    res.status(200).json({ users: users.map(service.userDto) });
  } catch (err) {
    next(err);
  }
};
