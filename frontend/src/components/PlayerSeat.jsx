import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Sparkles } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';

export default function PlayerSeat({
  seatNumber,
  player,
  drawnBalls = [],
  isCurrentUser = false,
  isWinner = false,
  isHost = false,
  activeReaction = null,
}) {
  const drawnSet = new Set(drawnBalls);

  if (!player) return null;

  const isPlayerHost = isHost || Boolean(player.isHost);
  const numbers = player.numbers || [];
  const matchedNumbers = numbers.filter((n) => drawnSet.has(n));
  const matchedCount = matchedNumbers.length;
  const photoUrl = player.photo_url || player.photoUrl || null;

  return (
    <motion.div
      layout
      className={`relative rounded-xl px-2 py-1.5 sm:px-2.5 sm:py-2 border transition-all ${
        isWinner
          ? 'bg-amber-100/90 dark:bg-amber-500/15 border-amber-400 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/80'
          : isCurrentUser
          ? 'bg-white dark:bg-casino-card/95 border-cyan-400 dark:border-cyan-400/80 ring-2 ring-cyan-400/40 shadow-md shadow-cyan-500/15'
          : isPlayerHost
          ? 'bg-amber-50/90 dark:bg-casino-card/90 border-amber-300 dark:border-amber-500/30 shadow-sm'
          : 'bg-white dark:bg-casino-card/85 border-slate-200 dark:border-casino-border hover:border-slate-300 dark:hover:border-gray-700 shadow-sm'
      }`}
    >
      {/* Live Animated Reaction & Message Speech Bubble */}
      <AnimatePresence>
        {activeReaction && (activeReaction.emoji || activeReaction.message) && (
          <motion.div
            key={activeReaction.id || activeReaction.timestamp}
            initial={{ opacity: 0, scale: 0.3, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: -10 }}
            exit={{ opacity: 0, scale: 0.4, y: -24, transition: { duration: 0.3 } }}
            transition={{ type: 'spring', stiffness: 450, damping: 20 }}
            className="absolute -top-3.5 right-1 sm:right-2 z-30 flex items-center space-x-1.5 px-3 py-1 rounded-2xl bg-slate-950/95 dark:bg-black/95 text-white border-2 border-amber-400 shadow-2xl backdrop-blur-md pointer-events-none max-w-[92%]"
          >
            {activeReaction.emoji && (
              <span className="text-base sm:text-lg animate-bounce leading-none select-none flex-shrink-0">
                {activeReaction.emoji}
              </span>
            )}
            {activeReaction.message && (
              <span className={`leading-tight truncate ${
                activeReaction.emoji
                  ? 'text-[10px] sm:text-[11px] font-bold text-amber-200 max-w-[90px] sm:max-w-[130px]'
                  : 'text-[11px] sm:text-xs font-black text-amber-100 max-w-[130px] sm:max-w-[180px]'
              }`}>
                {activeReaction.message}
              </span>
            )}
            {/* Bubble Tail */}
            <div className="absolute -bottom-1.5 right-4 w-2 h-2 bg-slate-950 dark:bg-black border-r-2 border-b-2 border-amber-400 transform rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Top Micro-Row: Avatar, Username, Badges & Matches count */}
      <div className="flex items-center justify-between gap-1 leading-none mb-1 sm:mb-1.5">
        <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
          <PlayerAvatar
            photoUrl={photoUrl}
            username={player.username}
            userId={player.user_id || player.userId}
            size="sm"
            borderColor={
              isWinner
                ? 'border border-amber-400 shadow-sm'
                : isCurrentUser
                ? 'border-2 border-cyan-400 ring-1 ring-cyan-400/50 shadow-sm'
                : isPlayerHost
                ? 'border border-amber-400/50'
                : 'border border-slate-300 dark:border-gray-600/50'
            }
          />

          <span className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-gray-200 truncate max-w-[42px] sm:max-w-[80px]" title={player.username}>
            {player.username}
          </span>

          {isPlayerHost && (
            <span 
              className="text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-500/25 to-yellow-500/20 dark:from-amber-500/30 dark:to-yellow-500/25 text-amber-800 dark:text-amber-300 border border-amber-400/50 flex items-center space-x-0.5 flex-shrink-0 shadow-sm"
              title="Table Host"
            >
              <Crown className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 fill-amber-500" />
              <span>HOST</span>
            </span>
          )}

          {isCurrentUser && (
            <span className="text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded bg-cyan-500 text-white dark:text-slate-950 flex-shrink-0 uppercase font-mono shadow-sm">
              YOU
            </span>
          )}
        </div>

        {/* Matches / Winner Badge */}
        <div className="flex items-center space-x-0.5 sm:space-x-1 flex-shrink-0">
          {isWinner && (
            <span className="text-[8px] sm:text-[9px] font-black px-1 py-0.2 rounded bg-gradient-to-r from-amber-400 to-yellow-300 text-black flex items-center space-x-0.5 shadow-sm">
              <Crown className="w-2.5 h-2.5 fill-black" />
              <span>WIN</span>
            </span>
          )}
          <span className={`text-[9px] sm:text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full border ${
            matchedCount === 5
              ? 'bg-amber-400 text-black border-amber-300'
              : matchedCount > 0
              ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/30'
              : 'bg-slate-200/80 dark:bg-gray-800/80 text-slate-700 dark:text-gray-400 border-slate-300 dark:border-gray-700/60'
          }`}>
            {matchedCount}/5
          </span>
        </div>
      </div>

      {/* 5 Compact Lottery Numbers - Circle Round */}
      <div className="grid grid-cols-5 gap-1 items-center justify-items-center">
        {numbers.map((num, i) => {
          const isMatched = drawnSet.has(num);
          return (
            <motion.div
              key={i}
              animate={isMatched ? { scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 0.2 }}
              className={`w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] aspect-square rounded-full flex items-center justify-center font-mono font-black text-[10px] sm:text-[11px] transition-all ${
                isMatched
                  ? 'bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-black shadow-md shadow-amber-500/50 ring-1 ring-yellow-200'
                  : 'bg-slate-100 dark:bg-casino-dark/95 border border-slate-300 dark:border-casino-border text-slate-800 dark:text-gray-300 shadow-inner'
              }`}
            >
              {num}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
