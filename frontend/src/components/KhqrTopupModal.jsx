import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode,
  CheckCircle2,
  X,
  Coins,
  ArrowRight,
  Sparkles,
  Building2,
  Download,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  ExternalLink,
  Smartphone,
} from "lucide-react";
import { khqrAPI, adminAPI } from "../services/api";

const DEFAULT_PRESETS = [
  { coins: 50000, usd: 12.5, label: "Starter" },
  { coins: 100000, usd: 25.0, label: "Popular", highlight: true },
  { coins: 200000, usd: 50.0, label: "Pro Lotto" },
  { coins: 5000000, usd: 1250.0, label: "VIP Mega" },
];

export default function KhqrTopupModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  playSound,
  socket,
  user,
}) {
  const [coinsPerUsd, setCoinsPerUsd] = useState(4000);
  const [packages, setPackages] = useState(DEFAULT_PRESETS);
  const [selectedPackage, setSelectedPackage] = useState(DEFAULT_PRESETS[1]);
  const [customCoins, setCustomCoins] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isApprovingAdmin, setIsApprovingAdmin] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [paidResult, setPaidResult] = useState(null);
  const [pendingNote, setPendingNote] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const pollIntervalRef = useRef(null);

  const handleCopyQR = () => {
    if (qrData?.khqrString) {
      navigator.clipboard.writeText(qrData.khqrString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById("khqr-svg");
    if (!svg) return;
    try {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width + 40;
        canvas.height = img.height + 40;
        if (ctx) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 20, 20);
          const pngFile = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.download = `KHQR-${qrData.billNumber}.png`;
          downloadLink.href = pngFile;
          downloadLink.click();
        }
      };
      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
    } catch (err) {
      console.warn("Failed to download QR code image:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    } else {
      handleReset();
    }
  }, [isOpen]);

  // Real-time automatic polling when QR is active
  useEffect(() => {
    if (!isOpen || !qrData?.transactionId || isPaid) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await khqrAPI.checkStatus(qrData.transactionId);
        if (res.data?.data?.status === "completed") {
          handlePaymentSuccess(res.data.data);
        }
      } catch (err) {
        // Silently continue polling
      }
    };

    // Run first check after 2s, then every 2.5s
    pollIntervalRef.current = setInterval(checkStatus, 2500);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isOpen, qrData?.transactionId, isPaid]);

  // Auto re-check immediately when user returns from banking app / deeplink
  useEffect(() => {
    if (!isOpen || !qrData?.transactionId || isPaid) return;

    const handleReturnToApp = async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await khqrAPI.checkStatus(qrData.transactionId);
          if (res.data?.data?.status === "completed") {
            handlePaymentSuccess(res.data.data);
          }
        } catch (err) {
          // ignore
        }
      }
    };

    document.addEventListener("visibilitychange", handleReturnToApp);
    window.addEventListener("focus", handleReturnToApp);

    return () => {
      document.removeEventListener("visibilitychange", handleReturnToApp);
      window.removeEventListener("focus", handleReturnToApp);
    };
  }, [isOpen, qrData?.transactionId, isPaid]);

  // Real-time Socket.io listener for instant push
  useEffect(() => {
    if (!socket || !qrData || isPaid) return;

    const handleSocketWallet = (data) => {
      if (
        data?.transactionId === qrData.transactionId ||
        (data?.coinsAdded &&
          Number(data.coinsAdded) === Number(qrData.coinAmount))
      ) {
        handlePaymentSuccess({
          status: "completed",
          coinAmount: data.coinsAdded || qrData.coinAmount,
          newBalance: data.balance,
        });
      }
    };

    socket.on("wallet:updated", handleSocketWallet);
    return () => {
      socket.off("wallet:updated", handleSocketWallet);
    };
  }, [socket, qrData, isPaid]);

  const handlePaymentSuccess = (resultData) => {
    if (isPaid) return;
    setIsPaid(true);
    setPaidResult(resultData);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (playSound) playSound();
    if (onPaymentSuccess) onPaymentSuccess();
  };

  const handleManualCheck = async () => {
    if (!qrData?.transactionId || isChecking || isPaid) return;
    try {
      setIsChecking(true);
      setError("");
      setPendingNote("");
      const res = await khqrAPI.checkStatus(qrData.transactionId);
      if (res.data?.data?.status === "completed") {
        handlePaymentSuccess(res.data.data);
      } else {
        const d = res.data?.data;
        if (d?.bakongConfigured === false) {
          setPendingNote(
            "Bakong API Token is not configured. Transfers require Admin Approval or an NBC Bakong developer token."
          );
        } else {
          setPendingNote(
            "Payment not confirmed by bank yet. Please allow a few seconds for the network to verify."
          );
        }
        setTimeout(() => setPendingNote(""), 7000);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Error checking payment status");
    } finally {
      setIsChecking(false);
    }
  };

  const handleAdminApprove = async () => {
    if (!qrData?.transactionId || isApprovingAdmin || isPaid) return;
    try {
      setIsApprovingAdmin(true);
      setError("");
      const res = await adminAPI.approveTopup(qrData.transactionId);
      handlePaymentSuccess(res.data?.data || { coinAmount: qrData.coinAmount });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to approve topup");
    } finally {
      setIsApprovingAdmin(false);
    }
  };

  const loadConfig = async () => {
    try {
      const res = await khqrAPI.getConfig();
      if (res.data?.data) {
        const rate = res.data.data.coinsPerUsd || 4000;
        const presets = res.data.data.presets || [
          50000, 100000, 200000, 5000000,
        ];
        setCoinsPerUsd(rate);

        const labels = [
          "Starter",
          "Popular",
          "Pro Lotto",
          "VIP Mega",
          "High Roller",
        ];
        const pkgs = presets.map((coins, idx) => {
          const label =
            labels[idx] || `${(coins / 1000).toLocaleString()}k Pack`;
          const isPopular = label === "Popular" || idx === 1;
          return {
            coins,
            usd: parseFloat((coins / rate).toFixed(2)),
            label,
            highlight: isPopular,
          };
        });
        setPackages(pkgs);
        if (pkgs.length > 0) {
          const defaultSelect = pkgs.find((p) => p.highlight) || pkgs[0];
          setSelectedPackage(defaultSelect);
        }
      }
    } catch (err) {
      console.warn("Failed to load topup config, using defaults:", err);
    }
  };

  const getEffectiveCoins = () => {
    if (isCustom) {
      return parseInt(customCoins, 10) || 0;
    }
    return selectedPackage?.coins || 0;
  };

  const getEffectiveUsd = () => {
    const coins = getEffectiveCoins();
    return parseFloat((coins / coinsPerUsd).toFixed(2));
  };

  const handleGenerateQR = async () => {
    const coinAmount = getEffectiveCoins();
    const amountUsd = getEffectiveUsd();

    if (coinAmount <= 0 || isNaN(coinAmount)) {
      setError("Please select or enter a valid coin amount");
      return;
    }

    if (amountUsd < 0.5) {
      setError(
        `Minimum deposit is $0.50 USD (${Math.round(coinsPerUsd * 0.5).toLocaleString()} coins)`,
      );
      return;
    }

    try {
      setLoading(true);
      setError("");
      setIsPaid(false);
      setPaidResult(null);
      const res = await khqrAPI.createTopup({
        coinAmount,
        amountUsd,
      });
      setQrData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setQrData(null);
    setIsPaid(false);
    setPaidResult(null);
    setPendingNote("");
    setError("");
    setIsCustom(false);
    setCustomCoins("");
  };

  if (!isOpen) return null;

  const effectiveCoins = getEffectiveCoins();
  const effectiveUsd = getEffectiveUsd();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-lg bg-casino-card border border-casino-border rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        >
          {/* Close button */}
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors z-20"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-red-600 to-rose-400 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                <span>Buy Coins</span>
              </h3>
              <p className="text-xs text-gray-400">
                Scan dynamic Bakong KHQR using ABA, Wing, or ACLEDA
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* SUCCESS SCREEN */}
          {isPaid ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-6 text-center space-y-4"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/20 animate-bounce">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div>
                <h4 className="text-2xl font-black text-white">
                  Payment Received!
                </h4>
                <p className="text-xs text-emerald-400 font-semibold mt-1">
                  Coins credited to your wallet balance successfully.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-casino-dark border border-emerald-500/30 max-w-sm mx-auto space-y-2">
                <div className="flex items-center justify-center space-x-2 text-amber-400">
                  <Coins className="w-6 h-6" />
                  <span className="text-2xl sm:text-3xl font-black font-mono">
                    +
                    {Number(
                      paidResult?.coinAmount ||
                        qrData?.coinAmount ||
                        effectiveCoins,
                    ).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-400 font-bold">Coins</span>
                </div>

                <div className="pt-2 border-t border-casino-border text-xs flex justify-between text-gray-400">
                  <span>Amount Paid:</span>
                  <span className="text-white font-mono font-bold">
                    ${qrData?.amountUsd || effectiveUsd.toFixed(2)} USD
                  </span>
                </div>
                {qrData?.billNumber && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Invoice Ref:</span>
                    <span className="text-gray-300 font-mono text-[11px]">
                      {qrData.billNumber}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                className="w-full max-w-sm py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/30 transition-all active:scale-95 mx-auto block"
              >
                Done & Play Now
              </button>
            </motion.div>
          ) : !qrData ? (
            /* STEP 1: SELECT COIN PACKAGE */
            <div>
              <div className="mb-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                  Select Preset Package:
                </label>
              </div>

              {/* Preset Packages 2x2 Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-3">
                {packages.map((pkg, idx) => {
                  const isSelected =
                    !isCustom && selectedPackage?.coins === pkg.coins;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedPackage(pkg);
                        setIsCustom(false);
                      }}
                      className={`relative p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "border-amber-500 bg-amber-500/10 shadow-md shadow-amber-500/10 ring-2 ring-amber-500"
                          : "border-casino-border bg-casino-dark/60 hover:border-gray-600"
                      }`}
                    >
                      {pkg.highlight && (
                        <span className="absolute -top-2.5 right-3 text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-black px-2.5 py-0.5 rounded-full shadow-md border border-amber-300/40 z-10 inline-flex items-center space-x-1">
                          <Sparkles className="w-2.5 h-2.5 text-black" />
                          <span>Best Value</span>
                        </span>
                      )}
                      <div className="flex items-center space-x-1.5 text-amber-400 mb-0.5">
                        <Coins className="w-4 h-4" />
                        <span className="font-extrabold text-base font-mono">
                          {pkg.coins.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs text-gray-300 font-semibold block">
                        ${pkg.usd.toFixed(2)} USD
                      </span>
                      <span
                        className={`text-[10px] block font-semibold ${pkg.highlight ? "text-amber-400 font-bold" : "text-gray-400"}`}
                      >
                        {pkg.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Relocated & Redesigned: Dedicated Custom Amount Card */}
              <div
                onClick={() => {
                  if (!isCustom) {
                    setIsCustom(true);
                    if (!customCoins) {
                      setCustomCoins(String(selectedPackage?.coins || 150000));
                    }
                  }
                }}
                className={`p-3 sm:p-3.5 rounded-xl border transition-all mb-3.5 cursor-pointer ${
                  isCustom
                    ? "border-amber-500 bg-amber-500/10 shadow-md shadow-amber-500/10 ring-2 ring-amber-500"
                    : "border-casino-border bg-casino-dark/60 hover:border-amber-500/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors ${
                        isCustom
                          ? "bg-amber-500 text-black border-amber-400 shadow-sm"
                          : "bg-casino-dark text-amber-400 border-casino-border"
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-white block">
                        Custom Amount
                      </span>
                      <span className="text-[10px] text-gray-400 block">
                        Enter any coin amount to purchase
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                      isCustom
                        ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
                        : "text-amber-400 bg-amber-500/10 border-amber-500/25"
                    }`}
                  >
                    {isCustom ? "Active" : "Select"}
                  </span>
                </div>

                {/* Expanded Input when Custom Amount is Active */}
                {isCustom && (
                  <div className="pt-2.5 mt-2.5 border-t border-amber-500/20 space-y-2">
                    <div className="relative">
                      <input
                        type="number"
                        step="1000"
                        min={Math.round(coinsPerUsd * 0.5)}
                        value={customCoins}
                        onChange={(e) => setCustomCoins(e.target.value)}
                        placeholder="e.g. 150000"
                        autoFocus
                        className="w-full bg-casino-dark border border-amber-500/60 focus:border-amber-400 rounded-xl pl-3.5 pr-16 py-2 text-amber-300 font-mono font-black text-base focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                        Coins
                      </span>
                    </div>

                    {/* Quick increment buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-gray-400 font-semibold mr-1">
                        Quick Add:
                      </span>
                      {[25000, 50000, 100000, 250000].map((addAmt) => (
                        <button
                          key={addAmt}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const current = parseInt(customCoins, 10) || 0;
                            setCustomCoins(String(current + addAmt));
                          }}
                          className="px-2 py-0.5 rounded-lg bg-casino-card hover:bg-casino-border border border-casino-border text-[10px] font-mono font-bold text-gray-300 hover:text-white transition-colors"
                        >
                          +{addAmt >= 1000 ? `${addAmt / 1000}k` : addAmt}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-casino-border/40">
                      <span className="text-[11px] text-gray-400">
                        Total Price:
                      </span>
                      <span className="text-emerald-400 font-mono font-bold text-sm">
                        ${effectiveUsd.toFixed(2)} USD
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Buy Coins Exchange Rate Banner */}
              <div className="bg-casino-dark/80 rounded-xl p-3 mb-5 border border-casino-border/50 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-800 dark:text-gray-300 font-semibold block">
                    Buy Coins Rate:
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Instant Auto-Credit
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-amber-400 font-bold text-sm block">
                    {coinsPerUsd.toLocaleString()} Coins = $1.00 USD
                  </span>
                  <span className="text-[11px] text-emerald-400 font-semibold">
                    ≈ 4000 KHR
                  </span>
                </div>
              </div>

              <button
                onClick={handleGenerateQR}
                disabled={loading || effectiveCoins <= 0}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 active:scale-95"
              >
                <span>
                  {loading
                    ? "Generating QR Code..."
                    : `Generate QR Code ($${effectiveUsd.toFixed(2)} USD)`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* STEP 2: KHQR CODE PRESENTATION & REAL-TIME VERIFICATION */
            <div className="text-center">
              {/* Official Bakong KHQR Presentation Card */}
              <div className="bg-white rounded-2xl inline-block shadow-2xl mb-3 border-2 border-red-600 overflow-hidden text-center max-w-[270px] w-full">
                {/* Official Red KHQR Header */}
                <div className="bg-red-600 px-3.5 py-2 flex items-center justify-between text-white select-none">
                  <div className="flex items-center space-x-1.5 font-black text-sm tracking-wider">
                    <span className="bg-white text-red-600 px-1 py-0.2 rounded text-[11px] font-black leading-tight">
                      KH
                    </span>
                    <span>QR</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-red-100">
                    Bakong
                  </span>
                </div>

                {/* Scannable EMVCo QR Code */}
                <div className="p-3 bg-white flex flex-col items-center justify-center">
                  <QRCodeSVG
                    id="khqr-svg"
                    value={qrData.khqrString}
                    size={210}
                    level="M"
                    includeMargin={true}
                  />
                  <div className="mt-1 text-center">
                    <span className="text-xs font-black text-slate-900 block uppercase tracking-tight">
                      KH-LOTTO CASINO
                    </span>
                    <span className="text-sm font-black text-emerald-600 font-mono block">
                      ${qrData.amountUsd} USD
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions: Download Image & Copy KHQR String */}
              <div className="flex items-center justify-center space-x-2 mb-3">
                <button
                  type="button"
                  onClick={handleDownloadQR}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-casino-dark dark:hover:bg-casino-border border border-slate-300 dark:border-casino-border text-slate-800 dark:text-gray-200 text-xs font-bold transition-all flex items-center space-x-1 shadow-sm active:scale-95"
                  title="Save QR Code image to device gallery"
                >
                  <Download className="w-3.5 h-3.5 text-red-500" />
                  <span>Save QR Image</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyQR}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-casino-dark dark:hover:bg-casino-border border border-slate-300 dark:border-casino-border text-slate-800 dark:text-gray-200 text-xs font-bold transition-all flex items-center space-x-1 shadow-sm active:scale-95"
                  title="Copy raw KHQR string"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-500" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              {/* Real-time Listening Indicator */}
              <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center space-x-2 text-xs text-amber-300">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <span className="font-semibold">
                  Waiting for bank payment... Auto-updates instantly.
                </span>
              </div>

              {pendingNote && (
                <div className="mb-3 p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs">
                  {pendingNote}
                </div>
              )}

              {/* Bill Details */}
              <div className="bg-casino-dark/90 rounded-xl p-3 border border-casino-border mb-3 text-left text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Bill No:</span>
                  <span className="font-mono text-slate-800 dark:text-gray-200">
                    {qrData.billNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="font-bold text-emerald-400">
                    ${qrData.amountUsd} USD
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Coins to Receive:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    +{Number(qrData.coinAmount).toLocaleString()} Coins
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rate:</span>
                  <span className="text-slate-800 dark:text-gray-300 font-mono">
                    {qrData.exchangeRate}
                  </span>
                </div>
              </div>

              {/* App-to-App Deeplink for Mobile Devices */}
              {qrData.deepLink && (
                <a
                  href={qrData.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 mb-2.5 rounded-xl font-black text-sm bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/30 flex items-center justify-center space-x-2 transition-all active:scale-95"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Open Banking App (Pay via Deeplink)</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              )}

              {/* Primary Action: I Have Paid / Check Status */}
              <button
                type="button"
                onClick={handleManualCheck}
                disabled={isChecking}
                className="w-full py-3 mb-2.5 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-60"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying with Bank...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>I Have Paid (Check Payment)</span>
                  </>
                )}
              </button>

              {/* Admin Instant Approve Fast-Pass */}
              {user?.role === "admin" && (
                <button
                  type="button"
                  onClick={handleAdminApprove}
                  disabled={isApprovingAdmin}
                  className="w-full py-2.5 mb-2.5 rounded-xl font-bold text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center justify-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50"
                  title="Admin Fast-Pass: Manually verify transfer on merchant phone & credit coins instantly"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {isApprovingAdmin
                      ? "Approving as Admin..."
                      : "Approve & Credit Now (Admin Fast-Pass)"}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-200 dark:bg-casino-dark text-slate-700 dark:text-gray-300 hover:bg-slate-300 dark:hover:bg-casino-border border border-slate-300 dark:border-casino-border transition-colors"
              >
                Change Amount
              </button>

              <p className="text-[11px] text-gray-500 mt-2.5">
                Open ABA Mobile, Wing Bank, or ACLEDA App & scan to pay.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
