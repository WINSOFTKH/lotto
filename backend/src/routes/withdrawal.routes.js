const express = require('express');
const router = express.Router();
const WithdrawalController = require('../controllers/withdrawalController');
const authenticateToken = require('../middlewares/auth');

router.use(authenticateToken);
router.get('/config', WithdrawalController.getWithdrawalConfig);
router.get('/banks', WithdrawalController.getSupportedBanks);
router.get('/payment-methods', WithdrawalController.getPaymentMethods);
router.post('/payment-methods', WithdrawalController.createPaymentMethod);
router.put('/payment-methods/:id', WithdrawalController.updatePaymentMethod);
router.patch('/payment-methods/:id/default', WithdrawalController.setDefaultPaymentMethod);
router.delete('/payment-methods/:id', WithdrawalController.deletePaymentMethod);
router.post('/', WithdrawalController.requestWithdrawal);
router.get('/my', WithdrawalController.getUserWithdrawals);
router.post('/:id/cancel', WithdrawalController.cancelWithdrawal);

module.exports = router;
