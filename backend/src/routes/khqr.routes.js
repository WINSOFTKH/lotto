const express = require('express');
const router = express.Router();
const KhqrController = require('../controllers/khqrController');
const authenticateToken = require('../middlewares/auth');

// Webhook endpoint from bank (Public, signature-verified)
router.post('/webhook', KhqrController.handleWebhook);

// Protected endpoints
router.use(authenticateToken);
router.get('/config', KhqrController.getTopupConfig);
router.post('/create', KhqrController.generateTopupRequest);
router.get('/check/:id', KhqrController.checkTransactionStatus);
router.post('/simulate', KhqrController.simulatePayment);
router.get('/history', KhqrController.getUserHistory);

module.exports = router;
