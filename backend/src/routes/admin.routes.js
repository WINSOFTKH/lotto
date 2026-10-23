const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const SupportController = require('../controllers/supportController');
const authenticateToken = require('../middlewares/auth');
const requireRoles = require('../middlewares/rbac');

// Base authentication check for all administrative routes
router.use(authenticateToken);

// Dashboard overview stats (Staff: moderator, finance, admin)
router.get('/stats', requireRoles('admin', 'moderator', 'finance'), AdminController.getDashboardStats);

// Admin Self Account Management (Admin only)
router.get('/account', requireRoles('admin'), AdminController.getAdminAccount);
router.put('/account', requireRoles('admin'), AdminController.updateAdminAccount);

// User Management (Admin & Moderator)
router.get('/users', requireRoles('admin', 'moderator'), AdminController.getUsers);
router.put('/users/:userId', requireRoles('admin'), AdminController.updateUserAccount);
router.put('/users/:userId/role', requireRoles('admin'), AdminController.updateUserRole);
router.put('/users/:userId/ban', requireRoles('admin', 'moderator'), AdminController.toggleBanUser);

// System Settings (Admin only)
router.get('/settings', requireRoles('admin'), AdminController.getSettings);
router.put('/settings/:key', requireRoles('admin'), AdminController.updateSetting);

// Supported Bank Names Management (Admin & Finance for read, Admin for write)
router.get('/banks', requireRoles('admin', 'finance'), AdminController.getBanks);
router.post('/banks', requireRoles('admin'), AdminController.addBank);
router.put('/banks', requireRoles('admin'), AdminController.updateBank);
router.delete('/banks', requireRoles('admin'), AdminController.removeBank);
router.post('/banks/reset', requireRoles('admin'), AdminController.resetBanks);

// Table Recovery: Check & Recover Crashed Tables (Admin only)
router.post('/tables/recover-crashed', requireRoles('admin'), AdminController.recoverCrashedTables);

// Top-Ups (Admin & Finance)
router.get('/topups', requireRoles('admin', 'finance'), AdminController.getTopups);
router.post('/topups/:id/approve', requireRoles('admin', 'finance'), AdminController.approveTopup);
router.post('/bakong/renew-token', requireRoles('admin'), AdminController.renewBakongToken);
router.post('/telegram/verify-bot', requireRoles('admin'), AdminController.verifyTelegramBot);

// Coin Ledger: Player Earnings and Reductions (Admin & Finance)
router.get('/wallet-transactions', requireRoles('admin', 'finance'), AdminController.getWalletTransactions);

// Withdrawals & Finance (Admin & Finance)
router.get('/withdrawals', requireRoles('admin', 'finance'), AdminController.getWithdrawals);
router.post('/withdrawals/:id/process', requireRoles('admin', 'finance'), AdminController.processWithdrawal);

// Player Support Help Desk (Admin, Moderator & Finance)
router.get('/support/conversations', requireRoles('admin', 'moderator', 'finance'), SupportController.adminGetConversations);
router.get('/support/conversation/:userId', requireRoles('admin', 'moderator', 'finance'), SupportController.adminGetConversationMessages);
router.post('/support/reply/:userId', requireRoles('admin', 'moderator', 'finance'), SupportController.adminSendReply);
router.patch('/support/status/:userId', requireRoles('admin', 'moderator', 'finance'), SupportController.adminUpdateStatus);

// Audit Security Logs (Admin only)
router.get('/audit-logs', requireRoles('admin'), AdminController.getAuditLogs);

module.exports = router;
