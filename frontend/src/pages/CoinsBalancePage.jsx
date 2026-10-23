import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Coins,
  ArrowUpRight,
  PlusCircle,
  RefreshCw,
  Gift,
  Trophy,
  History,
  TrendingUp,
  TrendingDown,
  Building2,
  Users,
  ShieldAlert,
  Calendar,
} from "lucide-react";
import { walletAPI, withdrawalAPI } from "../services/api";
import { formatCoins } from "../utils/formatters";
import CoinIcon from "../components/CoinIcon";

export default function CoinsBalancePage({
  user,
  onBack,
  onOpenTopup,
  onOpenWithdraw,
  onUserBalanceUpdate,
}) {
  const [balance, setBalance] = useState(user?.coinBalance || 0);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    totalCount: 0,
    totalEarned: 0,
    totalSpent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [coinsPerUsd, setCoinsPerUsd] = useState(4000);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [txRes, confRes] = await Promise.all([
        walletAPI.getTransactions({ limit: 25 }).catch(() => null),
        withdrawalAPI.getConfig().catch(() => null),
      ]);

      if (txRes?.data?.data) {
        setBalance(txRes.data.data.coinBalance ?? (user?.coinBalance || 0));
        setTransactions(txRes.data.data.transactions || []);
        if (txRes.data.data.summary) {
          setSummary(txRes.data.data.summary);
        }
      }

      if (confRes?.data?.data?.coinsPerUsd) {
        setCoinsPerUsd(confRes.data.data.coinsPerUsd);
      }
    } catch (err) {
      console.error("Failed to load wallet transactions:", err);
      setError("Could not load transaction history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (onUserBalanceUpdate) {
      onUserBalanceUpdate();
    }
  };

  const balanceUsd = (balance / coinsPerUsd).toFixed(2);

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (filter === "all") return true;
    if (filter === "wins") {
      return [
        "game_win_payout",
        "daily_bonus",
        "welcome_bonus",
        "referral_bonus",
      ].includes(tx.type);
    }
    if (filter === "games") {
      return tx.type === "game_entry_fee";
    }
    if (filter === "topup") {
      return tx.type === "khqr_deposit";
    }
    if (filter === "withdraw") {
      return ["withdrawal_deduct", "withdrawal_refund"].includes(tx.type);
    }
    return true;
  });

  const getTransactionMeta = (type, amount) => {
    switch (type) {
      case "game_win_payout":
        return {
          label: "Game Win Payout",
          icon: Trophy,
          color: "text-amber-400 bg-amber-500/15 border-amber-500/30",
          badgeText: "🏆 Winner",
        };
      case "game_entry_fee":
        return {
          label: "Table Entry Fee",
          icon: Coins,
          color: "text-rose-400 bg-rose-500/15 border-rose-500/30",
          badgeText: "🎟️ Entry",
        };
      case "daily_bonus":
        return {
          label: "Daily Reward Bonus",
          icon: Gift,
          color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
          badgeText: "🎁 Daily",
        };
      case "welcome_bonus":
        return {
          label: "Welcome Starter Bonus",
          icon: Gift,
          color: "text-purple-400 bg-purple-500/15 border-purple-500/30",
          badgeText: "🌟 Welcome",
        };
      case "referral_bonus":
        return {
          label: "Referral Commission",
          icon: Users,
          color: "text-indigo-400 bg-indigo-500/15 border-indigo-500/30",
          badgeText: "🤝 Referral",
        };
      case "khqr_deposit":
        return {
          label: "Buy Coins Deposit",
          icon: PlusCircle,
          color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
          badgeText: "🪙 Buy Coins",
        };
      case "withdrawal_deduct":
        return {
          label: "Sell Coins Escrow",
          icon: Building2,
          color: "text-orange-400 bg-orange-500/15 border-orange-500/30",
          badgeText: "🏦 Sell Coins",
        };
      case "withdrawal_refund":
        return {
          label: "Sell Coins Refund",
          icon: TrendingUp,
          color: "text-teal-400 bg-teal-500/15 border-teal-500/30",
          badgeText: "↩️ Refund",
        };
      default:
        return {
          label: amount >= 0 ? "Credit Adjustment" : "Debit Adjustment",
          icon: amount >= 0 ? TrendingUp : TrendingDown,
          color:
            amount >= 0
              ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
              : "text-rose-400 bg-rose-500/15 border-rose-500/30",
          badgeText: amount >= 0 ? "Adjustment (+)" : "Adjustment (-)",
        };
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-2.5 sm:px-6 py-2.5 sm:py-5 space-y-2.5 sm:space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 border-b border-casino-border pb-2.5 sm:pb-3.5">
        <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2 rounded-xl bg-casino-card hover:bg-casino-border border border-casino-border text-gray-300 hover:text-white transition-colors flex-shrink-0"
            title="Back to Lobby"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-xl font-black text-white flex items-center space-x-1.5 truncate">
              <CoinIcon className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              <span className="truncate">Coins Balance</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-gray-400 hidden sm:block">
              View your coin balance and real-time ledger of latest 25
              transactions
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 sm:p-2 rounded-xl bg-casino-card hover:bg-casino-border border border-casino-border text-gray-300 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh Ledger"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? "animate-spin text-amber-400" : ""}`}
            />
          </button>
          <button
            onClick={onOpenTopup}
            className="flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] sm:text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Buy Coins</span>
          </button>
          <button
            onClick={onOpenWithdraw}
            className="flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-[11px] sm:text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Sell Coins</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2.5 sm:p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError("")}
            className="text-rose-400 hover:text-white text-xs font-bold ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Hero Card: Current Coins Balance */}
      <div className="bg-gradient-to-br from-amber-500/15 via-casino-card to-casino-card border border-amber-500/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] sm:text-xs uppercase font-bold tracking-wider text-gray-400">
                Current Balance
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div className="flex items-baseline space-x-1.5 sm:space-x-2">
              <span className="text-2xl sm:text-4xl font-black font-mono text-amber-400 tracking-tight">
                {formatCoins(balance)}
              </span>
            </div>
            <div className="text-[11px] sm:text-xs text-emerald-400 font-semibold flex items-center space-x-1.5 flex-wrap">
              <span>≈ ${balanceUsd} USD</span>
              <span className="text-gray-400 text-[10px]">
                ({coinsPerUsd.toLocaleString()} Coins = $1.00)
              </span>
            </div>
          </div>
          <div className="p-2 sm:p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <CoinIcon className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
        </div>
      </div>

      {/* 3 Metric Summary KPI Bar - Compact 3-Column on Mobile */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        {/* Total Earned */}
        <div className="bg-casino-card border border-casino-border rounded-xl p-2 sm:p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] sm:text-xs text-gray-400 font-semibold truncate">
              Earned
            </span>
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0" />
          </div>
          <div className="text-xs sm:text-lg font-black font-mono text-emerald-400 truncate">
            +{formatCoins(summary.totalEarned)}
          </div>
          <span className="text-[9px] text-gray-500 hidden sm:block mt-0.5">
            Wins & bonuses
          </span>
        </div>

        {/* Total Spent */}
        <div className="bg-casino-card border border-casino-border rounded-xl p-2 sm:p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] sm:text-xs text-gray-400 font-semibold truncate">
              Spent
            </span>
            <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-rose-400 flex-shrink-0" />
          </div>
          <div className="text-xs sm:text-lg font-black font-mono text-rose-400 truncate">
            -{formatCoins(summary.totalSpent)}
          </div>
          <span className="text-[9px] text-gray-500 hidden sm:block mt-0.5">
            Entry & cash-outs
          </span>
        </div>

        {/* Total Transactions */}
        <div className="bg-casino-card border border-casino-border rounded-xl p-2 sm:p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] sm:text-xs text-gray-400 font-semibold truncate">
              Activity
            </span>
            <History className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400 flex-shrink-0" />
          </div>
          <div className="text-xs sm:text-lg font-black font-mono text-white truncate">
            {summary.totalCount}{" "}
            <span className="text-[9px] sm:text-xs text-gray-400 font-normal">
              Txs
            </span>
          </div>
          <span className="text-[9px] text-cyan-400/80 hidden sm:block mt-0.5">
            Latest 25 records
          </span>
        </div>
      </div>

      {/* Transactions List Card */}
      <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-5 shadow-lg space-y-3">
        {/* Toolbar & Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-casino-border pb-2.5 sm:pb-3">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-white flex items-center space-x-1.5">
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>Latest 25 Coins Transactions</span>
            </h3>
            <p className="text-[10px] sm:text-xs text-gray-400 hidden sm:block">
              Double-entry audit log of latest 25 coin movements in your wallet
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex bg-casino-dark border border-casino-border rounded-lg p-0.5 space-x-0.5 self-start sm:self-auto overflow-x-auto max-w-full scrollbar-none">
            {[
              { id: "all", label: "All" },
              { id: "wins", label: "Wins & Rewards" },
              { id: "games", label: "Game Fees" },
              { id: "topup", label: "Buy Coins" },
              { id: "withdraw", label: "Sell Coins" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                  filter === tab.id
                    ? "bg-amber-500 text-black shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table */}
        {loading ? (
          <div className="py-12 text-center text-gray-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
            <span className="text-xs">Loading transaction history...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-12 text-center space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-casino-dark border border-casino-border mx-auto flex items-center justify-center">
              <CoinIcon className="w-6 h-6" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-gray-300">
              No coin transactions found
            </h4>
            <p className="text-[11px] sm:text-xs text-gray-500 max-w-sm mx-auto">
              {filter === "all"
                ? "Join a lottery table, claim your daily bonus, or buy coins to see transactions here."
                : `No transactions matching filter '${filter}'.`}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-casino-border text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-casino-border/50 text-xs">
                  {filteredTransactions.map((tx) => {
                    const numAmt = Number(tx.amount || 0);
                    const isPositive = numAmt > 0;
                    const meta = getTransactionMeta(tx.type, numAmt);
                    const IconComponent = meta.icon;

                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${meta.color}`}
                          >
                            <IconComponent className="w-3.5 h-3.5" />
                            <span>{meta.badgeText}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium text-gray-200">
                          <div>{tx.description || meta.label}</div>
                          {tx.reference_id && (
                            <span className="text-[10px] font-mono text-gray-500 block">
                              Ref: {tx.reference_id}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-gray-400 whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString([], {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-sm whitespace-nowrap">
                          <span
                            className={
                              isPositive ? "text-emerald-400" : "text-rose-400"
                            }
                          >
                            {isPositive
                              ? `+${formatCoins(numAmt)}`
                              : `-${formatCoins(Math.abs(numAmt))}`}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-400/90 whitespace-nowrap">
                          {formatCoins(tx.balance_after)} Coins
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Compact List View */}
            <div className="md:hidden space-y-1.5">
              {filteredTransactions.map((tx) => {
                const numAmt = Number(tx.amount || 0);
                const isPositive = numAmt > 0;
                const meta = getTransactionMeta(tx.type, numAmt);
                const IconComponent = meta.icon;

                return (
                  <div
                    key={tx.id}
                    className="bg-casino-dark/70 hover:bg-casino-dark border border-casino-border/60 rounded-xl p-2 sm:p-2.5 flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center border flex-shrink-0 ${meta.color}`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-gray-200 block truncate">
                          {tx.description || meta.label}
                        </span>
                        <span className="text-[9px] text-gray-500 block truncate">
                          {new Date(tx.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div
                        className={`font-mono font-black text-xs sm:text-sm ${isPositive ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        {isPositive
                          ? `+${formatCoins(numAmt)}`
                          : `-${formatCoins(Math.abs(numAmt))}`}
                      </div>
                      <div className="text-[9px] font-mono text-gray-400">
                        Bal: {formatCoins(tx.balance_after)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
