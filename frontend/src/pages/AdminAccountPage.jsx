import React, { useState, useEffect } from 'react';
import {
  Shield,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Camera,
  Check,
  AlertCircle,
  ArrowLeft,
  Coins,
  Send,
  Sparkles,
  RefreshCw,
  Copy,
  CheckCircle2,
  KeyRound,
  ShieldAlert,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import PlayerAvatar, { getRandomAvatarUrl } from '../components/PlayerAvatar';
import { adminAPI } from '../services/api';
import { formatCoins } from '../utils/formatters';
import { triggerHaptic } from '../services/telegram';

// Curated selection of VIP / Casino Admin Preset Avatars
const PRESET_AVATARS = [
  { name: 'Royal VIP', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=RoyalVIP&backgroundColor=ffd700,b6e3f4' },
  { name: 'Admin King', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=AdminKing&backgroundColor=c0aede,d1d4f9' },
  { name: 'Casino Boss', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CasinoBoss&backgroundColor=ffdfbf,ffd5dc' },
  { name: 'Gold Dragon', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=GoldDragon&backgroundColor=ffd700,ffb300' },
  { name: 'High Roller', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=HighRoller&backgroundColor=b6e3f4,c0aede' },
  { name: 'Diamond Master', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DiamondMaster&backgroundColor=d1d4f9,ffd5dc' },
  { name: 'Cyber Agent', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CyberAgent&backgroundColor=b6e3f4,ffd700' },
  { name: 'Khmer Crown', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=KhmerCrown&backgroundColor=ffd700,ffb300' },
  { name: 'Shadow Ace', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ShadowAce&backgroundColor=c0aede,b6e3f4' },
  { name: 'Imperial Gold', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ImperialGold&backgroundColor=ffd700,d1d4f9' },
  { name: 'Emerald Tiger', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=EmeraldTiger&backgroundColor=c0aede,ffd5dc' },
  { name: 'Phoenix Fire', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=PhoenixFire&backgroundColor=ffb300,ffd700' },
];

export default function AdminAccountPage({
  user,
  onBack,
  onBackToDashboard,
  onUserUpdated,
}) {
  // Form fields
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [telegramId, setTelegramId] = useState(user?.telegramId || user?.telegram_id || '');
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || user?.photo_url || '');

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States
  const [accountDetails, setAccountDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [avatarTab, setAvatarTab] = useState('presets'); // 'presets' | 'custom'

  // Fetch latest admin profile data
  const loadAdminProfile = async () => {
    try {
      setInitialLoading(true);
      const res = await adminAPI.getAccount();
      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        setAccountDetails(data);
        setUsername(data.username || '');
        setEmail(data.email || '');
        setTelegramId(data.telegramId || data.telegram_id || '');
        setPhotoUrl(data.photoUrl || data.photo_url || '');
      }
    } catch (err) {
      console.warn('Could not load detailed admin account:', err);
      // Fallback to prop user
      if (user) {
        setUsername(user.username || '');
        setEmail(user.email || '');
        setTelegramId(user.telegramId || user.telegram_id || '');
        setPhotoUrl(user.photoUrl || user.photo_url || '');
      }
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadAdminProfile();
  }, []);

  // Access check: Only Admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-slate-900 border border-rose-500/30 rounded-2xl text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Administrator Access Required</h2>
        <p className="text-sm text-slate-400">
          This account update console is strictly restricted to authorized system administrators only.
        </p>
        <button
          onClick={onBackToDashboard || onBack}
          className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm shadow-lg transition-transform active:scale-95"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Password validation & strength
  const isPasswordProvided = Boolean(newPassword.trim().length > 0);
  const isPasswordValid = !isPasswordProvided || newPassword.length >= 6;
  const isPasswordMatched = !isPasswordProvided || (newPassword === confirmPassword);

  let passwordStrength = 'None';
  let passwordStrengthColor = 'bg-gray-500';
  if (isPasswordProvided) {
    let score = 0;
    if (newPassword.length >= 6) score += 1;
    if (newPassword.length >= 10) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    if (score <= 1) {
      passwordStrength = 'Weak';
      passwordStrengthColor = 'bg-rose-500';
    } else if (score <= 3) {
      passwordStrength = 'Good';
      passwordStrengthColor = 'bg-amber-500';
    } else {
      passwordStrength = 'Strong';
      passwordStrengthColor = 'bg-emerald-500';
    }
  }

  // Handle Copy ID
  const handleCopyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      triggerHaptic('light');
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Validations
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMessage('Username must be at least 3 characters long.');
      triggerHaptic('error');
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      triggerHaptic('error');
      return;
    }

    if (isPasswordProvided) {
      if (newPassword.length < 6) {
        setErrorMessage('New password must be at least 6 characters long.');
        triggerHaptic('error');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('New passwords do not match. Please verify.');
        triggerHaptic('error');
        return;
      }
    }

    try {
      setLoading(true);
      const payload = {
        username: cleanUsername,
        email: cleanEmail,
        photoUrl: photoUrl ? photoUrl.trim() : null,
        telegramId: telegramId ? telegramId.trim() : null,
      };

      if (isPasswordProvided) {
        payload.password = newPassword.trim();
      }

      const res = await adminAPI.updateAccount(payload);

      if (res.data?.success) {
        const { user: updatedUser, token: newToken } = res.data.data;
        setSuccessMessage('Admin account updated successfully! Changes are live.');
        triggerHaptic('success');

        // Clear password fields
        setNewPassword('');
        setConfirmPassword('');

        // Update local state
        setAccountDetails((prev) => ({ ...prev, ...updatedUser }));

        // Notify parent application
        if (onUserUpdated) {
          onUserUpdated(updatedUser, newToken);
        }

        // Auto-dismiss success toast after 4 seconds
        setTimeout(() => {
          setSuccessMessage('');
        }, 4000);
      } else {
        setErrorMessage(res.data?.error || 'Failed to update admin account.');
        triggerHaptic('error');
      }
    } catch (err) {
      const errText = err.response?.data?.error || err.message || 'Error updating account.';
      setErrorMessage(errText);
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Reset to current
  const handleResetForm = () => {
    const src = accountDetails || user;
    setUsername(src?.username || '');
    setEmail(src?.email || '');
    setTelegramId(src?.telegramId || src?.telegram_id || '');
    setPhotoUrl(src?.photoUrl || src?.photo_url || '');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage('');
    setSuccessMessage('');
    triggerHaptic('light');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-casino-dark py-6 px-3 sm:px-6 transition-colors">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* TOP NAVIGATION & BREADCRUMB */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-casino-card hover:bg-slate-100 dark:hover:bg-casino-border border border-slate-200 dark:border-casino-border text-xs font-bold text-slate-700 dark:text-gray-300 transition-all shadow-sm"
              >
                <ArrowLeft className="w-4 h-4 text-amber-500" />
                <span>Admin Dashboard</span>
              </button>
            )}

            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-casino-card hover:bg-slate-100 dark:hover:bg-casino-border border border-slate-200 dark:border-casino-border text-xs font-bold text-slate-700 dark:text-gray-300 transition-all shadow-sm"
              >
                <span>Casino Lobby</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Privileges Active</span>
            </span>
          </div>
        </div>

        {/* HERO HEADER */}
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 dark:from-amber-600/30 dark:via-casino-card dark:to-casino-card border border-amber-400/30 dark:border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6 text-center md:text-left">
            {/* Live Big Avatar Preview */}
            <div className="relative group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-1 bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-500 shadow-2xl flex items-center justify-center">
                <div className="w-full h-full rounded-[22px] overflow-hidden bg-slate-900 flex items-center justify-center">
                  <PlayerAvatar
                    photoUrl={photoUrl}
                    username={username || user.username}
                    userId={user.id}
                    size="xl"
                    showBorder={false}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-black font-black text-[10px] uppercase shadow-md flex items-center space-x-1">
                <Check className="w-3 h-3 stroke-[3]" />
                <span>Admin</span>
              </span>
            </div>

            {/* Profile Overview Text */}
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Update Admin Account
                </h1>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase bg-slate-900 text-amber-400 border border-amber-400/40">
                  Superuser
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-800 dark:text-gray-300 max-w-xl">
                Manage your administrative identity, email, secure password, and profile image. Changes take effect immediately across all casino tables and the admin panel.
              </p>

              {/* Quick Meta Badges */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2 text-xs">
                <div
                  onClick={handleCopyId}
                  className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-white/70 dark:bg-black/40 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-gray-300 cursor-pointer hover:border-amber-400 transition-colors"
                  title="Click to copy Admin UUID"
                >
                  <span className="font-mono text-[11px]">ID: {user.id ? `${user.id.slice(0, 8)}...` : 'Unknown'}</span>
                  {copiedId ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-gray-400" />
                  )}
                </div>

                <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-white/70 dark:bg-black/40 border border-slate-300 dark:border-white/10 text-amber-800 dark:text-amber-400 font-bold">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  <span>{formatCoins(accountDetails?.coinBalance ?? user.coinBalance)} Coins</span>
                </div>

                {accountDetails?.updatedAt && (
                  <span className="text-[11px] text-slate-700 dark:text-gray-400">
                    Updated: {new Date(accountDetails.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FEEDBACK ALERTS */}
        {successMessage && (
          <div className="flex items-center space-x-3 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 shadow-lg animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
            <span className="text-xs sm:text-sm font-bold">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center space-x-3 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-800 dark:text-rose-300 shadow-lg animate-fadeIn">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
            <span className="text-xs sm:text-sm font-bold">{errorMessage}</span>
          </div>
        )}

        {/* MAIN EDIT FORM */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1: AVATAR & PROFILE IMAGE PICKER */}
          <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-casino-border pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-amber-500" />
                  <span>Admin Profile Image / Avatar</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Select from premium VIP presets or provide a custom high-resolution image URL.
                </p>
              </div>

              {/* Avatar Type Tabs */}
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-casino-dark p-1 rounded-xl border border-slate-200 dark:border-casino-border">
                <button
                  type="button"
                  onClick={() => setAvatarTab('presets')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    avatarTab === 'presets'
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'text-slate-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  VIP Presets
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarTab('custom')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    avatarTab === 'custom'
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'text-slate-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  Custom URL
                </button>
              </div>
            </div>

            {/* PRESET AVATAR GALLERY */}
            {avatarTab === 'presets' && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-1">
                  {PRESET_AVATARS.map((preset) => {
                    const isSelected = photoUrl === preset.url;
                    return (
                      <div
                        key={preset.name}
                        onClick={() => {
                          setPhotoUrl(preset.url);
                          triggerHaptic('light');
                        }}
                        className={`group relative flex flex-col items-center p-2 rounded-2xl cursor-pointer border-2 transition-all ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-400/40 shadow-md scale-105'
                            : 'bg-slate-50 dark:bg-casino-dark/70 border-slate-200 dark:border-casino-border hover:border-amber-400/60 hover:scale-102'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-900 border border-white/10 mb-1.5 flex items-center justify-center">
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-800 dark:text-gray-300 text-center truncate max-w-full">
                          {preset.name}
                        </span>
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 text-black flex items-center justify-center shadow">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Generate a fresh random avatar seed
                      const randomSeed = `Admin_${Math.random().toString(36).substring(2, 8)}`;
                      setPhotoUrl(getRandomAvatarUrl(randomSeed));
                      triggerHaptic('light');
                    }}
                    className="flex items-center space-x-1.5 text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Random Seed Avatar</span>
                  </button>

                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoUrl('');
                        triggerHaptic('light');
                      }}
                      className="text-xs text-rose-500 hover:text-rose-600 font-medium"
                    >
                      Clear Avatar (Use System Initials)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* CUSTOM URL INPUT */}
            {avatarTab === 'custom' && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">
                    Direct Image URL (HTTPS)
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={photoUrl || ''}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="https://example.com/my-admin-photo.png"
                      className="w-full bg-slate-50 dark:bg-casino-dark border border-slate-300 dark:border-casino-border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                    />
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => setPhotoUrl('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-gray-400 mt-1 block">
                    Supported formats: PNG, JPG, WEBP, SVG. Enter any publicly hosted image URL.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: BASIC ACCOUNT CREDENTIALS (USERNAME, EMAIL, TELEGRAM) */}
          <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
            <div className="border-b border-slate-200 dark:border-casino-border pb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <User className="w-4 h-4 text-amber-500" />
                <span>Account Identity & Contact</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Update the official administrator display username, primary login email, and Telegram handle.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Username */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-300">
                  Admin Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin_boss"
                    minLength={3}
                    maxLength={50}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-casino-dark border border-slate-300 dark:border-casino-border rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block">
                  3-50 characters. Letters, numbers, underscores and hyphens.
                </span>
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-300">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@khlotto.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-casino-dark border border-slate-300 dark:border-casino-border rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Used for password resets and system notifications.
                </span>
              </div>

              {/* Telegram ID / Username */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-300">
                  Telegram Username or ID (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Send className="w-4 h-4 text-sky-500" />
                  </div>
                  <input
                    type="text"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                    placeholder="@khlotto_admin or 123456789"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-casino-dark border border-slate-300 dark:border-casino-border rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Enables instant one-tap authentication via Telegram Mini App.
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 3: SECURITY & PASSWORD CHANGE */}
          <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
            <div className="border-b border-slate-200 dark:border-casino-border pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    <span>Admin Security & Password</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Leave these password fields blank if you do not wish to change your current password.
                  </p>
                </div>
                {isPasswordProvided && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase text-white ${passwordStrengthColor}`}>
                    {passwordStrength}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* New Password */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-300">
                  New Password (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    minLength={6}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-casino-dark border border-slate-300 dark:border-casino-border rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-300">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    disabled={!isPasswordProvided}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-casino-dark border border-slate-300 dark:border-casino-border rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Password Validation Warnings */}
            {isPasswordProvided && (
              <div className="space-y-1 pt-1">
                {!isPasswordValid && (
                  <p className="text-xs text-rose-500 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Password must be at least 6 characters.</span>
                  </p>
                )}
                {confirmPassword && !isPasswordMatched && (
                  <p className="text-xs text-rose-500 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Passwords do not match.</span>
                  </p>
                )}
                {isPasswordValid && isPasswordMatched && (
                  <p className="text-xs text-emerald-500 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Password valid and matching.</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* AUDIT LOG & COMPLIANCE NOTICE */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 flex items-start space-x-3">
            <Shield className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Immutable Audit Security Protocol</span>
              <p className="text-[11px] text-slate-600 dark:text-gray-300">
                Every modification to this administrator account (username, email, password hashes, and profile image) is automatically signed and recorded into the persistent PostgreSQL <code className="bg-black/30 px-1 py-0.5 rounded text-amber-400">audit_logs</code> table with your originating IP address.
              </p>
            </div>
          </div>

          {/* FORM ACTIONS (SAVE & RESET) */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetForm}
              disabled={loading}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-casino-border text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-casino-border text-xs sm:text-sm font-bold transition-colors disabled:opacity-50"
            >
              Reset to Current
            </button>

            <button
              type="submit"
              disabled={loading || (isPasswordProvided && (!isPasswordValid || !isPasswordMatched))}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold text-xs sm:text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Save Account Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}