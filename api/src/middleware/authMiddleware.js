const jwt = require('jsonwebtoken');
const User = require('../models/User');
const HttpError = require('../utils/httpError');

module.exports = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new HttpError(401, 'Chưa đăng nhập');
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_) {
      throw new HttpError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }

    const user = await User.findById(payload.sub);
    if (!user) throw new HttpError(401, 'Tài khoản không tồn tại');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
