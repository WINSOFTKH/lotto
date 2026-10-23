const crypto = require('crypto');
const db = require('../config/db');
const LotteryEngine = require('./lotteryEngine');
const socketServer = require('../sockets/socketServer');

// Active bot join timers per tableId: tableId -> { timeoutId, endsAt, tableId, isFollowUp }
const botJoinTimers = new Map();
// Random target bot count per table round: tableId -> number (1..maxBotPlayers)
const tableTargetBotCounts = new Map();
// 5-second interval between each bot joining one by one
const BOT_JOIN_INTERVAL_MS = 5000;

// Predefined realistic Cambodian bot player profiles (200 players)
const BOT_PROFILES = [
  // 1-50: Popular Cambodian Full Names (Surname + Given Name)
  'Sokha_Chantha', 'Dara_Visal', 'Pisey_Sreypov', 'Rithy_Makara', 'Sopheak_Sovann',
  'Bunroeun_Kosal', 'Chenda_Rothana', 'Malis_Bopha', 'Vicheka_Samnang', 'Khemara_Panha',
  'Leakhena_Nary', 'Theara_Piseth', 'Sreyneang_Pich', 'Vannak_Ratanak', 'Sovannarith_Kiri',
  'Virak_Boran', 'Kunthea_Socheata', 'Mengly_Chhaya', 'Sreymom_Davy', 'Phearith_Vibol',
  'Sothea_Chanthou', 'Romdoul_Phalla', 'Vichet_Narith', 'Daneth_Kalyan', 'Reasmey_Thida',
  'Sreynich_Vathana', 'Heng_Sokha', 'Chan_Dara', 'Chea_Visal', 'Lim_Pisey',
  'Keo_Rithy', 'Meas_Makara', 'Seng_Sopheak', 'Ouk_Bunroeun', 'Pich_Chenda',
  'Long_Malis', 'Tep_Vicheka', 'Sar_Khemara', 'Chhay_Leakhena', 'Bun_Theara',
  'Sun_Sreyneang', 'Ly_Vannak', 'Ung_Sovannarith', 'Vong_Virak', 'Kim_Kunthea',
  'San_Mengly', 'Yin_Sreymom', 'Mao_Phearith', 'Khun_Sothea', 'Prak_Romdoul',

  // 51-100: Classical & Modern Khmer Name Pairings
  'Tuy_Vichet', 'Chhin_Daneth', 'Huy_Reasmey', 'Mom_Sreynich', 'Pen_Davy',
  'Suos_Chanthou', 'Yim_Phalla', 'Sok_Bopha', 'Chan_Kosal', 'Chea_Rothana',
  'Heng_Samnang', 'Lim_Panha', 'Keo_Nary', 'Meas_Piseth', 'Seng_Pich',
  'Ouk_Ratanak', 'Pich_Kiri', 'Long_Boran', 'Tep_Socheata', 'Sar_Chhaya',
  'Chhay_Vibol', 'Bun_Narith', 'Sun_Kalyan', 'Ly_Thida', 'Ung_Vathana',
  'Vong_Sreypov', 'Kim_Makara', 'San_Visal', 'Yin_Dara', 'Mao_Sokha',
  'Khun_Pisey', 'Prak_Rithy', 'Tuy_Sopheak', 'Chhin_Bunroeun', 'Huy_Chenda',
  'Mom_Malis', 'Pen_Vicheka', 'Suos_Khemara', 'Yim_Leakhena', 'Sok_Theara',
  'Chan_Sreyneang', 'Chea_Vannak', 'Heng_Sovannarith', 'Lim_Virak', 'Keo_Kunthea',
  'Meas_Mengly', 'Seng_Sreymom', 'Ouk_Phearith', 'Pich_Sothea', 'Long_Romdoul',

  // 101-150: Common Everyday Cambodian Usernames with Lucky Digits & Locations
  'Tep_Vichet', 'Sar_Daneth', 'Chhay_Reasmey', 'Bun_Sreynich', 'Sun_Bopha',
  'Ly_Kosal', 'Ung_Rothana', 'Vong_Samnang', 'Kim_Panha', 'San_Nary',
  'Yin_Piseth', 'Mao_Pich', 'Khun_Ratanak', 'Prak_Kiri', 'Tuy_Boran',
  'Chhin_Socheata', 'Huy_Chhaya', 'Mom_Vibol', 'Pen_Narith', 'Suos_Kalyan',
  'Yim_Thida', 'Dara_168', 'Sokha_PP', 'Pisey_SR', 'Rithy_88',
  'Makara_777', 'Sopheak_168', 'Bunroeun_BTB', 'Chenda_99', 'Malis_Angkor',
  'Vicheka_888', 'Khemara_168', 'Leakhena_KH', 'Theara_777', 'Sreyneang_99',
  'Vannak_168', 'Sovannarith_SR', 'Virak_88', 'Kunthea_PP', 'Mengly_168',
  'Sreymom_KH', 'Phearith_777', 'Sothea_99', 'Romdoul_SR', 'Vichet_168',
  'Daneth_PP', 'Reasmey_88', 'Sreynich_KH', 'Bopha_168', 'Kosal_777',

  // 151-200: Elegant Cambodian Names & Popular User Profiles
  'Rothana_99', 'Samnang_168', 'Panha_SR', 'Nary_88', 'Piseth_PP',
  'Pich_168', 'Ratanak_777', 'Kiri_99', 'Boran_SR', 'Socheata_168',
  'Chhaya_PP', 'Vibol_88', 'Narith_777', 'Kalyan_99', 'Thida_168',
  'Vathana_SR', 'Sreypov_88', 'Heng_Heang168', 'Chan_Channa', 'Chea_Chamroeun',
  'Lim_Ravy', 'Keo_Kompheak', 'Meas_Maneth', 'Seng_Vanny', 'Ouk_Sovannara',
  'Pich_Sokunthea', 'Long_Chandara', 'Tep_Phanith', 'Sar_Ratana', 'Chhay_Tola',
  'Bun_Chhay', 'Sun_Dalis', 'Ly_Sinat', 'Ung_Sreyleak', 'Vong_Vathanak',
  'Kim_Borey', 'San_Kanha', 'Yin_Sokhom', 'Mao_Sambo', 'Khun_Chanthea',
  'Prak_Somaly', 'Tuy_Vireak', 'Chhin_Monineath', 'Huy_Rathana', 'Mom_Dalin',
  'Pen_Sreylin', 'Suos_Phearun', 'Yim_Bunnath', 'Sok_Voleak', 'Chan_Sovanratana'
].map((username) => ({
  username,
  email: `${username.toLowerCase().replace(/[^a-z0-9_]/g, '')}@kh-lotto.bot`,
}));

let schemaInitialized = false;

class BotService {
  /**
   * Ensure is_bot column and bot user pool exist in database (200 Cambodian bot players)
   */
  static async ensureBotPool(minRequired = 200) {
    try {
      if (!schemaInitialized) {
        await db.query(`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;
        `);
        await db.query(`
          INSERT INTO system_settings (key, value, description)
          VALUES
            ('bot_players_enabled', 'true', 'Enable or disable automatic bot players joining tables when fewer than 2 real players are seated'),
            ('max_bot_players_per_table', '9', 'Maximum number of bot players (bots join randomly from 1 up to this max) on a table with fewer than 2 real players'),
            ('bot_join_delay_seconds', '30', 'Wait time in seconds before bot players automatically join seats when a table has fewer than 2 real players')
          ON CONFLICT (key) DO NOTHING;
        `);
        schemaInitialized = true;
      }

      // Seed 200 realistic Cambodian bot profiles
      for (const profile of BOT_PROFILES) {
        await db.query(
          `INSERT INTO users (username, email, password_hash, role, coin_balance, is_bot)
           VALUES ($1, $2, 'BOT_ACCOUNT_NO_LOGIN', 'player', 100000, true)
           ON CONFLICT (username) DO UPDATE SET is_bot = true;`,
          [profile.username, profile.email]
        );
      }
    } catch (err) {
      console.error('[BotService] Error ensuring bot pool:', err);
    }
  }

  /**
   * Read bot player settings from system_settings
   */
  static async getBotConfig() {
    try {
      const res = await db.query(`
        SELECT key, value FROM system_settings
        WHERE key IN ('bot_players_enabled', 'max_bot_players_per_table', 'bot_join_delay_seconds');
      `);
      const map = {};
      res.rows.forEach((r) => {
        map[r.key] = r.value;
      });

      const enabled = map['bot_players_enabled'] !== 'false';
      const parsedMax = parseInt(map['max_bot_players_per_table'] || '9', 10);
      const maxBotPlayers = !isNaN(parsedMax) && parsedMax >= 1 ? Math.min(99, parsedMax) : 9;
      const parsedDelay = parseInt(map['bot_join_delay_seconds'] || '30', 10);
      const joinDelaySeconds = !isNaN(parsedDelay) && parsedDelay >= 1 ? Math.min(600, parsedDelay) : 30;

      return {
        enabled,
        maxBotPlayers,
        joinDelaySeconds,
      };
    } catch (err) {
      console.warn('[BotService] Error reading bot config, using defaults:', err);
      return {
        enabled: true,
        maxBotPlayers: 9,
        joinDelaySeconds: 30,
      };
    }
  }

  /**
   * Pick a uniform random integer count of bots between 1 and maxPossible (inclusive)
   */
  static pickRandomBotCount(maxPossible) {
    const cap = Math.max(1, Math.floor(maxPossible));
    if (cap <= 1) return 1;
    return crypto.randomInt(1, cap + 1);
  }

  /**
   * Get current bot join countdown state for a table
   */
  static getBotJoinTimerInfo(tableId) {
    if (!tableId || !botJoinTimers.has(tableId)) {
      return { isWaitingForBots: false, secondsLeft: 0, endsAt: null };
    }
    const info = botJoinTimers.get(tableId);
    if (info.isFollowUp) {
      return { isWaitingForBots: false, secondsLeft: 0, endsAt: null };
    }
    const secondsLeft = Math.max(0, Math.round((info.endsAt - Date.now()) / 1000));
    return {
      isWaitingForBots: secondsLeft > 0,
      secondsLeft,
      endsAt: info.endsAt,
    };
  }

  /**
   * Cancel any pending scheduled bot join timer for a table
   */
  static cancelBotTimers(tableId) {
    if (!tableId) return;
    tableTargetBotCounts.delete(tableId);
    if (botJoinTimers.has(tableId)) {
      const info = botJoinTimers.get(tableId);
      clearTimeout(info.timeoutId);
      botJoinTimers.delete(tableId);

      socketServer.emitToRoom(`table:${tableId}`, 'table:bot_join_cancelled', {
        tableId,
      });
    }
  }

  /**
   * Schedule bot player(s) to join a waiting table when real players < 2 (i.e. 1 real player).
   * Initial bot waits `bot_join_delay_seconds` (default 30s) before joining seat.
   */
  static async scheduleBotJoinForTable(tableId, options = {}) {
    if (!tableId) return null;

    const opts = typeof options === 'object' && options !== null ? options : { reset: false };
    const { reset = false, isFollowUp = false, customDelayMs = null } = opts;

    try {
      const config = await BotService.getBotConfig();
      if (!config.enabled || config.maxBotPlayers < 1) {
        BotService.cancelBotTimers(tableId);
        return null;
      }

      // If an initial bot wait timer is already ticking and reset is false, keep it ticking
      if (!isFollowUp && botJoinTimers.has(tableId) && !reset) {
        return BotService.getBotJoinTimerInfo(tableId);
      }

      await BotService.ensureBotPool(Math.max(20, config.maxBotPlayers + 5));

      // Clear any previous timer for this table before scheduling
      if (botJoinTimers.has(tableId)) {
        clearTimeout(botJoinTimers.get(tableId).timeoutId);
        botJoinTimers.delete(tableId);
      }

      if (!isFollowUp && reset) {
        tableTargetBotCounts.delete(tableId);
      }

      const delayMs = customDelayMs !== null
        ? customDelayMs
        : isFollowUp
        ? BOT_JOIN_INTERVAL_MS
        : config.joinDelaySeconds * 1000;

      const endsAt = Date.now() + delayMs;
      const secondsLeft = Math.max(1, Math.round(delayMs / 1000));

      const timeoutId = setTimeout(async () => {
        botJoinTimers.delete(tableId);
        await BotService.seatOneBotAndContinue(tableId);
      }, delayMs);

      const timerInfo = {
        timeoutId,
        endsAt,
        tableId,
        isFollowUp,
      };
      botJoinTimers.set(tableId, timerInfo);

      if (!isFollowUp) {
        socketServer.emitToRoom(`table:${tableId}`, 'table:bot_join_countdown', {
          tableId,
          secondsLeft,
          endsAt,
        });
      }

      return BotService.getBotJoinTimerInfo(tableId);
    } catch (err) {
      console.error(`[BotService] Failed to schedule bot join for table ${tableId}:`, err);
      return null;
    }
  }

  /**
   * Atomically seat 1 bot player if the table is waiting and has strictly 1 real player (< 2 real players),
   * then schedule the next bot quickly if botPlayersCount < maxBotPlayers
   */
  static async seatOneBotAndContinue(tableId) {
    try {
      const config = await BotService.getBotConfig();
      if (!config.enabled || config.maxBotPlayers < 1) {
        return;
      }

      const result = await db.withTransaction(async (client) => {
        // 1. Lock table row
        const tableRes = await client.query('SELECT * FROM tables WHERE id = $1 FOR UPDATE;', [tableId]);
        if (tableRes.rows.length === 0) return { seated: false };

        const table = tableRes.rows[0];
        if (table.status !== 'waiting') {
          return { seated: false };
        }

        const maxAllowed = table.max_players || 10;

        // 2. Fetch currently seated players and their is_bot status
        const seatedRes = await client.query(`
          SELECT tp.id, tp.user_id, tp.seat_number, tp.numbers, u.username, u.is_bot
          FROM table_players tp
          JOIN users u ON tp.user_id = u.id
          WHERE tp.table_id = $1
          ORDER BY tp.seat_number ASC;
        `, [tableId]);

        const seatedPlayers = seatedRes.rows;
        const realPlayers = seatedPlayers.filter((p) => !p.is_bot);
        const botPlayers = seatedPlayers.filter((p) => p.is_bot);

        // Condition: Table must have at least 1 real player AND fewer than 2 real players (i.e. 1 real player)
        if (realPlayers.length === 0 || realPlayers.length >= 2) {
          return { seated: false };
        }

        // Check if max bots reached or table seats full
        const maxBotsAllowed = Math.min(config.maxBotPlayers, maxAllowed - realPlayers.length);
        if (maxBotsAllowed <= 0 || seatedPlayers.length >= maxAllowed) {
          tableTargetBotCounts.delete(tableId);
          return { seated: false };
        }

        // Roll a random target number of bots (1 .. maxBotsAllowed) for this table round when the first bot joins
        let targetBotsForThisRound = tableTargetBotCounts.get(tableId);
        if (!targetBotsForThisRound || botPlayers.length === 0) {
          targetBotsForThisRound = BotService.pickRandomBotCount(maxBotsAllowed);
          tableTargetBotCounts.set(tableId, targetBotsForThisRound);
        } else {
          targetBotsForThisRound = Math.min(targetBotsForThisRound, maxBotsAllowed);
        }

        if (botPlayers.length >= targetBotsForThisRound) {
          tableTargetBotCounts.delete(tableId);
          return { seated: false };
        }

        // 3. Pick a random bot user not already seated at this table
        const seatedUserIds = seatedPlayers.map((p) => p.user_id);
        const botCandidateRes = await client.query(
          `SELECT id, username, photo_url, is_bot
           FROM users
           WHERE is_bot = true
             AND NOT (id = ANY($1::uuid[]))
           ORDER BY RANDOM()
           LIMIT 1;`,
          [seatedUserIds]
        );

        let botUser = botCandidateRes.rows[0];
        if (!botUser) {
          const extraName = `LuckyBot_${Math.floor(1000 + Math.random() * 9000)}`;
          const extraRes = await client.query(
            `INSERT INTO users (username, email, password_hash, role, coin_balance, is_bot)
             VALUES ($1, $2, 'BOT_ACCOUNT_NO_LOGIN', 'player', 0, true)
             RETURNING id, username, photo_url, is_bot;`,
            [extraName, `${extraName.toLowerCase()}@kh-lotto.bot`]
          );
          botUser = extraRes.rows[0];
        }

        // 4. Find next available seat number
        const takenSeats = new Set(seatedPlayers.map((r) => r.seat_number));
        let nextSeat = 1;
        while (takenSeats.has(nextSeat) && nextSeat <= maxAllowed) {
          nextSeat++;
        }

        // 5. Generate 5 cryptographically distinct lucky numbers for the bot
        const takenNumbers = new Set(
          seatedPlayers.flatMap((r) => (Array.isArray(r.numbers) ? r.numbers : []))
        );
        const existingTickets = seatedPlayers.map((r) => r.numbers);
        const ticket = LotteryEngine.generateTicket(takenNumbers, existingTickets);

        // 6. Insert bot into table_players
        await client.query(
          `INSERT INTO table_players (table_id, user_id, seat_number, numbers)
           VALUES ($1, $2, $3, $4);`,
          [tableId, botUser.id, nextSeat, ticket]
        );

        // 7. Update table player count (and status if full)
        const newCount = seatedPlayers.length + 1;
        const isFull = newCount >= maxAllowed;
        const newStatus = isFull ? 'playing' : 'waiting';

        // Ensure host_id stays set to the real player
        const hostId = table.host_id || realPlayers[0].user_id;

        await client.query(
          `UPDATE tables
           SET current_players = $1, status = $2, host_id = $3, updated_at = NOW()
           WHERE id = $4;`,
          [newCount, newStatus, hostId, tableId]
        );

        if (isFull) {
          await client.query(
            `INSERT INTO table_draws (table_id, drawn_numbers, is_completed)
             VALUES ($1, '{}', false);`,
            [tableId]
          );
        }

        return {
          seated: true,
          botUser,
          seatNumber: nextSeat,
          numbers: ticket,
          currentPlayers: newCount,
          isFull,
          hostId,
          newBotCount: botPlayers.length + 1,
          targetBotsForThisRound,
        };
      });

      if (!result || !result.seated) {
        return;
      }

      const tableSocket = require('../sockets/tableSocket');

      // Broadcast bot joined to the room
      tableSocket.broadcastPlayerJoined(tableId, {
        userId: result.botUser.id,
        username: result.botUser.username,
        photo_url: result.botUser.photo_url || null,
        photoUrl: result.botUser.photo_url || null,
        isBot: true,
        seatNumber: result.seatNumber,
        numbers: result.numbers,
        currentPlayers: result.currentPlayers,
        hostId: result.hostId,
      });

      // Broadcast updated player count to lobby
      socketServer.emitToAll('table:updated', {
        tableId,
        status: result.isFull ? 'playing' : 'waiting',
        currentPlayers: result.currentPlayers,
      });

      console.log(
        `[BotService] 🤖 Bot ${result.botUser.username} joined seat #${result.seatNumber} on table ${tableId} (${result.newBotCount}/${result.targetBotsForThisRound} random bots, ${result.currentPlayers} players total)`
      );

      if (result.isFull) {
        BotService.cancelBotTimers(tableId);
        tableSocket.cancelAutoStart(tableId);
        tableSocket.triggerGameStart(tableId);
        return;
      }

      // Ensure auto-start countdown is running now that >= 2 players are seated.
      // Always reset countdown timer when a bot player joins table (giving other players time to see/join)
      if (result.currentPlayers >= 2) {
        await tableSocket.resetAutoStart(tableId, null, {
          newPlayerUsername: result.botUser.username,
        });
      }

      // If more bots need to join up to targetBotsForThisRound, seat the next bot after 5 seconds (one by one)
      if (result.newBotCount < result.targetBotsForThisRound) {
        await BotService.scheduleBotJoinForTable(tableId, {
          reset: false,
          isFollowUp: true,
          customDelayMs: BOT_JOIN_INTERVAL_MS,
        });
      } else {
        tableTargetBotCounts.delete(tableId);
      }
    } catch (err) {
      console.error(`[BotService] Error seating bot on table ${tableId}:`, err);
    }
  }

  /**
   * Immediately fill seats with bots inside an existing transaction (e.g. if Host clicks Start Game early when realPlayers === 1)
   */
  static async seatBotsImmediatelyInTransaction(client, table) {
    const config = await BotService.getBotConfig();
    if (!config.enabled || config.maxBotPlayers < 1) {
      return [];
    }

    await BotService.ensureBotPool(Math.max(20, config.maxBotPlayers + 5));

    const tableId = table.id;
    const maxAllowed = table.max_players || 10;

    const seatedRes = await client.query(
      `SELECT tp.id, tp.user_id, tp.seat_number, tp.numbers, u.username, u.is_bot
       FROM table_players tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.table_id = $1
       ORDER BY tp.seat_number ASC;`,
      [tableId]
    );

    const seatedPlayers = [...seatedRes.rows];
    const realPlayers = seatedPlayers.filter((p) => !p.is_bot);
    const botPlayers = seatedPlayers.filter((p) => p.is_bot);

    if (realPlayers.length === 0 || realPlayers.length >= 2) {
      return [];
    }

    const maxBotsAllowed = Math.min(config.maxBotPlayers, maxAllowed - realPlayers.length);
    const targetTotalBots = tableTargetBotCounts.get(tableId)
      ? Math.min(tableTargetBotCounts.get(tableId), maxBotsAllowed)
      : BotService.pickRandomBotCount(maxBotsAllowed);
    tableTargetBotCounts.delete(tableId);

    const maxBotsToSeat = targetTotalBots - botPlayers.length;
    if (maxBotsToSeat <= 0) {
      return [];
    }

    const addedBots = [];

    for (let i = 0; i < maxBotsToSeat; i++) {
      const seatedUserIds = seatedPlayers.map((p) => p.user_id);
      const botCandidateRes = await client.query(
        `SELECT id, username, photo_url, is_bot
         FROM users
         WHERE is_bot = true
           AND NOT (id = ANY($1::uuid[]))
         ORDER BY RANDOM()
         LIMIT 1;`,
        [seatedUserIds]
      );

      let botUser = botCandidateRes.rows[0];
      if (!botUser) break;

      const takenSeats = new Set(seatedPlayers.map((r) => r.seat_number));
      let nextSeat = 1;
      while (takenSeats.has(nextSeat) && nextSeat <= maxAllowed) {
        nextSeat++;
      }

      const takenNumbers = new Set(
        seatedPlayers.flatMap((r) => (Array.isArray(r.numbers) ? r.numbers : []))
      );
      const existingTickets = seatedPlayers.map((r) => r.numbers);
      const ticket = LotteryEngine.generateTicket(takenNumbers, existingTickets);

      await client.query(
        `INSERT INTO table_players (table_id, user_id, seat_number, numbers)
         VALUES ($1, $2, $3, $4);`,
        [tableId, botUser.id, nextSeat, ticket]
      );

      const newBotEntry = {
        user_id: botUser.id,
        username: botUser.username,
        photo_url: botUser.photo_url || null,
        seat_number: nextSeat,
        numbers: ticket,
        is_bot: true,
      };

      seatedPlayers.push(newBotEntry);
      addedBots.push(newBotEntry);
    }

    if (addedBots.length > 0) {
      await client.query(
        `UPDATE tables SET current_players = $1, updated_at = NOW() WHERE id = $2;`,
        [seatedPlayers.length, tableId]
      );
      table.current_players = seatedPlayers.length;
    }

    return addedBots;
  }

  /**
   * Check all currently waiting tables with 1 real player and dispatch bots if enabled
   */
  static async checkAllWaitingTables(resetTimers = false) {
    try {
      const config = await BotService.getBotConfig();
      if (!config.enabled) return;

      const waitingRes = await db.query(`
        SELECT id FROM tables
        WHERE status = 'waiting' AND current_players > 0;
      `);

      for (const row of waitingRes.rows) {
        await BotService.scheduleBotJoinForTable(row.id, { reset: resetTimers });
      }
    } catch (err) {
      console.error('[BotService] Error checking waiting tables:', err);
    }
  }
}

module.exports = BotService;
