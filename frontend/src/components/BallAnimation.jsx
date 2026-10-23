import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function BallAnimation({
  currentBall,
  drawnBalls = [],
  isDrawing,
  totalPoolCount = 70,
}) {
  // Get ball color theme based on number range 1-99
  const getBallColor = (num) => {
    if (num <= 20)
      return "from-amber-400 to-yellow-600 border-amber-300 text-black";
    if (num <= 40)
      return "from-cyan-400 to-blue-600 border-cyan-300 text-white";
    if (num <= 60)
      return "from-emerald-400 to-teal-700 border-emerald-300 text-white";
    if (num <= 80)
      return "from-purple-400 to-indigo-700 border-purple-300 text-white";
    return "from-rose-500 to-red-700 border-rose-300 text-white";
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gradient-to-b dark:from-casino-card dark:to-casino-dark border border-slate-200 dark:border-casino-border rounded-3xl shadow-xl dark:shadow-2xl relative overflow-hidden">
      {/* Decorative radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Title */}
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">
        {isDrawing
          ? `🎰 LIVE DRAW IN PROGRESS (1 - 99)`
          : "🎱 LOTTERY DRAW CHAMBER"}
      </span>

      {/* Main Ball Display */}
      <div className="relative w-36 h-36 flex items-center justify-center my-3">
        {/* Outer glowing pulse rings */}
        {isDrawing && (
          <div className="absolute inset-0 rounded-full border border-amber-500/40 animate-ping pointer-events-none" />
        )}
        <div className="absolute inset-2 rounded-full border-2 border-dashed border-amber-400/30 animate-spin-slow pointer-events-none" />

        <AnimatePresence mode="wait">
          {currentBall ? (
            <motion.div
              key={currentBall}
              initial={{ scale: 0, rotate: -180, y: -40 }}
              animate={{ scale: 1, rotate: 0, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 20 }}
              className={`w-28 h-28 rounded-full bg-gradient-to-tr ${getBallColor(currentBall)} border-4 shadow-2xl flex flex-col items-center justify-center relative select-none`}
            >
              {/* Spherical specular highlight */}
              <div className="absolute top-2 left-4 w-7 h-4 bg-white/40 rounded-full transform -rotate-45 blur-[1px]" />
              <span className="text-4xl font-black tracking-tight">
                {currentBall}
              </span>
              <span className="text-[9px] font-bold tracking-widest uppercase opacity-75">
                KH-BALL
              </span>
            </motion.div>
          ) : (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
              className="w-24 h-24 rounded-full border-4 border-dashed border-slate-300 dark:border-gray-700 flex items-center justify-center text-slate-400 dark:text-gray-500 font-bold text-xs"
            >
              WAITING
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Drawn Balls Roll History */}
      <div className="w-full mt-4 bg-slate-50 dark:bg-casino-dark/80 border border-slate-200 dark:border-casino-border/60 rounded-2xl p-3 shadow-inner">
        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-gray-400 font-semibold mb-2 px-1">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Drawn Balls History:</span>
          </div>
          <div className="flex items-center space-x-1 font-mono text-xs">
            <AnimatePresence mode="wait">
              <motion.span
                key={drawnBalls.length}
                initial={{ scale: 1.4, color: "#f59e0b" }}
                animate={{ scale: 1, color: "inherit" }}
                transition={{ duration: 0.35, type: "spring", stiffness: 400 }}
                className="font-bold text-slate-800 dark:text-white"
              >
                {drawnBalls.length}
              </motion.span>
            </AnimatePresence>
            <span className="text-slate-500 dark:text-gray-400">Balls Drawn</span>
          </div>
        </div>

        <div
          className="flex items-center space-x-2.5 overflow-x-auto py-2 px-2 scrollbar-none no-scrollbar max-w-full min-h-[48px]"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {drawnBalls.length === 0 ? (
            <span className="text-xs text-slate-400 dark:text-gray-500 italic mx-auto">
              No balls drawn yet
            </span>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              {drawnBalls
                .slice(-12)
                .reverse()
                .map((num, i) => {
                  const isLatest = i === 0;
                  return (
                    <motion.div
                      key={`drawn-ball-${num}`}
                      layout
                      initial={{ scale: 0, y: -22, rotate: -60, opacity: 0 }}
                      animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0, transition: { duration: 0.2 } }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 22,
                        mass: 0.8,
                      }}
                      className={`relative flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr ${getBallColor(
                        num
                      )} border flex items-center justify-center font-black text-xs shadow-md select-none ${
                        isLatest
                          ? "ring-2 ring-amber-400 dark:ring-amber-300 ring-offset-1 ring-offset-slate-50 dark:ring-offset-casino-dark shadow-amber-500/40 scale-105"
                          : ""
                      }`}
                    >
                      {/* Pulse beacon for the newest ball */}
                      {isLatest && (
                        <motion.span
                          initial={{ scale: 0.8, opacity: 0.9 }}
                          animate={{ scale: [1, 1.5, 1.3], opacity: [0.9, 0, 0] }}
                          transition={{
                            duration: 1.2,
                            repeat: 3,
                            ease: "easeOut",
                          }}
                          className="absolute -inset-1 rounded-full border-2 border-amber-400 pointer-events-none"
                        />
                      )}

                      {/* Spherical mini specular highlight */}
                      <div className="absolute top-1 left-1.5 w-2.5 h-1.5 bg-white/40 rounded-full blur-[0.3px] pointer-events-none" />

                      <span className="relative z-10">{num}</span>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
