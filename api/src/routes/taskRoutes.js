const express = require('express');
const controller = require('../controllers/taskController');
const auth = require('../middleware/authMiddleware');
const validate = require('../middleware/validateMiddleware');
const v = require('../validators/taskValidator');
const av = require('../validators/assignmentValidator');
const assignment = require('../controllers/assignmentController');
const share = require('../controllers/taskShareController');

const router = express.Router();

// Mọi API công việc đều cần đăng nhập
router.use(auth);

router.get('/', validate(v.validateListQuery, 'query'), controller.list);
router.post('/', validate(v.validateCreateTask), controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', validate(v.validateUpdateTask), controller.update);
router.patch('/:id/status', validate(v.validateStatus), controller.updateStatus);
router.delete('/:id', controller.remove);

// Nhóm C - giao việc
router.get('/:id/assignees', assignment.list);
router.put('/:id/assignees', validate(av.validateAssign), assignment.replace);
router.delete('/:id/assignees/:userId', assignment.removeOne);

// Nhóm C - chia sẻ
router.get('/:id/shares', share.list);
router.post('/:id/shares', validate(av.validateShare), share.create);
router.patch('/:id/shares/:userId', validate(av.validatePermission), share.update);
router.delete('/:id/shares/:userId', share.remove);

module.exports = router;
