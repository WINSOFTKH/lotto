const db = require('../config/db');
const LotteryEngine = require('../services/lotteryEngine');
const WalletService = require('../services/walletService');
const socketServer = require('./socketServer');

// Store active table game timers
const activeTimers = new Map();
// Store active 5-second game-start countdown timeouts
const gameStartTimers = new Map();
// Store active 30-second auto-start countdown timers
const autoStartTimers = new Map();
// Store recent in-game chat messages per table: tableId -> Array of messages (last 40)
const tableChatHistory = new Map();
// Rate limit map: userId -> lastSentTimestamp to prevent rapid 300ms clicking
const userChatRateLimit = new Map();
// Sliding window map: userId -> Array of timestamps in ms for 1-minute rate limiting
const userChatTimestamps = new Map();

// Periodic cleanup of expired player chat timestamps (every 5 minutes)
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [userId, times] of userChatTimestamps.entries()) {
    const active = times.filter((t) => t > cutoff);
    if (active.length === 0) {
      userChatTimestamps.delete(userId);
    } else {
      userChatTimestamps.set(userId, active);
    }
  }
}, 5 * 60 * 1000);

// Dynamic Chat Rate Limit Cache (messages per player per minute)
let cachedChatRateLimit = 15;
let lastChatRateLimitFetch = 0;

class TableSocketHandler {
  /**
   * Fetch configured chat messages per minute from system_settings (defaults to 15)
   */
  static async getChatRateLimitPerMinute() {
    const now = Date.now();
    if (now - lastChatRateLimitFetch < 10000) {
      return cachedChatRateLimit;
    }

    try {
      const res = await db.query("SELECT value FROM system_settings WHERE key = 'chat_messages_per_minute';");
      if (res.rows.length > 0) {
        const val = parseInt(res.rows[0].value, 10);
        if (!isNaN(val) && val > 0) {
          cachedChatRateLimit = val;
        }
      }
    } catch (err) {
      console.warn('Could not fetch chat_messages_per_minute from system_settings, using fallback 15:', err);
    }
    lastChatRateLimitFetch = now;
    return cachedChatRateLimit;
  }

  /**
   * Instantly update cached rate limit when admin saves setting
   */
  static updateCachedChatRateLimit(newLimit) {
    const val = parseInt(newLimit, 10);
    if (!isNaN(val) && val > 0) {
      cachedChatRateLimit = val;
      lastChatRateLimitFetch = Date.now();
    }
  }

  /**
   * Attach table room listeners to socket
   */
  static registerListeners(socket) {
    socket.on('table:join_room', ({ tableId }) => {
      if (!tableId) return;
      socket.join(`table:${tableId}`);
      console.log(`User ${socket.user.username} joined room table:${tableId}`);

      // Send recent chat history to the newly connected player
      const history = TableSocketHandler.getChatHistory(tableId);
      if (history.length > 0) {
        socket.emit('table:chat_history', { tableId, messages: history });
      }

      // If an auto-start countdown is active, immediately inform the client
      const autoStartInfo = TableSocketHandler.getAutoStartInfo(tableId);
      if (autoStartInfo.isCountingDown) {
        socket.emit('table:auto_start_countdown', {
          tableId,
          ...autoStartInfo,
        });
      }

      // If a bot-join countdown is active, immediately inform the client
      const BotService = require('../services/botService');
      const botTimerInfo = BotService.getBotJoinTimerInfo(tableId);
      if (botTimerInfo.isWaitingForBots) {
        socket.emit('table:bot_join_countdown', {
          tableId,
          secondsLeft: botTimerInfo.secondsLeft,
          endsAt: botTimerInfo.endsAt,
        });
      }
    });

    socket.on('table:leave_room', ({ tableId }) => {
      if (!tableId) return;
      socket.leave(`table:${tableId}`);
      console.log(`User ${socket.user.username} left room table:${tableId}`);
    });

    // In-Game Emoji & Chat Message Listener
    socket.on('table:send_chat', async ({ tableId, message = '', emoji = '', photoUrl = null } = {}) => {
      try {
        await TableSocketHandler.handleChat(socket, { tableId, message, emoji, photoUrl });
      } catch (err) {
        console.error('Error handling table:send_chat:', err);
      }
    });
  }

  /**
   * Handle incoming chat message or emoji reaction from a player
   * Enforces dynamic per-player per-minute rate limit configured by admin
   */
  static async handleChat(socket, { tableId, message = '', emoji = '', photoUrl = null }) {
    if (!tableId || !socket.user) return;

    // Verify user is a seated player (watch-only spectators are not allowed to chat or send reactions)
    const seatedRes = await db.query(
      'SELECT id FROM table_players WHERE table_id = $1 AND user_id = $2;',
      [tableId, socket.user.id]
    );
    if (seatedRes.rows.length === 0) {
      socket.emit('table:chat_rate_limited', {
        message: 'Watch-only spectators are not allowed to send chat or reactions in live game.',
      });
      return;
    }

    const cleanMessage = String(message || '').trim().slice(0, 150);
    const cleanEmoji = String(emoji || '').trim().slice(0, 20);

    if (!cleanMessage && !cleanEmoji) return;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // 1. Rate-limit check: enforce configured chat limit per player per minute
    const limitPerMinute = await TableSocketHandler.getChatRateLimitPerMinute();
    let timestamps = userChatTimestamps.get(socket.user.id) || [];
    timestamps = timestamps.filter((t) => t > oneMinuteAgo);

    if (timestamps.length >= limitPerMinute) {
      const oldestInWindow = timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + 60000 - now) / 1000));

      socket.emit('table:chat_rate_limited', {
        limit: limitPerMinute,
        retryAfterSeconds,
        message: `Chat limit reached (${limitPerMinute}/min). Please wait ${retryAfterSeconds}s before sending again.`,
      });
      return;
    }

    // 2. Anti-spam flood check: max 1 message per 300ms
    const lastSent = userChatRateLimit.get(socket.user.id) || 0;
    if (now - lastSent < 300) {
      return;
    }
    userChatRateLimit.set(socket.user.id, now);

    // Record this message in player's sliding 1-minute window
    timestamps.push(now);
    userChatTimestamps.set(socket.user.id, timestamps);

    const chatItem = {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tableId,
      userId: socket.user.id,
      username: socket.user.username,
      photoUrl: photoUrl || socket.user.photoUrl || socket.user.photo_url || null,
      message: cleanMessage,
      emoji: cleanEmoji,
      timestamp: now,
      createdAt: new Date().toISOString(),
    };

    // Store in table history (keep last 40)
    let history = tableChatHistory.get(tableId);
    if (!history) {
      history = [];
      tableChatHistory.set(tableId, history);
    }
    history.push(chatItem);
    if (history.length > 40) {
      history.shift();
    }

    // Broadcast in real-time to everyone in this table room
    socketServer.emitToRoom(`table:${tableId}`, 'table:new_chat', chatItem);
  }

  /**
   * Get recent chat messages for a table
   */
  static getChatHistory(tableId) {
    return tableChatHistory.get(tableId) || [];
  }

  /**
   * Fetch configured auto-start countdown seconds from system_settings (defaults to 30)
   */
  static async getAutoStartDurationSeconds() {
    try {
      const res = await db.query("SELECT value FROM system_settings WHERE key = 'game_auto_start_seconds';");
      if (res.rows.length > 0) {
        const val = parseInt(res.rows[0].value, 10);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch (err) {
      console.warn('Could not fetch game_auto_start_seconds from system_settings, using fallback 30s:', err);
    }
    return 30;
  }

  /**
   * Schedule automatic game start after configured seconds from system_settings
   * Only triggers when table status is 'waiting' and current_players >= 2
   * If reset=true (e.g. new player joins seat), clears existing timer and restarts countdown
   */
  static async scheduleAutoStart(tableId, customSeconds = null, options = {}) {
    if (!tableId) return null;

    const { reset = false, reason = null, newPlayerUsername = null } = options;
    const hasExistingTimer = autoStartTimers.has(tableId);

    // If an auto-start countdown is already ticking for this table
    if (hasExistingTimer) {
      if (!reset) {
        return autoStartTimers.get(tableId);
      }
      // Reset: clear existing timeout
      const existing = autoStartTimers.get(tableId);
      if (existing && existing.timeoutId) {
        clearTimeout(existing.timeoutId);
      }
      autoStartTimers.delete(tableId);
      console.log(`[AutoStart] Reset countdown for table ${tableId} (reason: ${reason || 'new player joined seat'})`);
    }

    const durationSeconds = customSeconds !== null && !isNaN(customSeconds) && customSeconds > 0
      ? customSeconds
      : await TableSocketHandler.getAutoStartDurationSeconds();

    const delayMs = durationSeconds * 1000;
    const endsAt = Date.now() + delayMs;
    const secondsLeft = durationSeconds;

    const timeoutId = setTimeout(async () => {
      autoStartTimers.delete(tableId);
      try {
        const BotService = require('../services/botService');
        BotService.cancelBotTimers(tableId);

        // Verify table is still in waiting state and has >= 2 players (with at least 1 real player)
        const tableRes = await db.query(
          "SELECT id, status, current_players, name, entry_fee, host_id FROM tables WHERE id = $1;",
          [tableId]
        );

        if (tableRes.rows.length === 0) return;
        const table = tableRes.rows[0];

        if (table.status !== 'waiting' || table.current_players < 2) {
          return;
        }

        // Verify at least 1 real human player is seated
        const realCheck = await db.query(
          `SELECT COUNT(*)::int AS real_cnt
           FROM table_players tp
           JOIN users u ON tp.user_id = u.id
           WHERE tp.table_id = $1 AND COALESCE(u.is_bot, false) = false;`,
          [tableId]
        );
        if ((realCheck.rows[0]?.real_cnt || 0) === 0) {
          await db.query('DELETE FROM table_players WHERE table_id = $1;', [tableId]);
          await db.query('UPDATE tables SET current_players = 0, host_id = NULL, updated_at = NOW() WHERE id = $1;', [tableId]);
          return;
        }

        console.log(`[AutoStart] ${durationSeconds}s countdown completed for table ${tableId} (${table.current_players} players). Starting game!`);

        // Atomically set status to playing and create table_draws row
        await db.withTransaction(async (client) => {
          await client.query(
            "UPDATE tables SET status = 'playing', updated_at = NOW() WHERE id = $1 AND status = 'waiting';",
            [tableId]
          );

          await client.query(
            "INSERT INTO table_draws (table_id, drawn_numbers, is_completed) VALUES ($1, '{}', false);",
            [tableId]
          );
        });

        // Trigger drawing sequence
        await TableSocketHandler.triggerGameStart(tableId);
      } catch (err) {
        console.error(`[AutoStart] Error executing auto-start on table ${tableId}:`, err);
      }
    }, delayMs);

    const timerInfo = { timeoutId, endsAt, tableId };
    autoStartTimers.set(tableId, timerInfo);

    // Broadcast countdown to everyone in the table room
    socketServer.emitToRoom(`table:${tableId}`, 'table:auto_start_countdown', {
      tableId,
      secondsLeft,
      endsAt,
      isReset: Boolean(reset && hasExistingTimer),
      reason: reason || (reset ? 'new_player_joined' : 'initial_countdown'),
      newPlayerUsername: newPlayerUsername || null,
    });

    return timerInfo;
  }

  /**
   * Reset automatic game start countdown when a new player joins seat
   */
  static async resetAutoStart(tableId, customSeconds = null, options = {}) {
    return TableSocketHandler.scheduleAutoStart(tableId, customSeconds, {
      reset: true,
      reason: 'new_player_joined',
      ...options,
    });
  }

  /**
   * Cancel auto start countdown (e.g. host started early, table reached 10, or players dropped below 2)
   */
  static cancelAutoStart(tableId) {
    if (!tableId) return;
    if (autoStartTimers.has(tableId)) {
      const { timeoutId } = autoStartTimers.get(tableId);
      clearTimeout(timeoutId);
      autoStartTimers.delete(tableId);

      socketServer.emitToRoom(`table:${tableId}`, 'table:auto_start_cancelled', {
        tableId,
      });
    }
  }

  /**
   * Clear any active drawing loop, game-start countdown, or auto-start timer for a table
   */
  static clearActiveGameTimer(tableId) {
    if (!tableId) return;
    if (activeTimers.has(tableId)) {
      clearInterval(activeTimers.get(tableId));
      activeTimers.delete(tableId);
    }
    if (gameStartTimers.has(tableId)) {
      clearTimeout(gameStartTimers.get(tableId));
      gameStartTimers.delete(tableId);
    }
    try {
      const BotService = require('../services/botService');
      BotService.cancelBotTimers(tableId);
    } catch (e) {
      // ignore
    }
    TableSocketHandler.cancelAutoStart(tableId);
  }

  /**
   * Get current auto start countdown state
   */
  static getAutoStartInfo(tableId) {
    if (!tableId || !autoStartTimers.has(tableId)) {
      return { isCountingDown: false, secondsLeft: 0, endsAt: null };
    }
    const info = autoStartTimers.get(tableId);
    const secondsLeft = Math.max(0, Math.round((info.endsAt - Date.now()) / 1000));
    return {
      isCountingDown: true,
      secondsLeft,
      endsAt: info.endsAt,
    };
  }

  /**
   * Broadcast player joined event to room
   */
  static broadcastPlayerJoined(tableId, data) {
    socketServer.emitToRoom(`table:${tableId}`, 'table:player_joined', data);
  }

  /**
   * Broadcast player left event to room
   */
  static broadcastPlayerLeft(tableId, data) {
    socketServer.emitToRoom(`table:${tableId}`, 'table:player_left', data);
  }

  /**
   * Broadcast table reset for next round to room
   */
  static broadcastRoundReset(tableId, data) {
    socketServer.emitToRoom(`table:${tableId}`, 'table:round_reset', data);
  }

  /**
   * Start the real-time drawing process when 10 players have seated
   */
  static async triggerGameStart(tableId) {
    try {
      const io = socketServer.getIO();

      // Fetch table and players
      const tableRes = await db.query('SELECT * FROM tables WHERE id = $1', [tableId]);
      if (tableRes.rows.length === 0) return;
      const table = tableRes.rows[0];

      const effectiveHostId = table.host_id;
      const playersRes = await db.query(`
        SELECT tp.id, tp.user_id, tp.seat_number, tp.numbers, tp.matched_count, u.username, u.photo_url, COALESCE(u.is_bot, false) AS is_bot
        FROM table_players tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.table_id = $1
        ORDER BY tp.seat_number ASC;
      `, [tableId]);

      const players = playersRes.rows.map((p, idx) => ({
        ...p,
        isBot: Boolean(p.is_bot),
        isHost: effectiveHostId ? p.user_id === effectiveHostId : idx === 0,
      }));

      // Dynamically generate draw pool: all players' lucky numbers + 20 additional random numbers from 1 to 99
      // (e.g. 2 players = 10 lucky + 20 extra = 30 numbers; 10 players = 50 lucky + 20 extra = 70 numbers)
      const drawPool = LotteryEngine.generateDrawPool(players, 20);
      const totalPoolCount = drawPool.length;

      // Notify clients that game is locked and starting with a 5-second countdown
      io.to(`table:${tableId}`).emit('table:game_start', {
        tableId,
        hostId: effectiveHostId,
        players,
        countdownSeconds: 5,
        totalPoolCount,
        message: `Game starting with ${players.length} players! Drawing from ${totalPoolCount} lucky numbers begins in 5 seconds...`,
      });

      // Clear any existing active timer or start countdown for this table
      TableSocketHandler.clearActiveGameTimer(tableId);

      // After 5 seconds, begin the ball-by-ball drawing loop
      const startTimer = setTimeout(async () => {
        gameStartTimers.delete(tableId);
        try {
          // Double-check table status is still 'playing' in the database before launching loop
          const tCheck = await db.query('SELECT status FROM tables WHERE id = $1;', [tableId]);
          if (tCheck.rows.length === 0 || tCheck.rows[0].status !== 'playing') {
            console.log(`[GameStart] Cancelled drawing loop for table ${tableId}: status is ${tCheck.rows[0]?.status}`);
            return;
          }
          TableSocketHandler.runDrawingLoop(table, players, drawPool);
        } catch (checkErr) {
          console.error(`[GameStart] Error verifying table ${tableId} status:`, checkErr);
        }
      }, 5000);

      gameStartTimers.set(tableId, startTimer);
    } catch (err) {
      console.error('Error triggering game start:', err);
    }
  }

  /**
   * Ball-by-ball extraction loop every 3 seconds until a winner matches all 5 digits.
   * Draws sequentially from a pre-generated pool of (lucky numbers + 20 extra random numbers)
   * containing all seated players' lucky numbers.
   */
  static runDrawingLoop(table, initialPlayers, precalculatedPool = null) {
    const tableId = table.id;
    const io = socketServer.getIO();
    let drawnBalls = [];
    let players = [...initialPlayers];
    let roundNumber = 0;

    // Immediately cancel any previous loop timer for this table to prevent duplicate sessions
    if (activeTimers.has(tableId)) {
      clearInterval(activeTimers.get(tableId));
      activeTimers.delete(tableId);
    }

    // Use pre-calculated pool or generate dynamically: all seated players' lucky numbers + 20 extra numbers
    const drawPool = precalculatedPool || LotteryEngine.generateDrawPool(players, 20);

    const interval = setInterval(async () => {
      try {
        // 1. Guard against stale or replaced interval timers
        if (activeTimers.get(tableId) !== interval) {
          clearInterval(interval);
          return;
        }

        // 2. Guard against table no longer being in 'playing' status (e.g. game ended, reset, or cancelled)
        const tCheck = await db.query('SELECT status, host_id FROM tables WHERE id = $1;', [tableId]);
        if (tCheck.rows.length === 0 || tCheck.rows[0].status !== 'playing') {
          console.log(`[DrawingLoop] Stopping drawing loop for table ${tableId} because status is ${tCheck.rows[0]?.status}`);
          clearInterval(interval);
          activeTimers.delete(tableId);
          return;
        }

        // 3. Guard against draw already completed in database
        const drawCheck = await db.query(
          'SELECT id FROM table_draws WHERE table_id = $1 AND is_completed = false;',
          [tableId]
        );
        if (drawCheck.rows.length === 0) {
          console.log(`[DrawingLoop] Stopping drawing loop for table ${tableId}: no uncompleted draw found in DB`);
          clearInterval(interval);
          activeTimers.delete(tableId);
          return;
        }

        roundNumber++;
        const ball = roundNumber <= drawPool.length
          ? drawPool[roundNumber - 1]
          : LotteryEngine.drawNextBall(drawnBalls);

        drawnBalls.push(ball);

        // Evaluate round against all seated players
        const evaluation = LotteryEngine.evaluateRound(players, drawnBalls);
        players = evaluation.updatedPlayers;

        // Persist draw state in PostgreSQL
        await db.query(`
          UPDATE table_draws 
          SET drawn_numbers = $1, current_ball = $2
          WHERE table_id = $3 AND is_completed = false;
        `, [drawnBalls, ball, tableId]);

        // Broadcast drawn ball to all clients in the table room
        io.to(`table:${tableId}`).emit('draw:ball', {
          tableId,
          hostId: tCheck.rows[0].host_id || table.host_id,
          ball,
          drawnBalls,
          totalPoolCount: drawPool.length,
          players,
          round: roundNumber,
          soundTrigger: 'ball_pop',
        });

        // Winning Condition Check: Exactly 1 winner whose 5-digit numbers match
        if (evaluation.winner) {
          // Stop drawing immediately!
          clearInterval(interval);
          activeTimers.delete(tableId);

          const winner = evaluation.winner;
          await TableSocketHandler.finalizeGame({
            table,
            winner,
            winningBall: ball,
            drawnBalls,
            playerCount: players.length,
          });
        }
      } catch (err) {
        console.error(`Error in table ${tableId} drawing loop:`, err);
        clearInterval(interval);
        activeTimers.delete(tableId);
      }
    }, 3000); // Draws a new ball every 3 seconds

    activeTimers.set(tableId, interval);
  }

  /**
   * Finalize game, credit 90% payout to winner, 10% platform fee, and emit celebration events
   */
  static async finalizeGame({ table, winner, winningBall, drawnBalls, playerCount }) {
    const tableId = table.id;
    const io = socketServer.getIO();

    // Stop and clear any active game loop or timers for this table immediately
    TableSocketHandler.clearActiveGameTimer(tableId);

    try {
      const actualCount = playerCount || table.current_players || 2;
      const payoutInfo = LotteryEngine.calculatePayout(table.entry_fee, actualCount, 10);

      // Check if winner is a bot player
      const winnerCheckRes = await db.query(
        'SELECT COALESCE(is_bot, false) AS is_bot FROM users WHERE id = $1;',
        [winner.user_id]
      );
      const isWinnerBot = Boolean(winnerCheckRes.rows[0]?.is_bot);

      // Atomic settlement in database
      await db.withTransaction(async (client) => {
        // 1. Update table status to completed with payout stats
        await client.query(`
          UPDATE tables 
          SET 
            status = 'completed',
            winner_id = $1,
            total_pool = $2,
            platform_fee = $3,
            winner_payout = $4,
            updated_at = NOW()
          WHERE id = $5;
        `, [winner.user_id, payoutInfo.totalPool, payoutInfo.platformCommission, payoutInfo.winnerPayout, tableId]);

        // 2. Mark table draw as completed
        await client.query(`
          UPDATE table_draws 
          SET 
            is_completed = true,
            winning_ball = $1,
            winner_id = $2,
            ended_at = NOW()
          WHERE table_id = $3;
        `, [winningBall, winner.user_id, tableId]);

        // 3. Atomically credit 90% winner payout to winner's wallet (only for real human players)
        if (!isWinnerBot) {
          await WalletService.creditCoins(
            winner.user_id,
            payoutInfo.winnerPayout,
            'table_win',
            tableId,
            `First Place Payout - Table ${table.name}`,
            client
          );
        }
      });

      // Fetch winner's new balance (if real player)
      const newBalance = !isWinnerBot ? await WalletService.getBalance(winner.user_id) : 0;

      // Fetch dynamic auto-rejoin configuration from system_settings
      let autoRejoin = { enabled: true, delaySeconds: 7 };
      try {
        const arRes = await db.query(
          "SELECT key, value FROM system_settings WHERE key IN ('auto_rejoin_enabled', 'auto_rejoin_delay_seconds');"
        );
        const arMap = {};
        arRes.rows.forEach((r) => { arMap[r.key] = r.value; });
        autoRejoin = {
          enabled: arMap['auto_rejoin_enabled'] !== 'false',
          delaySeconds: parseInt(arMap['auto_rejoin_delay_seconds'] || '7', 10) || 7,
        };
      } catch (err) {
        console.warn('Could not fetch auto-rejoin settings:', err);
      }

      // Broadcast victory payload to table room
      io.to(`table:${tableId}`).emit('draw:winner', {
        tableId,
        winner: {
          userId: winner.user_id,
          username: winner.username,
          photo_url: winner.photo_url || null,
          photoUrl: winner.photo_url || null,
          isBot: isWinnerBot,
          seatNumber: winner.seatNumber,
          numbers: winner.numbers,
          matchedNumbers: winner.matchedNumbers,
        },
        winningBall,
        totalBallsDrawn: drawnBalls.length,
        payout: {
          totalPool: payoutInfo.totalPool,
          platformFee: payoutInfo.platformCommission,
          winnerPayout: payoutInfo.winnerPayout,
        },
        autoRejoin,
        soundTrigger: 'winner_fanfare',
        animationTrigger: 'confetti_rain',
      });

      // Update winner's balance private socket (only for real human players)
      if (!isWinnerBot) {
        socketServer.emitToUser(winner.user_id, 'wallet:updated', {
          balance: newBalance,
          coinsAdded: payoutInfo.winnerPayout,
          message: `Congratulations! You won ${payoutInfo.winnerPayout} coins on Table ${table.name}!`,
        });
      }

    } catch (err) {
      console.error(`Failed to finalize game for table ${tableId}:`, err);
    }
  }
}

module.exports = TableSocketHandler;
