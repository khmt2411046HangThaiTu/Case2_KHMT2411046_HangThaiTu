const express = require('express');
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/statisticsController');

const router = express.Router();
router.use(auth);

router.get('/tasks', controller.tasks);
router.get('/assignments', controller.assignments);
router.get('/deadlines', controller.deadlines);

module.exports = router;
