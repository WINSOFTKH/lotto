const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const bonusRoutes = require('./bonus.routes');
const khqrRoutes = require('./khqr.routes');
const tableRoutes = require('./table.routes');
const withdrawalRoutes = require('./withdrawal.routes');
const adminRoutes = require('./admin.routes');
const supportRoutes = require('./support.routes');
const referralRoutes = require('./referral.routes');
const walletRoutes = require('./wallet.routes');

router.use('/auth', authRoutes);
router.use('/bonus', bonusRoutes);
router.use('/khqr', khqrRoutes);
router.use('/tables', tableRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/admin', adminRoutes);
router.use('/support', supportRoutes);
router.use('/referral', referralRoutes);
router.use('/wallet', walletRoutes);

router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'KH-Lotto Real-Time Engine',
  });
});

module.exports = router;
