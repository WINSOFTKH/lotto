const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const config = require('../config/env');
const ReferralService = require('../services/referralService');

class AuthController {
  /**
   * Helper to fetch configured welcome bonus coins from system_settings (defaults to 50)
   */
  static async getWelcomeBonusCoins() {
    try {
      const res = await db.query("SELECT value FROM system_settings WHERE key = 'welcome_bonus_coins';");
      if (res.rows.length > 0) {
        const val = parseInt(res.rows[0].value, 10);
        if (!isNaN(val) && val >= 0) return val;
      }
    } catch (err) {
      console.warn('Could not fetch welcome_bonus_coins from system_settings, fallback to 50:', err);
    }
    return 50;
  }

  /**
   * Helper to fetch configured Telegram bot token from system_settings or fallback to env
   */
  static async getTelegramBotToken() {
    try {
      const res = await db.query("SELECT value FROM system_settings WHERE key = 'telegram_bot_token' LIMIT 1;");
      if (res.rows.length > 0 && res.rows[0].value && res.rows[0].value.trim()) {
        return res.rows[0].value.trim();
      }
    } catch (err) {
      console.warn('Could not fetch telegram_bot_token from system_settings:', err);
    }
    return '';
  }

  /**
   * Register a new player account
   */
  static async register(req, res, next) {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ success: false, error: 'Username, email, and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
      }

      // Check existing user
      const existing = await db.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [email.toLowerCase(), username.trim()]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ success: false, error: 'Username or email already in use' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Generate unique referral code for the new player
      const myReferralCode = await ReferralService.generateUniqueCode();

      // Check if user entered an inviter's referral code upon registration (players only)
      let referredById = null;
      let referralBoundAt = null;
      let referralBindBonus = 0;
      let inviterUsername = null;
      const inviteCode = (req.body.referralCode || req.body.referral_code || '').trim().toUpperCase();
      if (inviteCode) {
        const refRes = await db.query("SELECT id, username FROM users WHERE UPPER(referral_code) = $1 AND role = 'player'", [inviteCode]);
        if (refRes.rows.length > 0) {
          referredById = refRes.rows[0].id;
          referralBoundAt = new Date();
          inviterUsername = refRes.rows[0].username;
          const refConfig = await ReferralService.getConfig();
          referralBindBonus = refConfig.bindBonusCoins || 0;
        }
      }

      // Fetch dynamic welcome bonus coins configured in Admin Settings
      const initialBonus = await AuthController.getWelcomeBonusCoins();
      const totalStartingCoins = initialBonus + referralBindBonus;

      const insertQuery = `
        INSERT INTO users (username, email, password_hash, role, coin_balance, referral_code, referred_by, referral_bound_at)
        VALUES ($1, $2, $3, 'player', $4, $5, $6, $7)
        RETURNING id, username, email, role, coin_balance, created_at, photo_url, referral_code, referred_by, referral_bound_at;
      `;
      const newUser = await db.query(insertQuery, [
        username.trim(),
        email.toLowerCase(),
        passwordHash,
        totalStartingCoins,
        myReferralCode,
        referredById,
        referralBoundAt,
      ]);

      const user = newUser.rows[0];

      // Record welcome bonus in ledger if bonus coins awarded
      if (initialBonus > 0) {
        await db.query(`
          INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description)
          VALUES ($1, 'daily_bonus', $2, $2, 'Welcome Bonus')
        `, [user.id, initialBonus]);
      }

      // Record referral code binding bonus in ledger if awarded
      if (referralBindBonus > 0) {
        await db.query(`
          INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_id, description)
          VALUES ($1, 'referral_bonus', $2, $3, $4, $5)
        `, [
          user.id,
          referralBindBonus,
          totalStartingCoins,
          referredById,
          `Referral Code Bonus (Joined @${inviterUsername}'s team)`
        ]);
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      return res.status(201).json({
        success: true,
        message: 'Account registered successfully',
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            coinBalance: parseInt(user.coin_balance, 10),
            lastClaimDate: null,
            canClaimBonus: true,
            photoUrl: user.photo_url || null,
            photo_url: user.photo_url || null,
            referralCode: user.referral_code,
            referral_code: user.referral_code,
            isBound: Boolean(user.referred_by),
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Login user
   */
  static async login(req, res, next) {
    try {
      const { emailOrUsername, password } = req.body;

      if (!emailOrUsername || !password) {
        return res.status(400).json({ success: false, error: 'Email/username and password are required' });
      }

      const query = `
        SELECT id, username, email, password_hash, role, coin_balance, last_claim_date,
               (last_claim_date IS NULL OR last_claim_date < CURRENT_DATE) AS can_claim_bonus,
               is_banned, photo_url, referral_code, referred_by, referral_bound_at
        FROM users 
        WHERE (LOWER(email) = $1 OR LOWER(username) = $1) AND COALESCE(is_bot, false) = false;
      `;
      const result = await db.query(query, [emailOrUsername.toLowerCase().trim()]);

      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      if (user.is_banned) {
        return res.status(403).json({ success: false, error: 'Account suspended. Contact administration.' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            coinBalance: parseInt(user.coin_balance, 10),
            lastClaimDate: user.last_claim_date,
            canClaimBonus: Boolean(user.can_claim_bonus),
            photoUrl: user.photo_url || null,
            photo_url: user.photo_url || null,
            referralCode: user.referral_code,
            referral_code: user.referral_code,
            isBound: Boolean(user.referred_by),
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get current authenticated user profile
   */
  static async getProfile(req, res, next) {
    try {
      const result = await db.query(`
        SELECT 
          u.id, 
          u.username, 
          u.email, 
          u.role, 
          u.coin_balance, 
          u.last_claim_date, 
          (u.last_claim_date IS NULL OR u.last_claim_date < CURRENT_DATE) AS can_claim_bonus,
          u.is_banned, 
          u.created_at, 
          u.photo_url, 
          u.referral_code, 
          u.referred_by, 
          u.referral_bound_at,
          ref.username AS referrer_username
        FROM users u
        LEFT JOIN users ref ON u.referred_by = ref.id
        WHERE u.id = $1;
      `, [req.user.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      const user = result.rows[0];

      // Failsafe auto-generate referral_code if missing (players only, not admin accounts)
      if (user.role === 'player' && !user.referral_code) {
        user.referral_code = await ReferralService.generateUniqueCode();
        await db.query('UPDATE users SET referral_code = $1 WHERE id = $2', [user.referral_code, user.id]);
      } else if (user.role !== 'player') {
        user.referral_code = null;
      }

      return res.json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          coinBalance: parseInt(user.coin_balance, 10),
          lastClaimDate: user.last_claim_date,
          canClaimBonus: Boolean(user.can_claim_bonus),
          createdAt: user.created_at,
          photoUrl: user.photo_url || null,
          photo_url: user.photo_url || null,
          referralCode: user.role === 'player' ? user.referral_code : null,
          referral_code: user.role === 'player' ? user.referral_code : null,
          isBound: Boolean(user.referred_by),
          referredBy: user.referred_by ? {
            id: user.referred_by,
            username: user.referrer_username,
            boundAt: user.referral_bound_at,
          } : null,
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Telegram Mini App Seamless Login & Registration
   * Strictly validates initData against the server's configured telegram_bot_token.
   * If the bot token does not match or is missing, access is denied and the app cannot open.
   */
  static async telegramLogin(req, res, next) {
    try {
      const { initData } = req.body;

      // 1. Strict validation: initData is required
      if (!initData || typeof initData !== 'string') {
        return res.status(401).json({
          success: false,
          code: 'TG_MISSING_INIT_DATA',
          error: 'Telegram WebApp initData is required. Access denied.',
        });
      }

      // 2. Fetch server's configured bot token
      const activeBotToken = await AuthController.getTelegramBotToken();
      if (!activeBotToken || !activeBotToken.trim()) {
        console.warn('[TelegramAuth] Server has no telegram_bot_token configured in system_settings.');
        return res.status(403).json({
          success: false,
          code: 'TG_BOT_TOKEN_NOT_CONFIGURED',
          error: 'Server Telegram Bot Token is not configured. Access denied.',
        });
      }

      // 3. Parse parameters and extract hash
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      params.delete('hash');

      if (!hash) {
        return res.status(401).json({
          success: false,
          code: 'TG_INVALID_HASH',
          error: 'Missing Telegram authentication hash. Access denied.',
        });
      }

      // 4. Validate auth_date (prevent replay attacks older than 24 hours)
      const authDate = parseInt(params.get('auth_date'), 10);
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (isNaN(authDate) || (nowSeconds - authDate) > 86400) {
        return res.status(401).json({
          success: false,
          code: 'TG_AUTH_DATE_EXPIRED',
          error: 'Telegram authentication session expired. Please reopen the Mini App from Telegram.',
        });
      }

      // 5. Compute HMAC-SHA256 signature using activeBotToken
      const dataCheckArr = [];
      Array.from(params.keys()).sort().forEach((key) => {
        dataCheckArr.push(`${key}=${params.get(key)}`);
      });
      const dataCheckString = dataCheckArr.join('\n');

      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(activeBotToken.trim())
        .digest();

      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      // 6. Cryptographic Token Match Check: If hash doesn't match, block access
      if (calculatedHash !== hash) {
        console.warn('[TelegramAuth] ⚠️ Telegram Bot Token mismatch! Calculated hash does not match initData hash.');
        return res.status(403).json({
          success: false,
          code: 'TG_TOKEN_MISMATCH',
          error: 'Telegram Bot Token does not match. You cannot open this app from an unauthorized bot.',
        });
      }

      // 7. Parse user payload from verified initData
      let tgUser = null;
      const userParam = params.get('user');
      if (userParam) {
        try {
          tgUser = JSON.parse(userParam);
        } catch (e) {
          console.warn('[TelegramAuth] Failed to parse user from initData:', e.message);
        }
      }

      if (!tgUser || !tgUser.id) {
        return res.status(400).json({
          success: false,
          code: 'TG_INVALID_USER',
          error: 'Invalid Telegram user payload in verified initData.',
        });
      }

      const telegramId = String(tgUser.id);
      const usernameCandidate = tgUser.username || (tgUser.first_name ? tgUser.first_name.replace(/\s+/g, '_') : null) || `tg_${telegramId.slice(0, 8)}`;
      const photoUrl = tgUser.photo_url || null;

      // 2. Look up user by telegram_id
      const existingTgUserRes = await db.query(
        'SELECT id, username, email, role, coin_balance, last_claim_date, (last_claim_date IS NULL OR last_claim_date < CURRENT_DATE) AS can_claim_bonus, is_banned, photo_url FROM users WHERE telegram_id = $1;',
        [telegramId]
      );

      let user = null;

      if (existingTgUserRes.rows.length > 0) {
        user = existingTgUserRes.rows[0];

        if (user.is_banned) {
          return res.status(403).json({ success: false, error: 'Account suspended. Contact administration.' });
        }

        // Update photo_url if changed
        if (photoUrl && photoUrl !== user.photo_url) {
          await db.query('UPDATE users SET photo_url = $1, updated_at = NOW() WHERE id = $2;', [photoUrl, user.id]);
          user.photo_url = photoUrl;
        }
      } else {
        // 3. Register brand new player for this Telegram user
        let finalUsername = usernameCandidate;
        const checkUsernameRes = await db.query('SELECT id FROM users WHERE username = $1;', [finalUsername]);
        if (checkUsernameRes.rows.length > 0) {
          finalUsername = `${usernameCandidate}_${Math.floor(100 + Math.random() * 900)}`;
        }

        const generatedEmail = `${telegramId}@telegram.kh-lotto.com`;
        const randomPass = crypto.randomBytes(16).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(randomPass, salt);
        
        // Fetch dynamic welcome bonus coins configured in Admin Settings
        const initialBonus = await AuthController.getWelcomeBonusCoins();
        const tgReferralCode = await ReferralService.generateUniqueCode();

        const insertRes = await db.query(`
          INSERT INTO users (username, email, password_hash, role, coin_balance, telegram_id, photo_url, referral_code)
          VALUES ($1, $2, $3, 'player', $4, $5, $6, $7)
          RETURNING id, username, email, role, coin_balance, last_claim_date, created_at, photo_url, referral_code, referred_by;
        `, [
          finalUsername,
          generatedEmail,
          passwordHash,
          initialBonus,
          telegramId,
          photoUrl,
          tgReferralCode,
        ]);

        user = insertRes.rows[0];

        // Record welcome bonus in wallet transactions ledger if bonus coins awarded
        if (initialBonus > 0) {
          await db.query(`
            INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description)
            VALUES ($1, 'daily_bonus', $2, $2, 'Telegram Mini App Welcome Bonus');
          `, [user.id, initialBonus]);
        }

        console.log(`[TelegramAuth] Registered new Telegram player: @${finalUsername} (TG ID: ${telegramId})`);
      }

      // 4. Generate JWT Session Token
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, telegramId },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      return res.json({
        success: true,
        message: 'Telegram authentication successful',
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            coinBalance: parseInt(user.coin_balance, 10),
            lastClaimDate: user.last_claim_date,
            canClaimBonus: user.can_claim_bonus !== undefined ? Boolean(user.can_claim_bonus) : true,
            telegramId,
            photoUrl: user.photo_url || photoUrl,
            photo_url: user.photo_url || photoUrl,
            referralCode: user.referral_code,
            referral_code: user.referral_code,
            isBound: Boolean(user.referred_by),
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
