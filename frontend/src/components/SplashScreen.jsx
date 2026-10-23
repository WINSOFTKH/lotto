import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ShieldCheck, Zap, Trophy } from 'lucide-react';

const LOADING_STEPS = [
  { progress: 20, text: 'Connecting to LOTTO 4U Network...' },
  { progress: 45, text: 'Syncing Live Draw Chamber...' },
  { progress: 70, text: 'Validating Wallet & Security...' },
  { progress: 90, text: 'Preparing Tables & Odds...' },
  { progress: 100, text: 'Ready! Entering Arena...' },
];

export default function SplashScreen({ onFinish, isReady = true, minDuration = 1800 }) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing LOTTO 4U Arena...');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      let rawPct = Math.min(100, Math.floor((elapsed / minDuration) * 100));

      // If auth or profile check is still pending, hold progress at 92% until isReady
      if (!isReady && rawPct > 92) {
        rawPct = 92;
      }

      // Find appropriate status step
      for (const step of LOADING_STEPS) {
        if (rawPct >= step.progress) {
          setStatusText(step.text);
        }
      }

      setProgress(rawPct);

      if (rawPct >= 100 && isReady) {
        clearInterval(interval);
        setTimeout(() => {
          setIsDone(true);
          setTimeout(() => {
            if (onFinish) onFinish();
          }, 450); // allow exit animation to complete
        }, 200);
      }
    }, 35);

    return () => clearInterval(interval);
  }, [minDuration, onFinish, isReady]);

  return (
    <AnimatePresence>
      {!isDone && (
        <motion.div
          key="kh-splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-between p-6 bg-[#080B11] text-white select-none overflow-hidden"
        >
          {/* Ambient Lighting & Glows */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 h-80 sm:h-96 bg-amber-500/15 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-64 h-64 bg-yellow-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute top-10 left-10 w-64 h-64 bg-amber-600/10 rounded-full blur-[80px] pointer-events-none" />

          {/* Floating background decorative lottery spheres */}
          <motion.div
            animate={{ y: [-10, 10, -10], rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-12 left-8 w-12 h-12 rounded-full border border-amber-500/20 bg-amber-500/5 flex items-center justify-center text-[10px] font-mono text-amber-500/30 blur-[0.5px] pointer-events-none"
          >
            07
          </motion.div>
          <motion.div
            animate={{ y: [10, -10, 10], rotate: [360, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-28 right-10 w-14 h-14 rounded-full border border-yellow-500/20 bg-yellow-500/5 flex items-center justify-center text-xs font-mono text-yellow-500/30 blur-[0.5px] pointer-events-none"
          >
            77
          </motion.div>
          <motion.div
            animate={{ y: [-8, 8, -8] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-28 left-12 w-10 h-10 rounded-full border border-amber-400/20 bg-amber-400/5 flex items-center justify-center text-[10px] font-mono text-amber-400/30 blur-[0.5px] pointer-events-none"
          >
            99
          </motion.div>

          {/* Top Header Tag */}
          <div className="w-full max-w-sm flex items-center justify-center pt-2">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-widest shadow-sm">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Official Gaming Platform</span>
            </span>
          </div>

          {/* Center Brand Identity */}
          <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-sm my-auto">
            {/* Animated Emblem */}
            <div className="relative flex items-center justify-center">
              {/* Spinning / pulsing back rings */}
              <div className="absolute -inset-4 rounded-3xl border border-amber-500/30 animate-pulse pointer-events-none" />
              <div className="absolute -inset-7 rounded-3xl border border-amber-400/20 border-dashed animate-spin-slow pointer-events-none" />

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 p-[3px] shadow-2xl shadow-amber-500/30 relative select-none"
              >
                <div className="w-full h-full rounded-[22px] bg-[#0E131E] flex flex-col items-center justify-center relative overflow-hidden">
                  {/* Subtle Shimmer Bar */}
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
                    className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 pointer-events-none"
                  />
                  <span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent drop-shadow-md">
                    LOTTO
                  </span>
                  <span className="text-sm font-black tracking-widest uppercase text-amber-400/90 -mt-1">
                    4U
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Typography */}
            <div className="space-y-1.5">
              <motion.h1
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="text-2xl sm:text-3xl font-black tracking-wide bg-gradient-to-r from-white via-amber-100 to-yellow-200 bg-clip-text text-transparent"
              >
                LOTTO 4U ARENA
              </motion.h1>
              <motion.p
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-xs text-slate-400 font-medium tracking-wide"
              >
                High-Concurrency Live Real-Time Web Lottery
              </motion.p>
            </div>

            {/* Progress Bar & Status */}
            <div className="w-64 sm:w-72 space-y-2.5 pt-2">
              <div className="flex items-center justify-between text-[11px] font-mono px-0.5">
                <span className="text-amber-400/90 font-medium truncate max-w-[200px]">
                  {statusText}
                </span>
                <span className="text-amber-300 font-bold ml-2">
                  {progress}%
                </span>
              </div>

              {/* Progress Track */}
              <div className="h-1.5 w-full bg-slate-800/80 border border-slate-700/50 rounded-full overflow-hidden p-0.5 relative">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.7)]"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: 'easeOut', duration: 0.1 }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Features Pill */}
          <div className="w-full max-w-sm flex items-center justify-center pb-2">
            <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-medium">
              <span className="flex items-center space-x-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Live Draws</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Provably Fair</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center space-x-1">
                <Trophy className="w-3 h-3 text-yellow-400" />
                <span>Instant Cashout</span>
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
