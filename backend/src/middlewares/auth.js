const jwt = require('jsonwebtoken');
const config = require('../config/env');
const db = require('../config/db');

/**
 * Authentication Middleware: Validates JWT token and checks active account status
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token required'
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Verify user exists and is not banned in database
    const userResult = await db.query(
      'SELECT id, username, email, role, coin_balance, is_banned, photo_url FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found or account deactivated'
      });
    }

    const user = userResult.rows[0];

    if (user.is_banned) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact support.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired. Please log in again.'
      });
    }
    return res.status(403).json({
      success: false,
      error: 'Invalid authentication token'
    });
  }
};

module.exports = authenticateToken;
