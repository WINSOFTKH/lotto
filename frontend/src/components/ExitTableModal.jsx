import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import CoinIcon from './CoinIcon';
import { formatCoins } from '../utils/formatters';

export default function ExitTableModal({
  isOpen,
  onClose,
  onConfirm,
  tableName = 'Game Room',
  entryFee = 0,
  loading = false,
  error = '',
}) {
  if (!isOpen) return null;

  const feeNumber = Number(entryFee) || 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-3xl p-6 text-center shadow-2xl overflow-hidden"
        >
          {/* Ambient Lighting Glows */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500/20 via-rose-500/10 to-amber-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500 dark:text-rose-400 mb-4 shadow-lg shadow-rose-500/10">
            <LogOut className="w-8 h-8 text-rose-500 dark:text-rose-400" />
          </div>

          {/* Title & Subtitle */}
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
            Exit Table & Refund?
          </h3>
          <p className="text-xs text-slate-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
            Are you sure you want to leave <span className="text-slate-800 dark:text-gray-200 font-semibold">{tableName}</span> before the game starts?
          </p>

          {/* Error Banner */}
          {error && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-600 dark:text-red-300 text-xs flex items-center space-x-2 text-left">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Instant Refund Callout Card */}
          <div className="bg-amber-50/70 dark:bg-casino-dark/90 border border-amber-300 dark:border-amber-500/30 rounded-2xl p-4 my-5 text-left flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/25 to-yellow-500/10 border border-amber-500/40 flex items-center justify-center text-amber-500 dark:text-amber-400 flex-shrink-0">
                <CoinIcon className="w-7 h-7 drop-shadow-md" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-gray-400 font-semibold block">
                  Coin Refund
                </span>
                <span className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight truncate block">
                  +{formatCoins(feeNumber)} <span className="text-xs font-normal text-amber-700/80 dark:text-amber-200/80">Coins</span>
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400 text-[10px] sm:text-[11px] font-bold flex-shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Instant 100%</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-gray-400/90 mb-5 leading-normal">
            Your seat will be released and your full entry fee will be returned to your wallet immediately.
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-slate-200 dark:bg-gray-800/90 hover:bg-slate-300 dark:hover:bg-gray-700/90 border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-all disabled:opacity-50"
            >
              Stay in Table
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="py-3 px-4 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:via-rose-400 hover:to-amber-500 text-white shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span>{loading ? 'Exiting...' : 'Confirm & Exit'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
