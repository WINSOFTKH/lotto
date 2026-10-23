import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, Smile, Sparkles, ChevronDown, AlertCircle, Eye } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';

// Curated list of high-energy game reaction emojis
export const QUICK_EMOJIS = ['🔥', '🍀', '🎉', '🤑', '😱', '👏', '🤞', '😂', '👑', '❤️'];

export default function TableChat({
  isOpen,
  onToggle,
  messages = [],
  onSendMessage,
  onSendEmoji,
  currentUserId,
  unreadCount = 0,
  rateLimitWarning = null,
  isWatchOnly = false,
}) {
  const [inputText, setInputText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages if chat is open
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isWatchOnly) return;
    const trimmed = inputText.trim();
    if (!trimmed && !selectedEmoji) return;

    onSendMessage(trimmed, selectedEmoji);
    setInputText('');
    setSelectedEmoji('');
    setShowEmojiPicker(false);
  };

  const handleQuickEmojiTap = (emoji) => {
    if (isWatchOnly) return;
    onSendEmoji(emoji);
  };

  return (
    <>
      {/* Rate limit warning banner above quick bar when drawer is closed */}
      <AnimatePresence>
        {rateLimitWarning && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="w-full mb-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-semibold flex items-center space-x-1.5 shadow-sm"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-500 animate-pulse" />
            <span className="flex-1 truncate">{rateLimitWarning}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QUICK EMOJI BAR & CHAT TOGGLE (Always visible in Game Room) */}
      <div className="w-full bg-white/90 dark:bg-casino-card/90 border border-slate-200 dark:border-casino-border rounded-2xl p-2 sm:p-2.5 shadow-sm backdrop-blur-md flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Quick Emoji Reaction Pills or Watch-Only Notice */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto scrollbar-none py-0.5 px-0.5 flex-1 min-w-0">
          {isWatchOnly ? (
            <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-500 dark:text-gray-400 py-1 px-1.5 min-w-0">
              <Eye className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
              <span className="truncate">Watch-only spectators cannot send chat in live game</span>
            </div>
          ) : (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center space-x-1 flex-shrink-0 pr-1 hidden xs:flex">
                <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                <span>React:</span>
              </span>

              {QUICK_EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.2, y: -2 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => handleQuickEmojiTap(emoji)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-amber-100 dark:bg-casino-dark/90 dark:hover:bg-amber-500/20 border border-slate-200 hover:border-amber-300 dark:border-casino-border dark:hover:border-amber-500/40 flex items-center justify-center text-lg sm:text-xl transition-colors flex-shrink-0 shadow-sm"
                  title={`Send ${emoji}`}
                >
                  <span className="leading-none select-none">{emoji}</span>
                </motion.button>
              ))}
            </>
          )}
        </div>

        {/* Chat Drawer Toggle Button with Unread Badge */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggle}
          className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 border shadow-sm ${
            isOpen
              ? 'bg-amber-500 text-black border-amber-400 shadow-amber-500/20'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-casino-dark dark:hover:bg-casino-border border-slate-200 dark:border-casino-border text-slate-800 dark:text-gray-200'
          }`}
        >
          <div className="relative">
            <MessageCircle className="w-4 h-4" />
            {unreadCount > 0 && !isOpen && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-md animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className="hidden sm:inline">Table Chat</span>
          <span className="sm:hidden">Chat</span>
        </motion.button>
      </div>

      {/* CHAT DRAWER / MODAL SLIDE-OVER */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 sm:p-4 bg-black/60 backdrop-blur-sm pointer-events-auto">
            {/* Click backdrop to close */}
            <div className="absolute inset-0" onClick={onToggle} />

            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full sm:max-w-md h-[520px] max-h-[85vh] bg-white dark:bg-casino-card border-t sm:border border-slate-200 dark:border-casino-border rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-casino-border bg-slate-50/80 dark:bg-casino-dark/70">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/30">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                      Table Chat & Reactions
                    </h3>
                    <span className="text-[10px] text-slate-500 dark:text-gray-400">
                      Live interactions with all seated players
                    </span>
                  </div>
                </div>

                <button
                  onClick={onToggle}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                  title="Close Chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 scrollbar-thin">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-gray-500 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl">
                      💬
                    </div>
                    <p className="text-xs font-semibold">No messages yet!</p>
                    <p className="text-[11px] max-w-[200px]">
                      Send an emoji reaction or message below to start the conversation.
                    </p>
                  </div>
                ) : (
                  messages.map((item) => {
                    const isSelf = item.userId === currentUserId;
                    const isPureEmoji = !item.message && item.emoji;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`flex items-start space-x-2 ${isSelf ? 'flex-row-reverse space-x-reverse' : ''}`}
                      >
                        <PlayerAvatar
                          photoUrl={item.photoUrl}
                          username={item.username}
                          userId={item.userId}
                          size="sm"
                          borderColor={isSelf ? 'border border-cyan-400' : 'border border-amber-400/50'}
                        />

                        <div className={`max-w-[78%] ${isSelf ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div className="flex items-center space-x-1.5 px-1 mb-0.5">
                            <span className="text-[10px] font-bold text-slate-700 dark:text-gray-300">
                              {isSelf ? 'You' : item.username}
                            </span>
                            <span className="text-[9px] text-slate-400 dark:text-gray-500 font-mono">
                              {new Date(item.timestamp || item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {isPureEmoji ? (
                            <motion.div
                              whileHover={{ scale: 1.15 }}
                              className="text-3xl sm:text-4xl px-2 py-1 select-none leading-none drop-shadow-md"
                            >
                              {item.emoji}
                            </motion.div>
                          ) : (
                            <div
                              className={`rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm break-words ${
                                isSelf
                                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-semibold rounded-tr-none'
                                  : 'bg-slate-100 dark:bg-casino-dark border border-slate-200 dark:border-casino-border text-slate-800 dark:text-gray-200 rounded-tl-none'
                              }`}
                            >
                              {item.emoji && (
                                <span className="text-base mr-1.5 inline-block select-none align-middle">
                                  {item.emoji}
                                </span>
                              )}
                              <span>{item.message}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Emojis inside Drawer */}
              {!isWatchOnly && (
                <div className="px-3 py-1.5 bg-slate-50 dark:bg-casino-dark/50 border-t border-slate-200 dark:border-casino-border/60 flex items-center space-x-1 overflow-x-auto scrollbar-none">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setSelectedEmoji(emoji);
                        inputRef.current?.focus();
                      }}
                      className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-colors flex-shrink-0 ${
                        selectedEmoji === emoji
                          ? 'bg-amber-400 text-black font-bold scale-110 shadow-sm'
                          : 'hover:bg-slate-200 dark:hover:bg-white/10'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Rate Limit Warning Banner inside Drawer */}
              <AnimatePresence>
                {rateLimitWarning && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-3.5 py-2 bg-rose-500/15 border-t border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center space-x-2"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500 animate-pulse" />
                    <span className="flex-1">{rateLimitWarning}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input Form or Watch-Only Notice */}
              {isWatchOnly ? (
                <div className="p-3.5 border-t border-slate-200 dark:border-casino-border bg-slate-50 dark:bg-casino-dark/70 flex items-center justify-center space-x-2 text-center">
                  <Eye className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-gray-300 font-semibold">
                    Watch-only spectators are not allowed to send chat or reactions in live game.
                  </span>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="p-3 border-t border-slate-200 dark:border-casino-border bg-white dark:bg-casino-card flex items-center space-x-2"
                >
                  {/* Active selected emoji badge */}
                  {selectedEmoji && (
                    <div className="flex items-center space-x-1 pl-2 pr-1 py-1 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300 text-xs font-bold flex-shrink-0">
                      <span className="text-base leading-none">{selectedEmoji}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedEmoji('')}
                        className="p-0.5 hover:text-black dark:hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <input
                    ref={inputRef}
                    type="text"
                    maxLength={120}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={selectedEmoji ? "Add message or send..." : "Send an emoji or message..."}
                    className="flex-1 bg-slate-100 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 dark:focus:border-amber-400 transition-colors"
                  />

                  <button
                    type="submit"
                    disabled={!inputText.trim() && !selectedEmoji}
                    className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold transition-all shadow-md active:scale-95 flex-shrink-0"
                    title="Send"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Floating Live Screen Reactions Component
 * Renders playful emojis bubbling upward from the bottom right
 */
export function FloatingReactions({ reactions = [] }) {
  return (
    <div className="fixed bottom-24 right-4 sm:right-8 z-40 pointer-events-none flex flex-col items-end space-y-1">
      <AnimatePresence>
        {reactions.slice(-6).map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.2, y: 30, x: Math.random() * 20 - 10 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1, 0.8], y: -90, x: Math.random() * 30 - 15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.4, ease: 'easeOut' }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 dark:bg-black/90 text-white border border-amber-400/50 shadow-2xl backdrop-blur-md"
          >
            <span className="text-xl leading-none select-none">{item.emoji}</span>
            <span className="text-[10px] font-bold text-amber-200 max-w-[80px] truncate">
              {item.username}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}