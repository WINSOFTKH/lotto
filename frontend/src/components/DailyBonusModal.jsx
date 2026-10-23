import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Sparkles, CheckCircle2, Clock, X } from 'lucide-react';
import { bonusAPI } from '../services/api';

export default function DailyBonusModal({ isOpen, onClose, onBonusClaimed, onBonusStatusUpdate, playSound }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    try {
      const res = await bonusAPI.getStatus();
      const bonusData = res.data.data;
      setStatus(bonusData);
      if (bonusData && bonusData.canClaim !== undefined && onBonusStatusUpdate) {
        onBonusStatusUpdate(Boolean(bonusData.canClaim));
      }
    } catch (err) {
      console.error('Failed to load bonus status:', err);
    }
  };

  const handleClaim = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await bonusAPI.claim();
      setMessage(res.data.message);
      if (playSound) playSound();
      if (onBonusClaimed) onBonusClaimed(res.data.data.coinBalance);
      await loadStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to claim daily bonus');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-casino-card border border-casino-border rounded-2xl p-6 text-center shadow-2xl overflow-hidden"
        >
          {/* Background Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Header */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white mb-4 shadow-lg shadow-emerald-500/20">
            <Gift className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-bold text-white mb-1">Daily Lucky Bonus</h3>
          <p className="text-xs text-gray-400 mb-6">
            Log in every 24 hours to claim {status?.bonusCoins ? status.bonusCoins.toLocaleString() : '10'} free lottery coins!
          </p>

          {/* Reward Display Box */}
          <div className="bg-casino-dark/80 border border-emerald-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-3 text-left">
              <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
              <div>
                <span className="text-xs text-gray-400 block">Daily Reward</span>
                <span className="text-lg font-extrabold text-amber-400">
                  +{status?.bonusCoins ? status.bonusCoins.toLocaleString() : '10'} Free Coins
                </span>
              </div>
            </div>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 font-semibold px-2.5 py-1 rounded-full border border-emerald-500/30">
              Active
            </span>
          </div>

          {message && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Claim Action */}
          {status?.canClaim ? (
            <button
              onClick={handleClaim}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {loading
                ? 'Claiming Coins...'
                : `Claim ${status?.bonusCoins ? status.bonusCoins.toLocaleString() : '10'} Free Coins Now`}
            </button>
          ) : (
            <div className="space-y-3">
              <button
                disabled
                className="w-full py-3 px-4 rounded-xl font-medium text-xs bg-gray-800 text-gray-400 cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Clock className="w-4 h-4 text-gray-500" />
                <span>Already Claimed for Today!</span>
              </button>
              <p className="text-[11px] text-gray-500">
                Next claim available tomorrow at 00:00 UTC.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
