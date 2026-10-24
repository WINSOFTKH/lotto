/**
 * Telegram Mini App (TMA) Integration Service
 * Provides helpers for SDK initialization, haptic feedback, safe navigation & auto-auth
 */

export const getTelegramWebApp = () => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
};

export const isTelegramWebApp = () => {
  const tg = getTelegramWebApp();
  return Boolean(tg && (tg.initData || tg.platform !== 'unknown'));
};

export const initTelegramApp = () => {
  const tg = getTelegramWebApp();
  if (!tg) return null;

  try {
    // Notify Telegram client that Mini App is initialized
    tg.ready();

    // Expand Mini App to full vertical height
    tg.expand();

    // Enable closing confirmation to prevent accidental swipes during active gameplay
    if (typeof tg.enableClosingConfirmation === 'function') {
      tg.enableClosingConfirmation();
    }

    // Set header/background color to dark casino theme if supported
    if (typeof tg.setHeaderColor === 'function') {
      tg.setHeaderColor('#0a0b10');
    }
    if (typeof tg.setBackgroundColor === 'function') {
      tg.setBackgroundColor('#0a0b10');
    }
  } catch (err) {
    console.warn('[TelegramWebApp] Error initializing Telegram WebApp SDK:', err);
  }

  return tg;
};

/**
 * Native Telegram Haptic Feedback
 * @param {'light'|'medium'|'heavy'|'rigid'|'soft'|'success'|'warning'|'error'} type
 */
export const triggerHaptic = (type = 'light') => {
  const tg = getTelegramWebApp();
  if (!tg?.HapticFeedback) return;

  try {
    if (['success', 'warning', 'error'].includes(type)) {
      tg.HapticFeedback.notificationOccurred(type);
    } else {
      tg.HapticFeedback.impactOccurred(type);
    }
  } catch {
    // Silently continue if haptics unavailable on device
  }
};

/**
 * Configure Native Telegram BackButton
 */
export const setTelegramBackButton = (visible, onClickCallback = null) => {
  const tg = getTelegramWebApp();
  if (!tg?.BackButton) return;

  try {
    if (visible && typeof onClickCallback === 'function') {
      tg.BackButton.show();
      tg.BackButton.onClick(onClickCallback);
    } else {
      tg.BackButton.hide();
    }
  } catch (err) {
    console.warn('[TelegramWebApp] BackButton error:', err);
  }
};

/**
 * Register Telegram WebApp lifecycle & UI event listener with auto-cleanup
 */
export const onTelegramEvent = (eventType, callback) => {
  const tg = getTelegramWebApp();
  if (tg && typeof tg.onEvent === 'function' && typeof callback === 'function') {
    try {
      tg.onEvent(eventType, callback);
      return () => {
        try {
          tg.offEvent(eventType, callback);
        } catch {}
      };
    } catch (err) {
      console.warn(`[TelegramWebApp] Error subscribing to ${eventType}:`, err);
    }
  }
  return () => {};
};
