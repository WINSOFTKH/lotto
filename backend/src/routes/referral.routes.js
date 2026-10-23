const express = require('express');
const router = express.Router();
const ReferralController = require('../controllers/referralController');
const authenticateToken = require('../middlewares/auth');

// Public or player config
router.get('/config', ReferralController.getConfig);

// Authenticated player endpoints
router.use(authenticateToken);
router.get('/me', ReferralController.getMyStats);
router.post('/bind', ReferralController.bindCode);

module.exports = router;
