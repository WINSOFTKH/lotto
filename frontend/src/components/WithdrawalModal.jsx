import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  CreditCard,
  Plus,
  Star,
} from 'lucide-react';
import { withdrawalAPI } from '../services/api';
import BankLogo from './BankLogo';

export default function WithdrawalModal({
  isOpen,
  onClose,
  currentBalance,
  onWithdrawalSubmitted,
  onNavigatePaymentMethods,
  initialPaymentMethodId = null,
}) {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [supportedBanks, setSupportedBanks] = useState([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [coinsPerUsd, setCoinsPerUsd] = useState(4000);
  const [minWithdrawalCoins, setMinWithdrawalCoins] = useState(1500);
  const [coinAmount, setCoinAmount] = useState('4000');
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess('');
      loadConfig();
    }
  }, [isOpen, initialPaymentMethodId]);

  const loadConfig = async () => {
    try {
      setConfigLoading(true);
      const res = await withdrawalAPI.getConfig();
      if (res.data?.data) {
        const rate = res.data.data.coinsPerUsd || 4000;
        const minVal = res.data.data.minWithdrawalCoins || 1500;
        const methods = res.data.data.paymentMethods || [];
        const supported = res.data.data.supportedBanks || [];
        setCoinsPerUsd(rate);
        setMinWithdrawalCoins(minVal);
        setCoinAmount(String(Math.max(rate, minVal)));
        setPaymentMethods(methods);
        setSupportedBanks(supported);

        if (initialPaymentMethodId && methods.some((m) => m.id === initialPaymentMethodId)) {
          setSelectedMethodId(initialPaymentMethodId);
        } else {
          const def = methods.find((m) => m.is_default) || methods[0];
          setSelectedMethodId(def ? def.id : '');
        }
      }
    } catch (err) {
      console.warn('Failed to load withdrawal config:', err);
    } finally {
      setConfigLoading(false);
    }
  };

  const numCoins = parseInt(coinAmount, 10) || 0;
  const estimatedUsd = (numCoins / coinsPerUsd).toFixed(2);
  const selectedMethod = paymentMethods.find((m) => m.id === selectedMethodId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedMethodId || !selectedMethod) {
      setError('Please select or set up a payment method first.');
      return;
    }

    if (numCoins > currentBalance) {
      setError(`Insufficient balance. You currently have ${currentBalance?.toLocaleString()} coins.`);
      return;
    }

    if (numCoins < minWithdrawalCoins) {
      setError(
        `Minimum sell coins is ${minWithdrawalCoins.toLocaleString()} coins ($${(
          minWithdrawalCoins / coinsPerUsd
        ).toFixed(2)} USD)`
      );
      return;
    }

    try {
      setLoading(true);
      const res = await withdrawalAPI.request({
        coinAmount: numCoins,
        paymentMethodId: selectedMethod.id,
        bankName: selectedMethod.bank_name,
        accountNumber: selectedMethod.account_number,
        accountName: selectedMethod.account_name,
      });

      setSuccess('Sell coins request submitted! Coins escrowed pending Finance approval.');
      if (onWithdrawalSubmitted) onWithdrawalSubmitted(res.data.data.remainingCoins);
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 2200);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit sell coins request');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-casino-card border border-casino-border rounded-2xl p-4 sm:p-6 shadow-2xl overflow-y-auto max-h-[92vh]"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center space-x-3 mb-4 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 flex-shrink-0">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Sell Coins to Cash</h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">Transfer payout directly to your saved Payment Method</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {configLoading ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-gray-400">
              Loading your saved payment methods...
            </div>
          ) : paymentMethods.length === 0 ? (
            /* Prompt to set up Payment Method once */
            <div className="bg-slate-50 dark:bg-casino-dark border border-amber-500/40 rounded-2xl p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">No Payment Method Set Up Yet</h4>
                <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                  Set up your receiving bank account once in <strong className="text-amber-500 dark:text-amber-400">Payment Method</strong>, and you can sell coins anytime with a single click.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigatePaymentMethods) {
                    onNavigatePaymentMethods();
                  }
                }}
                className="w-full py-3 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 hover:from-amber-400 hover:to-yellow-200 text-black shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Set Up Payment Method Now</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Saved Payment Method Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    Receiving Bank Account:
                  </label>
                  {onNavigatePaymentMethods && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigatePaymentMethods();
                      }}
                      className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 flex items-center space-x-1"
                    >
                      <CreditCard className="w-3 h-3" />
                      <span>Edit Payment Method</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {paymentMethods.slice(0, 1).map((m) => {
                    const isSelected = m.id === selectedMethodId;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMethodId(m.id)}
                        className="rounded-xl p-3 border bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/50 dark:border-emerald-500/60 ring-1 ring-emerald-500/20 dark:ring-emerald-500/30 flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          {(() => {
                            const bObj = supportedBanks.find((b) => (typeof b === 'string' ? b : b.name) === m.bank_name);
                            const bLogo = typeof bObj === 'object' ? bObj?.logo : null;
                            return <BankLogo bankName={m.bank_name} logoUrl={bLogo} size="md" />;
                          })()}
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-black text-slate-900 dark:text-white truncate">{m.bank_name}</span>
                              <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold">
                                <span>Linked</span>
                              </span>
                            </div>
                            <div className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5 truncate">
                              {m.account_number} • <span className="font-sans text-slate-700 dark:text-gray-300 font-semibold">{m.account_name}</span>
                            </div>
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-gray-600'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    Coins to Sell:
                  </label>
                  <span className="text-xs text-slate-500 dark:text-gray-400">
                    Available: <strong className="text-amber-600 dark:text-amber-400">{currentBalance?.toLocaleString()}</strong>
                  </span>
                </div>
                <input
                  type="number"
                  min={minWithdrawalCoins}
                  step="500"
                  value={coinAmount}
                  onChange={(e) => setCoinAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                  required
                />
                <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500 dark:text-gray-400">
                  <span>
                    Min: {minWithdrawalCoins.toLocaleString()} Coins ($
                    {(minWithdrawalCoins / coinsPerUsd).toFixed(2)})
                  </span>
                  <span>Rate: {coinsPerUsd.toLocaleString()} Coins = $1.00 USD</span>
                </div>
              </div>

              {/* Live Exchange Rate & Conversion Preview */}
              <div className="bg-slate-50 dark:bg-casino-dark/80 rounded-xl p-3 border border-slate-200 dark:border-casino-border/60 text-xs flex justify-between items-center">
                <div>
                  <span className="text-slate-800 dark:text-gray-300 font-semibold block">
                    Rate: {coinsPerUsd.toLocaleString()} Coins = $1.00 USD
                  </span>
                  <span className="text-slate-500 dark:text-gray-500 text-[11px]">
                    Min sell coins: {minWithdrawalCoins.toLocaleString()} Coins
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 dark:text-gray-400 block">You Receive:</span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">${estimatedUsd} USD</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                <span>{loading ? 'Submitting Request...' : `Submit Sell Coins ($${estimatedUsd})`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
