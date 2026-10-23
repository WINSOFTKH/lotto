const db = require('../config/db');
const AuditService = require('../services/auditService');
const socketServer = require('../sockets/socketServer');

class SupportController {
  /**
   * Auto-ensure support_messages table exists in PostgreSQL
   */
  static async ensureTable() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS support_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          sender_role VARCHAR(20) NOT NULL DEFAULT 'player',
          admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
          subject VARCHAR(150) DEFAULT 'General Support',
          message TEXT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'open',
          is_read_by_player BOOLEAN NOT NULL DEFAULT TRUE,
          is_read_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_support_user_created ON support_messages(user_id, created_at ASC);
        CREATE INDEX IF NOT EXISTS idx_support_status_created ON support_messages(status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_support_admin_read ON support_messages(is_read_by_admin);
      `);
    } catch (err) {
      console.warn('ensureTable (support_messages) error:', err.message);
    }
  }

  /**
   * PLAYER: Get full message history for the authenticated player
   */
  static async getMessages(req, res, next) {
    try {
      await SupportController.ensureTable();
      const userId = req.user.id;

      // Mark all incoming admin replies as read by the player
      await db.query(
        'UPDATE support_messages SET is_read_by_player = TRUE WHERE user_id = $1 AND is_read_by_player = FALSE;',
        [userId]
      );

      const query = `
        SELECT 
          sm.id,
          sm.user_id,
          sm.sender_role,
          sm.admin_id,
          sm.subject,
          sm.message,
          sm.status,
          sm.is_read_by_player,
          sm.is_read_by_admin,
          sm.created_at,
          admin_u.username AS admin_username
        FROM support_messages sm
        LEFT JOIN users admin_u ON sm.admin_id = admin_u.id
        WHERE sm.user_id = $1
        ORDER BY sm.created_at ASC;
      `;
      const result = await db.query(query, [userId]);

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PLAYER: Send a support inquiry or message to Admin
   */
  static async sendMessage(req, res, next) {
    try {
      await SupportController.ensureTable();
      const userId = req.user.id;
      const { message, subject = 'General Support' } = req.body;

      if (!message || !String(message).trim()) {
        return res.status(400).json({ success: false, error: 'Support message is required' });
      }

      const cleanMessage = String(message).trim().slice(0, 3000);
      const cleanSubject = String(subject || 'General Support').trim().slice(0, 150);

      // Insert new player message
      const insertQuery = `
        INSERT INTO support_messages (
          user_id, sender_role, subject, message, status, is_read_by_player, is_read_by_admin
        )
        VALUES ($1, 'player', $2, $3, 'open', TRUE, FALSE)
        RETURNING *;
      `;
      const result = await db.query(insertQuery, [userId, cleanSubject, cleanMessage]);
      const newMsg = result.rows[0];

      // Reset previous thread status to 'open' so admins know there is a pending response
      await db.query("UPDATE support_messages SET status = 'open' WHERE user_id = $1;", [userId]);

      // Emit real-time notification to all active admin staff
      try {
        socketServer.emitToAll('admin:support_new_message', {
          id: newMsg.id,
          userId,
          username: req.user.username,
          subject: cleanSubject,
          message: cleanMessage,
          createdAt: newMsg.created_at,
        });
      } catch (sockErr) {
        console.warn('Could not emit admin:support_new_message:', sockErr.message);
      }

      return res.status(201).json({
        success: true,
        message: 'Support message sent to admin support team',
        data: newMsg,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PLAYER: Check unread replies count for UI badge
   */
  static async getUnreadCount(req, res, next) {
    try {
      await SupportController.ensureTable();
      const userId = req.user.id;

      const result = await db.query(
        "SELECT COUNT(*) AS unread_count FROM support_messages WHERE user_id = $1 AND sender_role = 'admin' AND is_read_by_player = FALSE;",
        [userId]
      );
      const count = parseInt(result.rows[0]?.unread_count || '0', 10);

      return res.json({
        success: true,
        data: { unreadCount: count },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ADMIN: Get list of player conversations with summary metrics
   */
  static async adminGetConversations(req, res, next) {
    try {
      await SupportController.ensureTable();
      const { status = 'all', search = '', page = 1, limit = 20 } = req.query;
      const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

      // 1. Overall stats
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT user_id) AS total_conversations,
          COUNT(DISTINCT CASE WHEN status = 'open' THEN user_id END) AS open_count,
          COUNT(DISTINCT CASE WHEN status = 'replied' THEN user_id END) AS replied_count,
          COUNT(DISTINCT CASE WHEN status = 'resolved' THEN user_id END) AS resolved_count,
          COUNT(CASE WHEN sender_role = 'player' AND is_read_by_admin = FALSE THEN 1 END) AS unread_messages_total
        FROM support_messages;
      `;
      const statsRes = await db.query(statsQuery);
      const stats = statsRes.rows[0] || {};

      // 2. Filtered list of player conversations
      const queryParams = [];
      let whereClause = '';

      if (status && status !== 'all') {
        queryParams.push(status);
        whereClause += ` AND latest_status = $${queryParams.length}`;
      }

      if (search && search.trim()) {
        queryParams.push(`%${search.trim().toLowerCase()}%`);
        const pIndex = queryParams.length;
        whereClause += ` AND (LOWER(username) LIKE $${pIndex} OR LOWER(email) LIKE $${pIndex} OR LOWER(last_message) LIKE $${pIndex})`;
      }

      const conversationsQuery = `
        WITH user_convos AS (
          SELECT 
            u.id AS user_id,
            u.username,
            u.email,
            u.photo_url,
            u.role,
            u.coin_balance,
            COUNT(sm.id) AS total_messages,
            COUNT(CASE WHEN sm.sender_role = 'player' AND sm.is_read_by_admin = FALSE THEN 1 END) AS unread_by_admin_count,
            (
              SELECT sm2.status 
              FROM support_messages sm2 
              WHERE sm2.user_id = u.id 
              ORDER BY sm2.created_at DESC 
              LIMIT 1
            ) AS latest_status,
            (
              SELECT sm2.subject 
              FROM support_messages sm2 
              WHERE sm2.user_id = u.id 
              ORDER BY sm2.created_at DESC 
              LIMIT 1
            ) AS last_subject,
            (
              SELECT sm2.message 
              FROM support_messages sm2 
              WHERE sm2.user_id = u.id 
              ORDER BY sm2.created_at DESC 
              LIMIT 1
            ) AS last_message,
            (
              SELECT sm2.sender_role 
              FROM support_messages sm2 
              WHERE sm2.user_id = u.id 
              ORDER BY sm2.created_at DESC 
              LIMIT 1
            ) AS last_sender_role,
            (
              SELECT sm2.created_at 
              FROM support_messages sm2 
              WHERE sm2.user_id = u.id 
              ORDER BY sm2.created_at DESC 
              LIMIT 1
            ) AS last_message_at
          FROM users u
          JOIN support_messages sm ON sm.user_id = u.id
          GROUP BY u.id, u.username, u.email, u.photo_url, u.role, u.coin_balance
        )
        SELECT * FROM user_convos
        WHERE 1=1 ${whereClause}
        ORDER BY 
          CASE WHEN unread_by_admin_count > 0 THEN 0 ELSE 1 END ASC,
          last_message_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};
      `;

      queryParams.push(parseInt(limit, 10));
      queryParams.push(offset);

      const convosRes = await db.query(conversationsQuery, queryParams);

      return res.json({
        success: true,
        data: {
          conversations: convosRes.rows,
          stats: {
            totalConversations: parseInt(stats.total_conversations || '0', 10),
            openCount: parseInt(stats.open_count || '0', 10),
            repliedCount: parseInt(stats.replied_count || '0', 10),
            resolvedCount: parseInt(stats.resolved_count || '0', 10),
            unreadMessagesTotal: parseInt(stats.unread_messages_total || '0', 10),
          },
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ADMIN: Get full message thread for a specific player and mark admin read
   */
  static async adminGetConversationMessages(req, res, next) {
    try {
      await SupportController.ensureTable();
      const { userId } = req.params;

      // 1. Fetch player info
      const userRes = await db.query(
        'SELECT id, username, email, photo_url, role, coin_balance, created_at, is_banned FROM users WHERE id = $1;',
        [userId]
      );
      if (userRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Player account not found' });
      }
      const player = userRes.rows[0];

      // 2. Mark messages as read by admin
      await db.query(
        "UPDATE support_messages SET is_read_by_admin = TRUE WHERE user_id = $1 AND is_read_by_admin = FALSE;",
        [userId]
      );

      // 3. Fetch all messages in chronological order
      const messagesQuery = `
        SELECT 
          sm.id,
          sm.user_id,
          sm.sender_role,
          sm.admin_id,
          sm.subject,
          sm.message,
          sm.status,
          sm.is_read_by_player,
          sm.is_read_by_admin,
          sm.created_at,
          admin_u.username AS admin_username
        FROM support_messages sm
        LEFT JOIN users admin_u ON sm.admin_id = admin_u.id
        WHERE sm.user_id = $1
        ORDER BY sm.created_at ASC;
      `;
      const messagesRes = await db.query(messagesQuery, [userId]);

      return res.json({
        success: true,
        data: {
          player,
          messages: messagesRes.rows,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ADMIN: Reply to a player's support inquiry
   */
  static async adminSendReply(req, res, next) {
    try {
      await SupportController.ensureTable();
      const { userId } = req.params;
      const { message, status = 'replied' } = req.body;
      const adminId = req.user.id;

      if (!message || !String(message).trim()) {
        return res.status(400).json({ success: false, error: 'Reply message cannot be empty' });
      }

      const cleanMessage = String(message).trim().slice(0, 3000);
      const cleanStatus = ['open', 'replied', 'resolved'].includes(status) ? status : 'replied';

      // Insert admin reply
      const insertQuery = `
        INSERT INTO support_messages (
          user_id, sender_role, admin_id, subject, message, status, is_read_by_player, is_read_by_admin
        )
        VALUES ($1, 'admin', $2, 'Staff Support Reply', $3, $4, FALSE, TRUE)
        RETURNING *;
      `;
      const result = await db.query(insertQuery, [userId, adminId, cleanMessage, cleanStatus]);
      const newReply = result.rows[0];

      // Update thread status across conversation
      await db.query("UPDATE support_messages SET status = $1 WHERE user_id = $2;", [cleanStatus, userId]);

      // Emit real-time notification to the player
      try {
        socketServer.emitToUser(userId, 'support:new_reply', {
          id: newReply.id,
          userId,
          senderRole: 'admin',
          adminUsername: req.user.username,
          subject: newReply.subject,
          message: cleanMessage,
          status: cleanStatus,
          createdAt: newReply.created_at,
        });
      } catch (sockErr) {
        console.warn('Could not emit support:new_reply to user:', sockErr.message);
      }

      // Log in Audit Trail
      await AuditService.log({
        adminId,
        action: 'SUPPORT_REPLY_SENT',
        targetType: 'USER_SUPPORT',
        targetId: userId,
        details: { status: cleanStatus, replySnippet: cleanMessage.slice(0, 100) },
        ipAddress: req.ip,
      });

      return res.status(201).json({
        success: true,
        message: 'Reply sent successfully to player',
        data: {
          ...newReply,
          admin_username: req.user.username,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ADMIN: Update status of a support conversation (e.g. resolve)
   */
  static async adminUpdateStatus(req, res, next) {
    try {
      await SupportController.ensureTable();
      const { userId } = req.params;
      const { status } = req.body;
      const adminId = req.user.id;

      if (!['open', 'replied', 'resolved'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Valid status must be open, replied, or resolved' });
      }

      await db.query('UPDATE support_messages SET status = $1 WHERE user_id = $2;', [status, userId]);

      await AuditService.log({
        adminId,
        action: 'SUPPORT_STATUS_UPDATED',
        targetType: 'USER_SUPPORT',
        targetId: userId,
        details: { status },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        message: `Conversation status updated to ${status}`,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = SupportController;
