import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  theme: 'dark',
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  // Read persisted theme or default to 'dark'
  const [theme, setThemeState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kh_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  const isDark = theme === 'dark';

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('kh_theme', theme);

    // Sync with Telegram WebApp if active
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      try {
        const tg = window.Telegram.WebApp;
        if (typeof tg.setHeaderColor === 'function') {
          tg.setHeaderColor(isDark ? '#0a0b10' : '#f8fafc');
        }
        if (typeof tg.setBackgroundColor === 'function') {
          tg.setBackgroundColor(isDark ? '#0a0b10' : '#f1f5f9');
        }
      } catch (e) {
        // Safe fallback
      }
    }
  }, [theme, isDark]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
