import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Headphones, Send, X, ShieldCheck, CheckCircle2, Clock, 
  Sparkles, MessageSquare, AlertCircle, RefreshCw, User 
} from 'lucide-react';
import { supportAPI } from '../services/api';
import PlayerAvatar from './PlayerAvatar';

const SUPPORT_TOPICS = [
  'General Inquiry',
  'Deposit / Buy Coins',
  'Sell Coins & Cash-Out',
  'Game Rules & Tables',
  'Account & Security',
];

export default function SupportModal({ isOpen, onClose, user, socket, onNewReply, onOpenAdminSupport }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(SUPPORT_TOPICS[0]);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadMessages();
      setError('');
      setSuccessNotice('');
    }
  }, [isOpen]);

  // Real-time socket listener for admin replies
  useEffect(() => {
    if (!socket) return;

    const handleNewReply = (data) => {
      setMessages((prev) => {
        // Prevent duplicate
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, {
          id: data.id,
          user_id: data.userId,
          sender_role: 'admin',
          admin_username: data.adminUsername,
          subject: data.subject || 'Admin Reply',
          message: data.message,
          status: data.status || 'replied',
          created_at: data.createdAt || new Date().toISOString(),
        }];
      });
      if (onNewReply) onNewReply();
    };

    socket.on('support:new_reply', handleNewReply);
    return () => {
      socket.off('support:new_reply', handleNewReply);
    };
  }, [socket, onNewReply]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await supportAPI.getMyMessages();
      if (res.data?.data) {
        setMessages(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load support messages:', err);
      setError('Could not load message history. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText || sending) return;

    try {
      setSending(true);
      setError('');
      setSuccessNotice('');

      const res = await supportAPI.sendMessage({
        message: cleanText,
        subject: selectedTopic,
      });

      if (res.data?.data) {
        setMessages((prev) => [...prev, res.data.data]);
        setInputText('');
        setSuccessNotice('Your message has been sent to our support team!');
        setTimeout(() => setSuccessNotice(''), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  // Determine latest status
  const latestMessage = messages[messages.length - 1];
  const currentStatus = latestMessage?.status || 'open';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm">
        {/* Backdrop */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl h-[620px] max-h-[92vh] bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-casino-border bg-slate-50 dark:bg-casino-dark/70 flex-shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-black flex items-center justify-center shadow-md shadow-amber-500/20 font-bold">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">
                    Customer Support Desk
                  </h3>
                  {messages.length > 0 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      currentStatus === 'resolved'
                        ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                        : currentStatus === 'replied'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    }`}>
                      {currentStatus === 'resolved' ? '✓ Resolved' : currentStatus === 'replied' ? '💬 Admin Replied' : '⏳ Waiting Reply'}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-gray-400">
                  Chat directly with our administrative support staff
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={loadMessages}
                disabled={loading}
                title="Refresh messages"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
              </button>

              <button
                onClick={onClose}
                title="Close"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Admin Staff Quick Switch Banner */}
          {user && ['admin', 'moderator', 'finance'].includes(user.role) && (
            <div className="px-4 py-3 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-amber-500/20 border-b border-amber-500/30 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-xs">
                <ShieldCheck className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-slate-800 dark:text-gray-200">
                  Logged in as <strong className="capitalize">{user.role}</strong>. Reply to player tickets in Support Desk.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenAdminSupport) onOpenAdminSupport();
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-md transition-colors whitespace-nowrap"
              >
                Open Support Desk →
              </button>
            </div>
          )}

          {/* Quick Notice Banner */}
          {successNotice && (
            <div className="px-4 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
              <span>{successNotice}</span>
            </div>
          )}

          {error && (
            <div className="px-4 py-2 bg-rose-500/15 border-b border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin bg-slate-50/50 dark:bg-casino-dark/40">
            {loading && messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-gray-500 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <p className="text-xs font-medium">Connecting to Support Desk...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-gray-500 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl">
                  🎧
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white mb-1">
                    How can we help you today?
                  </h4>
                  <p className="text-xs max-w-sm text-slate-500 dark:text-gray-400 leading-relaxed">
                    Have questions about buying coins, selling coins, games, or account verification? Type your question below and our admin team will reply promptly.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center max-w-xs pt-1">
                  {SUPPORT_TOPICS.slice(1, 4).map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => {
                        setSelectedTopic(topic);
                        inputRef.current?.focus();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-white/5 hover:bg-amber-500/20 hover:text-amber-500 text-[11px] font-bold text-slate-600 dark:text-gray-300 transition-colors border border-slate-300 dark:border-white/10"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((item) => {
                const isAdmin = item.sender_role === 'admin';

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex items-start space-x-2.5 ${isAdmin ? '' : 'flex-row-reverse space-x-reverse'}`}
                  >
                    {/* Avatar */}
                    {isAdmin ? (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md flex-shrink-0 border border-purple-400/40">
                        <ShieldCheck className="w-4 h-4 text-amber-300" />
                      </div>
                    ) : (
                      <PlayerAvatar
                        photoUrl={user?.photoUrl || user?.photo_url}
                        username={user?.username || 'You'}
                        userId={user?.id}
                        size="sm"
                        borderColor="border border-cyan-400"
                      />
                    )}

                    <div className={`max-w-[82%] sm:max-w-[75%] flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}>
                      {/* Sender Meta */}
                      <div className="flex items-center space-x-1.5 px-1 mb-1">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-gray-200 flex items-center space-x-1">
                          {isAdmin ? (
                            <>
                              <span className="text-purple-600 dark:text-purple-300">
                                {item.admin_username || 'Support Admin'}
                              </span>
                              <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30">
                                Staff
                              </span>
                            </>
                          ) : (
                            <span>You</span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono">
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm break-words ${
                          isAdmin
                            ? 'bg-white dark:bg-casino-card border border-purple-500/30 text-slate-800 dark:text-gray-100 rounded-tl-none shadow-md'
                            : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-medium rounded-tr-none shadow-amber-500/20'
                        }`}
                      >
                        {item.subject && item.subject !== 'General Support' && (
                          <div className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${
                            isAdmin ? 'text-purple-600 dark:text-purple-300' : 'text-amber-950/80 font-black'
                          }`}>
                            📌 {item.subject}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{item.message}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer Form */}
          <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-casino-border bg-white dark:bg-casino-card flex-shrink-0 space-y-2.5">
            {/* Quick Topic Chips */}
            <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none pb-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500 flex-shrink-0 mr-1">
                Topic:
              </span>
              {SUPPORT_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setSelectedTopic(topic)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex-shrink-0 ${
                    selectedTopic === topic
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'bg-slate-100 dark:bg-casino-dark hover:bg-slate-200 dark:hover:bg-white/5 text-slate-600 dark:text-gray-400'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
              <textarea
                ref={inputRef}
                rows={2}
                maxLength={3000}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Write your message or inquiry here... (Press Enter to send)"
                className="flex-1 bg-slate-100 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 resize-none transition-colors"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-40 text-black font-black text-xs sm:text-sm flex items-center space-x-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all flex-shrink-0"
              >
                {sending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="hidden xs:inline">Send</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
