import React, { useState } from 'react';

/**
 * Deterministic color gradient based on string seed
 */
function getDeterministicGradient(seed = '') {
  const gradients = [
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-purple-500 to-indigo-600',
    'from-rose-500 to-pink-600',
    'from-fuchsia-500 to-purple-600',
    'from-amber-400 to-yellow-600',
    'from-sky-400 to-indigo-600',
    'from-violet-500 to-rose-600',
    'from-teal-400 to-emerald-600',
  ];
  let hash = 0;
  const str = String(seed || 'player');
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

/**
 * Generates a deterministic avatar URL via DiceBear
 */
export function getRandomAvatarUrl(seed = 'player') {
  const cleanSeed = encodeURIComponent(String(seed || 'player').trim());
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanSeed}`;
}

export default function PlayerAvatar({
  photoUrl,
  username = 'Player',
  userId = '',
  size = 'md',
  className = '',
  showBorder = true,
  borderColor = '',
}) {
  const [hasError, setHasError] = useState(false);
  const seed = username || userId || 'Player';

  const sizeClasses = {
    xs: 'w-4 h-4 text-[9px]',
    sm: 'w-5 h-5 sm:w-5.5 sm:h-5.5 text-[10px]',
    md: 'w-6 h-6 sm:w-7 sm:h-7 text-xs',
    lg: 'w-8 h-8 sm:w-9 sm:h-9 text-sm',
    xl: 'w-14 h-14 sm:w-16 sm:h-16 text-xl',
  }[size] || 'w-6 h-6 sm:w-7 sm:h-7 text-xs';

  const initial = (username || 'P').charAt(0).toUpperCase();

  // If user provided a photoUrl, try it first. Otherwise use random avatar.
  const rawUrl = (photoUrl && typeof photoUrl === 'string' && photoUrl.trim().length > 0)
    ? photoUrl.trim()
    : null;

  const currentSrc = !hasError && rawUrl ? rawUrl : getRandomAvatarUrl(seed);

  // If even the avatar image fails to load (e.g. device is offline), fallback to initials
  if (hasError && !rawUrl) {
    return (
      <div
        className={`rounded-full flex items-center justify-center font-black text-white bg-gradient-to-tr ${getDeterministicGradient(seed)} flex-shrink-0 select-none shadow-sm ${
          showBorder ? (borderColor || 'border border-white/20') : ''
        } ${sizeClasses} ${className}`}
        title={username}
      >
        <span>{initial}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center bg-slate-200 dark:bg-gray-800 ${
        showBorder ? (borderColor || 'border border-slate-300 dark:border-white/20') : ''
      } ${sizeClasses} ${className}`}
      title={username}
    >
      <img
        src={currentSrc}
        alt={username}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => {
          // If custom photoUrl failed, fallback to dicebear. If dicebear failed, fallback to initials.
          setHasError(true);
        }}
      />
    </div>
  );
}
