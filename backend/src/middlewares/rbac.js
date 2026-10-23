/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts route access to specific roles ('player', 'moderator', 'finance', 'admin')
 * @param {string[]} allowedRoles Array of roles authorized to access the route
 */
const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Access requires one of [${allowedRoles.join(', ')}] roles`
      });
    }

    next();
  };
};

module.exports = requireRoles;
