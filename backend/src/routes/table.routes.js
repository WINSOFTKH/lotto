const express = require('express');
const router = express.Router();
const TableController = require('../controllers/tableController');
const authenticateToken = require('../middlewares/auth');

router.use(authenticateToken);
router.get('/config', TableController.getTableConfig);
router.get('/', TableController.getTables);
router.post('/', TableController.createTable);
router.get('/:id', TableController.getTableById);
router.delete('/:id', TableController.deleteTable);
router.post('/:id/join', TableController.joinTable);
router.post('/:id/leave', TableController.leaveTable);
router.post('/:id/start', TableController.startGame);
router.post('/quick-play', TableController.quickPlay);

module.exports = router;
