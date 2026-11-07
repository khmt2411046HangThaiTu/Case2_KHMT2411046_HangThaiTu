const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const HttpError = require('../utils/httpError');

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /auth/register
exports.register = async (req, res, next) => {
  try {
    const fullName = req.body.fullName.trim();
    const email = req.body.email.trim().toLowerCase();

    if (await User.exists({ email })) {
      throw new HttpError(409, 'Email đã được sử dụng', {
        email: 'Email đã được sử dụng',
      });
    }

    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const user = await User.create({ fullName, email, passwordHash });

    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
};

// POST /auth/login
exports.login = async (req, res, next) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const user = await User.findOne({ email });
    // Cùng một thông báo cho cả "sai email" và "sai mật khẩu" để không lộ email nào tồn tại
    const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
    if (!ok) throw new HttpError(401, 'Email hoặc mật khẩu không đúng');

    res.status(200).json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
};

// GET /auth/me
exports.getMe = (req, res) => {
  res.status(200).json({ user: req.user });
};

// PUT /auth/me
exports.updateMe = async (req, res, next) => {
  try {
    const { fullName, avatarUrl } = req.body;
    if (fullName !== undefined) req.user.fullName = fullName.trim();
    if (avatarUrl !== undefined) req.user.avatarUrl = avatarUrl.trim();
    await req.user.save();
    res.status(200).json({ user: req.user });
  } catch (err) {
    next(err);
  }
};

// PUT /auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const match = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!match) {
      throw new HttpError(400, 'Mật khẩu hiện tại không đúng', {
        currentPassword: 'Mật khẩu hiện tại không đúng',
      });
    }
    req.user.passwordHash = await bcrypt.hash(newPassword, 10);
    await req.user.save();
    res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    next(err);
  }
};
