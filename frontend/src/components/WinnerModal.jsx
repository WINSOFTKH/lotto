import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Trophy,
  Sparkles,
  ArrowRight,
  Zap,
  Crown,
  Timer,
  AlertCircle,
  Eye,
  Check,
} from "lucide-react";
import PlayerAvatar from "./PlayerAvatar";
import CoinIcon from "./CoinIcon";
import { formatCoins } from "../utils/formatters";

export default function WinnerModal({
  isOpen,
  winnerData,
  entryFee = 100,
  isHost = false,
  hostName = "",
  joiningCurrent = false,
  onJoinCurrentTable,
  onJoinOtherTable,
  playWinnerFanfare,
  autoRejoinSeconds = null,
  returnToLobbySeconds = null,
  rejoinCount = 0,
  onCancelAutoRejoin,
  hasEnoughCoins = true,
  wasUserSeated = false,
  autoRejoinEnabled = true,
}) {
  useEffect(() => {
    if (isOpen) {
      // Trigger sound fanfare
      if (playWinnerFanfare) {
        playWinnerFanfare();
      }

      // Celebratory multi-stage confetti
      const duration = 3.5 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 65,
          origin: { x: 0, y: 0.65 },
          colors: ["#F59E0B", "#FBBF24", "#10B981", "#EC4899", "#FFFFFF"],
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 65,
          origin: { x: 1, y: 0.65 },
          colors: ["#F59E0B", "#FBBF24", "#06B6D4", "#8B5CF6", "#FFFFFF"],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [isOpen]);

  if (!isOpen || !winnerData) return null;

  const { winner, winningBall, payout, totalBallsDrawn } = winnerData;
  const winnerPayout = payout?.winnerPayout || 0;
  const totalPool = payout?.totalPool || 0;
  const platformFee = payout?.platformFee || 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className="relative w-full max-w-sm sm:max-w-md my-auto bg-white/95 dark:bg-[#13111C]/95 border border-amber-400/50 dark:border-amber-500/30 rounded-3xl p-5 sm:p-6 text-center shadow-2xl dark:shadow-[0_0_80px_rgba(245,158,11,0.25)] backdrop-blur-xl overflow-hidden"
        >
          {/* Subtle Ambient Golden Lighting */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-48 bg-gradient-to-b from-amber-400/30 via-yellow-300/15 to-transparent blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/15 dark:bg-amber-400/10 blur-3xl rounded-full pointer-events-none" />

          {/* Top Decorative Floating Trophy Emblem */}
          <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 mb-3 flex items-center justify-center">
            {/* Pulsing ambient halo */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 blur-xl opacity-60 animate-pulse pointer-events-none" />

            {/* Metallic Gold Shield */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 20,
                delay: 0.1,
              }}
              className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-200 border-2 border-yellow-100 shadow-xl shadow-amber-500/35 flex items-center justify-center text-slate-950"
            >
              <Trophy className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.4] drop-shadow-sm" />
              <Sparkles className="w-4 h-4 text-white absolute -top-1.5 -right-1.5 animate-spin-slow pointer-events-none" />
            </motion.div>
          </div>

          {/* Subtitle Badge */}
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 dark:bg-amber-400/15 border border-amber-400/40 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-widest mb-1 shadow-sm">
            <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span>JACKPOT HIT • 5/5 MATCHED</span>
          </div>

          {!wasUserSeated && (
            <div className="mb-1.5">
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/40 text-purple-700 dark:text-purple-300 text-[10px] font-bold uppercase tracking-wider">
                <Eye className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                <span>Watch Only</span>
              </span>
            </div>
          )}

          {/* Hero Header */}
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase mb-3">
            Winner Announced!
          </h2>

          {/* Grand Hero Winner Prize Card */}
          <div className="relative bg-gradient-to-b from-amber-500/15 via-yellow-400/10 to-amber-500/5 dark:from-amber-400/15 dark:via-yellow-400/5 dark:to-transparent border border-amber-400/50 dark:border-amber-400/30 rounded-2xl p-3.5 sm:p-4 mb-3.5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 block mb-1">
              Winner Payout (90%)
            </span>
            <div className="flex items-center justify-center space-x-2 my-0.5">
              <CoinIcon className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md" />
              <span className="text-2xl sm:text-4xl font-black font-mono tracking-tight text-amber-600 dark:text-amber-400 drop-shadow-sm">
                +{formatCoins(winnerPayout)}
              </span>
            </div>

            {/* Micro Breakdown Chip */}
            <div className="flex items-center justify-center space-x-3 text-[11px] text-slate-600 dark:text-gray-400 pt-2 border-t border-amber-400/25 dark:border-amber-400/15 mt-2">
              <span>
                Pool:{" "}
                <strong className="text-slate-900 dark:text-gray-200 font-semibold">
                  {formatCoins(totalPool)}
                </strong>
              </span>
              <span className="text-amber-400/60">•</span>
              <span>
                Fee (10%):{" "}
                <strong className="text-rose-600 dark:text-rose-400 font-semibold">
                  -{formatCoins(platformFee)}
                </strong>
              </span>
            </div>
          </div>

          {/* Champion Profile & 5-Digit Ticket Card */}
          <div className="bg-slate-50 dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/10 rounded-2xl p-3.5 sm:p-4 mb-3 text-left shadow-sm">
            {/* Winner User Info */}
            <div className="flex items-center space-x-3 mb-2.5">
              <div className="relative flex-shrink-0">
                <PlayerAvatar
                  photoUrl={winner?.photo_url || winner?.photoUrl}
                  username={winner?.username}
                  userId={winner?.userId || winner?.user_id}
                  size="md"
                  borderColor="border-2 border-amber-400 ring-2 ring-amber-400/30"
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center shadow-md">
                  <Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-slate-950" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1.5">
                  <span
                    className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate"
                    title={winner?.username}
                  >
                    {winner?.username}
                  </span>
                  {winner?.isBot && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-gray-400 uppercase">
                      BOT
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-gray-400 font-medium">
                  <span>Seat #{winner?.seatNumber || winner?.seat_number}</span>
                  <span>•</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    Lucky Champion
                  </span>
                </div>
              </div>
            </div>

            {/* Winning 5-Digit Ticket Display */}
            <div className="pt-2 border-t border-slate-200/70 dark:border-white/10">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-600 dark:text-gray-400 font-semibold mb-2">
                <span>Winning 5-Digit Ticket:</span>
                <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                  Hit Ball #{winningBall}{" "}
                  {totalBallsDrawn ? `(${totalBallsDrawn} balls)` : ""}
                </span>
              </div>

              <div className="flex justify-center items-center space-x-1.5 sm:space-x-2 py-0.5">
                {winner?.numbers?.map((num, i) => {
                  const isWinningBall = num === winningBall;
                  return (
                    <div
                      key={i}
                      className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-black text-xs sm:text-sm select-none shadow-md transition-transform ${
                        isWinningBall
                          ? "bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 text-black ring-2 ring-amber-300 dark:ring-yellow-300 scale-110 shadow-lg shadow-amber-500/40 z-10"
                          : "bg-slate-100 dark:bg-casino-dark border border-slate-300 dark:border-casino-border text-slate-900 dark:text-gray-200"
                      }`}
                    >
                      {/* Specular 3D Highlight */}
                      <div className="absolute top-1 left-1.5 w-2 h-1 bg-white/40 rounded-full blur-[0.2px] pointer-events-none" />

                      {/* Pulse Ring on the winning ball */}
                      {isWinningBall && (
                        <span className="absolute -inset-1 rounded-full border border-amber-400 animate-ping pointer-events-none" />
                      )}

                      <span className="relative z-10">{num}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Auto Re-Join Countdown or Return to Lobby Banner */}
          {wasUserSeated &&
            (returnToLobbySeconds !== null && returnToLobbySeconds > 0 ? (
              <div className="bg-gradient-to-r from-purple-500/15 via-indigo-500/20 to-purple-500/15 border border-purple-400/50 rounded-2xl p-2.5 sm:p-3 mb-3 flex items-center justify-between text-left shadow-sm animate-pulse">
                <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-500 text-white flex items-center justify-center font-black text-xs flex-shrink-0 shadow-sm">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-purple-200 block truncate">
                      Returning to Lobby in {returnToLobbySeconds}s...
                    </span>
                    <span className="text-[10px] text-slate-600 dark:text-gray-400 block truncate">
                      Click Re-Join Table to stay and play, or return to lobby.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onJoinOtherTable}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex-shrink-0 shadow-sm"
                >
                  Lobby Now
                </button>
              </div>
            ) : autoRejoinEnabled &&
              autoRejoinSeconds !== null &&
              autoRejoinSeconds > 0 ? (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-2xl p-2.5 sm:p-3 mb-3 flex items-center justify-between text-left shadow-sm">
                <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs flex-shrink-0 shadow-sm">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-amber-300 block truncate">
                      Auto Re-Joining in {autoRejoinSeconds}s...
                    </span>
                    <span className="text-[10px] text-slate-600 dark:text-gray-400 flex items-center gap-1 truncate">
                      <CoinIcon className="w-3 h-3 inline" />
                      {formatCoins(entryFee)} will be deducted for next round
                    </span>
                  </div>
                </div>
                {onCancelAutoRejoin && (
                  <button
                    type="button"
                    onClick={onCancelAutoRejoin}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-800 dark:text-gray-200 text-xs font-bold transition-all flex-shrink-0 shadow-sm border border-slate-200 dark:border-white/10"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ) : !hasEnoughCoins && wasUserSeated ? (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-2.5 mb-3 flex items-center space-x-2 text-left">
                <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span className="text-xs text-rose-600 dark:text-rose-300 font-semibold">
                  Insufficient balance ({formatCoins(entryFee)} required).
                  Please buy coins to play next round.
                </span>
              </div>
            ) : null)}

          {/* Action Buttons: ALWAYS KEEP BOTH Re-Join Table and Return to Lobby! */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Option 1: Re-Join Table Button */}
              <button
                onClick={onJoinCurrentTable}
                disabled={joiningCurrent}
                className="flex-1 py-3 px-4 rounded-xl font-black text-xs bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 hover:from-amber-400 hover:to-yellow-200 text-slate-950 shadow-lg shadow-amber-500/25 flex items-center justify-center space-x-1.5 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 fill-slate-950 stroke-none" />
                <span className="inline-flex items-center gap-1">
                  {joiningCurrent ? (
                    "Taking Seat..."
                  ) : autoRejoinSeconds !== null && autoRejoinSeconds > 0 ? (
                    <>
                      Re-Join Now (
                      <CoinIcon className="w-3.5 h-3.5 inline -mt-0.5" />
                      {formatCoins(entryFee)})
                    </>
                  ) : (
                    <>Re-Join Table</>
                  )}
                </span>
              </button>

              {/* Option 2: Return to Lobby */}
              <button
                onClick={onJoinOtherTable}
                disabled={joiningCurrent}
                className="flex-1 py-3 bg-white dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.12] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-gray-200 hover:text-black dark:hover:text-white px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 shadow-sm"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>
                  {returnToLobbySeconds !== null && returnToLobbySeconds > 0
                    ? `Back to Lobby (${returnToLobbySeconds}s)`
                    : "Back to Lobby"}
                </span>
              </button>
            </div>

            {/* Host Preservation Status Note */}
            <p className="text-[11px] text-slate-500 dark:text-gray-400 text-center pt-1">
              {isHost ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold inline-flex items-center space-x-1">
                  <span>
                    👑 You are the Table Host! Host privileges remain yours for
                    next round.
                  </span>
                </span>
              ) : (
                <span>
                  👑 Table Host:{" "}
                  <strong className="text-slate-800 dark:text-gray-200 font-semibold">
                    {hostName || "Host"}
                  </strong>
                </span>
              )}
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
