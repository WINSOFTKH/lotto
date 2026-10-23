const db = require('../config/db');
const LotteryEngine = require('../services/lotteryEngine');
const WalletService = require('../services/walletService');
const BotService = require('../services/botService');
const tableSocket = require('../sockets/tableSocket');
const socketServer = require('../sockets/socketServer');

class TableController {
  /**
   * Get dynamic table settings (quick play coins & allowed entry fees)
   */
  static async getTableConfig(req, res, next) {
    try {
      const resSettings = await db.query(
        "SELECT key, value FROM system_settings WHERE key IN ('quick_play_coins', 'allowed_entry_fees', 'max_players_per_table', 'auto_rejoin_enabled', 'auto_rejoin_delay_seconds', 'bot_players_enabled', 'max_bot_players_per_table', 'bot_join_delay_seconds');"
      );
      const configMap = {};
      resSettings.rows.forEach((r) => { configMap[r.key] = r.value; });

      const quickPlayCoins = parseInt(configMap['quick_play_coins'] || '100', 10);
      const maxPlayersPerTable = parseInt(configMap['max_players_per_table'] || '10', 10);
      const allowedFeesStr = configMap['allowed_entry_fees'] || '50,100,250,500';
      const allowedEntryFees = allowedFeesStr
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);

      const autoRejoinEnabled = configMap['auto_rejoin_enabled'] !== 'false';
      const autoRejoinDelaySeconds = parseInt(configMap['auto_rejoin_delay_seconds'] || '7', 10);
      const botPlayersEnabled = configMap['bot_players_enabled'] !== 'false';
      const maxBotPlayers = parseInt(configMap['max_bot_players_per_table'] || '9', 10);
      const botJoinDelaySeconds = parseInt(configMap['bot_join_delay_seconds'] || '30', 10);

      return res.json({
        success: true,
        data: {
          quickPlayCoins,
          maxPlayersPerTable: !isNaN(maxPlayersPerTable) && maxPlayersPerTable >= 2 ? maxPlayersPerTable : 10,
          allowedEntryFees: allowedEntryFees.length > 0 ? allowedEntryFees : [50, 100, 250, 500],
          autoRejoin: {
            enabled: autoRejoinEnabled,
            delaySeconds: isNaN(autoRejoinDelaySeconds) || autoRejoinDelaySeconds < 1 ? 7 : autoRejoinDelaySeconds,
          },
          botPlayers: {
            enabled: botPlayersEnabled,
            maxBotPlayers: !isNaN(maxBotPlayers) && maxBotPlayers >= 1 ? maxBotPlayers : 9,
            joinDelaySeconds: !isNaN(botJoinDelaySeconds) && botJoinDelaySeconds >= 1 ? botJoinDelaySeconds : 30,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create a new lottery table
   */
  static async createTable(req, res, next) {
    try {
      const userId = req.user.id;
      const { name, entryFee, maxPlayers: requestedMaxPlayers } = req.body;

      const fee = parseInt(entryFee, 10);
      if (!name || isNaN(fee) || fee <= 0) {
        return res.status(400).json({ success: false, error: 'Valid table name and entry fee required' });
      }

      // Check if user is already seated in an active table (waiting or playing)
      const userActiveTableRes = await db.query(`
        SELECT tp.table_id, t.name, t.status
        FROM table_players tp
        JOIN tables t ON tp.table_id = t.id
        WHERE tp.user_id = $1
          AND t.status IN ('waiting', 'playing')
        LIMIT 1;
      `, [userId]);

      if (userActiveTableRes.rows.length > 0) {
        const activeGame = userActiveTableRes.rows[0];
        return res.status(400).json({
          success: false,
          error: `You are already participating in table "${activeGame.name}". Please finish or leave that table before creating a new one.`,
          activeTableId: activeGame.table_id,
        });
      }

      // Check max players from request body or fallback to system_settings default
      let maxPlayers = parseInt(requestedMaxPlayers, 10);
      if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 100) {
        const settingRes = await db.query("SELECT value FROM system_settings WHERE key = 'max_players_per_table';");
        maxPlayers = settingRes.rows.length > 0 ? parseInt(settingRes.rows[0].value, 10) : 10;
        if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 100) {
          maxPlayers = 10;
        }
      }

      const insertQuery = `
        INSERT INTO tables (name, entry_fee, max_players, current_players, status, created_by, host_id)
        VALUES ($1, $2, $3, 0, 'waiting', $4, $4)
        RETURNING *;
      `;
      const result = await db.query(insertQuery, [name.trim(), fee, maxPlayers, userId]);
      const table = result.rows[0];

      return res.status(201).json({
        success: true,
        message: 'Table created successfully',
        data: table,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get active and waiting tables
   */
  static async getTables(req, res, next) {
    try {
      const userId = req.user?.id;
      const { search } = req.query;
      let query = `
        SELECT 
          t.id, t.name, t.entry_fee, t.max_players, t.current_players, t.status, 
          t.total_pool, t.winner_payout, t.created_at, t.created_by,
          u.username AS creator_name,
          w.username AS winner_name,
          EXISTS (
            SELECT 1 FROM table_players tp 
            WHERE tp.table_id = t.id AND tp.user_id = $1
          ) AS is_user_seated
        FROM tables t
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN users w ON t.winner_id = w.id
        WHERE t.status IN ('waiting', 'playing')
      `;
      const params = [userId];
      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        query += ` AND (LOWER(t.name) LIKE $${params.length} OR LOWER(t.id::text) LIKE $${params.length})`;
      }
      query += `
        ORDER BY (t.status = 'waiting') DESC, t.created_at DESC
        LIMIT 50;
      `;
      const result = await db.query(query, params);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get table details by ID along with seated players
   */
  static async getTableById(req, res, next) {
    try {
      const { id } = req.params;

      const tableRes = await db.query(`
        SELECT t.*, w.username AS winner_name, w.photo_url AS winner_photo_url, h.username AS host_username, h.photo_url AS host_photo_url
        FROM tables t
        LEFT JOIN users w ON t.winner_id = w.id
        LEFT JOIN users h ON t.host_id = h.id
        WHERE t.id = $1;
      `, [id]);

      if (tableRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Table not found' });
      }

      const table = tableRes.rows[0];

      // Fetch seated players ordered by join time
      const playersRes = await db.query(`
        SELECT 
          tp.id, tp.user_id, tp.seat_number, tp.numbers, tp.matched_count, tp.joined_at,
          u.username, u.photo_url, COALESCE(u.is_bot, false) AS is_bot
        FROM table_players tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.table_id = $1
        ORDER BY tp.joined_at ASC, tp.seat_number ASC;
      `, [id]);

      const effectiveHostId = table.host_id || (playersRes.rows.length > 0 ? playersRes.rows[0].user_id : null);
      const playersWithHost = playersRes.rows.map((p, idx) => ({
        ...p,
        isBot: Boolean(p.is_bot),
        isHost: effectiveHostId ? p.user_id === effectiveHostId : idx === 0,
      }));

      // If table is waiting:
      // - If >= 2 players seated, ensure auto-start timer is scheduled
      // - If strictly 1 real player seated (< 2 real players and < 2 total players), ensure bot join timer is scheduled without resetting existing countdown
      if (table.status === 'waiting') {
        const realPlayersCount = playersRes.rows.filter((p) => !p.is_bot).length;
        if (realPlayersCount >= 2) {
          // If 2 or more real players are seated, stop bots from continuing to join!
          BotService.cancelBotTimers(id);
        } else if (realPlayersCount === 1 && playersRes.rows.length < 2) {
          await BotService.scheduleBotJoinForTable(id, { reset: false });
        }
        if (table.current_players >= 2) {
          await tableSocket.scheduleAutoStart(id);
        }
      }
      const autoStartInfo = tableSocket.getAutoStartInfo(id);
      const botJoinCountdown = BotService.getBotJoinTimerInfo(id);

      // Fetch latest draw state if table is playing or completed
      let drawState = null;
      if (table.status === 'playing' || table.status === 'completed') {
        const drawRes = await db.query(`
          SELECT drawn_numbers, current_ball, is_completed, winning_ball, started_at
          FROM table_draws
          WHERE table_id = $1
          ORDER BY started_at DESC
          LIMIT 1;
        `, [id]);
        if (drawRes.rows.length > 0) {
          drawState = drawRes.rows[0];
        }
      }

      // Fetch auto-rejoin and bot configuration from system_settings
      const autoRejoinRes = await db.query(
        "SELECT key, value FROM system_settings WHERE key IN ('auto_rejoin_enabled', 'auto_rejoin_delay_seconds', 'bot_players_enabled', 'max_bot_players_per_table', 'bot_join_delay_seconds');"
      );
      const autoRejoinMap = {};
      autoRejoinRes.rows.forEach((r) => { autoRejoinMap[r.key] = r.value; });
      const autoRejoin = {
        enabled: autoRejoinMap['auto_rejoin_enabled'] !== 'false',
        delaySeconds: parseInt(autoRejoinMap['auto_rejoin_delay_seconds'] || '7', 10) || 7,
      };
      const botPlayers = {
        enabled: autoRejoinMap['bot_players_enabled'] !== 'false',
        maxBotPlayers: parseInt(autoRejoinMap['max_bot_players_per_table'] || '9', 10) || 9,
        joinDelaySeconds: parseInt(autoRejoinMap['bot_join_delay_seconds'] || '30', 10) || 30,
      };

      return res.json({
        success: true,
        data: {
          table,
          players: playersWithHost,
          drawState,
          autoStart: autoStartInfo,
          botJoinCountdown,
          autoRejoin,
          botPlayers,
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Join a table with strict row-level locking (SELECT FOR UPDATE)
   * Prevents race conditions and guarantees strictly max 10 players
   */
  static async joinTable(req, res, next) {
    try {
      const userId = req.user.id;
      const { id: tableId } = req.params;

      const result = await db.withTransaction(async (client) => {
        // 1. Lock table row
        const tableRes = await client.query(
          'SELECT * FROM tables WHERE id = $1 FOR UPDATE;',
          [tableId]
        );

        if (tableRes.rows.length === 0) {
          const err = new Error('Table not found');
          err.statusCode = 404;
          throw err;
        }

        const table = tableRes.rows[0];
        let isResettingFromCompleted = false;

        // If table was completed, reset table for next round, keeping host_id!
        if (table.status === 'completed') {
          // Immediately stop any lingering timers from the old completed game session
          tableSocket.clearActiveGameTimer(tableId);

          await client.query('DELETE FROM table_players WHERE table_id = $1;', [tableId]);

          const preservedHostId = table.host_id || userId;
          await client.query(`
            UPDATE tables
            SET status = 'waiting',
                current_players = 0,
                winner_id = NULL,
                total_pool = 0,
                platform_fee = 0,
                winner_payout = 0,
                host_id = $1,
                updated_at = NOW()
            WHERE id = $2;
          `, [preservedHostId, tableId]);

          table.status = 'waiting';
          table.current_players = 0;
          table.host_id = preservedHostId;
          isResettingFromCompleted = true;
        } else if (table.status !== 'waiting') {
          const err = new Error(`Cannot join: Table is currently ${table.status}`);
          err.statusCode = 400;
          throw err;
        }

        const maxAllowed = table.max_players || 10;
        if (table.current_players >= maxAllowed) {
          const err = new Error(`Table is already full (${maxAllowed}/${maxAllowed} players)`);
          err.statusCode = 400;
          throw err;
        }

        // If table has no host_id, set to first joiner
        if (!table.host_id) {
          await client.query('UPDATE tables SET host_id = $1 WHERE id = $2;', [userId, tableId]);
          table.host_id = userId;
        }

        // Lock user row to serialize concurrent joins and prevent race conditions
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE;', [userId]);

        // 2. Check if user already joined this active round
        const alreadyJoined = await client.query(
          'SELECT id, seat_number, numbers FROM table_players WHERE table_id = $1 AND user_id = $2;',
          [tableId, userId]
        );

        if (alreadyJoined.rows.length > 0) {
          return {
            alreadyJoined: true,
            player: alreadyJoined.rows[0],
            table,
            isFull: false,
            newBalance: undefined,
            realPlayersCount: table.current_players,
          };
        }

        // Check if user is already participating in ANOTHER active table (waiting or playing)
        const activeTableRes = await client.query(`
          SELECT tp.table_id, t.name, t.status
          FROM table_players tp
          JOIN tables t ON tp.table_id = t.id
          WHERE tp.user_id = $1
            AND tp.table_id != $2
            AND t.status IN ('waiting', 'playing')
          LIMIT 1;
        `, [userId, tableId]);

        if (activeTableRes.rows.length > 0) {
          const activeTable = activeTableRes.rows[0];
          const err = new Error(
            `You are already participating in table "${activeTable.name}". Please finish or leave that table before joining another.`
          );
          err.statusCode = 400;
          err.activeTableId = activeTable.table_id;
          throw err;
        }

        // 3. Atomically check and debit user's entry fee
        const debitRes = await WalletService.debitCoins(
          userId,
          table.entry_fee,
          'table_entry',
          table.id,
          `Entry Fee for Table: ${table.name}`,
          client
        );

        // 4. Retrieve existing players to calculate next seat and ensure distinct ticket
        const existingPlayersRes = await client.query(
          `SELECT tp.seat_number, tp.numbers, COALESCE(u.is_bot, false) AS is_bot
           FROM table_players tp
           JOIN users u ON tp.user_id = u.id
           WHERE tp.table_id = $1;`,
          [tableId]
        );

        const realPlayersCount = existingPlayersRes.rows.filter(r => !r.is_bot).length + 1;

        const takenSeats = new Set(existingPlayersRes.rows.map(r => r.seat_number));
        let nextSeat = 1;
        while (takenSeats.has(nextSeat) && nextSeat <= maxAllowed) {
          nextSeat++;
        }

        // Collect all lucky numbers and tickets already assigned to other players at this table
        const takenNumbers = new Set(
          existingPlayersRes.rows.flatMap(r => (Array.isArray(r.numbers) ? r.numbers : []))
        );
        const existingTickets = existingPlayersRes.rows.map(r => r.numbers);

        // Generate 5 cryptographically distinct numbers (1-99), distinct from all existing players' lucky numbers
        // Ensuring each pair of players has different lucky numbers (mutually exclusive across up to 10 players)
        const ticket = LotteryEngine.generateTicket(takenNumbers, existingTickets);

        // 5. Insert player into table_players
        const insertPlayerQuery = `
          INSERT INTO table_players (table_id, user_id, seat_number, numbers)
          VALUES ($1, $2, $3, $4)
          RETURNING *;
        `;
        const newPlayerRes = await client.query(insertPlayerQuery, [
          tableId,
          userId,
          nextSeat,
          ticket
        ]);
        const seatedPlayer = newPlayerRes.rows[0];

        // 6. Increment player count
        const newCount = table.current_players + 1;
        let isFull = newCount >= maxAllowed;
        let newStatus = isFull ? 'playing' : 'waiting';

        await client.query(`
          UPDATE tables 
          SET current_players = $1, status = $2, updated_at = NOW()
          WHERE id = $3;
        `, [newCount, newStatus, tableId]);

        // If table is full, initialize table_draws row
        let drawId = null;
        if (isFull) {
          const drawRes = await client.query(`
            INSERT INTO table_draws (table_id, drawn_numbers, is_completed)
            VALUES ($1, '{}', false)
            RETURNING id;
          `, [tableId]);
          drawId = drawRes.rows[0].id;
        }

        return {
          table: { ...table, current_players: newCount, status: newStatus },
          player: seatedPlayer,
          isFull,
          drawId,
          isResettingFromCompleted,
          newBalance: debitRes.newBalance,
          entryFee: table.entry_fee,
          realPlayersCount,
        };
      });

      // Emit real-time balance update to the joining player's private socket
      socketServer.emitToUser(userId, 'wallet:updated', {
        balance: result.newBalance,
        coinsDebited: result.entryFee,
      });

      // 7. Real-time Socket.io Notifications
      if (result.isResettingFromCompleted) {
        tableSocket.clearActiveGameTimer(tableId);
        tableSocket.broadcastRoundReset(tableId, {
          tableId,
          hostId: result.table.host_id,
          resetByUserId: userId,
        });
      }

      // If user is already seated in this table, return immediately without re-charging or re-announcing
      if (result.alreadyJoined) {
        return res.json({
          success: true,
          message: 'Already seated at this table',
          data: {
            tableId,
            seatNumber: result.player.seat_number,
            numbers: result.player.numbers,
            currentPlayers: result.table.current_players,
            status: result.table.status,
            hostId: result.table.host_id,
            alreadyJoined: true,
          },
        });
      }

      // Broadcast player joined to all room participants
      tableSocket.broadcastPlayerJoined(tableId, {
        userId,
        username: req.user.username,
        photo_url: req.user.photo_url || null,
        photoUrl: req.user.photo_url || null,
        isBot: false,
        seatNumber: result.player.seat_number,
        numbers: result.player.numbers,
        currentPlayers: result.table.current_players,
        hostId: result.table.host_id,
      });

      // If full (max_players), cancel countdown and kick off drawing sequence immediately!
      if (result.isFull) {
        BotService.cancelBotTimers(tableId);
        tableSocket.cancelAutoStart(tableId);
        tableSocket.triggerGameStart(tableId);
      } else if (result.table.status === 'waiting') {
        if (result.realPlayersCount >= 2) {
          // 2 or more real human players are now seated; stop scheduling bots
          BotService.cancelBotTimers(tableId);
        } else if (result.realPlayersCount === 1) {
          // Fewer than 2 real players (1 real player seated): schedule bot player(s) to join seats after configured delay!
          await BotService.scheduleBotJoinForTable(tableId, { reset: true });
        }

        if (result.table.current_players >= 2) {
          // Automatically start game after configured seconds if at least 2 players are seated.
          // Reset countdown timer whenever a new real player joins a seat
          await tableSocket.resetAutoStart(tableId, null, {
            newPlayerUsername: req.user.username,
          });
        }
      }

      return res.json({
        success: true,
        message: 'Successfully joined table!',
        data: {
          tableId,
          seatNumber: result.player.seat_number,
          numbers: result.player.numbers,
          currentPlayers: result.table.current_players,
          status: result.table.status,
          hostId: result.table.host_id,
          gameStarting: result.isFull,
          newBalance: result.newBalance,
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Quick Play / Auto-Matchmaking: Find an available table with the chosen fee or create one
   */
  static async quickPlay(req, res, next) {
    try {
      const userId = req.user.id;

      // 0. Check if user is already seated in an active table (waiting or playing)
      const userActiveTableRes = await db.query(`
        SELECT tp.table_id, t.name, t.status
        FROM table_players tp
        JOIN tables t ON tp.table_id = t.id
        WHERE tp.user_id = $1
          AND t.status IN ('waiting', 'playing')
        LIMIT 1;
      `, [userId]);

      if (userActiveTableRes.rows.length > 0) {
        const activeGame = userActiveTableRes.rows[0];
        return res.json({
          success: true,
          message: `Reconnected to your active game at table "${activeGame.name}"`,
          data: {
            tableId: activeGame.table_id,
            reconnected: true,
          },
        });
      }

      let fee = parseInt(req.body.entryFee, 10);
      if (isNaN(fee) || fee <= 0) {
        const qpRes = await db.query("SELECT value FROM system_settings WHERE key = 'quick_play_coins';");
        fee = qpRes.rows.length > 0 ? parseInt(qpRes.rows[0].value, 10) : 100;
      }

      // 1. Find waiting table with this entry fee where user is NOT already a player
      const findQuery = `
        SELECT t.id 
        FROM tables t
        WHERE t.status = 'waiting' 
          AND t.entry_fee = $1 
          AND t.current_players < t.max_players
          AND NOT EXISTS (
            SELECT 1 FROM table_players tp WHERE tp.table_id = t.id AND tp.user_id = $2
          )
        ORDER BY t.current_players DESC, t.created_at ASC
        LIMIT 1;
      `;
      const matchRes = await db.query(findQuery, [fee, userId]);

      let targetTableId;
      if (matchRes.rows.length > 0) {
        targetTableId = matchRes.rows[0].id;
      } else {
        // Query default max_players from system_settings
        const settingRes = await db.query("SELECT value FROM system_settings WHERE key = 'max_players_per_table';");
        let maxPlayers = settingRes.rows.length > 0 ? parseInt(settingRes.rows[0].value, 10) : 10;
        if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 100) {
          maxPlayers = 10;
        }

        // Create an auto-matched table
        const createRes = await db.query(`
          INSERT INTO tables (name, entry_fee, max_players, current_players, status, created_by)
          VALUES ($1, $2, $3, 0, 'waiting', $4)
          RETURNING id;
        `, [`Lotto Arena #${Math.floor(1000 + Math.random() * 9000)}`, fee, maxPlayers, userId]);
        targetTableId = createRes.rows[0].id;
      }

      // Delegate to joinTable
      req.params = { id: targetTableId };
      return TableController.joinTable(req, res, next);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Start game when at least 2 players have joined the table
   */
  static async startGame(req, res, next) {
    try {
      const userId = req.user.id;
      const { id: tableId } = req.params;

      BotService.cancelBotTimers(tableId);

      const result = await db.withTransaction(async (client) => {
        // 1. Lock table row
        const tableRes = await client.query(
          'SELECT * FROM tables WHERE id = $1 FOR UPDATE;',
          [tableId]
        );

        if (tableRes.rows.length === 0) {
          const err = new Error('Table not found');
          err.statusCode = 404;
          throw err;
        }

        const table = tableRes.rows[0];

        if (table.status !== 'waiting') {
          const err = new Error(`Table is already ${table.status}`);
          err.statusCode = 400;
          throw err;
        }

        // 2. Verify that caller is the Host Player or an Admin
        const effectiveHostId = table.host_id || (
          (await client.query('SELECT user_id FROM table_players WHERE table_id = $1 ORDER BY joined_at ASC, seat_number ASC LIMIT 1;', [tableId])).rows[0]?.user_id
        );

        const isHost = (effectiveHostId && userId === effectiveHostId) || req.user.role === 'admin';
        if (!isHost) {
          const err = new Error('Only the table host can start the game');
          err.statusCode = 403;
          throw err;
        }

        const seatedRes = await client.query('SELECT id FROM table_players WHERE table_id = $1 AND user_id = $2;', [tableId, userId]);
        if (seatedRes.rows.length === 0 && req.user.role !== 'admin') {
          const err = new Error('You must be seated at the table to start the game');
          err.statusCode = 400;
          throw err;
        }

        // If fewer than 2 players are seated, try seating configured bot player(s) immediately
        let addedBots = [];
        if (table.current_players < 2) {
          addedBots = await BotService.seatBotsImmediatelyInTransaction(client, table);
        }

        if (table.current_players < 2) {
          const err = new Error(`At least 2 players are required to start the game (currently ${table.current_players})`);
          err.statusCode = 400;
          throw err;
        }

        // 3. Set status to playing
        await client.query(
          "UPDATE tables SET status = 'playing', updated_at = NOW() WHERE id = $1;",
          [tableId]
        );

        // 4. Initialize table_draws row
        const drawRes = await client.query(
          "INSERT INTO table_draws (table_id, drawn_numbers, is_completed) VALUES ($1, '{}', false) RETURNING id;",
          [tableId]
        );

        return {
          table: { ...table, status: 'playing' },
          drawId: drawRes.rows[0].id,
          playerCount: table.current_players,
          addedBots,
        };
      });

      // Broadcast any bots that were immediately seated on start
      if (result.addedBots && result.addedBots.length > 0) {
        for (const b of result.addedBots) {
          tableSocket.broadcastPlayerJoined(tableId, {
            userId: b.user_id,
            username: b.username,
            photo_url: b.photo_url,
            photoUrl: b.photo_url,
            isBot: true,
            seatNumber: b.seat_number,
            numbers: b.numbers,
            currentPlayers: result.playerCount,
            hostId: result.table.host_id,
          });
        }
      }

      // 5. Trigger the real-time drawing sequence
      tableSocket.cancelAutoStart(tableId);
      tableSocket.triggerGameStart(tableId);

      return res.json({
        success: true,
        message: `Game started with ${result.playerCount} players!`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Leave table before game starts (Instant full coin refund)
   */
  static async leaveTable(req, res, next) {
    try {
      const userId = req.user.id;
      const { id: tableId } = req.params;

      const result = await db.withTransaction(async (client) => {
        // 1. Lock table row
        const tableRes = await client.query(
          'SELECT * FROM tables WHERE id = $1 FOR UPDATE;',
          [tableId]
        );
        if (tableRes.rows.length === 0) {
          const err = new Error('Table not found');
          err.statusCode = 404;
          throw err;
        }
        const table = tableRes.rows[0];

        let refundedCoins = 0;
        let newBalance = null;
        let leftSeatNumber = null;
        let removedBots = [];

        if (table.status === 'waiting') {
          // 2. Lock and find seated player
          const playerRes = await client.query(
            'SELECT * FROM table_players WHERE table_id = $1 AND user_id = $2 FOR UPDATE;',
            [tableId, userId]
          );
          if (playerRes.rows.length > 0) {
            const seatedPlayer = playerRes.rows[0];
            leftSeatNumber = seatedPlayer.seat_number;

            // 3. Delete player from table_players
            await client.query(
              'DELETE FROM table_players WHERE id = $1;',
              [seatedPlayer.id]
            );

            // 4. Decrement current_players count
            const newCount = Math.max(0, table.current_players - 1);
            await client.query(
              'UPDATE tables SET current_players = $1, updated_at = NOW() WHERE id = $2;',
              [newCount, tableId]
            );
            table.current_players = newCount;

            // 5. Atomically refund entry fee coins back to user wallet
            const entryFee = parseInt(table.entry_fee, 10) || 0;
            if (entryFee > 0) {
              const refundRes = await WalletService.creditCoins(
                userId,
                entryFee,
                'table_refund',
                tableId,
                `Refund for leaving table: ${table.name}`,
                client
              );
              refundedCoins = entryFee;
              newBalance = refundRes.newBalance;
            }
          }
        } else if (table.status === 'completed') {
          // Player leaving completed room before next round starts
          const playerRes = await client.query(
            'SELECT * FROM table_players WHERE table_id = $1 AND user_id = $2 FOR UPDATE;',
            [tableId, userId]
          );
          if (playerRes.rows.length > 0) {
            leftSeatNumber = playerRes.rows[0].seat_number;
            await client.query('DELETE FROM table_players WHERE id = $1;', [playerRes.rows[0].id]);
            const newCount = Math.max(0, table.current_players - 1);
            await client.query(
              'UPDATE tables SET current_players = $1, updated_at = NOW() WHERE id = $2;',
              [newCount, tableId]
            );
            table.current_players = newCount;
          }
        } else {
          // If the player is a spectator or already unseated, allow smooth exit
          const playerRes = await client.query(
            'SELECT * FROM table_players WHERE table_id = $1 AND user_id = $2;',
            [tableId, userId]
          );
          if (playerRes.rows.length === 0) {
            return {
              tableId,
              newCount: table.current_players,
              refundedCoins: 0,
              newBalance: null,
              newHost: null,
              leftUserId: userId,
              leftUsername: req.user.username,
              leftSeatNumber: null,
              removedBots: [],
              remainingRealPlayers: 1,
            };
          }
          const err = new Error('Cannot exit table while game is in progress');
          err.statusCode = 400;
          throw err;
        }

        // Check how many real (non-bot) players remain at this table
        const remainingRes = await client.query(
          `SELECT tp.id, tp.user_id, tp.seat_number, u.username, COALESCE(u.is_bot, false) AS is_bot
           FROM table_players tp
           JOIN users u ON tp.user_id = u.id
           WHERE tp.table_id = $1;`,
          [tableId]
        );
        const remainingReal = remainingRes.rows.filter((r) => !r.is_bot);
        const remainingBots = remainingRes.rows.filter((r) => r.is_bot);

        // If 0 real players remain on the table, remove all bots as well so bots never sit or play alone!
        if (remainingReal.length === 0 && remainingBots.length > 0) {
          removedBots = remainingBots;
          await client.query('DELETE FROM table_players WHERE table_id = $1;', [tableId]);
          await client.query(
            `UPDATE tables
             SET current_players = 0,
                 host_id = NULL,
                 status = 'waiting',
                 winner_id = NULL,
                 total_pool = 0,
                 platform_fee = 0,
                 winner_payout = 0,
                 updated_at = NOW()
             WHERE id = $1;`,
            [tableId]
          );
          table.current_players = 0;
          table.host_id = null;
        }

        // 6. Host transfer logic: if the departing user was the host, reassign host_id to next real player
        let newHost = null;
        if (table.host_id === userId) {
          const nextPlayerRes = await client.query(
            `SELECT tp.user_id, u.username 
             FROM table_players tp 
             JOIN users u ON tp.user_id = u.id 
             WHERE tp.table_id = $1 AND tp.user_id != $2 AND COALESCE(u.is_bot, false) = false
             ORDER BY tp.joined_at ASC, tp.seat_number ASC 
             LIMIT 1;`,
            [tableId, userId]
          );

          if (nextPlayerRes.rows.length > 0) {
            newHost = nextPlayerRes.rows[0];
            await client.query(
              'UPDATE tables SET host_id = $1, updated_at = NOW() WHERE id = $2;',
              [newHost.user_id, tableId]
            );
          } else {
            await client.query(
              'UPDATE tables SET host_id = NULL, updated_at = NOW() WHERE id = $1;',
              [tableId]
            );
          }
        } else if (table.host_id) {
          const hostUserRes = await client.query(
            'SELECT id, username FROM users WHERE id = $1;',
            [table.host_id]
          );
          if (hostUserRes.rows.length > 0) {
            newHost = { user_id: hostUserRes.rows[0].id, username: hostUserRes.rows[0].username };
          }
        }

        return {
          tableId,
          newCount: table.current_players,
          refundedCoins,
          newBalance,
          newHost,
          leftUserId: userId,
          leftUsername: req.user.username,
          leftSeatNumber,
          removedBots,
          remainingRealPlayers: remainingReal.length,
        };
      });

      // If no real players remain, cancel any pending bot timers
      if (result.remainingRealPlayers === 0) {
        BotService.cancelBotTimers(tableId);
      } else if (result.remainingRealPlayers === 1) {
        // If 2 real players dropped down to 1 real player, schedule bots if needed
        await BotService.scheduleBotJoinForTable(tableId, { reset: true });
      }

      // 7. Real-time broadcast that player left
      tableSocket.broadcastPlayerLeft(tableId, {
        userId,
        username: req.user.username,
        seatNumber: result.leftSeatNumber,
        currentPlayers: result.newCount,
        newHostId: result.newHost ? result.newHost.user_id : null,
        newHostUsername: result.newHost ? result.newHost.username : null,
        newHost: result.newHost,
      });

      // Also broadcast any bots that were cleared when the last real player left
      if (result.removedBots && result.removedBots.length > 0) {
        for (const b of result.removedBots) {
          tableSocket.broadcastPlayerLeft(tableId, {
            userId: b.user_id,
            username: b.username,
            seatNumber: b.seat_number,
            currentPlayers: 0,
            newHostId: null,
            newHostUsername: null,
            newHost: null,
          });
        }
      }

      // 8. If remaining players drop below 2, cancel any pending auto-start countdown
      if (result.newCount < 2) {
        tableSocket.cancelAutoStart(tableId);
      }

      // 9. Real-time private wallet update to the departing player
      if (result.newBalance !== null) {
        socketServer.emitToUser(userId, 'wallet:updated', {
          balance: result.newBalance,
          coinsRefunded: result.refundedCoins,
        });
      }

      return res.json({
        success: true,
        message: `Successfully exited table. ${result.refundedCoins} coins refunded to your wallet.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete an empty table
   * Can only be deleted by the table creator or an admin, and ONLY if current_players === 0
   */
  static async deleteTable(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { id: tableId } = req.params;

      const result = await db.withTransaction(async (client) => {
        // 1. Lock table row
        const tableRes = await client.query(
          'SELECT * FROM tables WHERE id = $1 FOR UPDATE;',
          [tableId]
        );

        if (tableRes.rows.length === 0) {
          const err = new Error('Table not found');
          err.statusCode = 404;
          throw err;
        }

        const table = tableRes.rows[0];

        // 2. Check authorization: must be creator or admin
        const isCreator = table.created_by === userId;
        const isAdmin = userRole === 'admin';

        if (!isCreator && !isAdmin) {
          const err = new Error('Forbidden: Only the table creator or an admin can delete this table');
          err.statusCode = 403;
          throw err;
        }

        // 3. Condition: must have strictly 0 players
        if (table.current_players > 0) {
          const err = new Error(`Cannot delete table: Table currently has ${table.current_players} player(s) seated`);
          err.statusCode = 400;
          throw err;
        }

        // 4. Must not be currently playing
        if (table.status === 'playing') {
          const err = new Error('Cannot delete an active game in progress');
          err.statusCode = 400;
          throw err;
        }

        // 5. Delete table
        await client.query('DELETE FROM tables WHERE id = $1;', [tableId]);

        return { id: tableId, name: table.name };
      });

      tableSocket.cancelAutoStart(tableId);

      return res.json({
        success: true,
        message: `Table '${result.name}' successfully deleted.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = TableController;
