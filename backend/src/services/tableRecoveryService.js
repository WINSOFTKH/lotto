const db = require('../config/db');
const socketServer = require('../sockets/socketServer');
const TableSocketHandler = require('../sockets/tableSocket');
const AuditService = require('./auditService');

class TableRecoveryService {
  /**
   * Fetch configured timeout in minutes from system_settings (defaults to 15 minutes)
   */
  static async getCrashedTimeoutMinutes() {
    try {
      const res = await db.query(
        "SELECT key, value FROM system_settings WHERE key IN ('crashed_game_timeout_minutes', 'crashed_game_timeout_hours');"
      );
      if (res.rows.length > 0) {
        const minRow = res.rows.find((r) => r.key === 'crashed_game_timeout_minutes');
        if (minRow) {
          const val = parseFloat(minRow.value);
          if (!isNaN(val) && val > 0) return val;
        }
        const hrRow = res.rows.find((r) => r.key === 'crashed_game_timeout_hours');
        if (hrRow) {
          const val = parseFloat(hrRow.value);
          if (!isNaN(val) && val > 0) return Math.round(val * 60);
        }
      }
    } catch (err) {
      console.warn('Could not fetch crashed_game_timeout_minutes, using fallback 15 minutes:', err);
    }
    return 15;
  }

  /**
   * Backward-compatibility alias
   */
  static async getCrashedTimeoutHours() {
    const mins = await TableRecoveryService.getCrashedTimeoutMinutes();
    return mins / 60;
  }

  /**
   * Scan for tables stuck in 'playing' status that started >= timeoutMinutes ago
   * and reset them to 'waiting' status.
   */
  static async checkAndRecoverCrashedTables(adminId = null) {
    try {
      const timeoutMinutes = await TableRecoveryService.getCrashedTimeoutMinutes();

      // Find tables stuck in 'playing' status where updated_at or draw started_at >= timeoutMinutes ago
      const findQuery = `
        SELECT DISTINCT t.id, t.name, t.entry_fee, t.current_players, t.status, t.host_id, t.updated_at,
               COALESCE(d.started_at, t.updated_at) AS game_started_at
        FROM tables t
        LEFT JOIN LATERAL (
          SELECT id, started_at, is_completed
          FROM table_draws
          WHERE table_id = t.id AND is_completed = false
          ORDER BY started_at DESC
          LIMIT 1
        ) d ON true
        WHERE t.status = 'playing'
          AND (
            t.updated_at < NOW() - ($1 || ' minutes')::INTERVAL
            OR (d.started_at IS NOT NULL AND d.started_at < NOW() - ($1 || ' minutes')::INTERVAL)
          );
      `;

      const stuckTables = await db.query(findQuery, [String(timeoutMinutes)]);

      if (stuckTables.rows.length === 0) {
        return { recoveredCount: 0, tables: [] };
      }

      console.log(`[TableRecovery] Found ${stuckTables.rows.length} crashed table(s) in 'playing' status (started >= ${timeoutMinutes}m ago). Resetting to 'waiting'...`);

      const recovered = [];

      for (const table of stuckTables.rows) {
        try {
          await db.withTransaction(async (client) => {
            // 1. Update table status to 'waiting'
            await client.query(`
              UPDATE tables 
              SET status = 'waiting', updated_at = NOW()
              WHERE id = $1 AND status = 'playing';
            `, [table.id]);

            // 2. Mark any uncompleted draws as ended so new drawings won't collide
            await client.query(`
              UPDATE table_draws
              SET is_completed = true, ended_at = NOW()
              WHERE table_id = $1 AND is_completed = false;
            `, [table.id]);
          });

          // 3. Clear any in-memory timer
          TableSocketHandler.clearActiveGameTimer(table.id);

          // 4. Real-time notification to table room
          socketServer.emitToRoom(`table:${table.id}`, 'table:reset_to_waiting', {
            tableId: table.id,
            status: 'waiting',
            message: 'Game was reset to waiting because it timed out or crashed. You can exit for a refund or start a new game.',
          });

          // 5. Broadcast table status update to lobby
          socketServer.emitToAll('table:updated', {
            tableId: table.id,
            status: 'waiting',
            currentPlayers: table.current_players,
          });

          // 6. Record audit log
          await AuditService.log({
            adminId,
            action: 'RECOVER_CRASHED_TABLE',
            targetType: 'TABLE',
            targetId: table.id,
            details: {
              tableName: table.name,
              previousStatus: 'playing',
              newStatus: 'waiting',
              currentPlayers: table.current_players,
              gameStartedAt: table.game_started_at,
              timeoutMinutes,
              recoveredBy: adminId ? 'manual_admin' : 'auto_scheduler',
            },
          });

          recovered.push({
            id: table.id,
            name: table.name,
            currentPlayers: table.current_players,
            gameStartedAt: table.game_started_at,
          });

          console.log(`[TableRecovery] Successfully recovered table ${table.id} (${table.name}) -> status: 'waiting'`);
        } catch (tableErr) {
          console.error(`[TableRecovery] Failed to recover table ${table.id}:`, tableErr);
        }
      }

      return {
        recoveredCount: recovered.length,
        tables: recovered,
      };
    } catch (err) {
      console.error('[TableRecovery] Error running crashed table recovery check:', err);
      throw err;
    }
  }

  /**
   * Start recurring background schedule
   * Runs check on server boot and every `intervalMinutes` (default: 5 minutes)
   */
  static startScheduler(intervalMinutes = 5) {
    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

    // Run initial boot check after 5 seconds to ensure pools are connected
    setTimeout(() => {
      console.log(`[TableRecovery] Running initial boot check for crashed tables (threshold >= 1 hour)...`);
      TableRecoveryService.checkAndRecoverCrashedTables().catch(err => {
        console.error('[TableRecovery] Initial boot check error:', err);
      });
    }, 5000);

    // Recurring schedule
    const timer = setInterval(() => {
      TableRecoveryService.checkAndRecoverCrashedTables().catch(err => {
        console.error('[TableRecovery] Scheduled check error:', err);
      });
    }, intervalMs);

    console.log(`[TableRecovery] Schedule active: checking for crashed tables every ${intervalMinutes} minutes.`);
    return timer;
  }
}

module.exports = TableRecoveryService;
