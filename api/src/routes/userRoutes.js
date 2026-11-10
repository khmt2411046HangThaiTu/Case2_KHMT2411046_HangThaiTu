const express = require('express');
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/userController');

const router = express.Router();

router.get('/', auth, controller.search);

module.exports = router;
