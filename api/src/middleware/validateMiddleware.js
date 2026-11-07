const HttpError = require('../utils/httpError');

// validate(fn): fn(dữ liệu) trả về object lỗi theo từng field.
// source: 'body' (mặc định) hoặc 'query'.
module.exports =
  (validatorFn, source = 'body') =>
  (req, _res, next) => {
    const errors = validatorFn(req[source] || {});
    if (Object.keys(errors).length > 0) {
      return next(new HttpError(400, 'Dữ liệu không hợp lệ', errors));
    }
    next();
  };
