import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({
  className = '',
  size = 'md', // 'sm', 'md', 'lg'
  variant = 'icon', // 'icon', 'row', 'segmented'
}) {
  const { theme, isDark, toggleTheme, setTheme } = useTheme();

  // Segmented Pill Control (Dark | Light side by side)
  if (variant === 'segmented') {
    return (
      <div className={`inline-flex items-center p-1 rounded-xl bg-casino-dark/90 border border-casino-border ${className}`}>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            isDark
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-gray-400 hover:text-slate-800 dark:hover:text-white'
          }`}
          title="Choose Dark Mode (Default)"
        >
          <Moon className="w-3.5 h-3.5 fill-current" />
          <span>Dark</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            !isDark
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-gray-400 hover:text-slate-800 dark:hover:text-white'
          }`}
          title="Choose Light Mode"
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Light</span>
        </button>
      </div>
    );
  }

  // Full-width drawer row with direct Dark & Light choice
  if (variant === 'row') {
    return (
      <div className={`w-full flex items-center justify-between p-2 rounded-xl transition-all ${
        isDark
          ? 'bg-casino-dark/80 border border-casino-border text-gray-200'
          : 'bg-slate-100 border border-slate-200 text-slate-800'
      } ${className}`}>
        <div className="flex items-center space-x-2 pl-1">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
            isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-500/15 text-amber-600'
          }`}>
            {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </div>
          <span className="text-xs font-bold">
            Theme: {isDark ? 'Dark (Default)' : 'Light'}
          </span>
        </div>

        {/* Explicit Dark & Light Segmented Buttons */}
        <div className="flex items-center space-x-1 bg-casino-card p-0.5 rounded-lg border border-casino-border">
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`px-2.5 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-all ${
              isDark
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-gray-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Moon className="w-3 h-3" />
            <span>Dark</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`px-2.5 py-1 rounded text-xs font-bold flex items-center space-x-1 transition-all ${
              !isDark
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-gray-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Sun className="w-3 h-3" />
            <span>Light</span>
          </button>
        </div>
      </div>
    );
  }

  // Icon Button
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 sm:w-8.5 sm:h-8.5 text-sm',
    lg: 'w-10 h-10 text-base',
  }[size] || 'w-8 h-8 text-sm';

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size] || 'w-4 h-4';

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      onClick={toggleTheme}
      type="button"
      className={`rounded-xl border flex items-center justify-center transition-all ${
        isDark
          ? 'bg-casino-card hover:bg-casino-border border-casino-border text-amber-400 shadow-sm hover:border-amber-400/40'
          : 'bg-white hover:bg-slate-100 border-slate-200 text-amber-600 shadow-sm hover:border-amber-400/40'
      } ${sizeClasses} ${className}`}
      title={isDark ? 'Dark Mode active. Click for Light Mode.' : 'Light Mode active. Click for Dark Mode (Default).'}
      aria-label="Toggle dark/light theme"
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {isDark ? (
          <Moon className={`${iconSizes} stroke-[2.2] fill-amber-400/20`} />
        ) : (
          <Sun className={`${iconSizes} stroke-[2.2]`} />
        )}
      </motion.div>
    </motion.button>
  );
}
