/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        casino: {
          dark: 'rgb(var(--color-casino-dark) / <alpha-value>)',
          card: 'rgb(var(--color-casino-card) / <alpha-value>)',
          border: 'rgb(var(--color-casino-border) / <alpha-value>)',
          subcard: 'rgb(var(--color-casino-subcard) / <alpha-value>)',
          gold: '#f59e0b',
          goldGlow: '#fbbf24',
          neonCyan: '#06b6d4',
          neonPurple: '#a855f7',
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 1, filter: 'drop-shadow(0 0 15px rgba(245, 158, 11, 0.6))' },
          '50%': { opacity: 0.8, filter: 'drop-shadow(0 0 5px rgba(245, 158, 11, 0.3))' },
        }
      }
    },
  },
  plugins: [],
}
