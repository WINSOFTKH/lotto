const db = require('../config/db');

class AuditService {
  /**
   * Records an administrative action in the audit logs
   */
  static async log({ adminId, action, targetType, targetId, details = {}, ipAddress = null }) {
    try {
      const query = `
        INSERT INTO audit_logs (admin_id, action, target_type, target_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const res = await db.query(query, [
        adminId,
        action,
        targetType,
        targetId ? String(targetId) : null,
        JSON.stringify(details),
        ipAddress,
      ]);
      return res.rows[0];
    } catch (err) {
      console.error('Failed to write audit log:', err);
      // Non-blocking for primary transaction flow
    }
  }
}

module.exports = AuditService;
