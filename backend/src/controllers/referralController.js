const ReferralService = require('../services/referralService');

class ReferralController {
  /**
   * Get referral dashboard data for the authenticated player
   */
  static async getMyStats(req, res, next) {
    try {
      const userId = req.user.id;
      const stats = await ReferralService.getReferralStats(userId);
      return res.json({
        success: true,
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Bind an inviter's referral code to current player (Single-Use Only)
   */
  static async bindCode(req, res, next) {
    try {
      const userId = req.user.id;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a referral code',
        });
      }

      const result = await ReferralService.bindReferralCode(userId, code);

      const message = result.bonusCoinsAwarded > 0
        ? `Successfully connected! You earned +${result.bonusCoinsAwarded.toLocaleString()} coins for joining @${result.referrer.username}'s team!`
        : `Successfully connected! You are now part of @${result.referrer.username}'s referral network.`;

      return res.json({
        success: true,
        message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get active referral configuration (percentages, status)
   */
  static async getConfig(req, res, next) {
    try {
      const config = await ReferralService.getConfig();
      return res.json({
        success: true,
        data: config,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ReferralController;
