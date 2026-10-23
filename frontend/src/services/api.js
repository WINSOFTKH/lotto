import axios from "axios";

/**
 * Robust API Base URL resolution:
 * - Trims whitespace and trailing slashes
 * - Automatically ensures /api suffix if not present
 * - Prevents Mixed Content HTTP/HTTPS browser blocks on custom domains
 */
export function resolveApiBaseUrl() {
  const envUrl = (import.meta.env.VITE_API_URL || "").trim();

  if (typeof window !== "undefined") {
    const isHttps = window.location.protocol === "https:";
    const hostname = window.location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

    // Direct local IP or localhost in development
    if (isLocalhost) {
      if (envUrl) {
        let cleaned = envUrl.replace(/\/+$/, "");
        if (!cleaned.endsWith("/api")) cleaned = `${cleaned}/api`;
        // Strip accidental https:// on local dev
        cleaned = cleaned.replace(/^https:\/\/(localhost|127\.0\.0\.1)/, "http://$1");
        // Align 127.0.0.1 / localhost with current window tab
        cleaned = cleaned.replace(/(localhost|127\.0\.0\.1)/, hostname);
        return cleaned;
      }
      return `http://${hostname}:3500/api`;
    }

    // On custom HTTPS domain without explicit VITE_API_URL:
    // Use same origin /api to work with reverse proxies and avoid Mixed Content
    if (isHttps) {
      if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
        let cleaned = envUrl.replace(/\/+$/, "");
        if (!cleaned.endsWith("/api")) cleaned = `${cleaned}/api`;
        return cleaned;
      }
      return `${window.location.origin}/api`;
    }

    if (envUrl) {
      let cleaned = envUrl.replace(/\/+$/, "");
      if (!cleaned.endsWith("/api")) cleaned = `${cleaned}/api`;
      return cleaned;
    }

    return `http://${hostname}:3500/api`;
  }

  if (envUrl) {
    let cleaned = envUrl.replace(/\/+$/, "");
    if (!cleaned.endsWith("/api")) cleaned = `${cleaned}/api`;
    return cleaned;
  }

  return "http://localhost:3500/api";
}

const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("kh_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Handle Auth Expired
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Don't auto-clear if already on login page
      if (!window.location.pathname.includes("/login")) {
        // Option to redirect to login
      }
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  register: (data) => api.post("/auth/register", data),
  telegramLogin: (data) => api.post("/auth/telegram", data),
  getProfile: () => api.get("/auth/me"),
};

export const bonusAPI = {
  getStatus: () => api.get("/bonus/status"),
  claim: () => api.post("/bonus/claim"),
};

export const khqrAPI = {
  getConfig: () => api.get("/khqr/config"),
  createTopup: (data) => api.post("/khqr/create", data),
  checkStatus: (id) => api.get(`/khqr/check/${id}`),
  simulatePay: (data) => api.post("/khqr/simulate", data),
  getHistory: () => api.get("/khqr/history"),
};

export const tableAPI = {
  getConfig: () => api.get("/tables/config"),
  getTables: (params) => api.get("/tables", { params }),
  getTable: (id) => api.get(`/tables/${id}`),
  createTable: (data) => api.post("/tables", data),
  joinTable: (id) => api.post(`/tables/${id}/join`),
  leaveTable: (id) => api.post(`/tables/${id}/leave`),
  startGame: (id) => api.post(`/tables/${id}/start`),
  deleteTable: (id) => api.delete(`/tables/${id}`),
  quickPlay: (data) => api.post("/tables/quick-play", data),
};

export const withdrawalAPI = {
  getConfig: () => api.get("/withdrawals/config"),
  getBanks: () => api.get("/withdrawals/banks"),
  getPaymentMethods: () => api.get("/withdrawals/payment-methods"),
  createPaymentMethod: (data) => api.post("/withdrawals/payment-methods", data),
  updatePaymentMethod: (id, data) => api.put(`/withdrawals/payment-methods/${id}`, data),
  setDefaultPaymentMethod: (id) => api.patch(`/withdrawals/payment-methods/${id}/default`),
  deletePaymentMethod: (id) => api.delete(`/withdrawals/payment-methods/${id}`),
  request: (data) => api.post("/withdrawals", data),
  getMyWithdrawals: () => api.get("/withdrawals/my"),
  cancel: (id) => api.post(`/withdrawals/${id}/cancel`),
};

export const walletAPI = {
  getTransactions: (params) => api.get("/wallet/transactions", { params }),
};

export const supportAPI = {
  // Player endpoints
  getMyMessages: () => api.get("/support/my-messages"),
  sendMessage: (data) => api.post("/support/send", data),
  getUnreadCount: () => api.get("/support/unread-count"),

  // Admin endpoints
  getConversations: (params) => api.get("/admin/support/conversations", { params }),
  getConversationMessages: (userId) => api.get(`/admin/support/conversation/${userId}`),
  reply: (userId, data) => api.post(`/admin/support/reply/${userId}`, data),
  updateStatus: (userId, status) => api.patch(`/admin/support/status/${userId}`, { status }),
};

export const referralAPI = {
  getConfig: () => api.get("/referral/config"),
  getMyStats: () => api.get("/referral/me"),
  bindCode: (code) => api.post("/referral/bind", { code }),
};

export const adminAPI = {
  getStats: () => api.get("/admin/stats"),
  getAccount: () => api.get("/admin/account"),
  updateAccount: (data) => api.put("/admin/account", data),
  getUsers: (params) => api.get("/admin/users", { params }),
  updateUserAccount: (userId, data) => api.put(`/admin/users/${userId}`, data),
  updateRole: (userId, role) =>
    api.put(`/admin/users/${userId}/role`, { role }),
  toggleBan: (userId, isBanned) =>
    api.put(`/admin/users/${userId}/ban`, { isBanned }),
  getSettings: () => api.get("/admin/settings"),
  updateSetting: (key, value) => api.put(`/admin/settings/${key}`, { value }),
  getBanks: () => api.get("/admin/banks"),
  addBank: (data) => api.post("/admin/banks", typeof data === 'string' ? { bankName: data } : data),
  updateBank: (data) => api.put("/admin/banks", data),
  removeBank: (bankName) => api.delete("/admin/banks", { data: { bankName } }),
  resetBanks: () => api.post("/admin/banks/reset"),
  getWithdrawals: (params) =>
    api.get("/admin/withdrawals", { params: typeof params === 'string' ? { status: params } : params }),
  processWithdrawal: (id, data) =>
    api.post(`/admin/withdrawals/${id}/process`, data),
  getTopups: (params) => api.get("/admin/topups", { params }),
  approveTopup: (id) => api.post(`/admin/topups/${id}/approve`),
  renewBakongToken: (email) => api.post("/admin/bakong/renew-token", { email }),
  verifyTelegramBot: (token) => api.post("/admin/telegram/verify-bot", { token }),
  getWalletTransactions: (params) =>
    api.get("/admin/wallet-transactions", { params }),
  getAuditLogs: (params) => api.get("/admin/audit-logs", { params }),
  recoverCrashedTables: () => api.post("/admin/tables/recover-crashed"),
};

export default api;
