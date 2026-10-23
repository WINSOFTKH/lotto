import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit3,
  ArrowUpRight,
  ShieldCheck,
  X,
  RefreshCw,
} from "lucide-react";
import { withdrawalAPI } from "../services/api";
import BankLogo, { BANK_METADATA } from "../components/BankLogo";

export const CAMBODIAN_BANKS = BANK_METADATA.map((b) => b.name);

export default function PaymentMethodPage({
  user,
  onBack,
  onNavigateSellCoins,
  onOpenSellCoinsModal,
}) {
  const [methods, setMethods] = useState([]);
  const [banksList, setBanksList] = useState(CAMBODIAN_BANKS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Form / Modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [bankName, setBankName] = useState(CAMBODIAN_BANKS[0]);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [label, setLabel] = useState("");

  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      setError("");
      const [pmRes, confRes] = await Promise.all([
        withdrawalAPI.getPaymentMethods().catch(() => null),
        withdrawalAPI.getConfig().catch(() => null),
      ]);

      if (pmRes?.data?.data) {
        setMethods(pmRes.data.data.slice(0, 1));
      }

      if (confRes?.data?.data?.supportedBanks && Array.isArray(confRes.data.data.supportedBanks) && confRes.data.data.supportedBanks.length > 0) {
        const banks = confRes.data.data.supportedBanks;
        setBanksList(banks);
        const firstBankName = typeof banks[0] === 'string' ? banks[0] : (banks[0]?.name || '');
        setBankName((prev) => {
          const exists = banks.some((b) => (typeof b === 'string' ? b : b?.name) === prev);
          return exists ? prev : firstBankName;
        });
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to load saved payment method",
      );
    } finally {
      setLoading(false);
    }
  };

  const openEditForm = (m) => {
    setEditingMethod(m);
    setBankName(m.bank_name || CAMBODIAN_BANKS[0]);
    setAccountNumber(m.account_number || "");
    setAccountName(m.account_name || "");
    setLabel(m.label || "");
    setError("");
    setShowFormModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!accountNumber.trim() || !accountName.trim()) {
      setError("Please enter both Account Number and Account Holder Name");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        bankName,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim().toUpperCase(),
        label: label.trim() || null,
        isDefault: true,
      };

      if (editingMethod) {
        const res = await withdrawalAPI.updatePaymentMethod(
          editingMethod.id,
          payload,
        );
        setMessage(res.data?.message || "Bank account updated successfully!");
      } else {
        const res = await withdrawalAPI.createPaymentMethod(payload);
        setMessage(
          res.data?.message ||
            "Bank account saved! You can now use it anytime to sell coins.",
        );
      }

      setShowFormModal(false);
      setEditingMethod(null);
      setAccountNumber("");
      setAccountName("");
      setLabel("");
      await loadPaymentMethods();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save payment method");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setDeletingId(id);
      setError("");
      setMessage("");
      await withdrawalAPI.deletePaymentMethod(id);
      setMessage(
        "Bank account removed. You can now set up a new bank account.",
      );
      await loadPaymentMethods();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to remove payment method");
    } finally {
      setDeletingId(null);
    }
  };

  const savedMethod = methods[0] || null;

  return (
    <div className="max-w-4xl mx-auto px-2.5 sm:px-6 py-3 sm:py-6 space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 border-b border-casino-border pb-3 sm:pb-4">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2.5 rounded-xl bg-casino-card hover:bg-casino-border border border-casino-border text-gray-300 hover:text-white transition-colors flex-shrink-0"
            title="Back to Sell Coins"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-black text-white flex items-center space-x-1.5 sm:space-x-2 truncate">
              <CreditCard className="w-4 h-4 sm:w-6 sm:h-6 text-amber-400 flex-shrink-0" />
              <span className="truncate">Payment Method</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-400 hidden sm:block">
              Set up your receiving bank account (1 bank account per player) for
              selling coins
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2.5 flex-shrink-0">
          {onNavigateSellCoins && (
            <button
              onClick={onNavigateSellCoins}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl bg-casino-card hover:bg-casino-border border border-casino-border text-emerald-400 font-bold text-xs sm:text-sm transition-all"
            >
              <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Back to Sell Coins</span>
            </button>
          )}
          {savedMethod && (
            <button
              onClick={() => openEditForm(savedMethod)}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 hover:from-amber-400 hover:to-yellow-200 text-black font-black text-xs sm:text-sm shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Edit Bank Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-casino-card/90 border border-casino-border rounded-2xl p-3.5 sm:p-4 flex items-start space-x-3">
        <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 flex-shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="text-xs text-gray-300 space-y-0.5">
          <div className="font-bold text-white">
            One-Time Bank Account Setup (1 Account Limit)
          </div>
          <p className="text-gray-400 leading-relaxed">
            Each player can link{" "}
            <strong className="text-amber-400">one bank account</strong>. Once
            saved, your bank account will be used automatically whenever you{" "}
            <strong className="text-emerald-400">Sell Coins</strong>.
          </p>
        </div>
      </div>

      {/* Feedback Alerts */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 sm:p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span>{message}</span>
          </div>
          <button
            onClick={() => setMessage("")}
            className="text-emerald-400 hover:text-white text-xs font-bold ml-2"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 sm:p-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs sm:text-sm flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError("")}
            className="text-rose-400 hover:text-white text-xs font-bold ml-2"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center space-y-2 bg-casino-card border border-casino-border rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
          <span className="text-xs">Loading saved payment method...</span>
        </div>
      ) : !savedMethod ? (
        /* One-Time Setup Card when player has 0 saved accounts */
        <div className="bg-casino-card border border-casino-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl">
          <div className="flex items-center space-x-3 mb-5 pb-3 border-b border-slate-200 dark:border-casino-border">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Set Up Your Bank Account
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Choose your bank below and enter your account details once
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5 max-w-2xl">
            {/* Visual Bank Selector Grid with Bank Logos */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Select Your Bank:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {banksList.map((item) => {
                  const bName = typeof item === 'string' ? item : item.name;
                  const bLogo = typeof item === 'object' ? item.logo : null;
                  const isSelected = bankName === bName;
                  return (
                    <button
                      key={bName}
                      type="button"
                      onClick={() => setBankName(bName)}
                      className={`p-2.5 sm:p-3 rounded-xl border text-left flex items-center space-x-2.5 transition-all ${
                        isSelected
                          ? "bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/40 shadow-md"
                          : "bg-slate-50 dark:bg-casino-dark border-slate-200 dark:border-casino-border hover:border-gray-400 dark:hover:border-gray-600"
                      }`}
                    >
                      <BankLogo bankName={bName} logoUrl={bLogo} size="md" />
                      <div className="min-w-0 flex-1">
                        <span
                          className={`text-xs font-black block truncate ${
                            isSelected
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {bName}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Account Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 000 123 456"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-gray-200 font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Account Holder Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. SOK CHANTHA"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-gray-200 uppercase focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Account Label / Nickname{" "}
                <span className="text-gray-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Personal Account"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full bg-slate-50 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-gray-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {saving ? "Saving Bank Account..." : "Save Bank Account"}
            </button>
          </form>
        </div>
      ) : (
        /* Single Saved Bank Account Card with Bank Logo */
        <div className="max-w-xl">
          <div className="bg-casino-card border border-amber-500/60 ring-1 ring-amber-500/20 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
            <div>
              {/* Card Top Row with Bank Logo */}
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center space-x-3.5 min-w-0">
                  {(() => {
                    const savedObj = banksList.find((b) => (typeof b === 'string' ? b : b.name) === savedMethod.bank_name);
                    const savedLogo = typeof savedObj === 'object' ? savedObj?.logo : null;
                    return <BankLogo bankName={savedMethod.bank_name} logoUrl={savedLogo} size="lg" />;
                  })()}
                  <div className="min-w-0">
                    <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                      {savedMethod.bank_name}
                    </h4>
                    {savedMethod.label ? (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold block truncate">
                        {savedMethod.label}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-gray-400 block">
                        Active Payout Bank Account
                      </span>
                    )}
                  </div>
                </div>

                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Linked</span>
                </span>
              </div>

              {/* Account Number & Holder Box */}
              <div className="bg-slate-50 dark:bg-casino-dark/90 border border-slate-200 dark:border-casino-border/80 rounded-xl p-4 space-y-2.5 mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-gray-400 font-semibold">
                    Account Number
                  </span>
                  <span className="text-base sm:text-lg font-mono font-black text-amber-600 dark:text-amber-400 tracking-wider">
                    {savedMethod.account_number}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 dark:border-casino-border/50 pt-2.5">
                  <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-gray-400 font-semibold">
                    Account Holder
                  </span>
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase">
                    {savedMethod.account_name}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Actions */}
            <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-200 dark:border-casino-border/60">
              <button
                onClick={() => {
                  if (onOpenSellCoinsModal) {
                    onOpenSellCoinsModal(savedMethod);
                  } else if (onNavigateSellCoins) {
                    onNavigateSellCoins();
                  }
                }}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Sell Coins Now</span>
              </button>

              <button
                onClick={() => openEditForm(savedMethod)}
                className="flex items-center space-x-1.5 py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-casino-dark dark:hover:bg-white/10 border border-slate-200 dark:border-casino-border text-slate-700 hover:text-slate-900 dark:text-gray-200 dark:hover:text-white text-xs font-bold transition-colors"
                title="Edit Bank Account"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit</span>
              </button>

              <button
                onClick={() => handleDelete(savedMethod.id)}
                disabled={deletingId === savedMethod.id}
                className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-colors disabled:opacity-50"
                title="Delete Bank Account"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bank Account Modal */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-casino-card border border-casino-border rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
            >
              <button
                onClick={() => setShowFormModal(false)}
                className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-3 mb-5">
                {(() => {
                  const currObj = banksList.find((b) => (typeof b === 'string' ? b : b.name) === bankName);
                  const currLogo = typeof currObj === 'object' ? currObj?.logo : null;
                  return <BankLogo bankName={bankName} logoUrl={currLogo} size="md" />;
                })()}
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingMethod
                      ? "Edit Bank Account"
                      : "Set Up Bank Account"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Update your payout bank account details
                  </p>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Select Bank
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {banksList.map((item) => {
                      const bName = typeof item === 'string' ? item : item.name;
                      const bLogo = typeof item === 'object' ? item.logo : null;
                      const isSelected = bankName === bName;
                      return (
                        <button
                          key={bName}
                          type="button"
                          onClick={() => setBankName(bName)}
                          className={`p-2 rounded-xl border text-left flex items-center space-x-2 transition-all ${
                            isSelected
                              ? "bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/40"
                              : "bg-slate-50 dark:bg-casino-dark border-slate-200 dark:border-casino-border hover:border-gray-400 dark:hover:border-gray-600"
                          }`}
                        >
                          <BankLogo bankName={bName} logoUrl={bLogo} size="sm" />
                          <span
                            className={`text-xs font-bold truncate ${
                              isSelected
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {bName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Account Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 000 123 456"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-gray-200 font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Account Holder Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SOK CHANTHA"
                    value={accountName}
                    onChange={(e) =>
                      setAccountName(e.target.value.toUpperCase())
                    }
                    className="w-full bg-slate-50 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-gray-200 uppercase focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Account Label / Nickname{" "}
                    <span className="text-gray-500 font-normal">
                      (Optional)
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main Account"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-gray-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center space-x-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-casino-dark dark:hover:bg-white/5 border border-slate-200 dark:border-casino-border text-slate-700 dark:text-gray-300 text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : editingMethod
                        ? "Update Account"
                        : "Save Account"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
