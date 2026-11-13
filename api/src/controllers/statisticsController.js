const HttpError = require('../utils/httpError');
const stats = require('../services/statisticsService');

exports.tasks = async (req, res, next) => {
  try {
    res.status(200).json(await stats.taskStats(req.user));
  } catch (err) {
    next(err);
  }
};

exports.assignments = async (req, res, next) => {
  try {
    res.status(200).json(await stats.assignmentStats(req.user));
  } catch (err) {
    next(err);
  }
};

// GET /statistics/deadlines?days=7
exports.deadlines = async (req, res, next) => {
  try {
    let days = 7;
    if (req.query.days !== undefined) {
      days = Number(req.query.days);
      if (!Number.isInteger(days) || days < 1 || days > 90) {
        throw new HttpError(400, 'Dữ liệu không hợp lệ', {
          days: 'days phải là số nguyên từ 1 đến 90',
        });
      }
    }
    res.status(200).json(await stats.deadlineStats(req.user, days));
  } catch (err) {
    next(err);
  }
};
