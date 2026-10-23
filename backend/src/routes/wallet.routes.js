const express = require('express');
const router = express.Router();
const WalletController = require('../controllers/walletController');
const authenticateToken = require('../middlewares/auth');

router.use(authenticateToken);
router.get('/transactions', WalletController.getMyTransactions);

module.exports = router;
