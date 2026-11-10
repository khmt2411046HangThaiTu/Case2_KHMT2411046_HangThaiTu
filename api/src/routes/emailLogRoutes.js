const express = require('express');
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/emailLogController');

const router = express.Router();
router.use(auth);

router.post('/:id/retry', controller.retry);

module.exports = router;
