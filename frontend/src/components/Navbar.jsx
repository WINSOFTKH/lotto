import React, { useState, useEffect, useRef } from 'react';
import { 
  Coins, Gift, PlusCircle, ArrowUpRight, Shield, LogOut, 
  Menu, X, User, Plus, Headphones, Users, CreditCard, ChevronDown 
} from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import ThemeToggle from './ThemeToggle';
import { formatCoins } from '../utils/formatters';

/**
 * Helper to check whether player is eligible to claim the daily bonus.
 * Returns false when player has already claimed today.
 */
function canUserClaimBonus(user) {
  if (!user) return false;
  if (user.canClaimBonus !== undefined) {
    return Boolean(user.canClaimBonus);
  }
  if (!user.lastClaimDate) {
    return true;
  }
  try {
    const claimDate = new Date(user.lastClaimDate);
    const today = new Date();
    const claimStr = claimDate.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);
    return claimStr < todayStr;
  } catch (e) {
    return false;
  }
}

export default function Navbar({
  user,
  onOpenBonus,
  onOpenTopup,
  onOpenWithdraw,
  onOpenSupport,
  unreadSupportCount = 0,
  onLogout,
  currentView,
  setCurrentView
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
        setAccountDropdownOpen(false);
      }
    };
    if (accountDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [accountDropdownOpen]);

  const handleAction = (actionFn) => {
    setMobileMenuOpen(false);
    setAccountDropdownOpen(false);
    if (actionFn) actionFn();
  };

  return (
    <nav className="border-b border-slate-200 dark:border-casino-border bg-white/95 dark:bg-casino-dark/95 backdrop-blur sticky top-0 z-40 px-3 sm:px-4 py-2 sm:py-3 transition-all shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={() => {
            setCurrentView('dashboard');
            setMobileMenuOpen(false);
          }}
          className="flex items-center space-x-2 cursor-pointer group flex-shrink-0"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-200 flex items-center justify-center font-black text-black text-sm sm:text-lg shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            KH
          </div>
          <div>
            <span className="font-black text-base sm:text-xl tracking-tight text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors block leading-tight">
              KH-LOTTO
            </span>
            <span className="text-[9px] uppercase tracking-widest text-amber-600 dark:text-amber-400 font-semibold hidden sm:block">
              Live Real-Time Casino
            </span>
          </div>
        </div>

        {/* User Balance & Actions */}
        {user && (
          <>
            {/* DESKTOP BAR (md and above) */}
            <div className="hidden md:flex items-center space-x-3">
              {/* Coin Balance Pill */}
              <div 
                onClick={() => setCurrentView('coins-balance')}
                className={`flex items-center rounded-full px-4 py-1.5 shadow-sm cursor-pointer transition-all ${
                  currentView === 'coins-balance'
                    ? 'bg-amber-100/90 dark:bg-amber-950/60 border-2 border-amber-500 ring-2 ring-amber-400/30'
                    : 'bg-amber-50/80 dark:bg-casino-card border border-amber-300 dark:border-amber-500/30 hover:border-amber-400 dark:hover:border-amber-400 hover:shadow-md'
                }`}
                title="View Coins Balance & Transaction History"
              >
                <Coins className="w-4 h-4 text-amber-500 dark:text-amber-400 mr-2" />
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 dark:text-gray-400 block -mb-1">Balance</span>
                  <span className="font-bold text-amber-800 dark:text-amber-400 text-sm tracking-wide">
                    {formatCoins(user.coinBalance)} <span className="text-xs text-amber-700/80 dark:text-amber-200 font-normal">COINS</span>
                  </span>
                </div>

                {/* Quick Buy Coins Plus */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTopup();
                  }}
                  title="Buy Coins"
                  className="ml-3 p-1 rounded-full bg-amber-500/20 hover:bg-amber-500 text-amber-600 dark:text-amber-400 hover:text-black transition-colors"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Daily Bonus Button (hidden when already claimed) */}
              {canUserClaimBonus(user) && (
                <button
                  onClick={onOpenBonus}
                  className="flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs px-3.5 py-2 rounded-xl shadow-md hover:shadow-emerald-500/20 transition-all"
                >
                  <Gift className="w-4 h-4" />
                  <span>Daily Bonus</span>
                </button>
              )}

              {/* Cash Out / Sell Coins Button */}
              <button
                onClick={() => setCurrentView(currentView === 'withdrawal' ? 'dashboard' : 'withdrawal')}
                className={`flex items-center space-x-1.5 border text-xs px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm ${
                  currentView === 'withdrawal' || currentView === 'payment-methods'
                    ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-100 dark:bg-casino-card hover:bg-slate-200 dark:hover:bg-casino-border border-slate-200 dark:border-casino-border text-slate-800 dark:text-gray-200 hover:text-black dark:hover:text-white'
                }`}
              >
                <ArrowUpRight className={`w-4 h-4 ${currentView === 'withdrawal' || currentView === 'payment-methods' ? 'text-black' : 'text-emerald-500 dark:text-emerald-400'}`} />
                <span>Sell Coins</span>
              </button>

              {/* Referral Program Page (Players Only) */}
              {user.role === 'player' && (
                <button
                  onClick={() => setCurrentView(currentView === 'referral' ? 'dashboard' : 'referral')}
                  className={`flex items-center space-x-1.5 border text-xs px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm ${
                    currentView === 'referral'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                      : 'bg-slate-100 dark:bg-casino-card hover:bg-slate-200 dark:hover:bg-casino-border border-slate-200 dark:border-casino-border text-slate-800 dark:text-gray-200 hover:text-black dark:hover:text-white'
                  }`}
                  title="Referral Program & Affiliate Pyramid"
                >
                  <Users className={`w-4 h-4 ${currentView === 'referral' ? 'text-white' : 'text-indigo-500 dark:text-indigo-400'}`} />
                  <span>Referral</span>
                </button>
              )}

              {/* Player Support Help Desk / Admin Support Desk */}
              <button
                onClick={onOpenSupport}
                className="relative flex items-center space-x-1.5 border text-xs px-3 py-2 rounded-xl font-bold transition-all shadow-sm bg-slate-100 dark:bg-casino-card hover:bg-slate-200 dark:hover:bg-casino-border border-slate-200 dark:border-casino-border text-slate-800 dark:text-gray-200 hover:text-black dark:hover:text-white"
                title={['admin', 'moderator', 'finance'].includes(user.role) ? "Support Desk (Reply to Players)" : "Customer Support & Help Desk"}
              >
                <Headphones className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>{['admin', 'moderator', 'finance'].includes(user.role) ? 'Support Desk' : 'Support'}</span>
                {unreadSupportCount > 0 && (
                  <span className="min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-md animate-pulse">
                    {unreadSupportCount > 9 ? '9+' : unreadSupportCount}
                  </span>
                )}
              </button>

              {/* User Profile Pill with "My Account" & "Admin Panel" Dropdown */}
              <div className="relative" ref={accountDropdownRef}>
                <button
                  type="button"
                  onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                  className={`flex items-center space-x-2 rounded-xl px-2.5 py-1.5 shadow-sm transition-all cursor-pointer ${
                    accountDropdownOpen || currentView === 'admin-account'
                      ? 'bg-amber-100 dark:bg-amber-500/20 border-2 border-amber-500 ring-2 ring-amber-400/30'
                      : 'bg-slate-100 dark:bg-casino-card/80 border border-slate-200 dark:border-casino-border hover:border-amber-400'
                  }`}
                  title={user.role === 'admin' ? "Click name to open My Account menu" : user.username}
                >
                  <PlayerAvatar
                    photoUrl={user.photoUrl || user.photo_url}
                    username={user.username}
                    userId={user.id}
                    size="sm"
                    borderColor="border border-amber-400/50"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-gray-200 truncate max-w-[110px]" title={user.username}>
                    {user.username}
                  </span>
                  {user.role === 'admin' && (
                    <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black">
                      ADMIN
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 dark:text-gray-400 transition-transform ${accountDropdownOpen ? 'rotate-180 text-amber-500' : ''}`} />
                </button>

                {/* USER DROPDOWN MENU */}
                {accountDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-2xl shadow-2xl z-50 p-2 space-y-1 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Header info */}
                    <div className="px-3 py-2.5 border-b border-slate-100 dark:border-white/10 flex items-center space-x-2.5">
                      <PlayerAvatar
                        photoUrl={user.photoUrl || user.photo_url}
                        username={user.username}
                        userId={user.id}
                        size="md"
                        borderColor="border border-amber-400/50"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate block">
                            {user.username}
                          </span>
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            {user.role}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-gray-400 truncate block">
                          {user.email || 'Admin Profile'}
                        </span>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="pt-1 space-y-0.5">
                      {/* Admin Operations Panel */}
                      {['admin', 'moderator', 'finance'].includes(user.role) && (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentView('admin');
                            setAccountDropdownOpen(false);
                          }}
                          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                            currentView === 'admin'
                              ? 'bg-amber-500 text-black shadow-sm'
                              : 'text-slate-800 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-4 h-4" />
                          </div>
                          <div className="text-left flex-1">
                            <span className="font-extrabold capitalize">{user.role} Panel</span>
                            <span className="text-[10px] text-slate-500 dark:text-gray-400 font-normal block leading-tight">
                              Manage stats, recovery, settings & users
                            </span>
                          </div>
                        </button>
                      )}

                      {/* My Account (Admin use only) - Next to Admin Panel */}
                      {user.role === 'admin' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentView('admin-account');
                            setAccountDropdownOpen(false);
                          }}
                          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                            currentView === 'admin-account'
                              ? 'bg-amber-500 text-black shadow-sm'
                              : 'text-slate-800 dark:text-gray-200 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="text-left flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold">My Account</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold uppercase">
                                Edit
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-gray-400 font-normal block leading-tight">
                              Update username, email, password & photo
                            </span>
                          </div>
                        </button>
                      ) : (
                        <div className="px-3 py-2 text-xs text-slate-500 dark:text-gray-400">
                          Player Account: <span className="font-bold text-slate-800 dark:text-gray-200">{user.username}</span>
                        </div>
                      )}
                    </div>

                    {/* Divider & Sign Out */}
                    <div className="border-t border-slate-100 dark:border-white/10 my-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                          <LogOut className="w-4 h-4" />
                        </div>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Theme Toggle (Dark / Light) */}
              <ThemeToggle size="md" />

              {/* Logout */}
              <button
                onClick={onLogout}
                title="Logout"
                className="p-2 text-slate-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* MOBILE ULTRA-CLEAN APP BAR (mobile only) */}
            <div className="flex md:hidden items-center space-x-2">
              {/* Clean Compact Coin Chip with One-Tap Buy Coins */}
              <div 
                onClick={() => setCurrentView('coins-balance')}
                className={`flex items-center rounded-full pl-2.5 pr-1 py-1 shadow-sm cursor-pointer transition-all ${
                  currentView === 'coins-balance'
                    ? 'bg-amber-100/90 dark:bg-amber-950/60 border-2 border-amber-500 ring-1 ring-amber-400/50'
                    : 'bg-amber-50 dark:bg-casino-card/90 border border-amber-300 dark:border-amber-500/40 active:scale-95'
                }`}
                title="View Coins Balance & Transaction History"
              >
                <Coins className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 mr-1.5 flex-shrink-0" />
                <span className="text-xs font-black font-mono text-amber-800 dark:text-amber-300 mr-1.5">
                  {formatCoins(user.coinBalance)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTopup();
                  }}
                  title="Buy Coins"
                  className="w-5 h-5 rounded-full bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center font-bold text-xs shadow-sm active:scale-95 transition-transform"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                </button>
              </div>

              {/* Mobile Quick Support Icon Button */}
              <button
                onClick={onOpenSupport}
                title="Customer Support & Help Desk"
                className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-300 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-500/25 flex items-center justify-center transition-colors relative shadow-sm"
              >
                <Headphones className="w-4 h-4" />
                {unreadSupportCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center shadow-md animate-pulse">
                    {unreadSupportCount > 9 ? '9+' : unreadSupportCount}
                  </span>
                )}
              </button>

              {/* Quick Daily Bonus Icon Button (hidden when already claimed) */}
              {canUserClaimBonus(user) && (
                <button
                  onClick={onOpenBonus}
                  title="Daily Bonus"
                  className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 flex items-center justify-center transition-colors relative shadow-sm"
                >
                  <Gift className="w-4 h-4" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
                </button>
              )}

              {/* Mobile Quick Theme Toggle */}
              <ThemeToggle size="sm" />

              {/* Mobile Menu Hamburger Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                title="Menu"
                className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors shadow-sm ${
                  mobileMenuOpen
                    ? 'bg-amber-500 text-black border-amber-400'
                    : 'bg-white dark:bg-casino-card border-slate-200 dark:border-casino-border text-slate-700 dark:text-gray-300 hover:text-black dark:hover:text-white'
                }`}
              >
                {mobileMenuOpen ? <X className="w-4 h-4 stroke-[2.5]" /> : <Menu className="w-4 h-4 stroke-[2.5]" />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* MOBILE DROPDOWN DRAWER */}
      {user && mobileMenuOpen && (
        <div className="md:hidden mt-2 pt-3 border-t border-slate-200 dark:border-casino-border/70 space-y-2 bg-white/98 dark:bg-casino-card/95 rounded-2xl p-3 shadow-2xl backdrop-blur-xl border border-slate-200 dark:border-transparent">
          {/* User info row */}
          <div 
            onClick={() => {
              if (user.role === 'admin') {
                setCurrentView(currentView === 'admin-account' ? 'dashboard' : 'admin-account');
                setMobileMenuOpen(false);
              }
            }}
            className={`flex items-center justify-between pb-2 border-b border-slate-200 dark:border-casino-border/50 px-1 ${
              user.role === 'admin' ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg p-1' : ''
            }`}
          >
            <div className="flex items-center space-x-2">
              <PlayerAvatar
                photoUrl={user.photoUrl || user.photo_url}
                username={user.username}
                userId={user.id}
                size="md"
                borderColor="border border-amber-400/50"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px] block leading-tight">{user.username}</span>
                {user.role === 'admin' ? (
                  <span className="text-[9px] text-amber-500 font-bold block">👤 My Account</span>
                ) : user.telegramId ? (
                  <span className="text-[9px] text-sky-600 dark:text-sky-400 font-mono block">✈️ Telegram ID</span>
                ) : null}
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
              {user.role}
            </span>
          </div>

          {/* Action List */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handleAction(onOpenTopup)}
              className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-xs font-bold transition-colors shadow-sm"
            >
              <Coins className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>Buy Coins</span>
            </button>

            {canUserClaimBonus(user) && (
              <button
                onClick={() => handleAction(onOpenBonus)}
                className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-xs font-bold transition-colors shadow-sm"
              >
                <Gift className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Claim Bonus</span>
              </button>
            )}

            <button
              onClick={() => {
                setCurrentView(currentView === 'withdrawal' ? 'dashboard' : 'withdrawal');
                setMobileMenuOpen(false);
              }}
              className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors shadow-sm ${
                currentView === 'withdrawal' || currentView === 'payment-methods'
                  ? 'bg-emerald-500 text-black border-emerald-400'
                  : 'bg-slate-100 dark:bg-casino-dark border-slate-200 dark:border-casino-border hover:border-slate-300 dark:hover:border-gray-600 text-slate-800 dark:text-gray-200'
              }`}
            >
              <ArrowUpRight className={`w-4 h-4 ${currentView === 'withdrawal' || currentView === 'payment-methods' ? 'text-black' : 'text-emerald-500 dark:text-emerald-400'}`} />
              <span>Sell Coins</span>
            </button>

            {user.role === 'player' && (
              <button
                onClick={() => {
                  setCurrentView(currentView === 'referral' ? 'dashboard' : 'referral');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors shadow-sm ${
                  currentView === 'referral'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-100 dark:bg-casino-dark border-slate-200 dark:border-casino-border hover:border-slate-300 dark:hover:border-gray-600 text-slate-800 dark:text-gray-200'
                }`}
              >
                <Users className={`w-4 h-4 ${currentView === 'referral' ? 'text-white' : 'text-indigo-500 dark:text-indigo-400'}`} />
                <span>Referral</span>
              </button>
            )}

            <button
              onClick={() => handleAction(onOpenSupport)}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-300 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-xs font-bold transition-colors shadow-sm"
            >
              <div className="flex items-center space-x-2">
                <Headphones className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>{['admin', 'moderator', 'finance'].includes(user?.role) ? 'Support Desk' : 'Need Support'}</span>
              </div>
              {unreadSupportCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black animate-pulse">
                  {unreadSupportCount}
                </span>
              )}
            </button>

            {['admin', 'moderator', 'finance'].includes(user.role) && (
              <button
                onClick={() => {
                  setCurrentView(currentView === 'admin' ? 'dashboard' : 'admin');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm ${
                  user.role === 'admin' ? '' : 'col-span-2'
                } ${
                  currentView === 'admin'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/40'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="capitalize">{user.role} Panel</span>
              </button>
            )}

            {/* My Account - Next to Admin Panel on Mobile */}
            {user.role === 'admin' && (
              <button
                onClick={() => {
                  setCurrentView(currentView === 'admin-account' ? 'dashboard' : 'admin-account');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors shadow-sm ${
                  currentView === 'admin-account'
                    ? 'bg-amber-500 text-black border-amber-400 shadow-md'
                    : 'bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                }`}
              >
                <User className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>My Account</span>
              </button>
            )}
          </div>

          {/* Appearance / Theme Switcher Row */}
          <div className="pt-1">
            <ThemeToggle variant="row" />
          </div>

          {/* Logout row */}
          <div className="pt-2 border-t border-slate-200 dark:border-casino-border/50">
            <button
              onClick={() => handleAction(onLogout)}
              className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
