const express = require('express');
const controller = require('../controllers/taskController');
const auth = require('../middleware/authMiddleware');
const validate = require('../middleware/validateMiddleware');
const v = require('../validators/taskValidator');

const router = express.Router();

// Mọi API công việc đều cần đăng nhập
router.use(auth);

router.get('/', validate(v.validateListQuery, 'query'), controller.list);
router.post('/', validate(v.validateCreateTask), controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', validate(v.validateUpdateTask), controller.update);
router.patch('/:id/status', validate(v.validateStatus), controller.updateStatus);
router.delete('/:id', controller.remove);

module.exports = router;
