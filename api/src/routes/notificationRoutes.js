const express = require('express');
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/notificationController');

const router = express.Router();
router.use(auth);

router.get('/', controller.list);
router.get('/unread-count', controller.unreadCount);
// read-all phải khai báo trước /:id/read
router.patch('/read-all', controller.markAllRead);
router.patch('/:id/read', controller.markRead);

module.exports = router;
