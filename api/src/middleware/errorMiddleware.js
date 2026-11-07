exports.notFound = (req, res) => {
  res.status(404).json({ message: `Không tìm thấy ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, _req, res, _next) => {
  // JSON body sai định dạng
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'JSON không hợp lệ' });
  }
  // Trùng unique index (email)
  if (err.code === 11000) {
    return res.status(409).json({
      message: 'Dữ liệu đã tồn tại',
      errors: { email: 'Email đã được sử dụng' },
    });
  }
  if (err.status) {
    const body = { message: err.message };
    if (err.errors) body.errors = err.errors;
    return res.status(err.status).json(body);
  }
  // Lỗi không lường trước: chỉ log phía server, không lộ chi tiết cho client
  console.error(err);
  res.status(500).json({ message: 'Lỗi máy chủ' });
};
