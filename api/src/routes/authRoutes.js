const express = require('express');
const controller = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');
const validate = require('../middleware/validateMiddleware');
const v = require('../validators/authValidator');

const router = express.Router();

router.post('/register', validate(v.validateRegister), controller.register);
router.post('/login', validate(v.validateLogin), controller.login);
router.get('/me', auth, controller.getMe);
router.put('/me', auth, validate(v.validateUpdateProfile), controller.updateMe);
router.put(
  '/change-password',
  auth,
  validate(v.validateChangePassword),
  controller.changePassword
);

module.exports = router;
