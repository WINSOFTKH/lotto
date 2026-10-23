import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Building2, Coins, ArrowUpRight, Clock, CheckCircle2, 
  XCircle, Ban, RefreshCw, AlertCircle, Plus, ShieldCheck, 
  Search, ExternalLink, ChevronRight, CreditCard 
} from 'lucide-react';
import { withdrawalAPI } from '../services/api';
import WithdrawalModal from '../components/WithdrawalModal';
import BankLogo from '../components/BankLogo';
import { formatCoins } from '../utils/formatters';

export default function WithdrawalPage({
  user,
  onUserBalanceUpdate,
  onBack,
  onNavigatePaymentMethods,
}) {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'approved', 'cancelled'
  const [config, setConfig] = useState({ coinsPerUsd: 4000, minWithdrawalCoins: 1500, paymentMethods: [] });
  const [showNewModal, setShowNewModal] = useState(false);
  const [cancellingItem, setCancellingItem] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [confRes, listRes] = await Promise.all([
        withdrawalAPI.getConfig().catch(() => null),
        withdrawalAPI.getMyWithdrawals().catch(() => null),
      ]);

      if (confRes?.data?.data) {
        setConfig(confRes.data.data);
      }
      if (listRes?.data?.data) {
        setWithdrawals(listRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load withdrawal data:', err);
      setError('Failed to load sell coins records');
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

  const handleConfirmCancel = async () => {
    if (!cancellingItem) return;
    try {
      setCancelLoading(true);
      setError('');
      setMessage('');
      const res = await withdrawalAPI.cancel(cancellingItem.id);
      setMessage(res.data.message || 'Sell coins request cancelled successfully and coins refunded!');
      setCancellingItem(null);
      if (onUserBalanceUpdate) {
        onUserBalanceUpdate();
      }
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel sell coins request');
    } finally {
      setCancelLoading(false);
    }
  };

  const coinsPerUsd = config.coinsPerUsd || 4000;
  const currentBalance = user?.coinBalance || 0;
  const balanceUsd = (currentBalance / coinsPerUsd).toFixed(2);

  // Compute summary stats
  const pendingItems = withdrawals.filter((w) => w.status === 'pending');
  const approvedItems = withdrawals.filter((w) => w.status === 'approved');
  const pendingCoins = pendingItems.reduce((acc, curr) => acc + Number(curr.coin_amount || 0), 0);
  const totalWithdrawnUsd = approvedItems.reduce((acc, curr) => acc + Number(curr.amount_usd || 0), 0);

  // Filter list
  const filteredWithdrawals = withdrawals.filter((w) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return w.status === 'pending';
    if (filter === 'approved') return w.status === 'approved';
    if (filter === 'rejected' || filter === 'cancelled') {
      return w.status === 'rejected' || w.status === 'cancelled';
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between gap-2 border-b border-casino-border pb-3 sm:pb-4">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2.5 rounded-xl bg-casino-card hover:bg-casino-border border border-casino-border text-gray-300 hover:text-white transition-colors flex-shrink-0"
            title="Back to Lobby"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-black text-white flex items-center space-x-1.5 sm:space-x-2 truncate">
              <Building2 className="w-4 h-4 sm:w-6 sm:h-6 text-emerald-400 flex-shrink-0" />
              <span className="truncate">Sell Coins & Cash-Out</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-400 hidden sm:block">
              Convert coins directly to USD bank transfer with instant escrow refund support
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-3 flex-shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 sm:p-2.5 rounded-xl bg-casino-card hover:bg-casino-border border border-casino-border text-gray-300 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh List"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          {onNavigatePaymentMethods && (
            <button
              onClick={onNavigatePaymentMethods}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl bg-casino-card hover:bg-casino-border border border-casino-border text-amber-400 font-bold text-xs sm:text-sm transition-all"
              title="Manage Saved Bank Accounts"
            >
              <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Payment Method</span>
            </button>
          )}
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/30 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* Notification Banners */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-emerald-400 hover:text-white text-xs font-bold ml-2">
            Dismiss
          </button>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs sm:text-sm flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-white text-xs font-bold ml-2">
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Summary Cards Dashboard (Sleek 2x2 grid on mobile, 4-col on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {/* Available Balance */}
        <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-0.5 sm:mb-1">
            <span className="text-[10px] sm:text-xs text-gray-400 font-semibold truncate">Available Balance</span>
            <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 flex-shrink-0" />
          </div>
          <div className="text-sm sm:text-2xl font-black text-amber-400 font-mono tracking-tight truncate">
            {formatCoins(currentBalance)} <span className="text-[9px] sm:text-xs text-gray-400 font-normal">Coins</span>
          </div>
          <span className="text-[10px] sm:text-xs text-emerald-400 font-semibold block mt-0.5 sm:mt-1 truncate">
            ≈ ${balanceUsd} USD
          </span>
        </div>

        {/* Dynamic Exchange Rate */}
        <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-5">
          <div className="flex items-center justify-between mb-0.5 sm:mb-1">
            <span className="text-[10px] sm:text-xs text-gray-400 font-semibold truncate">Exchange Rate</span>
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0" />
          </div>
          <div className="text-sm sm:text-2xl font-black text-white font-mono tracking-tight truncate">
            {coinsPerUsd.toLocaleString()} = $1
          </div>
          <span className="text-[10px] sm:text-xs text-gray-400 block mt-0.5 sm:mt-1 truncate">
            Min: {config.minWithdrawalCoins?.toLocaleString() || '1,500'} Coins
          </span>
        </div>

        {/* In-Escrow Pending Requests */}
        <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-5">
          <div className="flex items-center justify-between mb-0.5 sm:mb-1">
            <span className="text-[10px] sm:text-xs text-gray-400 font-semibold truncate">In Escrow</span>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 animate-pulse flex-shrink-0" />
          </div>
          <div className="text-sm sm:text-2xl font-black text-amber-300 font-mono tracking-tight truncate">
            {formatCoins(pendingCoins)} <span className="text-[9px] sm:text-xs text-gray-400 font-normal">Coins</span>
          </div>
          <span className="text-[10px] sm:text-xs text-amber-400/80 block mt-0.5 sm:mt-1 truncate">
            {pendingItems.length} Pending
          </span>
        </div>

        {/* Total Cash Paid Out */}
        <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-5">
          <div className="flex items-center justify-between mb-0.5 sm:mb-1">
            <span className="text-[10px] sm:text-xs text-gray-400 font-semibold truncate">Total Paid Out</span>
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400 flex-shrink-0" />
          </div>
          <div className="text-sm sm:text-2xl font-black text-emerald-400 font-mono tracking-tight truncate">
            ${totalWithdrawnUsd.toFixed(2)} <span className="text-[9px] sm:text-xs text-gray-400 font-normal">USD</span>
          </div>
          <span className="text-[10px] sm:text-xs text-gray-400 block mt-0.5 sm:mt-1 truncate">
            {approvedItems.length} Approved
          </span>
        </div>
      </div>

      {/* Sell Coins History Card */}
      <div className="bg-casino-card border border-casino-border rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-xl space-y-3 sm:space-y-4">
        {/* Table Toolbar & Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-casino-border pb-3 sm:pb-4">
          <div>
            <h3 className="text-sm sm:text-base font-black text-white">Sell Coins Requests & History</h3>
            <p className="text-[11px] sm:text-xs text-gray-400 hidden sm:block">
              You can submit multiple sell coins requests. Pending requests can be cancelled anytime for an instant coin refund.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex bg-casino-dark border border-casino-border rounded-xl p-1 space-x-1 self-start sm:self-auto overflow-x-auto max-w-full">
            {[
              { id: 'all', label: 'All', count: withdrawals.length },
              { id: 'pending', label: 'Pending', count: pendingItems.length },
              { id: 'approved', label: 'Approved', count: approvedItems.length },
              { id: 'rejected', label: 'Cancelled', count: withdrawals.length - pendingItems.length - approvedItems.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1 ${
                  filter === tab.id
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-gray-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono ${filter === tab.id ? 'text-black/80 font-bold' : 'text-gray-500'}`}>
                  ({tab.count})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Section: Table for Desktop & Cards for Mobile */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span className="text-xs">Loading sell coins records...</span>
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-gray-800/60 border border-slate-300 dark:border-gray-700 mx-auto flex items-center justify-center text-gray-500">
              <Building2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-gray-300">No sell coins records found</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {filter === 'all'
                ? "You haven't requested to sell coins yet. Convert your lucky coins into USD cash transfers!"
                : `No requests matching filter '${filter}'.`}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => setShowNewModal(true)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Submit First Sell Coins Request</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View (hidden on small mobile screens) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-casino-border text-gray-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">Date & Ref</th>
                    <th className="py-3 px-3">Bank Details</th>
                    <th className="py-3 px-3">Coins Debited</th>
                    <th className="py-3 px-3">USD Amount</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-casino-border/50">
                  {filteredWithdrawals.map((w) => {
                    const isPending = w.status === 'pending';
                    const isApproved = w.status === 'approved';
                    const isCancelled = w.status === 'cancelled';
                    const isRejected = w.status === 'rejected';

                    return (
                      <tr key={w.id} className="hover:bg-casino-dark/50 transition-colors">
                        {/* Date & Ref */}
                        <td className="py-3.5 px-3">
                          <span className="font-semibold text-gray-200 block">
                            {new Date(w.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="text-[11px] text-gray-500 font-mono block">
                            {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • #{w.id.slice(0, 8)}
                          </span>
                        </td>

                        {/* Bank Details */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center space-x-2.5">
                            {(() => {
                              const bObj = (config?.supportedBanks || []).find((b) => (typeof b === 'string' ? b : b.name) === w.bank_name);
                              const bLogo = typeof bObj === 'object' ? bObj?.logo : null;
                              return <BankLogo bankName={w.bank_name} logoUrl={bLogo} size="sm" />;
                            })()}
                            <div className="min-w-0">
                              <span className="font-bold text-white block truncate">{w.bank_name}</span>
                              <span className="text-[11px] text-gray-400 font-mono block truncate">
                                {w.account_number} • <strong className="text-gray-300 font-sans">{w.account_name}</strong>
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Coins Debited */}
                        <td className="py-3.5 px-3">
                          <span className="font-extrabold text-amber-400 font-mono text-sm block">
                            -{formatCoins(w.coin_amount)}
                          </span>
                          <span className="text-[10px] text-gray-500">Coins</span>
                        </td>

                        {/* USD Amount */}
                        <td className="py-3.5 px-3">
                          <span className="font-black text-emerald-400 font-mono text-sm block">
                            ${Number(w.amount_usd).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-gray-500">USD Transfer</span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-3">
                          {isPending && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[11px]">
                              <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                              <span>Pending Review</span>
                            </span>
                          )}
                          {isApproved && (
                            <div>
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approved</span>
                              </span>
                              {w.processed_at && (
                                <span className="text-[10px] text-gray-500 block mt-0.5">
                                  {new Date(w.processed_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          )}
                          {isCancelled && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-400 font-bold text-[11px]">
                              <Ban className="w-3.5 h-3.5" />
                              <span>Cancelled & Refunded</span>
                            </span>
                          )}
                          {isRejected && (
                            <div>
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-[11px]">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Rejected</span>
                              </span>
                              {w.rejection_reason && (
                                <span className="text-[10px] text-rose-300/80 block mt-0.5 max-w-xs truncate" title={w.rejection_reason}>
                                  {w.rejection_reason}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="py-3.5 px-3 text-right">
                          {isPending ? (
                            <button
                              onClick={() => setCancellingItem(w)}
                              className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-bold text-xs transition-colors hover:text-white"
                              title="Cancel request and refund coins immediately"
                            >
                              Cancel & Refund
                            </button>
                          ) : (
                            <span className="text-gray-500 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (displayed on phones) */}
            <div className="grid grid-cols-1 gap-2 md:hidden">
              {filteredWithdrawals.map((w) => {
                const isPending = w.status === 'pending';
                const isApproved = w.status === 'approved';
                const isCancelled = w.status === 'cancelled';
                const isRejected = w.status === 'rejected';

                return (
                  <div
                    key={w.id}
                    className="bg-casino-dark/80 border border-casino-border/70 rounded-xl p-2.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {(() => {
                          const bObj = (config?.supportedBanks || []).find((b) => (typeof b === 'string' ? b : b.name) === w.bank_name);
                          const bLogo = typeof bObj === 'object' ? bObj?.logo : null;
                          return <BankLogo bankName={w.bank_name} logoUrl={bLogo} size="sm" />;
                        })()}
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate">{w.bank_name}</span>
                          <span className="text-[10px] text-gray-400 font-mono block truncate">
                            {w.account_number} • {w.account_name}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {isPending && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[9px] flex items-center space-x-1">
                            <Clock className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                            <span>Pending</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[9px] flex items-center space-x-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Approved</span>
                          </span>
                        )}
                        {isCancelled && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400 font-bold text-[9px] flex items-center space-x-1">
                            <Ban className="w-2.5 h-2.5" />
                            <span>Cancelled</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-[9px] flex items-center space-x-1">
                            <XCircle className="w-2.5 h-2.5" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-casino-card/60 border border-casino-border/40 text-[11px] font-mono">
                      <div className="flex items-center space-x-1">
                        <span className="text-[9px] text-gray-400 uppercase font-sans">Coins:</span>
                        <span className="font-extrabold text-amber-400">-{formatCoins(w.coin_amount)}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-right">
                        <span className="text-[9px] text-gray-400 uppercase font-sans">USD:</span>
                        <span className="font-extrabold text-emerald-400">${Number(w.amount_usd).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                      <span>{new Date(w.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • #{w.id.slice(0, 6)}</span>
                      {isPending && (
                        <button
                          onClick={() => setCancellingItem(w)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 font-bold text-[10px] hover:bg-rose-600/30 transition-colors"
                        >
                          Cancel & Refund
                        </button>
                      )}
                    </div>

                    {w.rejection_reason && (
                      <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px]">
                        <strong>Note:</strong> {w.rejection_reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Cancel Request Confirmation Modal */}
      <AnimatePresence>
        {cancellingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              className="relative w-full max-w-sm bg-casino-card border border-casino-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-center shadow-2xl overflow-hidden"
            >
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-3 sm:mb-4">
                <Ban className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <h3 className="text-lg font-black text-white mb-1">Cancel Sell Coins Request?</h3>
              <p className="text-xs text-gray-400 mb-4">
                Are you sure you want to cancel your sell coins request to <strong className="text-gray-200">{cancellingItem.bank_name}</strong>?
              </p>

              <div className="bg-casino-dark/90 border border-amber-500/30 rounded-2xl p-3.5 mb-5 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-left">
                  <Coins className="w-5 h-5 text-amber-400 animate-pulse" />
                  <div>
                    <span className="text-[10px] text-gray-400 block font-semibold uppercase">Instant Refund</span>
                    <span className="text-base font-black text-amber-400 font-mono">
                      +{Number(cancellingItem.coin_amount).toLocaleString()} Coins
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  +$ {Number(cancellingItem.amount_usd).toFixed(2)} USD
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setCancellingItem(null)}
                  disabled={cancelLoading}
                  className="py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs transition-colors"
                >
                  Keep Request
                </button>
                <button
                  onClick={handleConfirmCancel}
                  disabled={cancelLoading}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
                >
                  {cancelLoading ? 'Cancelling...' : 'Confirm & Refund'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Withdrawal Modal */}
      <WithdrawalModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        currentBalance={currentBalance}
        onNavigatePaymentMethods={onNavigatePaymentMethods}
        onWithdrawalSubmitted={async () => {
          if (onUserBalanceUpdate) {
            onUserBalanceUpdate();
          }
          await loadData();
          setMessage('New sell coins request submitted for approval!');
        }}
      />
    </div>
  );
}
