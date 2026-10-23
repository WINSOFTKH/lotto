const express = require('express');
const router = express.Router();
const SupportController = require('../controllers/supportController');
const authenticateToken = require('../middlewares/auth');

router.use(authenticateToken);

// Player support routes
router.get('/my-messages', SupportController.getMessages);
router.post('/send', SupportController.sendMessage);
router.get('/unread-count', SupportController.getUnreadCount);

module.exports = router;
