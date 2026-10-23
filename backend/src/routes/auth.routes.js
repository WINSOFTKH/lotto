const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const authenticateToken = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiter');

router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/telegram', AuthController.telegramLogin);
router.get('/me', authenticateToken, AuthController.getProfile);

module.exports = router;
