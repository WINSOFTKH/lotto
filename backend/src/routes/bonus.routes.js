const express = require('express');
const router = express.Router();
const BonusController = require('../controllers/bonusController');
const authenticateToken = require('../middlewares/auth');

router.use(authenticateToken);
router.get('/status', BonusController.getBonusStatus);
router.post('/claim', BonusController.claimDailyBonus);

module.exports = router;
