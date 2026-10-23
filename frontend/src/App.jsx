import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import GameRoom from './pages/GameRoom';
import AdminDashboard from './pages/AdminDashboard';
import AdminAccountPage from './pages/AdminAccountPage';
import WithdrawalPage from './pages/WithdrawalPage';
import PaymentMethodPage from './pages/PaymentMethodPage';
import ReferralPage from './pages/ReferralPage';
import CoinsBalancePage from './pages/CoinsBalancePage';
import DailyBonusModal from './components/DailyBonusModal';
import KhqrTopupModal from './components/KhqrTopupModal';
import WithdrawalModal from './components/WithdrawalModal';
import SupportModal from './components/SupportModal';
import AdminSupportDesk from './components/AdminSupportDesk';
import SplashScreen from './components/SplashScreen';
import ThemeToggle from './components/ThemeToggle';
import { useSocket } from './hooks/useSocket';
import { useSoundEffects } from './hooks/useSoundEffects';
import { authAPI, tableAPI, supportAPI, referralAPI } from './services/api';
import { initTelegramApp, getTelegramWebApp, triggerHaptic, isTelegramWebApp } from './services/telegram';
import { Headphones, Send, X, ShieldAlert, RefreshCw, Lock } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('kh_token') || '');
  const [user, setUser] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [authResolved, setAuthResolved] = useState(!localStorage.getItem('kh_token'));
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'gameroom', 'admin'
  const [activeTableId, setActiveTableId] = useState(null);

  // Modals state
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawInitialMethodId, setWithdrawInitialMethodId] = useState(null);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showAdminSupportModal, setShowAdminSupportModal] = useState(false);
  const [adminSupportTargetUserId, setAdminSupportTargetUserId] = useState(null);
  const [adminSupportToast, setAdminSupportToast] = useState(null);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);

  // Auth form state
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authReferralCode, setAuthReferralCode] = useState('');
  const [referralBindBonus, setReferralBindBonus] = useState(50);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [telegramBlocked, setTelegramBlocked] = useState(false);
  const [telegramBlockedError, setTelegramBlockedError] = useState('');

  // Socket & Sounds
  const { socket, isConnected } = useSocket(token);
  const soundEffects = useSoundEffects();

  // Load public referral program configuration
  useEffect(() => {
    referralAPI.getConfig()
      .then((res) => {
        if (res.data?.data?.bindBonusCoins !== undefined) {
          setReferralBindBonus(Number(res.data.data.bindBonusCoins));
        }
      })
      .catch((err) => {
        console.warn('Could not load public referral config:', err?.message);
      });
  }, []);

  // Detect referral code from URL query parameters (e.g. ?ref=KH1234 or ?invite=KH1234)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref') || params.get('invite') || params.get('startapp');
      if (ref) {
        setAuthReferralCode(ref.trim().toUpperCase());
        setAuthMode('register');
      }
    }
  }, []);

  // Initialize Telegram Mini App SDK and Auto-Authenticate
  useEffect(() => {
    const tg = initTelegramApp();
    if (isTelegramWebApp()) {
      // In Telegram Mini App environment, MUST strictly verify with telegram bot token
      if (tg && tg.initData) {
        handleTelegramLogin(tg.initData, tg.initDataUnsafe?.user);
      } else {
        // Missing initData in Telegram environment
        setTelegramBlocked(true);
        setTelegramBlockedError('Telegram authentication signature (initData) is missing. Cannot verify bot authorization.');
        setAuthResolved(true);
      }
    } else if (token) {
      loadUserProfile();
    } else {
      setAuthResolved(true);
    }
  }, []);

  // Telegram Native BackButton Handler
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg?.BackButton) return;

    if (currentView !== 'dashboard') {
      tg.BackButton.show();
      const onBack = () => {
        triggerHaptic('light');
        setCurrentView('dashboard');
        setActiveTableId(null);
      };
      tg.BackButton.onClick(onBack);
      return () => {
        tg.BackButton.offClick(onBack);
      };
    } else {
      tg.BackButton.hide();
    }
  }, [currentView]);

  // Listen to personal wallet balance & support updates
  useEffect(() => {
    if (socket && user) {
      socket.on('wallet:updated', (data) => {
        setUser((prev) => prev ? { ...prev, coinBalance: data.balance } : prev);
        soundEffects.playCoinClink();
        triggerHaptic('success');
      });

      // Real-time reply from admin support desk for players
      socket.on('support:new_reply', () => {
        setUnreadSupportCount((c) => c + 1);
        soundEffects.playEmojiPop?.();
        triggerHaptic('success');
      });

      // Real-time player inquiry notification for Admin/Moderator/Finance staff
      socket.on('admin:support_new_message', (data) => {
        if (['admin', 'moderator', 'finance'].includes(user.role)) {
          setUnreadSupportCount((c) => c + 1);
          soundEffects.playCoinClink();
          triggerHaptic('warning');
          setAdminSupportToast(data);
        }
      });

      return () => {
        socket.off('wallet:updated');
        socket.off('support:new_reply');
        socket.off('admin:support_new_message');
      };
    }
  }, [socket, user]);

  const loadUnreadSupportCount = async () => {
    try {
      if (user && ['admin', 'moderator', 'finance'].includes(user.role)) {
        const res = await supportAPI.getConversations({ status: 'open', limit: 1 });
        if (res.data?.data?.stats) {
          const stats = res.data.data.stats;
          setUnreadSupportCount(stats.openCount || stats.unreadMessagesTotal || 0);
        }
      } else {
        const res = await supportAPI.getUnreadCount();
        if (res.data?.data) {
          setUnreadSupportCount(res.data.data.unreadCount || 0);
        }
      }
    } catch (e) {
      // Ignore unread count error
    }
  };

  const handleOpenSupport = (targetUserId = null) => {
    if (user && ['admin', 'moderator', 'finance'].includes(user.role)) {
      setAdminSupportTargetUserId(targetUserId || null);
      setShowAdminSupportModal(true);
    } else {
      setShowSupportModal(true);
    }
  };

  const loadUserProfile = async () => {
    try {
      const res = await authAPI.getProfile();
      setUser(res.data.data);
      loadUnreadSupportCount();
    } catch (err) {
      console.warn('Failed to load user profile, token might be expired:', err);
      handleLogout();
    } finally {
      setAuthResolved(true);
    }
  };

  const handleTelegramLogin = async (initData, tgUser) => {
    try {
      setAuthLoading(true);
      setAuthError('');
      setTelegramBlocked(false);
      setTelegramBlockedError('');

      if (!initData) {
        setTelegramBlocked(true);
        setTelegramBlockedError('Telegram signature (initData) is missing. Cannot open app.');
        setAuthResolved(true);
        return;
      }

      const res = await authAPI.telegramLogin({ initData, user: tgUser });
      const { token: receivedToken, user: userData } = res.data.data;
      localStorage.setItem('kh_token', receivedToken);
      setToken(receivedToken);
      setUser(userData);
      soundEffects.playCoinClink();
      triggerHaptic('success');
    } catch (err) {
      console.warn('[TelegramAuth] Telegram authentication failed:', err);
      const errMsg = err.response?.data?.error || 'Telegram Bot Token does not match. You cannot open this app from an unauthorized bot.';
      localStorage.removeItem('kh_token');
      setToken('');
      setUser(null);
      setTelegramBlocked(true);
      setTelegramBlockedError(errMsg);
    } finally {
      setAuthLoading(false);
      setAuthResolved(true);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await authAPI.login({
        emailOrUsername: authEmail,
        password: authPassword,
      });
      const { token: receivedToken, user: userData } = res.data.data;
      localStorage.setItem('kh_token', receivedToken);
      setToken(receivedToken);
      setUser(userData);
      soundEffects.playCoinClink();
    } catch (err) {
      console.error('[Auth] Login error:', err);
      const isNetworkError = !err.response && (err.message === 'Network Error' || err.code === 'ERR_NETWORK');
      if (isNetworkError) {
        setAuthError('Cannot connect to backend server. Please verify your backend domain and CORS configuration.');
      } else {
        setAuthError(err.response?.data?.error || 'Login failed. Please check credentials.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await authAPI.register({
        username: authUsername,
        email: authEmail,
        password: authPassword,
        referralCode: authReferralCode.trim() || undefined,
      });
      const { token: receivedToken, user: userData } = res.data.data;
      localStorage.setItem('kh_token', receivedToken);
      setToken(receivedToken);
      setUser(userData);
      soundEffects.playCoinClink();
    } catch (err) {
      console.error('[Auth] Registration error:', err);
      const isNetworkError = !err.response && (err.message === 'Network Error' || err.code === 'ERR_NETWORK');
      if (isNetworkError) {
        setAuthError('Cannot connect to backend server. Please verify your backend domain and CORS configuration.');
      } else {
        setAuthError(err.response?.data?.error || 'Registration failed.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kh_token');
    setToken('');
    setUser(null);
    setCurrentView('dashboard');
    setActiveTableId(null);
    triggerHaptic('light');
  };

  const handleJoinTable = (tableId) => {
    triggerHaptic('medium');
    setActiveTableId(tableId);
    setCurrentView('gameroom');
  };

  const handleQuickPlay = async (entryFee = 100) => {
    try {
      triggerHaptic('heavy');
      const res = await tableAPI.quickPlay({ entryFee });
      const tableId = res.data.data.tableId;
      if (res.data.data?.newBalance !== undefined) {
        setUser((prev) => (prev ? { ...prev, coinBalance: res.data.data.newBalance } : prev));
      } else {
        await loadUserProfile();
      }
      handleJoinTable(tableId);
    } catch (err) {
      triggerHaptic('error');
      alert(err.response?.data?.error || 'Quick play matchmaking failed');
    }
  };

  // Initial First-Time App Launch / Splash Screen
  if (showSplash) {
    return (
      <SplashScreen
        isReady={authResolved}
        onFinish={() => setShowSplash(false)}
        minDuration={1800}
      />
    );
  }

  // If authenticating Telegram session, show loader
  if (authLoading && !user) {
    return (
      <div className="min-h-screen bg-casino-dark flex flex-col items-center justify-center p-4 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center font-black text-black text-2xl shadow-xl shadow-amber-500/20 animate-pulse">
          🎰
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-white font-bold text-base">Entering LOTTO 4U Arena...</h3>
          <p className="text-xs text-amber-400 font-mono">Synchronizing Telegram Session</p>
        </div>
      </div>
    );
  }

  // If in Telegram Mini App mode and Bot Token verification failed / blocked
  if (isTelegramWebApp() && telegramBlocked) {
    const tg = getTelegramWebApp();
    return (
      <div className="min-h-screen bg-casino-dark flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-casino-card border border-red-500/40 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
          </div>

          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold font-mono mb-3">
            <Lock className="w-3.5 h-3.5" />
            <span>UNAUTHORIZED TELEGRAM BOT</span>
          </div>

          <h2 className="text-xl font-black text-white mb-2">Access Denied</h2>
          <p className="text-xs text-gray-400 leading-relaxed mb-6">
            {telegramBlockedError || 'The Telegram Bot Token does not match our verified system. You are prohibited from opening or accessing this application from an unauthorized bot.'}
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                const tgApp = getTelegramWebApp();
                if (tgApp && tgApp.initData) {
                  handleTelegramLogin(tgApp.initData, tgApp.initDataUnsafe?.user);
                } else {
                  window.location.reload();
                }
              }}
              className="w-full py-3.5 rounded-xl font-bold text-xs bg-casino-gold hover:bg-yellow-400 text-black flex items-center justify-center space-x-2 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Verification</span>
            </button>

            {tg?.close && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  tg.close();
                }}
                className="w-full py-3 rounded-xl font-bold text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center space-x-2 transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
                <span>Close Telegram App</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If user is not logged in, show Auth Gate
  if (!user) {
    return (
      <div className="min-h-screen bg-casino-dark flex items-center justify-center p-4 transition-colors duration-200">
        <div className="w-full max-w-md bg-casino-card border border-casino-border rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Top Theme Switcher */}
          <div className="absolute top-4 right-4 z-10">
            <ThemeToggle size="sm" />
          </div>

          {/* Ambient Glow */}
          <div className="absolute -top-20 -left-20 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-200 flex items-center justify-center font-black text-black text-xl shadow-lg shadow-amber-500/20 mb-3">
              4U
            </div>
            <h1 className="text-2xl font-black text-white">LOTTO 4U ARENA</h1>
            <p className="text-xs text-gray-400">High-Concurrency Live Real-Time Web Lottery</p>
            {isTelegramWebApp() && (
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-400 font-mono text-[11px] font-bold">
                ✈️ Telegram Mini App Mode Active
              </span>
            )}
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs">
              {authError}
            </div>
          )}

          {isTelegramWebApp() && (
            <button
              type="button"
              onClick={() => {
                const tg = getTelegramWebApp();
                if (tg) handleTelegramLogin(tg.initData, tg.initDataUnsafe?.user);
              }}
              className="w-full py-3 rounded-xl font-bold text-xs bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center space-x-2 shadow-md shadow-sky-500/20 transition-all mb-4 active:scale-95"
            >
              <span>✈️ Instant Sign-In with Telegram</span>
            </button>
          )}

          <div className="flex bg-slate-100 dark:bg-casino-dark p-1 rounded-xl mb-6 border border-slate-200 dark:border-casino-border text-xs font-bold">
            <button
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
              className={`flex-1 py-2 rounded-lg transition-colors ${authMode === 'login' ? 'bg-amber-500 text-black shadow-sm' : 'text-slate-600 dark:text-gray-400 hover:text-black dark:hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode('register'); setAuthError(''); }}
              className={`flex-1 py-2 rounded-lg transition-colors ${authMode === 'register' ? 'bg-amber-500 text-black shadow-sm' : 'text-slate-600 dark:text-gray-400 hover:text-black dark:hover:text-white'}`}
            >
              Register (50 Free Coins)
            </button>
          </div>

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Username</label>
                <input
                  type="text"
                  placeholder="e.g. luckyplayer88"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full bg-casino-dark border border-casino-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">
                {authMode === 'login' ? 'Email or Username' : 'Email Address'}
              </label>
              <input
                type={authMode === 'login' ? 'text' : 'email'}
                placeholder={authMode === 'login' ? 'admin@kh-lotto.com' : 'player@gmail.com'}
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-casino-dark border border-casino-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-casino-dark border border-casino-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            {authMode === 'register' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-400 uppercase">
                    Referral Code (Optional)
                  </label>
                  {referralBindBonus > 0 ? (
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span>🎁</span>
                      <span>+{referralBindBonus.toLocaleString()} Extra Coins</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 font-bold">Join Friend's Team</span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. KH7A29BF"
                  value={authReferralCode}
                  onChange={(e) => setAuthReferralCode(e.target.value.toUpperCase())}
                  className="w-full bg-casino-dark border border-casino-border rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase text-amber-300 focus:outline-none focus:border-amber-500"
                  maxLength={15}
                />
                {referralBindBonus > 0 && authReferralCode.trim() && (
                  <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1 mt-1">
                    <span>✨</span>
                    <span>+{referralBindBonus.toLocaleString()} bonus coins will be added upon account creation!</span>
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 hover:from-amber-400 hover:to-yellow-200 text-black shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 mt-2"
            >
              {authLoading
                ? 'Authenticating...'
                : authMode === 'login'
                ? 'Enter Arena'
                : authReferralCode.trim() && referralBindBonus > 0
                ? `Register & Claim +${referralBindBonus} Bonus Coins`
                : 'Register & Play'}
            </button>
          </form>

          {/* Quick Demo Credentials Reminder */}
          <div className="mt-6 pt-4 border-t border-casino-border text-center text-[11px] text-gray-500">
            Default Admin Demo: <span className="font-mono text-gray-300">admin@kh-lotto.com</span> / <span className="font-mono text-gray-300">Admin@123456</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-casino-dark text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      <Navbar
        user={user}
        onOpenBonus={() => setShowBonusModal(true)}
        onOpenTopup={() => setShowTopupModal(true)}
        onOpenWithdraw={() => setShowWithdrawModal(true)}
        onOpenSupport={() => handleOpenSupport()}
        unreadSupportCount={unreadSupportCount}
        onLogout={handleLogout}
        currentView={currentView}
        setCurrentView={setCurrentView}
      />

      <main className="flex-1">
        {currentView === 'dashboard' && (
          <Dashboard
            user={user}
            onJoinTable={handleJoinTable}
            onQuickPlay={handleQuickPlay}
          />
        )}

        {currentView === 'gameroom' && (
          <GameRoom
            key={activeTableId}
            tableId={activeTableId}
            user={user}
            socket={socket}
            soundEffects={soundEffects}
            onBackToLobby={() => setCurrentView('dashboard')}
            onSwitchTable={(id) => handleJoinTable(id)}
            onUserBalanceUpdate={loadUserProfile}
          />
        )}

        {currentView === 'admin' && (
          <AdminDashboard
            user={user}
            socket={socket}
            onNavigateAdminAccount={() => setCurrentView('admin-account')}
          />
        )}

        {currentView === 'admin-account' && (
          <AdminAccountPage
            user={user}
            onBack={() => setCurrentView('admin')}
            onBackToDashboard={() => setCurrentView('dashboard')}
            onUserUpdated={(updatedUser, newToken) => {
              if (newToken) {
                localStorage.setItem('kh_token', newToken);
                setToken(newToken);
              }
              setUser((prev) => ({
                ...prev,
                ...updatedUser,
                username: updatedUser.username,
                email: updatedUser.email,
                photoUrl: updatedUser.photoUrl || updatedUser.photo_url,
                photo_url: updatedUser.photo_url || updatedUser.photoUrl,
                telegramId: updatedUser.telegramId || updatedUser.telegram_id,
              }));
            }}
          />
        )}

        {currentView === 'withdrawal' && (
          <WithdrawalPage
            user={user}
            onUserBalanceUpdate={loadUserProfile}
            onBack={() => setCurrentView('dashboard')}
            onNavigatePaymentMethods={() => setCurrentView('payment-methods')}
          />
        )}

        {currentView === 'payment-methods' && (
          <PaymentMethodPage
            user={user}
            onBack={() => setCurrentView('withdrawal')}
            onNavigateSellCoins={() => setCurrentView('withdrawal')}
            onOpenSellCoinsModal={(method) => {
              setWithdrawInitialMethodId(method?.id || null);
              setShowWithdrawModal(true);
            }}
          />
        )}

        {currentView === 'referral' && (
          <ReferralPage
            user={user}
            onUserBalanceUpdate={loadUserProfile}
            onBack={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'coins-balance' && (
          <CoinsBalancePage
            user={user}
            onBack={() => setCurrentView('dashboard')}
            onOpenTopup={() => setShowTopupModal(true)}
            onOpenWithdraw={() => setCurrentView('withdrawal')}
            onUserBalanceUpdate={loadUserProfile}
          />
        )}
      </main>

      {/* Global Modals */}
      <DailyBonusModal
        isOpen={showBonusModal}
        onClose={() => setShowBonusModal(false)}
        onBonusClaimed={(newBal) => {
          setUser((prev) => (prev ? {
            ...prev,
            coinBalance: newBal,
            canClaimBonus: false,
            lastClaimDate: new Date().toISOString()
          } : prev));
          loadUserProfile();
        }}
        onBonusStatusUpdate={(canClaim) => {
          setUser((prev) => (prev ? { ...prev, canClaimBonus: canClaim } : prev));
        }}
        playSound={soundEffects.playCoinClink}
      />

      <KhqrTopupModal
        isOpen={showTopupModal}
        onClose={() => setShowTopupModal(false)}
        onPaymentSuccess={loadUserProfile}
        playSound={soundEffects.playCoinClink}
        socket={socket}
        user={user}
      />

      <WithdrawalModal
        isOpen={showWithdrawModal}
        onClose={() => {
          setShowWithdrawModal(false);
          setWithdrawInitialMethodId(null);
        }}
        currentBalance={user.coinBalance}
        initialPaymentMethodId={withdrawInitialMethodId}
        onNavigatePaymentMethods={() => setCurrentView('payment-methods')}
        onWithdrawalSubmitted={(remaining) => setUser((u) => ({ ...u, coinBalance: remaining }))}
      />

      {/* PLAYER SUPPORT INQUIRY MODAL */}
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => {
          setShowSupportModal(false);
          loadUnreadSupportCount();
        }}
        user={user}
        socket={socket}
        onNewReply={() => setUnreadSupportCount(0)}
        onOpenAdminSupport={() => handleOpenSupport()}
      />

      {/* ADMIN SUPPORT DESK MODAL (REPLY TO PLAYERS DIRECTLY FROM ANY PAGE) */}
      {showAdminSupportModal && user && ['admin', 'moderator', 'finance'].includes(user.role) && (
        <AdminSupportDesk
          user={user}
          socket={socket}
          initialSelectedUserId={adminSupportTargetUserId}
          isModal={true}
          onClose={() => {
            setShowAdminSupportModal(false);
            setAdminSupportTargetUserId(null);
            loadUnreadSupportCount();
          }}
        />
      )}

      {/* REAL-TIME ADMIN FLOATING INQUIRY ALERT TOAST */}
      {adminSupportToast && user && ['admin', 'moderator', 'finance'].includes(user.role) && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm sm:max-w-md w-full bg-slate-900/95 dark:bg-casino-card/95 border-2 border-amber-500 rounded-2xl p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 flex-shrink-0 mt-0.5">
                <Headphones className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                    New Player Support Inquiry
                  </span>
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                </div>
                <p className="text-xs font-bold text-white">
                  {adminSupportToast.username} <span className="text-slate-400 font-normal">needs help:</span>
                </p>
                {adminSupportToast.subject && (
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Topic: {adminSupportToast.subject}
                  </span>
                )}
                <p className="text-xs text-slate-300 dark:text-gray-300 line-clamp-2 bg-black/40 p-2 rounded-lg border border-white/5 font-mono">
                  "{adminSupportToast.message}"
                </p>
              </div>
            </div>
            <button
              onClick={() => setAdminSupportToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-end space-x-2 mt-3 pt-2 border-t border-white/10">
            <button
              onClick={() => setAdminSupportToast(null)}
              className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
            >
              Later
            </button>
            <button
              onClick={() => {
                const targetUid = adminSupportToast.userId;
                setAdminSupportToast(null);
                handleOpenSupport(targetUid);
              }}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-md flex items-center space-x-1.5 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Reply to Player Now</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
