const db = require('../config/db');
const WalletService = require('./walletService');
const socketServer = require('../sockets/socketServer');

class ReferralService {
  /**
   * Generate an 8-character unique uppercase referral code (e.g., KH7X9K2A)
   */
  static async generateUniqueCode(client = null) {
    const executor = client || db;
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let isUnique = false;
    let code = '';

    while (!isUnique) {
      code = 'KH';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const existing = await executor.query(
        'SELECT id FROM users WHERE referral_code = $1',
        [code]
      );
      if (existing.rows.length === 0) {
        isUnique = true;
      }
    }
    return code;
  }

  /**
   * Get current referral system configurations
   */
  static async getConfig() {
    try {
      const res = await db.query(`
        SELECT key, value FROM system_settings 
        WHERE key IN (
          'referral_program_enabled',
          'referral_bonus_level1_percent',
          'referral_bonus_level2_percent',
          'referral_bind_bonus_coins'
        );
      `);

      const configMap = {};
      res.rows.forEach(r => {
        configMap[r.key] = r.value;
      });

      return {
        enabled: configMap['referral_program_enabled'] !== 'false',
        level1Percent: parseFloat(configMap['referral_bonus_level1_percent']) || 5.0,
        level2Percent: parseFloat(configMap['referral_bonus_level2_percent']) || 1.0,
        bindBonusCoins: parseInt(configMap['referral_bind_bonus_coins'], 10) >= 0
          ? parseInt(configMap['referral_bind_bonus_coins'], 10)
          : 50,
      };
    } catch (err) {
      console.warn('Error reading referral system_settings, using defaults:', err);
      return {
        enabled: true,
        level1Percent: 5.0,
        level2Percent: 1.0,
        bindBonusCoins: 50,
      };
    }
  }

  /**
   * Bind an inviter's referral code to a user (one-time only)
   */
  static async bindReferralCode(userId, rawCode) {
    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      const err = new Error('Referral code is required');
      err.statusCode = 400;
      throw err;
    }

    const code = rawCode.trim().toUpperCase();

    return db.withTransaction(async (client) => {
      // 1. Check current user status
      const userRes = await client.query(
        'SELECT id, username, role, referred_by, referral_code, referral_bound_at FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userRes.rows.length === 0) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
      }

      const currentUser = userRes.rows[0];

      // Referral program is strictly for players, not admin or staff accounts
      if (currentUser.role !== 'player') {
        const err = new Error('The referral program is exclusively for players, not admin accounts');
        err.statusCode = 403;
        throw err;
      }

      // Strict single-use rule: cannot bind more than once
      if (currentUser.referred_by) {
        const err = new Error('You have already bound a referral code. Only one referral code can be entered per account.');
        err.statusCode = 400;
        throw err;
      }

      // 2. Look up the inviter by referral_code
      const referrerRes = await client.query(
        'SELECT id, username, role, photo_url, referral_code, referred_by FROM users WHERE UPPER(referral_code) = $1',
        [code]
      );

      if (referrerRes.rows.length === 0) {
        const err = new Error(`Referral code "${code}" is invalid or does not exist`);
        err.statusCode = 404;
        throw err;
      }

      const referrer = referrerRes.rows[0];

      // Only player accounts can be referrers (not admin or staff accounts)
      if (referrer.role !== 'player') {
        const err = new Error('This referral code belongs to an admin or staff account. Only players can invite referrals.');
        err.statusCode = 400;
        throw err;
      }

      // Cannot refer self
      if (referrer.id === userId) {
        const err = new Error('You cannot bind your own referral code');
        err.statusCode = 400;
        throw err;
      }

      // Check circular reference (prevent A -> B -> A or longer loops)
      let currentCheckId = referrer.referred_by;
      const visited = new Set([referrer.id]);
      while (currentCheckId) {
        if (currentCheckId === userId) {
          const err = new Error('Circular referral detected. You cannot bind this referral code.');
          err.statusCode = 400;
          throw err;
        }
        if (visited.has(currentCheckId)) break;
        visited.add(currentCheckId);

        const checkRes = await client.query(
          'SELECT referred_by FROM users WHERE id = $1',
          [currentCheckId]
        );
        currentCheckId = checkRes.rows[0]?.referred_by || null;
      }

      // 3. Bind the referral
      const now = new Date();
      await client.query(
        'UPDATE users SET referred_by = $1, referral_bound_at = $2, updated_at = NOW() WHERE id = $3',
        [referrer.id, now, userId]
      );

      // 4. Award Referral Input / Binding Bonus Coins to the referee player if configured
      const config = await ReferralService.getConfig();
      let bonusCoinsAwarded = 0;
      let newBalance = currentUser.coin_balance;

      if (config.bindBonusCoins > 0) {
        bonusCoinsAwarded = config.bindBonusCoins;
        const creditRes = await WalletService.creditCoins(
          userId,
          bonusCoinsAwarded,
          'referral_bonus',
          referrer.id,
          `Referral Code Bonus (Joined @${referrer.username}'s team)`,
          client
        );
        newBalance = creditRes.newBalance;

        // Emit real-time wallet update to the player
        socketServer.emitToUser(userId, 'wallet:updated', {
          balance: newBalance,
          coinsAdded: bonusCoinsAwarded,
          message: `🎉 You earned ${bonusCoinsAwarded} bonus coins for entering referral code ${referrer.referral_code}!`,
        });
      }

      return {
        referrer: {
          id: referrer.id,
          username: referrer.username,
          photoUrl: referrer.photo_url || null,
          referralCode: referrer.referral_code,
        },
        boundAt: now.toISOString(),
        bonusCoinsAwarded,
        newBalance,
      };
    });
  }

  /**
   * Get complete referral dashboard stats for a player,
   * including 3-tier pyramid breakdown and reward history.
   */
  static async getReferralStats(userId) {
    // 1. Fetch user's basic referral info
    const userRes = await db.query(`
      SELECT 
        u.id, 
        u.username, 
        u.role,
        u.referral_code, 
        u.referred_by, 
        u.referral_bound_at,
        ref.username AS referrer_username,
        ref.photo_url AS referrer_photo_url
      FROM users u
      LEFT JOIN users ref ON u.referred_by = ref.id
      WHERE u.id = $1;
    `, [userId]);

    if (userRes.rows.length === 0) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const userData = userRes.rows[0];

    // Referral program is exclusively for players, not admin accounts
    if (userData.role !== 'player') {
      const err = new Error('The referral program is exclusively for players, not admin accounts');
      err.statusCode = 403;
      throw err;
    }

    let referralCode = userData.referral_code;

    // Failsafe: if player lacks a referral code, generate one on the fly
    if (!referralCode) {
      referralCode = await ReferralService.generateUniqueCode();
      await db.query('UPDATE users SET referral_code = $1 WHERE id = $2', [referralCode, userId]);
    }

    const config = await ReferralService.getConfig();

    // 2. Fetch Level 1 (Direct Referrals - Level B, players only)
    const level1Res = await db.query(`
      SELECT 
        id, 
        username, 
        photo_url, 
        coin_balance, 
        created_at, 
        referral_bound_at
      FROM users 
      WHERE referred_by = $1 AND role = 'player'
      ORDER BY referral_bound_at DESC, created_at DESC;
    `, [userId]);

    const level1Users = level1Res.rows;
    const level1Ids = level1Users.map(u => u.id);

    // 3. Fetch Level 2 (Sub-referrals - Level C, players only)
    let level2Users = [];
    if (level1Ids.length > 0) {
      const level2Res = await db.query(`
        SELECT 
          id, 
          username, 
          photo_url, 
          coin_balance, 
          referred_by,
          created_at, 
          referral_bound_at
        FROM users 
        WHERE referred_by = ANY($1::uuid[]) AND role = 'player'
        ORDER BY referral_bound_at DESC, created_at DESC;
      `, [level1Ids]);
      level2Users = level2Res.rows;
    }

    // 4. Aggregate commission rewards earned by level for this referrer
    const rewardsAggRes = await db.query(`
      SELECT 
        level,
        COUNT(*)::int AS reward_count,
        COALESCE(SUM(bonus_coins), 0)::bigint AS total_bonus_coins,
        COALESCE(SUM(deposit_coins), 0)::bigint AS total_deposit_coins,
        COALESCE(SUM(deposit_usd), 0)::numeric AS total_deposit_usd
      FROM referral_rewards
      WHERE referrer_id = $1
      GROUP BY level;
    `, [userId]);

    const levelRewardsMap = { 1: 0, 2: 0 };
    const levelDepositVolumeMap = { 1: 0, 2: 0 };
    rewardsAggRes.rows.forEach(r => {
      levelRewardsMap[r.level] = parseInt(r.total_bonus_coins, 10);
      levelDepositVolumeMap[r.level] = parseInt(r.total_deposit_coins, 10);
    });

    // 5. Recent rewards ledger (last 50 payouts)
    const recentRewardsRes = await db.query(`
      SELECT 
        rr.id,
        rr.level,
        rr.deposit_usd,
        rr.deposit_coins,
        rr.commission_percent,
        rr.bonus_coins,
        rr.created_at,
        referee.username AS referee_username,
        referee.photo_url AS referee_photo_url
      FROM referral_rewards rr
      JOIN users referee ON rr.referee_id = referee.id
      WHERE rr.referrer_id = $1
      ORDER BY rr.created_at DESC
      LIMIT 50;
    `, [userId]);

    const totalCoinsEarned = 
      (levelRewardsMap[1] || 0) + 
      (levelRewardsMap[2] || 0);

    const totalMembers = level1Users.length + level2Users.length;

    return {
      config,
      user: {
        referralCode,
        isBound: Boolean(userData.referred_by),
        referredBy: userData.referred_by ? {
          id: userData.referred_by,
          username: userData.referrer_username,
          photoUrl: userData.referrer_photo_url,
          boundAt: userData.referral_bound_at,
        } : null,
      },
      summary: {
        totalCoinsEarned,
        totalMembers,
        directMembersCount: level1Users.length,
        subMembersCount: level2Users.length,
      },
      pyramid: {
        // Level A: The current user (Pyramid Peak)
        levelA: {
          role: 'Peak (You)',
          username: userData.username,
          referralCode,
          totalEarned: totalCoinsEarned,
        },
        // Level B: Direct Referrals (5% commission)
        levelB: {
          level: 1,
          name: 'Direct Referrals',
          code: 'Level B',
          commissionPercent: config.level1Percent,
          memberCount: level1Users.length,
          totalCoinsEarned: levelRewardsMap[1] || 0,
          totalDepositVolume: levelDepositVolumeMap[1] || 0,
          members: level1Users.slice(0, 20).map(u => ({
            id: u.id,
            username: u.username,
            photoUrl: u.photo_url,
            coinBalance: parseInt(u.coin_balance, 10),
            joinedAt: u.referral_bound_at || u.created_at,
          })),
        },
        // Level C: Sub-Referrals (1% commission)
        levelC: {
          level: 2,
          name: 'Sub-Referrals',
          code: 'Level C',
          commissionPercent: config.level2Percent,
          memberCount: level2Users.length,
          totalCoinsEarned: levelRewardsMap[2] || 0,
          totalDepositVolume: levelDepositVolumeMap[2] || 0,
          members: level2Users.slice(0, 20).map(u => ({
            id: u.id,
            username: u.username,
            photoUrl: u.photo_url,
            coinBalance: parseInt(u.coin_balance, 10),
            joinedAt: u.referral_bound_at || u.created_at,
          })),
        },
      },
      recentRewards: recentRewardsRes.rows.map(r => ({
        id: r.id,
        level: r.level,
        levelLabel: r.level === 1 ? 'Level B (Direct)' : 'Level C (Sub)',
        depositUsd: parseFloat(r.deposit_usd),
        depositCoins: parseInt(r.deposit_coins, 10),
        commissionPercent: parseFloat(r.commission_percent),
        bonusCoins: parseInt(r.bonus_coins, 10),
        refereeUsername: r.referee_username,
        refereePhotoUrl: r.referee_photo_url,
        createdAt: r.created_at,
      })),
    };
  }

  /**
   * Process 3-tier commission distribution on completed KHQR top-up deposit
   */
  static async processTopupCommission(userId, depositCoins, depositUsd, topupTxId, client = null) {
    const executor = client || db;

    try {
      const config = await ReferralService.getConfig();
      if (!config.enabled) {
        console.log('[Referral] Referral program disabled in system settings. Skipping commissions.');
        return null;
      }

      // 1. Fetch referee info and their direct inviter (referee must be a player)
      const refereeRes = await executor.query(
        'SELECT id, username, role, referred_by FROM users WHERE id = $1',
        [userId]
      );

      if (refereeRes.rows.length === 0) return null;
      const referee = refereeRes.rows[0];

      // Referral commissions are only earned from player account deposits, not admin accounts
      if (referee.role !== 'player' || !referee.referred_by) {
        return null;
      }

      const numCoins = parseInt(depositCoins, 10);
      const numUsd = parseFloat(depositUsd) || 0;
      if (isNaN(numCoins) || numCoins <= 0) return null;

      const distributions = [];

      // ==========================================
      // LEVEL 1: Direct Inviter (Level B -> Level A, default 5%)
      // ==========================================
      const level1InviterId = referee.referred_by;
      const inviter1Res = await executor.query(
        'SELECT id, username, role, referred_by FROM users WHERE id = $1',
        [level1InviterId]
      );

      let inviter1 = inviter1Res.rows[0] || null;

      // Only players can receive referral commissions (not admin or staff accounts)
      if (inviter1 && inviter1.role === 'player' && config.level1Percent > 0) {
        const bonusCoins1 = Math.floor(numCoins * (config.level1Percent / 100));
        if (bonusCoins1 > 0) {
          // Atomically credit coins to Level 1 Referrer
          const creditRes = await WalletService.creditCoins(
            inviter1.id,
            bonusCoins1,
            'referral_bonus',
            topupTxId,
            `Level 1 Referral Bonus (${config.level1Percent}%) from @${referee.username} buy coins`,
            executor
          );

          // Log in referral_rewards ledger
          await executor.query(`
            INSERT INTO referral_rewards (
              referrer_id, referee_id, level, topup_tx_id, deposit_usd, deposit_coins, commission_percent, bonus_coins
            ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7);
          `, [
            inviter1.id,
            referee.id,
            topupTxId,
            numUsd,
            numCoins,
            config.level1Percent,
            bonusCoins1
          ]);

          distributions.push({
            level: 1,
            referrerId: inviter1.id,
            username: inviter1.username,
            bonusCoins: bonusCoins1,
            newBalance: creditRes.newBalance,
          });

          // Send real-time notification
          socketServer.emitToUser(inviter1.id, 'wallet:updated', {
            balance: creditRes.newBalance,
            coinsAdded: bonusCoins1,
            message: `🎉 You earned ${bonusCoins1.toLocaleString()} coins from @${referee.username}'s buy coins (5% Direct Referral Bonus)!`,
          });
          socketServer.emitToUser(inviter1.id, 'referral:reward_received', {
            level: 1,
            bonusCoins: bonusCoins1,
            refereeUsername: referee.username,
          });

          console.log(`[Referral] Credited ${bonusCoins1} coins to Level 1 referrer @${inviter1.username} from @${referee.username}`);
        }
      }

      // ==========================================
      // LEVEL 2: Sub-inviter (Level C -> Level A, default 1%)
      // ==========================================
      if (inviter1 && inviter1.referred_by && config.level2Percent > 0) {
        const level2InviterId = inviter1.referred_by;
        const inviter2Res = await executor.query(
          'SELECT id, username, role, referred_by FROM users WHERE id = $1',
          [level2InviterId]
        );

        let inviter2 = inviter2Res.rows[0] || null;

        // Only players can receive referral commissions (not admin or staff accounts)
        if (inviter2 && inviter2.role === 'player') {
          const bonusCoins2 = Math.floor(numCoins * (config.level2Percent / 100));
          if (bonusCoins2 > 0) {
            const creditRes2 = await WalletService.creditCoins(
              inviter2.id,
              bonusCoins2,
              'referral_bonus',
              topupTxId,
              `Level 2 Referral Bonus (${config.level2Percent}%) from @${referee.username} buy coins`,
              executor
            );

            await executor.query(`
              INSERT INTO referral_rewards (
                referrer_id, referee_id, level, topup_tx_id, deposit_usd, deposit_coins, commission_percent, bonus_coins
              ) VALUES ($1, $2, 2, $3, $4, $5, $6, $7);
            `, [
              inviter2.id,
              referee.id,
              topupTxId,
              numUsd,
              numCoins,
              config.level2Percent,
              bonusCoins2
            ]);

            distributions.push({
              level: 2,
              referrerId: inviter2.id,
              username: inviter2.username,
              bonusCoins: bonusCoins2,
              newBalance: creditRes2.newBalance,
            });

            socketServer.emitToUser(inviter2.id, 'wallet:updated', {
              balance: creditRes2.newBalance,
              coinsAdded: bonusCoins2,
              message: `🌟 You earned ${bonusCoins2.toLocaleString()} coins from @${referee.username}'s buy coins (1% Sub-Referral Bonus)!`,
            });
            socketServer.emitToUser(inviter2.id, 'referral:reward_received', {
              level: 2,
              bonusCoins: bonusCoins2,
              refereeUsername: referee.username,
            });

            console.log(`[Referral] Credited ${bonusCoins2} coins to Level 2 referrer @${inviter2.username} from @${referee.username}`);
          }
        }
      }

      return distributions;
    } catch (err) {
      console.error('[Referral] Error processing top-up commission:', err);
      // We do not rethrow to avoid breaking the user's primary topup transaction
      return null;
    }
  }
}

module.exports = ReferralService;
