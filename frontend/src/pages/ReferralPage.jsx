import React, { useState, useEffect } from "react";
import {
  Users,
  Share2,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Crown,
  Shield,
  Gift,
  Sparkles,
  AlertCircle,
  QrCode,
  TrendingUp,
  Coins,
  ChevronDown,
  ChevronUp,
  UserCheck,
  CheckCircle2,
  Lock,
  ExternalLink,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { referralAPI } from "../services/api";
import PlayerAvatar from "../components/PlayerAvatar";
import CoinIcon from "../components/CoinIcon";
import { formatCoins } from "../utils/formatters";

export default function ReferralPage({ user, onBack, onUserBalanceUpdate }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Referral code binding state
  const [inputCode, setInputCode] = useState("");
  const [binding, setBinding] = useState(false);
  const [bindError, setBindError] = useState("");

  // UI state
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState({ B: true, C: false });

  const fetchReferralStats = async (isManualRefresh = false) => {
    if (user?.role && user.role !== "player") {
      setLoading(false);
      return;
    }

    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      const res = await referralAPI.getMyStats();
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load referral stats:", err);
      setError(
        err.response?.data?.error ||
          "Could not load referral data. Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.role === "player") {
      fetchReferralStats();
    } else {
      setLoading(false);
    }
  }, [user]);

  const referralCode =
    stats?.user?.referralCode ||
    user?.referralCode ||
    user?.referral_code ||
    "";
  const inviteLink =
    typeof window !== "undefined" && referralCode
      ? `${window.location.origin}/?ref=${referralCode}`
      : "";

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleBindCode = async (e) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      setBindError("Please enter a referral code");
      return;
    }

    try {
      setBinding(true);
      setBindError("");
      setSuccessMessage("");

      const res = await referralAPI.bindCode(inputCode.trim());
      if (res.data?.success) {
        setSuccessMessage(
          res.data.message || "Referral code successfully linked!",
        );
        setInputCode("");
        fetchReferralStats(true);
        if (onUserBalanceUpdate) onUserBalanceUpdate();
      }
    } catch (err) {
      setBindError(err.response?.data?.error || "Failed to bind referral code");
    } finally {
      setBinding(false);
    }
  };

  const toggleLevel = (lvl) => {
    setExpandedLevels((prev) => ({ ...prev, [lvl]: !prev[lvl] }));
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center animate-spin">
          <RefreshCw className="w-6 h-6 text-amber-500" />
        </div>
        <p className="text-sm font-bold text-slate-600 dark:text-gray-400">
          Loading referral network pyramid...
        </p>
      </div>
    );
  }

  // Non-player account restriction notice
  if (user?.role && user.role !== "player") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 shadow-lg shadow-amber-500/10">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
          Player-Only Feature
        </h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 max-w-md mx-auto">
          The referral program is exclusively for player accounts. Admin and
          staff accounts cannot participate in referral networks or receive
          commissions.
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-black text-xs shadow-md transition-colors"
          >
            Back to Dashboard
          </button>
        )}
      </div>
    );
  }

  const pyramid = stats?.pyramid;
  const summary = stats?.summary;
  const config = stats?.config;
  const isBound = stats?.user?.isBound;
  const referredBy = stats?.user?.referredBy;
  const bindBonusCoins =
    config?.bindBonusCoins !== undefined ? Number(config.bindBonusCoins) : 50;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-casino-border">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-100 dark:bg-casino-card hover:bg-slate-200 dark:hover:bg-casino-border text-slate-700 dark:text-gray-300 transition-colors"
              title="Back to Lobby"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
                <Users className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Referral Program
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-300">
                Live Commission
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              Invite friends to play! You (Level A) earn{" "}
              <strong className="text-amber-600 dark:text-amber-400">
                {config?.level1Percent || 5}%
              </strong>{" "}
              from Level B direct deposits and{" "}
              <strong className="text-indigo-600 dark:text-indigo-400">
                {config?.level2Percent || 1}%
              </strong>{" "}
              from Level C sub-deposits.
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchReferralStats(true)}
          disabled={refreshing}
          className="self-end sm:self-auto flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-casino-card hover:bg-slate-200 dark:hover:bg-casino-border text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-casino-border transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-amber-500" : ""}`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Grid: Your Referral Code Card + Bind Inviter Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* CARD 1: YOUR REFERRAL CODE */}
        <div className="bg-white dark:bg-casino-card rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-casino-border shadow-md flex flex-col justify-between space-y-5 relative overflow-hidden">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-sm flex-shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Your Referral Code
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    Share this code with friends to join your Level B team
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowQrModal(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-casino-dark dark:hover:bg-casino-border border border-slate-200 dark:border-casino-border text-slate-700 dark:text-gray-300 text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 shadow-sm"
                title="View QR Code"
              >
                <QrCode className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-bold">QR Code</span>
              </button>
            </div>

            {/* Exclusive Invitation Code Card */}
            <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent dark:from-amber-500/15 dark:via-casino-dark dark:to-casino-dark border border-amber-400/40 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 shadow-inner">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 block mb-0.5">
                  Exclusive Invitation Code
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-slate-900 dark:text-white block truncate">
                  {referralCode || "KH------"}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="px-4 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 hover:from-amber-400 hover:to-yellow-200 text-black shadow-md shadow-amber-500/20 flex items-center space-x-1.5 transition-all hover:scale-[1.02] active:scale-95 flex-shrink-0"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : (
                  <Copy className="w-4 h-4 stroke-[2.5]" />
                )}
                <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
              </button>
            </div>

            {/* Commission Benefits Highlights (fills empty space seamlessly) */}
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-casino-dark/70 border border-slate-200/80 dark:border-casino-border/80 flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center flex-shrink-0 border border-amber-500/30">
                  {config?.level1Percent || 5}%
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-gray-400 block">
                    Level B (Direct)
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white truncate block">
                    Direct Friends
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-casino-dark/70 border border-slate-200/80 dark:border-casino-border/80 flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center flex-shrink-0 border border-indigo-500/30">
                  {config?.level2Percent || 1}%
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-gray-400 block">
                    Level C (Sub)
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white truncate block">
                    Team Network
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-casino-border/60 text-[11px] text-slate-500 dark:text-gray-400 flex items-center justify-between">
            <span className="truncate">
              Commission credited automatically on top-ups
            </span>
            <span className="font-black text-amber-600 dark:text-amber-400 flex-shrink-0 ml-2">
              Instant Payout
            </span>
          </div>
        </div>

        {/* CARD 2: BIND AN INVITER (SINGLE-USE ONLY) */}
        <div className="bg-white dark:bg-casino-card rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-casino-border shadow-md flex flex-col justify-between space-y-5 relative overflow-hidden">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border ${
                  isBound
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
                    : "bg-indigo-500/15 border-indigo-500/30 text-indigo-500"
                }`}
              >
                {isBound ? (
                  <UserCheck className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {isBound
                    ? "Your Inviter / Team Leader"
                    : "Join an Inviter (Single-Use Only)"}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">
                  {isBound
                    ? "Your account is permanently connected to this inviter"
                    : "Enter your friend’s referral code to join their team"}
                </p>
              </div>
            </div>

            {isBound ? (
              /* Already Bound Card */
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <PlayerAvatar
                      photoUrl={referredBy?.photoUrl}
                      username={referredBy?.username || "Inviter"}
                      userId={referredBy?.id}
                      size="md"
                    />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider block">
                        Invited By
                      </span>
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        @{referredBy?.username || "Unknown"}
                      </span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-sm">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Bound</span>
                  </span>
                </div>

                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300/80 flex items-center justify-between">
                  <span>Linked Since:</span>
                  <span className="font-mono font-bold">
                    {referredBy?.boundAt
                      ? new Date(referredBy.boundAt).toLocaleDateString()
                      : "Active Member"}
                  </span>
                </div>
              </div>
            ) : (
              /* Input Code Form */
              <form onSubmit={handleBindCode} className="space-y-3">
                {bindBonusCoins > 0 && (
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/5 border border-amber-500/30 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0">
                        <Gift className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-amber-700 dark:text-amber-300">
                          Join Reward: +{bindBonusCoins.toLocaleString()} Coins
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-gray-400">
                          Enter a code to instantly claim your bonus coins!
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-xs font-mono shadow-sm flex items-center space-x-1">
                      <CoinIcon className="w-3.5 h-3.5" />
                      <span>+{bindBonusCoins.toLocaleString()}</span>
                    </span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                    Inviter’s Referral Code
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="e.g. KH7A29BF"
                      value={inputCode}
                      onChange={(e) => {
                        setInputCode(e.target.value.toUpperCase());
                        setBindError("");
                      }}
                      className="flex-1 bg-slate-50 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder-slate-400 transition-colors"
                      maxLength={15}
                    />
                    <button
                      type="submit"
                      disabled={binding || !inputCode.trim()}
                      className="px-4 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all active:scale-95 flex items-center space-x-1 flex-shrink-0"
                    >
                      {binding ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>Apply Code</span>
                      )}
                    </button>
                  </div>
                </div>

                {bindError && (
                  <p className="text-xs font-bold text-rose-500 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{bindError}</span>
                  </p>
                )}

                <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-casino-dark/70 border border-slate-200/80 dark:border-casino-border/80 text-[11px] text-slate-600 dark:text-gray-300 space-y-0.5">
                  <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Important: Single-Use Binding</span>
                  </div>
                  <p className="text-slate-500 dark:text-gray-400">
                    You can only input a referral code once. Once connected, your inviter cannot be changed.
                  </p>
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-casino-border/60 text-[11px] text-slate-500 dark:text-gray-400 flex items-center justify-between">
            <span>Status:</span>
            <span
              className={`font-black ${isBound ? "text-emerald-500" : "text-slate-400"}`}
            >
              {isBound ? "Linked to Team" : "Unlinked (Eligible to enter code)"}
            </span>
          </div>
        </div>
      </div>

      {/* OVERVIEW STATS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Total Coins Earned */}
        <div className="bg-gradient-to-br from-amber-500/15 via-white dark:via-casino-card to-white dark:to-casino-card border border-amber-400/40 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
              Total Bonus Earned
            </span>
            <div className="p-1 rounded-lg bg-amber-500/10">
              <CoinIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
            {formatCoins(summary?.totalCoinsEarned || 0)}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 block">
            From Level B & Level C Referrals
          </span>
        </div>

        {/* Metric 2: Total Network Members */}
        <div className="bg-gradient-to-br from-indigo-500/15 via-white dark:via-casino-card to-white dark:to-casino-card border border-indigo-400/40 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              Total Team Size
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-500">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
            {(summary?.totalMembers || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 block">
            Direct (B) + Sub (C)
          </span>
        </div>

        {/* Metric 3: Level B Direct Referrals */}
        <div className="bg-gradient-to-br from-emerald-500/15 via-white dark:via-casino-card to-white dark:to-casino-card border border-emerald-400/40 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Level B (Direct)
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-500">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
            {(summary?.directMembersCount || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-1 block">
            {config?.level1Percent || 5}% Deposit Commission
          </span>
        </div>

        {/* Metric 4: Level C Sub-Referrals */}
        <div className="bg-gradient-to-br from-cyan-500/15 via-white dark:via-casino-card to-white dark:to-casino-card border border-cyan-400/40 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
              Level C (Sub)
            </span>
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-500">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
            {(summary?.subMembersCount || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-bold mt-1 block">
            {config?.level2Percent || 1}% Deposit Commission
          </span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 👑 VISUAL 3-TIER REFERRAL PYRAMID HIERARCHY */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-casino-card rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-casino-border shadow-md space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
            <Crown className="w-3.5 h-3.5" />
            <span>Multi-Tier Commission Structure</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Your Affiliate Network Pyramid
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            Hierarchical structure representing your team. Higher tiers receive
            automatic commissions whenever lower tiers buy coins.
          </p>
        </div>

        {/* Pyramid Container */}
        <div className="flex flex-col items-center space-y-4 max-w-4xl mx-auto">
          {/* TIER 1: LEVEL A (PEAK / YOU) */}
          <div className="w-full max-w-md bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 border-2 border-amber-400 rounded-3xl p-4 sm:p-5 shadow-xl shadow-amber-500/10 relative text-center">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-md">
              <Crown className="w-3.5 h-3.5" />
              <span>Level A • Apex Leader</span>
            </div>

            <div className="flex items-center justify-center space-x-3 mt-1">
              <PlayerAvatar
                photoUrl={user?.photoUrl || user?.photo_url}
                username={user?.username}
                userId={user?.id}
                size="lg"
                borderColor="border-2 border-amber-400"
              />
              <div className="text-left">
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white block leading-tight">
                  @{user?.username} (You)
                </span>
                <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                  Code: {referralCode}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-amber-400/30 grid grid-cols-2 gap-2 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-gray-400 block">
                  Total Earnings
                </span>
                <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                  {formatCoins(pyramid?.levelA?.totalEarned || 0)} Coins
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-gray-400 block">
                  Network Size
                </span>
                <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                  {(summary?.totalMembers || 0).toLocaleString()} Players
                </span>
              </div>
            </div>
          </div>

          {/* Cascading Arrow Down */}
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-6 bg-gradient-to-b from-amber-400 to-emerald-400" />
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-500">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>

          {/* TIER 2: LEVEL B (DIRECT REFERRALS - 5%) */}
          <div className="w-full max-w-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border-2 border-emerald-400 rounded-3xl p-4 sm:p-5 shadow-lg shadow-emerald-500/10 relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-md">
              <UserCheck className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>
                Level B • Direct Referrals ({config?.level1Percent || 5}% Bonus)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>Level B Team</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                    {pyramid?.levelB?.memberCount || 0} Members
                  </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Friends directly invited by you using code{" "}
                  <strong className="text-slate-800 dark:text-gray-200">
                    {referralCode}
                  </strong>
                </p>
              </div>

              <div className="flex items-center space-x-3 bg-white/70 dark:bg-casino-dark/70 rounded-2xl p-2.5 px-4 border border-emerald-400/30">
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 block">
                    Bonus Earned
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    +{formatCoins(pyramid?.levelB?.totalCoinsEarned || 0)}
                  </span>
                </div>
                <button
                  onClick={() => toggleLevel("B")}
                  className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-black transition-colors"
                  title="Toggle Member List"
                >
                  {expandedLevels.B ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Member List Drawer for Level B */}
            {expandedLevels.B && (
              <div className="mt-4 pt-3 border-t border-emerald-400/20 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 block">
                  Level B Members ({pyramid?.levelB?.members?.length || 0})
                </span>
                {pyramid?.levelB?.members?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {pyramid.levelB.members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center space-x-2.5 bg-white dark:bg-casino-dark/90 rounded-xl p-2 border border-emerald-400/30 shadow-sm"
                      >
                        <PlayerAvatar
                          photoUrl={m.photoUrl}
                          username={m.username}
                          userId={m.id}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                            @{m.username}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-gray-400 block">
                            {formatCoins(m.coinBalance)} Coins
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-gray-500 italic py-2">
                    No direct referrals yet. Share your code to start earning 5%
                    buy coins bonus!
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Cascading Arrow Down */}
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-6 bg-gradient-to-b from-emerald-400 to-indigo-400" />
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-400 flex items-center justify-center text-indigo-500">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>

          {/* TIER 3: LEVEL C (SUB-REFERRALS - 1%) */}
          <div className="w-full max-w-3xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border-2 border-indigo-400 rounded-3xl p-4 sm:p-5 shadow-lg shadow-indigo-500/10 relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-md">
              <Users className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>
                Level C • Sub-Referrals ({config?.level2Percent || 1}% Bonus)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>Level C Team</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono font-bold">
                    {pyramid?.levelC?.memberCount || 0} Members
                  </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Friends invited by your Level B referrals. You earn{" "}
                  {config?.level2Percent || 1}% passively when they deposit.
                </p>
              </div>

              <div className="flex items-center space-x-3 bg-white/70 dark:bg-casino-dark/70 rounded-2xl p-2.5 px-4 border border-indigo-400/30">
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 block">
                    Bonus Earned
                  </span>
                  <span className="text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
                    +{formatCoins(pyramid?.levelC?.totalCoinsEarned || 0)}
                  </span>
                </div>
                <button
                  onClick={() => toggleLevel("C")}
                  className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors"
                  title="Toggle Member List"
                >
                  {expandedLevels.C ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Member List Drawer for Level C */}
            {expandedLevels.C && (
              <div className="mt-4 pt-3 border-t border-indigo-400/20 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 block">
                  Level C Members ({pyramid?.levelC?.members?.length || 0})
                </span>
                {pyramid?.levelC?.members?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {pyramid.levelC.members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center space-x-2.5 bg-white dark:bg-casino-dark/90 rounded-xl p-2 border border-indigo-400/30 shadow-sm"
                      >
                        <PlayerAvatar
                          photoUrl={m.photoUrl}
                          username={m.username}
                          userId={m.id}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                            @{m.username}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-gray-400 block">
                            {formatCoins(m.coinBalance)} Coins
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-gray-500 italic py-2">
                    No sub-referrals yet. When your Level B friends invite their
                    friends, they will appear here!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* REWARDS TRANSACTION HISTORY TABLE */}
      <div className="bg-white dark:bg-casino-card rounded-2xl p-5 border border-slate-200 dark:border-casino-border shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-xl bg-amber-500/10">
              <CoinIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Referral Commission History
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-gray-400">
                Real-time breakdown of coins earned when team members buy coins
              </p>
            </div>
          </div>

          <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
            {stats?.recentRewards?.length || 0} Recent Payouts
          </span>
        </div>

        {stats?.recentRewards?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-casino-border/60 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Referee</th>
                  <th className="py-2.5 px-3">Level</th>
                  <th className="py-2.5 px-3">Deposit Coins</th>
                  <th className="py-2.5 px-3">Rate</th>
                  <th className="py-2.5 px-3 text-right">Commission Earned</th>
                  <th className="py-2.5 px-3 text-right">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-casino-border/40">
                {stats.recentRewards.map((reward) => (
                  <tr
                    key={reward.id}
                    className="hover:bg-slate-50 dark:hover:bg-casino-dark/50 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-2">
                        <PlayerAvatar
                          photoUrl={reward.refereePhotoUrl}
                          username={reward.refereeUsername}
                          size="sm"
                        />
                        <span className="font-bold text-slate-900 dark:text-white">
                          @{reward.refereeUsername}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          reward.level === 1
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                            : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30"
                        }`}
                      >
                        {reward.levelLabel}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 dark:text-gray-300">
                      {formatCoins(reward.depositCoins)} Coins
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-600 dark:text-gray-400">
                      {reward.commissionPercent}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                      +{formatCoins(reward.bonusCoins)} Coins
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400 dark:text-gray-500 text-[11px]">
                      {new Date(reward.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center text-slate-400 dark:text-gray-500 space-y-2 border border-dashed border-slate-200 dark:border-casino-border rounded-2xl">
            <CoinIcon className="w-10 h-10 mx-auto" />
            <p className="text-xs font-semibold">
              No commission rewards earned yet.
            </p>
            <p className="text-[11px] text-slate-400 dark:text-gray-500 max-w-sm mx-auto">
              When players who entered your referral code buy coins, your 5% and
              1% bonus coins will appear here automatically!
            </p>
          </div>
        )}
      </div>

      {/* QR CODE MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Scan to Join Network
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Share your QR code with friends
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-inner border border-slate-200">
              <QRCodeSVG
                value={inviteLink || referralCode}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500 block">
                Referral Code
              </span>
              <span className="text-xl font-black font-mono tracking-widest text-amber-500">
                {referralCode}
              </span>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-black shadow-md flex items-center justify-center space-x-1"
              >
                {copiedLink ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>{copiedLink ? "Link Copied" : "Copy Link"}</span>
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-casino-border hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
