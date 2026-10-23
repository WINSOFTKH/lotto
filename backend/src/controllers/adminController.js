const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/env");
const WalletService = require("../services/walletService");
const AuditService = require("../services/auditService");
const KhqrController = require("./khqrController");

const DEFAULT_SUPPORTED_BANKS = [
  { name: "ABA Bank (Advanced Bank of Asia)", logo: "/banks/aba.png" },
  { name: "ACLEDA Bank Plc.", logo: "/banks/acleda.png" },
  { name: "Wing Bank (Cambodia) Plc", logo: "/banks/wing.png" },
  { name: "Canadia Bank PLC", logo: "/banks/canadia.png" },
  { name: "Sathapana Bank Plc", logo: "/banks/sathapana.png" },
  { name: "Prince Bank Plc", logo: "/banks/prince.png" },
  { name: "Chip Mong Commercial Bank", logo: "/banks/chipmong.png" },
];

function normalizeBankList(raw) {
  if (!raw) return [...DEFAULT_SUPPORTED_BANKS];
  let list = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return [...DEFAULT_SUPPORTED_BANKS];
    }
  }
  if (!Array.isArray(list) || list.length === 0)
    return [...DEFAULT_SUPPORTED_BANKS];
  return list
    .map((item) => {
      if (typeof item === "string") {
        const trimmed = item.trim();
        const def = DEFAULT_SUPPORTED_BANKS.find(
          (d) => d.name.toLowerCase() === trimmed.toLowerCase(),
        );
        return { name: trimmed, logo: def ? def.logo : null };
      }
      if (item && typeof item === "object") {
        const name = (item.name || item.bankName || "").trim();
        const logo = item.logo || item.bankLogo || null;
        return { name, logo };
      }
      return null;
    })
    .filter((b) => b && b.name);
}

class AdminController {
  /**
   * Summary metrics for Admin Dashboard
   */
  static async getDashboardStats(req, res, next) {
    try {
      const statsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM users WHERE COALESCE(is_bot, false) = false) AS total_users,
          (SELECT COUNT(*) FROM users WHERE role = 'player' AND COALESCE(is_bot, false) = false) AS total_players,
          (SELECT COUNT(*) FROM tables WHERE status = 'playing') AS active_tables,
          (SELECT COUNT(*) FROM tables WHERE status = 'playing') AS total_tables_playing,
          (
            SELECT COALESCE(
              NULLIF((SELECT COUNT(DISTINCT tp.user_id) FROM table_players tp JOIN tables t ON tp.table_id = t.id WHERE t.status = 'playing'), 0),
              (SELECT COALESCE(SUM(current_players), 0) FROM tables WHERE status = 'playing')
            )
          ) AS total_players_playing,
          (SELECT COALESCE(SUM(CASE WHEN total_pool > 0 THEN total_pool ELSE (entry_fee * current_players) END), 0) FROM tables WHERE status = 'playing') AS total_coins_playing,
          (SELECT COUNT(*) FROM tables WHERE status = 'completed') AS completed_tables,
          (SELECT COALESCE(SUM(platform_fee), 0) FROM tables WHERE status = 'completed') AS total_commission_earned,
          (SELECT COALESCE(SUM(total_pool), 0) FROM tables WHERE status = 'completed') AS total_pool_volume,
          (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending') AS pending_withdrawals,
          (SELECT COALESCE(SUM(amount_usd), 0) FROM withdrawals WHERE status = 'pending') AS pending_withdrawal_usd,
          (SELECT COALESCE(SUM(amount_usd), 0) FROM khqr_transactions WHERE status = 'completed') AS total_topup_usd,
          (SELECT COALESCE(SUM(coin_amount), 0) FROM khqr_transactions WHERE status = 'completed') AS total_topup_coins,
          (SELECT COUNT(*) FROM khqr_transactions WHERE status = 'completed') AS completed_topups_count,
          (SELECT COALESCE(SUM(coin_balance), 0) FROM users WHERE COALESCE(is_bot, false) = false) AS total_all_users_coins,
          (SELECT COALESCE(SUM(coin_balance), 0) FROM users WHERE role = 'player' AND COALESCE(is_bot, false) = false) AS total_player_coins;
      `;
      const result = await db.query(statsQuery);
      return res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }

  /**
   * User Management: View users list with filters
   */
  static async getUsers(req, res, next) {
    try {
      const {
        search = "",
        role,
        isBanned,
        limit = 500,
        offset = 0,
      } = req.query;
      let conditions = ["COALESCE(is_bot, false) = false"];
      let params = [];

      if (search) {
        params.push(`%${search.trim().toLowerCase()}%`);
        conditions.push(
          `(LOWER(username) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`,
        );
      }

      if (role) {
        params.push(role);
        conditions.push(`role = $${params.length}`);
      }

      if (isBanned !== undefined && isBanned !== "") {
        params.push(isBanned === "true");
        conditions.push(`is_banned = $${params.length}`);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      params.push(parseInt(limit, 10));
      const limitParamIndex = params.length;
      params.push(parseInt(offset, 10));
      const offsetParamIndex = params.length;

      const query = `
        SELECT id, username, email, role, coin_balance, last_claim_date, is_banned, created_at
        FROM users
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex};
      `;

      const result = await db.query(query, params);

      // Compute system-wide user metrics and total coins across all real accounts
      const statsRes = await db.query(`
        SELECT 
          COUNT(*)::int AS total_users_count,
          COUNT(CASE WHEN role = 'player' THEN 1 END)::int AS player_count,
          COUNT(CASE WHEN is_banned = true THEN 1 END)::int AS banned_count,
          COALESCE(SUM(coin_balance), 0)::bigint AS total_all_users_coins,
          COALESCE(SUM(CASE WHEN role = 'player' THEN coin_balance ELSE 0 END), 0)::bigint AS total_player_coins
        FROM users
        WHERE COALESCE(is_bot, false) = false;
      `);

      return res.json({
        success: true,
        data: result.rows,
        summary: statsRes.rows[0] || {
          total_users_count: 0,
          player_count: 0,
          banned_count: 0,
          total_all_users_coins: "0",
          total_player_coins: "0",
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update User Role (RBAC)
   */
  static async updateUserRole(req, res, next) {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const adminId = req.user.id;

      const allowedRoles = ["player", "moderator", "finance", "admin"];
      if (!allowedRoles.includes(role)) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Invalid role. Allowed: ${allowedRoles.join(", ")}`,
          });
      }

      if (userId === adminId) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Cannot modify your own administrative role",
          });
      }

      const result = await db.query(
        "UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, email, role",
        [role, userId],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      await AuditService.log({
        adminId,
        action: "UPDATE_USER_ROLE",
        targetType: "USER",
        targetId: userId,
        details: { newRole: role, updatedUser: result.rows[0].username },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        message: `User role updated to ${role}`,
        data: result.rows[0],
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Ban or Unban User
   */
  static async toggleBanUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { isBanned } = req.body;
      const adminId = req.user.id;

      if (userId === adminId) {
        return res
          .status(400)
          .json({ success: false, error: "Cannot ban your own account" });
      }

      const result = await db.query(
        "UPDATE users SET is_banned = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, is_banned",
        [Boolean(isBanned), userId],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      await AuditService.log({
        adminId,
        action: isBanned ? "BAN_USER" : "UNBAN_USER",
        targetType: "USER",
        targetId: userId,
        details: { isBanned: Boolean(isBanned) },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        message: `User account ${isBanned ? "suspended" : "re-activated"}`,
        data: result.rows[0],
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get dynamic System Settings ordered by logical operational category / type
   */
  static async getSettings(req, res, next) {
    try {
      // Auto-ensure chat_messages_per_minute, welcome_bonus_coins, auto-rejoin, bot & referral settings exist
      await db.query(`
        INSERT INTO system_settings (key, value, description)
        VALUES 
          ('chat_messages_per_minute', '15', 'Maximum chat messages and emoji reactions allowed per player per minute to prevent spam'),
          ('welcome_bonus_coins', '50', 'Initial welcome bonus coins credited to newly registered players'),
          ('auto_rejoin_enabled', 'true', 'Enable or disable automatic table re-joining after game ends for players with enough coins'),
          ('auto_rejoin_delay_seconds', '7', 'Countdown duration in seconds before auto re-joining the current table after game completion'),
          ('bot_players_enabled', 'true', 'Enable or disable automatic bot players joining tables when fewer than 2 real players are seated'),
          ('max_bot_players_per_table', '3', 'Maximum number of bot players that can join seats on a table with fewer than 2 real players'),
          ('bot_join_delay_seconds', '30', 'Wait time in seconds before bot players automatically join seats when a table has fewer than 2 real players'),
          ('referral_program_enabled', 'true', 'Enable or disable the referral commission program'),
          ('referral_bonus_level1_percent', '5', 'Direct referral bonus (Level A gets % of deposit from direct referral Level B)'),
          ('referral_bonus_level2_percent', '1', 'Sub-referral bonus (Level A gets % of deposit from sub-referral Level C)'),
          ('referral_bind_bonus_coins', '50', 'Bonus coins awarded immediately to a player upon entering and binding an inviter referral code'),
          ('bakong_api_token', '', 'Bearer token from NBC Bakong Open API Portal (https://api-bakong.nbc.gov.kh/) to automatically verify KHQR transfers by MD5'),
          ('bakong_developer_email', '', 'Registered developer email on api-bakong.nbc.gov.kh used for scheduled automatic token renewals'),
          ('supported_bank_names', '${JSON.stringify(DEFAULT_SUPPORTED_BANKS).replace(/'/g, "''")}', 'JSON list of supported bank names for player payment method setup and cash-out withdrawals')
        ON CONFLICT (key) DO NOTHING;
      `);

      const result = await db.query(`
        SELECT 
          key, 
          value, 
          description, 
          updated_at,
          CASE 
            WHEN key IN ('game_auto_start_seconds', 'max_players_per_table', 'quick_play_coins', 'allowed_entry_fees', 'platform_fee_percent', 'crashed_game_timeout_minutes', 'crashed_game_timeout_hours', 'chat_messages_per_minute', 'auto_rejoin_enabled', 'auto_rejoin_delay_seconds', 'bot_players_enabled', 'max_bot_players_per_table', 'bot_join_delay_seconds') THEN 'gameplay'
            WHEN key IN ('topup_coins_per_usd', 'topup_coin_presets', 'bakong_api_token', 'bakong_developer_email') THEN 'topup'
            WHEN key IN ('coins_per_usd', 'min_withdrawal_coins', 'supported_bank_names') THEN 'withdrawal'
            WHEN key IN ('daily_bonus_coins', 'welcome_bonus_coins') THEN 'rewards'
            WHEN key IN ('referral_program_enabled', 'referral_bonus_level1_percent', 'referral_bonus_level2_percent', 'referral_bind_bonus_coins') THEN 'referral'
            ELSE 'general'
          END AS type,
          CASE 
            WHEN key IN ('game_auto_start_seconds', 'max_players_per_table', 'quick_play_coins', 'allowed_entry_fees', 'platform_fee_percent', 'crashed_game_timeout_minutes', 'crashed_game_timeout_hours', 'chat_messages_per_minute', 'auto_rejoin_enabled', 'auto_rejoin_delay_seconds', 'bot_players_enabled', 'max_bot_players_per_table', 'bot_join_delay_seconds') THEN 'Gameplay & Tables'
            WHEN key IN ('topup_coins_per_usd', 'topup_coin_presets', 'bakong_api_token', 'bakong_developer_email') THEN 'Buy Coins & Deposits'
            WHEN key IN ('coins_per_usd', 'min_withdrawal_coins', 'supported_bank_names') THEN 'Sell Coins'
            WHEN key IN ('daily_bonus_coins', 'welcome_bonus_coins') THEN 'Rewards & Bonuses'
            WHEN key IN ('referral_program_enabled', 'referral_bonus_level1_percent', 'referral_bonus_level2_percent', 'referral_bind_bonus_coins') THEN 'Referral Program'
            ELSE 'General'
          END AS type_label
        FROM system_settings 
        ORDER BY 
          CASE 
            -- Group 1: Gameplay & Table Rules
            WHEN key = 'game_auto_start_seconds' THEN 1
            WHEN key = 'max_players_per_table' THEN 2
            WHEN key = 'quick_play_coins' THEN 3
            WHEN key = 'allowed_entry_fees' THEN 4
            WHEN key = 'platform_fee_percent' THEN 5
            WHEN key = 'crashed_game_timeout_minutes' OR key = 'crashed_game_timeout_hours' THEN 6
            WHEN key = 'chat_messages_per_minute' THEN 7
            WHEN key = 'auto_rejoin_enabled' THEN 8
            WHEN key = 'auto_rejoin_delay_seconds' THEN 9
            WHEN key = 'bot_players_enabled' THEN 10
            WHEN key = 'max_bot_players_per_table' THEN 11
            WHEN key = 'bot_join_delay_seconds' THEN 12
            -- Group 2: Top-Up & Deposits (KHQR)
            WHEN key = 'topup_coins_per_usd' THEN 13
            WHEN key = 'topup_coin_presets' THEN 14
            WHEN key = 'bakong_api_token' THEN 15
            WHEN key = 'bakong_developer_email' THEN 16
            -- Group 3: Withdrawals & Cash-Outs
            WHEN key = 'coins_per_usd' THEN 17
            WHEN key = 'min_withdrawal_coins' THEN 18
            WHEN key = 'supported_bank_names' THEN 19
            -- Group 4: Bonuses & Rewards
            WHEN key = 'welcome_bonus_coins' THEN 20
            WHEN key = 'daily_bonus_coins' THEN 21
            -- Group 5: Referral Program
            WHEN key = 'referral_program_enabled' THEN 22
            WHEN key = 'referral_bonus_level1_percent' THEN 23
            WHEN key = 'referral_bonus_level2_percent' THEN 24
            WHEN key = 'referral_bind_bonus_coins' THEN 25
            ELSE 99
          END ASC, key ASC;
      `);

      const KhqrService = require('../services/khqrService');
      const rows = result.rows.map((row) => {
        if (row.key === 'bakong_api_token') {
          return {
            ...row,
            tokenDetails: KhqrService.getTokenDetails(row.value),
          };
        }
        return row;
      });

      return res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update dynamic System Setting (e.g. 1500 coins = $1)
   */
  static async updateSetting(req, res, next) {
    try {
      const { key } = req.params;
      const { value } = req.body;
      const adminId = req.user.id;

      if (value === undefined || value === null) {
        return res
          .status(400)
          .json({ success: false, error: "Setting value is required" });
      }

      if (key === "max_players_per_table") {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 2 || num > 100) {
          return res
            .status(400)
            .json({
              success: false,
              error:
                "Max players per table must be an integer between 2 and 100",
            });
        }
      }

      if (key === "max_bot_players_per_table") {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 1 || num > 99) {
          return res
            .status(400)
            .json({
              success: false,
              error:
                "Max bot players per table must be an integer between 1 and 99",
            });
        }
      }

      if (key === "bot_join_delay_seconds") {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 1 || num > 600) {
          return res
            .status(400)
            .json({
              success: false,
              error:
                "Bot join delay timer must be an integer between 1 and 600 seconds",
            });
        }
      }

      if (key === "chat_messages_per_minute") {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 1 || num > 300) {
          return res
            .status(400)
            .json({
              success: false,
              error:
                "Chat messages per minute must be an integer between 1 and 300",
            });
        }
      }

      if (key === "crashed_game_timeout_minutes") {
        const num = parseFloat(value);
        if (isNaN(num) || num < 1 || num > 1440) {
          return res.status(400).json({
            success: false,
            error: "Crashed game recovery threshold must be a number between 1 and 1440 minutes",
          });
        }
      }

      if (
        key === "welcome_bonus_coins" ||
        key === "referral_bind_bonus_coins"
      ) {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0 || num > 1000000) {
          return res
            .status(400)
            .json({
              success: false,
              error: `${key} must be an integer 0 or greater`,
            });
        }
      }

      if (key === "auto_rejoin_delay_seconds") {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 1 || num > 120) {
          return res
            .status(400)
            .json({
              success: false,
              error:
                "Auto re-join countdown must be an integer between 1 and 120 seconds",
            });
        }
      }

      if (
        key === "auto_rejoin_enabled" ||
        key === "referral_program_enabled" ||
        key === "bot_players_enabled"
      ) {
        const strVal = String(value).toLowerCase();
        if (strVal !== "true" && strVal !== "false") {
          return res
            .status(400)
            .json({ success: false, error: `${key} must be true or false` });
        }
      }

      if (
        [
          "referral_bonus_level1_percent",
          "referral_bonus_level2_percent",
        ].includes(key)
      ) {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 100) {
          return res
            .status(400)
            .json({
              success: false,
              error:
                "Referral commission percentage must be a number between 0 and 100",
            });
        }
      }

      if (key === "supported_bank_names") {
        try {
          const parsed = typeof value === "string" ? JSON.parse(value) : value;
          if (!Array.isArray(parsed) || parsed.length === 0) {
            return res
              .status(400)
              .json({
                success: false,
                error:
                  "supported_bank_names must be a non-empty array of bank name strings",
              });
          }
        } catch (jsonErr) {
          return res
            .status(400)
            .json({
              success: false,
              error:
                "supported_bank_names must be a valid JSON array of bank names",
            });
        }
      }

      const updateQuery = `
        INSERT INTO system_settings (key, value, updated_by, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (key) DO UPDATE 
        SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
        RETURNING *;
      `;
      const result = await db.query(updateQuery, [key, String(value), adminId]);

      if (key === "chat_messages_per_minute") {
        try {
          const TableSocketHandler = require("../sockets/tableSocket");
          TableSocketHandler.updateCachedChatRateLimit?.(value);
        } catch (socketErr) {
          console.warn("Could not update cached chat rate limit:", socketErr);
        }
      }

      if (
        key === "bot_players_enabled" ||
        key === "max_bot_players_per_table" ||
        key === "bot_join_delay_seconds"
      ) {
        try {
          const BotService = require("../services/botService");
          BotService.checkAllWaitingTables(key === "bot_join_delay_seconds");
        } catch (botErr) {
          console.warn(
            "Could not trigger bot check on waiting tables:",
            botErr,
          );
        }
      }

      await AuditService.log({
        adminId,
        action: "UPDATE_SYSTEM_SETTING",
        targetType: "SETTING",
        targetId: key,
        details: { key, newValue: value },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        message: `Setting ${key} updated successfully`,
        data: result.rows[0],
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get supported bank names list (Admin & Finance)
   */
  static async getBanks(req, res, next) {
    try {
      const resDb = await db.query(
        "SELECT value FROM system_settings WHERE key = 'supported_bank_names'",
      );
      const banks = normalizeBankList(resDb.rows[0]?.value);
      return res.json({ success: true, data: banks });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Add a new supported bank name and logo (Admin only)
   */
  static async addBank(req, res, next) {
    try {
      const bankName = (req.body?.bankName || req.body?.name || "").trim();
      const bankLogo = req.body?.bankLogo || req.body?.logo || null;

      let adminId = req.user?.id || null;
      if (adminId) {
        const uRes = await db.query("SELECT id FROM users WHERE id = $1", [
          adminId,
        ]);
        if (uRes.rows.length === 0) adminId = null;
      }

      if (!bankName) {
        return res
          .status(400)
          .json({ success: false, error: "Bank name is required" });
      }

      if (bankName.length < 2 || bankName.length > 100) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Bank name must be between 2 and 100 characters",
          });
      }

      const resDb = await db.query(
        "SELECT value FROM system_settings WHERE key = 'supported_bank_names'",
      );
      let banks = normalizeBankList(resDb.rows[0]?.value);

      const exists = banks.some(
        (b) => b.name.toLowerCase() === bankName.toLowerCase(),
      );
      if (exists) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Bank "${bankName}" already exists in the list`,
          });
      }

      banks.push({
        name: bankName,
        logo: bankLogo || null,
      });

      const jsonVal = JSON.stringify(banks);

      await db.query(
        `
        INSERT INTO system_settings (key, value, updated_by, updated_at)
        VALUES ('supported_bank_names', $1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW();
      `,
        [jsonVal, adminId],
      );

      try {
        await AuditService.log({
          adminId,
          action: "ADD_BANK",
          targetType: "SETTING",
          targetId: "supported_bank_names",
          details: {
            addedBank: bankName,
            hasCustomLogo: !!bankLogo,
            totalBanks: banks.length,
          },
          ipAddress: req.ip,
        });
      } catch (auditErr) {
        console.warn("Could not insert audit log for ADD_BANK:", auditErr);
      }

      return res.json({
        success: true,
        message: `Bank "${bankName}" added successfully`,
        data: banks,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update an existing supported bank's name and/or logo (Admin only)
   */
  static async updateBank(req, res, next) {
    try {
      const oldName = (
        req.body?.oldName ||
        req.body?.originalName ||
        ""
      ).trim();
      const newName = (req.body?.bankName || req.body?.name || "").trim();
      const newLogo =
        req.body?.bankLogo !== undefined ? req.body.bankLogo : req.body?.logo;

      let adminId = req.user?.id || null;
      if (adminId) {
        const uRes = await db.query("SELECT id FROM users WHERE id = $1", [
          adminId,
        ]);
        if (uRes.rows.length === 0) adminId = null;
      }

      if (!oldName) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Original bank name (oldName) is required",
          });
      }

      const resDb = await db.query(
        "SELECT value FROM system_settings WHERE key = 'supported_bank_names'",
      );
      let banks = normalizeBankList(resDb.rows[0]?.value);

      const targetIdx = banks.findIndex(
        (b) => b.name.toLowerCase() === oldName.toLowerCase(),
      );
      if (targetIdx === -1) {
        return res
          .status(404)
          .json({ success: false, error: `Bank "${oldName}" not found` });
      }

      const finalName = newName || banks[targetIdx].name;
      if (finalName.toLowerCase() !== oldName.toLowerCase()) {
        const duplicate = banks.some(
          (b, i) =>
            i !== targetIdx && b.name.toLowerCase() === finalName.toLowerCase(),
        );
        if (duplicate) {
          return res
            .status(400)
            .json({
              success: false,
              error: `Another bank named "${finalName}" already exists`,
            });
        }
      }

      banks[targetIdx] = {
        name: finalName,
        logo: newLogo !== undefined ? newLogo : banks[targetIdx].logo,
      };

      const jsonVal = JSON.stringify(banks);

      await db.query(
        `
        INSERT INTO system_settings (key, value, updated_by, updated_at)
        VALUES ('supported_bank_names', $1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW();
      `,
        [jsonVal, adminId],
      );

      try {
        await AuditService.log({
          adminId,
          action: "UPDATE_BANK",
          targetType: "SETTING",
          targetId: "supported_bank_names",
          details: {
            updatedBank: finalName,
            previousName: oldName,
            hasCustomLogo: !!banks[targetIdx].logo,
          },
          ipAddress: req.ip,
        });
      } catch (auditErr) {
        console.warn("Could not insert audit log for UPDATE_BANK:", auditErr);
      }

      return res.json({
        success: true,
        message: `Bank "${finalName}" updated successfully`,
        data: banks,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Remove a supported bank name (Admin only)
   */
  static async removeBank(req, res, next) {
    try {
      const bankName = (
        req.body?.bankName ||
        req.query?.bankName ||
        req.body?.name ||
        ""
      ).trim();
      let adminId = req.user?.id || null;
      if (adminId) {
        const uRes = await db.query("SELECT id FROM users WHERE id = $1", [
          adminId,
        ]);
        if (uRes.rows.length === 0) adminId = null;
      }

      if (!bankName) {
        return res
          .status(400)
          .json({ success: false, error: "Bank name to remove is required" });
      }

      const resDb = await db.query(
        "SELECT value FROM system_settings WHERE key = 'supported_bank_names'",
      );
      let banks = normalizeBankList(resDb.rows[0]?.value);

      if (banks.length <= 1) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "Cannot remove the last remaining bank. At least one bank must be supported.",
          });
      }

      const initialLen = banks.length;
      banks = banks.filter(
        (b) => b.name.toLowerCase() !== bankName.toLowerCase(),
      );

      if (banks.length === initialLen) {
        return res
          .status(404)
          .json({
            success: false,
            error: `Bank "${bankName}" not found in supported banks list`,
          });
      }

      const jsonVal = JSON.stringify(banks);

      await db.query(
        `
        INSERT INTO system_settings (key, value, updated_by, updated_at)
        VALUES ('supported_bank_names', $1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW();
      `,
        [jsonVal, adminId],
      );

      try {
        await AuditService.log({
          adminId,
          action: "REMOVE_BANK",
          targetType: "SETTING",
          targetId: "supported_bank_names",
          details: { removedBank: bankName, remainingBanks: banks.length },
          ipAddress: req.ip,
        });
      } catch (auditErr) {
        console.warn("Could not insert audit log for REMOVE_BANK:", auditErr);
      }

      return res.json({
        success: true,
        message: `Bank "${bankName}" removed successfully`,
        data: banks,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Reset supported bank names to default Cambodian banks list (Admin only)
   */
  static async resetBanks(req, res, next) {
    try {
      let adminId = req.user?.id || null;
      if (adminId) {
        const uRes = await db.query("SELECT id FROM users WHERE id = $1", [
          adminId,
        ]);
        if (uRes.rows.length === 0) adminId = null;
      }
      const jsonVal = JSON.stringify(DEFAULT_SUPPORTED_BANKS);

      await db.query(
        `
        INSERT INTO system_settings (key, value, updated_by, updated_at)
        VALUES ('supported_bank_names', $1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW();
      `,
        [jsonVal, adminId],
      );

      try {
        await AuditService.log({
          adminId,
          action: "RESET_BANKS",
          targetType: "SETTING",
          targetId: "supported_bank_names",
          details: { resetToDefaults: DEFAULT_SUPPORTED_BANKS },
          ipAddress: req.ip,
        });
      } catch (auditErr) {
        console.warn("Could not insert audit log for RESET_BANKS:", auditErr);
      }

      return res.json({
        success: true,
        message: "Reset supported banks to default Cambodian banks list",
        data: DEFAULT_SUPPORTED_BANKS,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get withdrawal requests list with status summary
   */
  static async getWithdrawals(req, res, next) {
    try {
      const { status, search } = req.query;
      let query = `
        SELECT 
          w.*, 
          u.username, u.email,
          p.username AS processed_by_name
        FROM withdrawals w
        JOIN users u ON w.user_id = u.id
        LEFT JOIN users p ON w.processed_by = p.id
      `;
      const params = [];
      const conditions = [];

      if (status && status !== "all") {
        params.push(status);
        conditions.push(`w.status = $${params.length}`);
      }

      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        conditions.push(`(
          LOWER(u.username) LIKE $${params.length} 
          OR LOWER(u.email) LIKE $${params.length} 
          OR LOWER(w.bank_name) LIKE $${params.length} 
          OR LOWER(w.account_number) LIKE $${params.length} 
          OR LOWER(w.account_name) LIKE $${params.length}
        )`);
      }

      if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(" AND ");
      }

      query += ` ORDER BY (w.status = 'pending') DESC, w.created_at DESC;`;

      const result = await db.query(query, params);

      // Compute total amounts (USD and coins) and counts grouped by status
      const statsRes = await db.query(`
        SELECT 
          COUNT(*)::int AS total_count,
          COALESCE(SUM(amount_usd), 0)::numeric(12, 2) AS total_usd,
          COALESCE(SUM(coin_amount), 0)::bigint AS total_coins,

          COUNT(CASE WHEN status = 'approved' THEN 1 END)::int AS approved_count,
          COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_usd ELSE 0 END), 0)::numeric(12, 2) AS approved_usd,
          COALESCE(SUM(CASE WHEN status = 'approved' THEN coin_amount ELSE 0 END), 0)::bigint AS approved_coins,

          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending_count,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_usd ELSE 0 END), 0)::numeric(12, 2) AS pending_usd,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN coin_amount ELSE 0 END), 0)::bigint AS pending_coins,

          COUNT(CASE WHEN status = 'rejected' THEN 1 END)::int AS rejected_count,
          COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount_usd ELSE 0 END), 0)::numeric(12, 2) AS rejected_usd,
          COALESCE(SUM(CASE WHEN status = 'rejected' THEN coin_amount ELSE 0 END), 0)::bigint AS rejected_coins,

          COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int AS cancelled_count,
          COALESCE(SUM(CASE WHEN status = 'cancelled' THEN amount_usd ELSE 0 END), 0)::numeric(12, 2) AS cancelled_usd,
          COALESCE(SUM(CASE WHEN status = 'cancelled' THEN coin_amount ELSE 0 END), 0)::bigint AS cancelled_coins
        FROM withdrawals;
      `);

      return res.json({
        success: true,
        data: result.rows,
        summary: statsRes.rows[0] || {
          total_count: 0,
          total_usd: "0.00",
          total_coins: "0",
          approved_count: 0,
          approved_usd: "0.00",
          approved_coins: "0",
          pending_count: 0,
          pending_usd: "0.00",
          pending_coins: "0",
          rejected_count: 0,
          rejected_usd: "0.00",
          rejected_coins: "0",
          cancelled_count: 0,
          cancelled_usd: "0.00",
          cancelled_coins: "0",
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Process withdrawal: Approve or Reject (Atomically refunds coins if rejected)
   */
  static async processWithdrawal(req, res, next) {
    try {
      const { id } = req.params;
      const { action, reason } = req.body; // action: 'approve' or 'reject'
      const adminId = req.user.id;

      if (!["approve", "reject"].includes(action)) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Action must be either 'approve' or 'reject'",
          });
      }

      const updated = await db.withTransaction(async (client) => {
        // Lock withdrawal row
        const findQuery = "SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE";
        const wRes = await client.query(findQuery, [id]);

        if (wRes.rows.length === 0) {
          const err = new Error("Sell coins request not found");
          err.statusCode = 404;
          throw err;
        }

        const withdrawal = wRes.rows[0];

        if (withdrawal.status !== "pending") {
          const err = new Error(
            `Sell coins request is already ${withdrawal.status}`,
          );
          err.statusCode = 400;
          throw err;
        }

        if (action === "approve") {
          const approveQuery = `
            UPDATE withdrawals 
            SET status = 'approved', processed_by = $1, processed_at = NOW(), updated_at = NOW()
            WHERE id = $2
            RETURNING *;
          `;
          const resApprove = await client.query(approveQuery, [adminId, id]);
          return { record: resApprove.rows[0], action: "approved" };
        } else {
          // Reject and refund escrowed coins back to user
          const rejectQuery = `
            UPDATE withdrawals 
            SET status = 'rejected', rejection_reason = $1, processed_by = $2, processed_at = NOW(), updated_at = NOW()
            WHERE id = $3
            RETURNING *;
          `;
          const resReject = await client.query(rejectQuery, [
            reason || "Rejected by finance",
            adminId,
            id,
          ]);

          // Atomically refund coins to user wallet
          await WalletService.creditCoins(
            withdrawal.user_id,
            withdrawal.coin_amount,
            "withdrawal_refund",
            withdrawal.id,
            `Refund for rejected sell coins: ${reason || "Administrative rejection"}`,
            client,
          );

          return { record: resReject.rows[0], action: "rejected" };
        }
      });

      await AuditService.log({
        adminId,
        action:
          updated.action === "approved"
            ? "APPROVE_WITHDRAWAL"
            : "REJECT_WITHDRAWAL",
        targetType: "WITHDRAWAL",
        targetId: id,
        details: {
          action: updated.action,
          reason,
          amountUsd: updated.record.amount_usd,
        },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        message: `Sell coins request successfully ${updated.action}`,
        data: updated.record,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get all player top-up history (KHQR Transactions)
   */
  static async getTopups(req, res, next) {
    try {
      const { status, search, limit = 500, offset = 0 } = req.query;
      let query = `
        SELECT 
          kt.id,
          kt.user_id,
          kt.amount_usd,
          kt.coin_amount,
          kt.khqr_string,
          kt.md5_hash,
          kt.status,
          kt.paid_at,
          kt.created_at,
          kt.updated_at,
          u.username,
          u.email,
          u.role AS user_role,
          u.coin_balance AS current_user_balance
        FROM khqr_transactions kt
        JOIN users u ON kt.user_id = u.id
      `;
      const params = [];
      const whereClauses = [];

      if (status && status !== "all") {
        params.push(status);
        whereClauses.push(`kt.status = $${params.length}`);
      }

      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        whereClauses.push(`(
          LOWER(u.username) LIKE $${params.length} OR 
          LOWER(u.email) LIKE $${params.length} OR 
          LOWER(kt.md5_hash) LIKE $${params.length} OR
          LOWER(kt.id::text) LIKE $${params.length}
        )`);
      }

      if (whereClauses.length > 0) {
        query += ` WHERE ` + whereClauses.join(" AND ");
      }

      query += ` ORDER BY kt.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
      params.push(parseInt(limit, 10), parseInt(offset, 10));

      const result = await db.query(query, params);

      // Compute summary stats for topups
      const statsRes = await db.query(`
        SELECT 
          COUNT(*)::int AS total_count,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed_count,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending_count,
          COUNT(CASE WHEN status = 'expired' OR status = 'failed' THEN 1 END)::int AS expired_count,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN amount_usd ELSE 0 END), 0)::numeric(12,2) AS total_usd_received,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN coin_amount ELSE 0 END), 0)::bigint AS total_coins_credited
        FROM khqr_transactions;
      `);

      return res.json({
        success: true,
        data: result.rows,
        summary: statsRes.rows[0] || {
          total_count: 0,
          completed_count: 0,
          pending_count: 0,
          expired_count: 0,
          total_usd_received: "0.00",
          total_coins_credited: "0",
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin approves a pending KHQR buy coins top-up
   */
  static async approveTopup(req, res, next) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Transaction ID is required' });
      }

      const settlement = await KhqrController.settleTransaction(id);

      // Audit log
      try {
        await db.query(
          `INSERT INTO audit_logs (admin_id, action, target_type, target_id, details)
           VALUES ($1, 'topup_approved', 'khqr_transaction', $2, $3)`,
          [
            adminId,
            settlement.tx.id,
            JSON.stringify({
              userId: settlement.tx.user_id,
              amountUsd: settlement.tx.amount_usd,
              coinAmount: settlement.tx.coin_amount,
              alreadyCompleted: settlement.alreadyCompleted,
            }),
          ]
        );
      } catch (auditErr) {
        console.warn('[AdminController] audit log error:', auditErr.message);
      }

      return res.json({
        success: true,
        message: settlement.alreadyCompleted
          ? 'Transaction was already completed'
          : `Top-up successfully approved! Credited ${Number(settlement.tx.coin_amount).toLocaleString()} coins.`,
        data: {
          transactionId: settlement.tx.id,
          status: 'completed',
          coinAmount: settlement.tx.coin_amount,
          amountUsd: settlement.tx.amount_usd,
          newBalance: settlement.newBalance,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Renew Bakong Developer API Token
   */
  static async renewBakongToken(req, res, next) {
    try {
      const { email } = req.body;
      const adminId = req.user.id;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Registered Bakong developer email is required' });
      }

      const KhqrService = require('../services/khqrService');
      const result = await KhqrService.renewBakongToken(email);

      // Audit log
      try {
        await db.query(
          `INSERT INTO audit_logs (admin_id, action, target_type, details)
           VALUES ($1, 'bakong_token_renew', 'system_setting', $2)`,
          [adminId, JSON.stringify({ email, result })]
        );
      } catch (e) {}

      return res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get all player coin earnings & reductions (Wallet Transaction Ledger)
   */
  static async getWalletTransactions(req, res, next) {
    try {
      const { type, direction, search, limit = 500, offset = 0 } = req.query;
      let query = `
        SELECT 
          wt.id,
          wt.user_id,
          wt.type,
          wt.amount,
          wt.balance_after,
          wt.reference_id,
          wt.description,
          wt.created_at,
          u.username,
          u.email,
          u.coin_balance AS current_user_balance
        FROM wallet_transactions wt
        JOIN users u ON wt.user_id = u.id
      `;
      const params = [];
      const whereClauses = [];

      if (type && type !== "all") {
        params.push(type);
        whereClauses.push(`wt.type = $${params.length}`);
      }

      if (direction === "earned" || direction === "credit") {
        whereClauses.push(`wt.amount > 0`);
      } else if (direction === "reduced" || direction === "debit") {
        whereClauses.push(`wt.amount < 0`);
      }

      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        whereClauses.push(`(
          LOWER(u.username) LIKE $${params.length} OR 
          LOWER(u.email) LIKE $${params.length} OR 
          LOWER(COALESCE(wt.description, '')) LIKE $${params.length} OR
          LOWER(COALESCE(wt.reference_id, '')) LIKE $${params.length}
        )`);
      }

      if (whereClauses.length > 0) {
        query += ` WHERE ` + whereClauses.join(" AND ");
      }

      query += ` ORDER BY wt.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
      params.push(parseInt(limit, 10), parseInt(offset, 10));

      const result = await db.query(query, params);

      // Summary statistics for wallet transactions
      const statsRes = await db.query(`
        SELECT 
          COUNT(*)::int AS total_transactions,
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::bigint AS total_coins_earned,
          COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)::bigint AS total_coins_reduced
        FROM wallet_transactions;
      `);

      return res.json({
        success: true,
        data: result.rows,
        summary: statsRes.rows[0] || {
          total_transactions: 0,
          total_coins_earned: "0",
          total_coins_reduced: "0",
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get audit log history
   */
  static async getAuditLogs(req, res, next) {
    try {
      const { limit = 500, offset = 0 } = req.query;
      const query = `
        SELECT 
          a.*,
          u.username AS admin_username
        FROM audit_logs a
        LEFT JOIN users u ON a.admin_id = u.id
        ORDER BY a.created_at DESC
        LIMIT $1 OFFSET $2;
      `;
      const result = await db.query(query, [
        parseInt(limit, 10),
        parseInt(offset, 10),
      ]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
  /**
   * Manually trigger check and recovery of crashed tables
   */
  static async recoverCrashedTables(req, res, next) {
    try {
      const adminId = req.user.id;
      const TableRecoveryService = require("../services/tableRecoveryService");
      const result =
        await TableRecoveryService.checkAndRecoverCrashedTables(adminId);
      return res.json({
        success: true,
        message:
          result.recoveredCount > 0
            ? `Recovered ${result.recoveredCount} crashed table(s) back to waiting status.`
            : "No crashed tables found. All active tables are healthy.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Admin Account Details (Admin use only)
   */
  static async getAdminAccount(req, res, next) {
    try {
      const adminId = req.user.id;
      const query = `
        SELECT id, username, email, role, coin_balance, photo_url, telegram_id, created_at, updated_at
        FROM users
        WHERE id = $1 AND role = 'admin';
      `;
      const result = await db.query(query, [adminId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Admin account not found or access unauthorized' });
      }
      const admin = result.rows[0];
      return res.json({
        success: true,
        data: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
          coinBalance: parseInt(admin.coin_balance, 10),
          photoUrl: admin.photo_url || null,
          photo_url: admin.photo_url || null,
          telegramId: admin.telegram_id || null,
          telegram_id: admin.telegram_id || null,
          createdAt: admin.created_at,
          updatedAt: admin.updated_at,
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update Admin's Own Account (Username, Email, Password, Profile Photo, Telegram ID)
   */
  static async updateAdminAccount(req, res, next) {
    try {
      const adminId = req.user.id;
      const { username, email, password, photoUrl, photo_url, telegramId, telegram_id } = req.body;

      // 1. Fetch existing admin record
      const existingRes = await db.query('SELECT * FROM users WHERE id = $1 AND role = $2', [adminId, 'admin']);
      if (existingRes.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'Admin access denied or account does not exist' });
      }
      const currentAdmin = existingRes.rows[0];

      const newUsername = (username !== undefined && username !== null) ? String(username).trim() : currentAdmin.username;
      const newEmail = (email !== undefined && email !== null) ? String(email).trim().toLowerCase() : currentAdmin.email;
      const newPhoto = (photoUrl !== undefined ? photoUrl : (photo_url !== undefined ? photo_url : currentAdmin.photo_url));
      const cleanPhoto = newPhoto ? String(newPhoto).trim() : null;
      const newTg = (telegramId !== undefined ? telegramId : (telegram_id !== undefined ? telegram_id : currentAdmin.telegram_id));
      const cleanTg = newTg ? String(newTg).trim() : null;

      // Validations
      if (!newUsername || newUsername.length < 3) {
        return res.status(400).json({ success: false, error: 'Username must be at least 3 characters long' });
      }
      if (newUsername.length > 50) {
        return res.status(400).json({ success: false, error: 'Username must be at most 50 characters long' });
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(newUsername)) {
        return res.status(400).json({ success: false, error: 'Username can only contain letters, numbers, underscores, dots, or hyphens' });
      }

      if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
      }

      // Check username uniqueness
      if (newUsername.toLowerCase() !== currentAdmin.username.toLowerCase()) {
        const dupUser = await db.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2', [newUsername, adminId]);
        if (dupUser.rows.length > 0) {
          return res.status(409).json({ success: false, error: 'This username is already taken by another user' });
        }
      }

      // Check email uniqueness
      if (newEmail.toLowerCase() !== currentAdmin.email.toLowerCase()) {
        const dupEmail = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2', [newEmail, adminId]);
        if (dupEmail.rows.length > 0) {
          return res.status(409).json({ success: false, error: 'This email is already associated with another user' });
        }
      }

      // Check password if provided
      let newPasswordHash = null;
      if (password && String(password).trim().length > 0) {
        const cleanPassword = String(password).trim();
        if (cleanPassword.length < 6) {
          return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
        }
        newPasswordHash = await bcrypt.hash(cleanPassword, 10);
      }

      // Track changed fields for audit log
      const changedFields = [];
      if (newUsername !== currentAdmin.username) changedFields.push('username');
      if (newEmail !== currentAdmin.email) changedFields.push('email');
      if (cleanPhoto !== currentAdmin.photo_url) changedFields.push('photo_url');
      if (cleanTg !== currentAdmin.telegram_id) changedFields.push('telegram_id');
      if (newPasswordHash) changedFields.push('password');

      // Update database
      const updateQuery = `
        UPDATE users
        SET 
          username = $1,
          email = $2,
          photo_url = $3,
          telegram_id = $4,
          password_hash = CASE WHEN $5::text IS NOT NULL AND $5::text <> '' THEN $5::text ELSE password_hash END,
          updated_at = NOW()
        WHERE id = $6 AND role = 'admin'
        RETURNING id, username, email, role, coin_balance, photo_url, telegram_id, created_at, updated_at;
      `;
      const updateRes = await db.query(updateQuery, [
        newUsername,
        newEmail,
        cleanPhoto,
        cleanTg,
        newPasswordHash,
        adminId
      ]);

      const updatedAdmin = updateRes.rows[0];

      // Generate a fresh JWT token
      const newToken = jwt.sign(
        { id: updatedAdmin.id, username: updatedAdmin.username, role: updatedAdmin.role },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      // Audit log entry
      await AuditService.log({
        adminId,
        action: 'UPDATE_ADMIN_ACCOUNT',
        targetType: 'admin_account',
        targetId: adminId,
        details: {
          changedFields,
          previousUsername: currentAdmin.username,
          newUsername: updatedAdmin.username,
          previousEmail: currentAdmin.email,
          newEmail: updatedAdmin.email,
          passwordChanged: Boolean(newPasswordHash),
          photoChanged: cleanPhoto !== currentAdmin.photo_url,
        },
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      });

      return res.json({
        success: true,
        message: 'Admin account profile updated successfully',
        data: {
          token: newToken,
          user: {
            id: updatedAdmin.id,
            username: updatedAdmin.username,
            email: updatedAdmin.email,
            role: updatedAdmin.role,
            coinBalance: parseInt(updatedAdmin.coin_balance, 10),
            photoUrl: updatedAdmin.photo_url || null,
            photo_url: updatedAdmin.photo_url || null,
            telegramId: updatedAdmin.telegram_id || null,
            telegram_id: updatedAdmin.telegram_id || null,
            createdAt: updatedAdmin.created_at,
            updatedAt: updatedAdmin.updated_at,
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin updates another user's account details (username, email, password, photo, balance)
   */
  static async updateUserAccount(req, res, next) {
    try {
      const adminId = req.user.id;
      const { userId } = req.params;
      const { username, email, password, photoUrl, photo_url, coinBalance, role, isBanned } = req.body;

      const userRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User account not found' });
      }
      const targetUser = userRes.rows[0];

      const newUsername = username !== undefined ? String(username).trim() : targetUser.username;
      const newEmail = email !== undefined ? String(email).trim().toLowerCase() : targetUser.email;
      const newPhoto = photoUrl !== undefined ? photoUrl : (photo_url !== undefined ? photo_url : targetUser.photo_url);
      const cleanPhoto = newPhoto ? String(newPhoto).trim() : null;

      if (!newUsername || newUsername.length < 3) {
        return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' });
      }

      if (newUsername.toLowerCase() !== targetUser.username.toLowerCase()) {
        const dupUser = await db.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2', [newUsername, userId]);
        if (dupUser.rows.length > 0) {
          return res.status(409).json({ success: false, error: 'Username is already taken' });
        }
      }

      if (newEmail.toLowerCase() !== targetUser.email.toLowerCase()) {
        const dupEmail = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2', [newEmail, userId]);
        if (dupEmail.rows.length > 0) {
          return res.status(409).json({ success: false, error: 'Email is already taken' });
        }
      }

      let newPasswordHash = null;
      if (password && String(password).trim().length > 0) {
        if (String(password).trim().length < 6) {
          return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
        }
        newPasswordHash = await bcrypt.hash(String(password).trim(), 10);
      }

      const updateQuery = `
        UPDATE users
        SET 
          username = $1,
          email = $2,
          photo_url = $3,
          password_hash = CASE WHEN $4::text IS NOT NULL AND $4::text <> '' THEN $4::text ELSE password_hash END,
          role = COALESCE($5, role),
          coin_balance = CASE WHEN $6::bigint IS NOT NULL THEN $6::bigint ELSE coin_balance END,
          is_banned = CASE WHEN $7::boolean IS NOT NULL THEN $7::boolean ELSE is_banned END,
          updated_at = NOW()
        WHERE id = $8
        RETURNING id, username, email, role, coin_balance, photo_url, is_banned, created_at, updated_at;
      `;

      const allowedRoles = ["player", "moderator", "finance", "admin"];
      const validatedRole = (role && allowedRoles.includes(role)) ? role : null;
      const validatedCoins = (coinBalance !== undefined && coinBalance !== null && !isNaN(coinBalance) && Number(coinBalance) >= 0) ? Number(coinBalance) : null;
      const validatedBanned = (isBanned !== undefined && isBanned !== null) ? Boolean(isBanned) : null;

      const result = await db.query(updateQuery, [
        newUsername,
        newEmail,
        cleanPhoto,
        newPasswordHash,
        validatedRole,
        validatedCoins,
        validatedBanned,
        userId
      ]);

      await AuditService.log({
        adminId,
        action: 'ADMIN_UPDATE_USER_ACCOUNT',
        targetType: 'user',
        targetId: userId,
        details: {
          targetUsername: targetUser.username,
          updatedUsername: newUsername,
          passwordReset: Boolean(newPasswordHash),
          roleChanged: validatedRole && validatedRole !== targetUser.role,
        },
        ipAddress: req.ip || null,
      });

      return res.json({
        success: true,
        message: `Account for ${newUsername} updated successfully`,
        data: result.rows[0],
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AdminController;
