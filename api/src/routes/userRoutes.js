const express = require('express');
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/userController');

const router = express.Router();

router.get('/', auth, controller.search);
router.get('/search', auth, controller.search); // đúng đường dẫn trong đề

module.exports = router;
