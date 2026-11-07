const HttpError = require('../utils/httpError');

// validate(fn): fn(body) trả về object lỗi theo từng field
module.exports = (validatorFn) => (req, _res, next) => {
  const errors = validatorFn(req.body || {});
  if (Object.keys(errors).length > 0) {
    return next(new HttpError(400, 'Dữ liệu không hợp lệ', errors));
  }
  next();
};
