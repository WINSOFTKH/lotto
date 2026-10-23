import React, { useState, useEffect, useRef } from 'react';
import { 
  Headphones, MessageSquare, Send, Check, CheckCheck, 
  CheckCircle2, Clock, Search, RefreshCw, X, ChevronLeft, 
  Shield, User, ArrowUpRight
} from 'lucide-react';
import { supportAPI } from '../services/api';
import PlayerAvatar from './PlayerAvatar';
import { formatCoins } from '../utils/formatters';

export default function AdminSupportDesk({
  user,
  socket,
  initialSelectedUserId = null,
  isModal = false,
  onClose,
}) {
  const [supportConversations, setSupportConversations] = useState([]);
  const [supportStats, setSupportStats] = useState({
    totalConversations: 0,
    openCount: 0,
    repliedCount: 0,
    resolvedCount: 0,
    unreadMessagesTotal: 0,
  });
  const [selectedSupportUserId, setSelectedSupportUserId] = useState(initialSelectedUserId);
  const [activeSupportThread, setActiveSupportThread] = useState({ player: null, messages: [] });
  const [supportFilter, setSupportFilter] = useState('all'); // 'all', 'open', 'replied', 'resolved'
  const [supportSearch, setSupportSearch] = useState('');
  const [supportReplyText, setSupportReplyText] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportThreadLoading, setSupportThreadLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSupportThread.messages]);

  // Initial load
  useEffect(() => {
    loadSupportConversations(supportFilter, supportSearch);
    if (initialSelectedUserId) {
      loadSupportThread(initialSelectedUserId);
    }
  }, []);

  // Reload when filter or search changes
  useEffect(() => {
    loadSupportConversations(supportFilter, supportSearch);
  }, [supportFilter, supportSearch]);

  // Handle incoming initialSelectedUserId changes
  useEffect(() => {
    if (initialSelectedUserId && initialSelectedUserId !== selectedSupportUserId) {
      loadSupportThread(initialSelectedUserId);
    }
  }, [initialSelectedUserId]);

  // Real-time socket listener for incoming player messages
  useEffect(() => {
    if (!socket) return;
    const handleAdminSupportNewMsg = (data) => {
      loadSupportConversations(supportFilter, supportSearch);
      if (selectedSupportUserId && String(selectedSupportUserId) === String(data.userId)) {
        setActiveSupportThread((prev) => {
          if (!prev || !prev.player || String(prev.player.id) !== String(data.userId)) return prev;
          if (prev.messages?.some((m) => m.id === data.id)) return prev;
          return {
            ...prev,
            messages: [
              ...(prev.messages || []),
              {
                id: data.id,
                user_id: data.userId,
                sender_role: 'player',
                subject: data.subject,
                message: data.message,
                status: 'open',
                created_at: data.createdAt,
              },
            ],
          };
        });
      }
    };

    socket.on('admin:support_new_message', handleAdminSupportNewMsg);
    return () => {
      socket.off('admin:support_new_message', handleAdminSupportNewMsg);
    };
  }, [socket, selectedSupportUserId, supportFilter, supportSearch]);

  const loadSupportConversations = async (status = supportFilter, search = supportSearch) => {
    try {
      const res = await supportAPI.getConversations({ status, search });
      if (res.data?.data) {
        setSupportConversations(res.data.data.conversations || []);
        if (res.data.data.stats) {
          setSupportStats(res.data.data.stats);
        }
      }
    } catch (err) {
      console.warn('Failed to load support conversations:', err);
    }
  };

  const loadSupportThread = async (userId) => {
    try {
      setSupportThreadLoading(true);
      setSelectedSupportUserId(userId);
      setActionError('');
      const res = await supportAPI.getConversationMessages(userId);
      if (res.data?.data) {
        setActiveSupportThread(res.data.data);
        loadSupportConversations();
      }
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to load player message thread');
    } finally {
      setSupportThreadLoading(false);
    }
  };

  const handleSendSupportReply = async (status = 'replied') => {
    if (!selectedSupportUserId || !supportReplyText.trim() || supportSending) return;
    try {
      setSupportSending(true);
      setActionError('');
      setActionNotice('');
      const res = await supportAPI.reply(selectedSupportUserId, {
        message: supportReplyText.trim(),
        status,
      });
      if (res.data?.data) {
        setActiveSupportThread((prev) => ({
          ...prev,
          messages: [...(prev.messages || []), res.data.data],
        }));
        setSupportReplyText('');
        setActionNotice('Reply sent to player successfully!');
        setTimeout(() => setActionNotice(''), 4000);
        loadSupportConversations();
      }
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to send reply');
    } finally {
      setSupportSending(false);
    }
  };

  const handleUpdateSupportStatus = async (status) => {
    if (!selectedSupportUserId) return;
    try {
      setActionError('');
      await supportAPI.updateStatus(selectedSupportUserId, status);
      setActionNotice(`Thread marked as ${status}`);
      setTimeout(() => setActionNotice(''), 4000);
      loadSupportThread(selectedSupportUserId);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to update status');
    }
  };

  const content = (
    <div className="space-y-4">
      {/* Notifications */}
      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
          <X className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
        {/* Total Inquiries */}
        <div
          onClick={() => setSupportFilter('all')}
          className={`bg-white dark:bg-casino-card border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-sm cursor-pointer transition-all flex flex-col justify-between hover:scale-[1.01] ${
            supportFilter === 'all'
              ? 'border-amber-500 ring-2 ring-amber-500/30'
              : 'border-slate-200 dark:border-casino-border hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate">
              Total Tickets
            </span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Headphones className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-2xl font-black font-mono text-slate-900 dark:text-white">
            {supportStats?.totalConversations || 0}
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-gray-500 block mt-0.5">
            All player support threads
          </span>
        </div>

        {/* Waiting Reply (Open) */}
        <div
          onClick={() => setSupportFilter(supportFilter === 'open' ? 'all' : 'open')}
          className={`bg-white dark:bg-casino-card border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-sm cursor-pointer transition-all flex flex-col justify-between hover:scale-[1.01] ${
            supportFilter === 'open'
              ? 'border-rose-500 ring-2 ring-rose-500/30'
              : 'border-slate-200 dark:border-casino-border hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-xs font-semibold text-rose-500 dark:text-rose-400 truncate">
              Awaiting Reply
            </span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-2xl font-black font-mono text-rose-600 dark:text-rose-400 flex items-center space-x-1.5">
            <span>{supportStats?.openCount || 0}</span>
            {supportStats?.openCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
            )}
          </div>
          <span className="text-[9px] sm:text-[10px] text-rose-500/80 dark:text-rose-400/80 block mt-0.5">
            Needs staff attention
          </span>
        </div>

        {/* Replied by Staff */}
        <div
          onClick={() => setSupportFilter(supportFilter === 'replied' ? 'all' : 'replied')}
          className={`bg-white dark:bg-casino-card border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-sm cursor-pointer transition-all flex flex-col justify-between hover:scale-[1.01] ${
            supportFilter === 'replied'
              ? 'border-sky-500 ring-2 ring-sky-500/30'
              : 'border-slate-200 dark:border-casino-border hover:border-sky-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-xs font-semibold text-sky-500 dark:text-sky-400 truncate">
              Staff Replied
            </span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Send className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-2xl font-black font-mono text-sky-600 dark:text-sky-400">
            {supportStats?.repliedCount || 0}
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-gray-500 block mt-0.5">
            Answered & pending player
          </span>
        </div>

        {/* Resolved */}
        <div
          onClick={() => setSupportFilter(supportFilter === 'resolved' ? 'all' : 'resolved')}
          className={`bg-white dark:bg-casino-card border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-sm cursor-pointer transition-all flex flex-col justify-between hover:scale-[1.01] ${
            supportFilter === 'resolved'
              ? 'border-emerald-500 ring-2 ring-emerald-500/30'
              : 'border-slate-200 dark:border-casino-border hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
              Resolved
            </span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {supportStats?.resolvedCount || 0}
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-gray-500 block mt-0.5">
            Closed inquiries
          </span>
        </div>

        {/* Unread Player Messages */}
        <div
          className="col-span-2 sm:col-span-1 bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-xs font-semibold text-purple-600 dark:text-purple-400 truncate">
              Unread Messages
            </span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
            {supportStats?.unreadMessagesTotal || 0}
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-gray-500 block mt-0.5">
            Unseen by support team
          </span>
        </div>
      </div>

      {/* Master-Detail Two-Column Layout */}
      <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-2xl overflow-hidden shadow-xl grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        {/* LEFT COLUMN: Conversation Queue */}
        <div
          className={`lg:col-span-5 xl:col-span-4 border-r border-slate-200 dark:border-casino-border flex flex-col ${
            selectedSupportUserId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Toolbar */}
          <div className="p-3.5 border-b border-slate-200 dark:border-casino-border space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Headphones className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Player Tickets</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300">
                  {supportConversations.length}
                </span>
              </div>
              <button
                onClick={() => loadSupportConversations(supportFilter, supportSearch)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-casino-dark dark:hover:bg-casino-border border border-slate-200 dark:border-casino-border text-slate-600 dark:text-gray-300 transition-colors"
                title="Refresh Tickets"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={supportSearch}
                onChange={(e) => setSupportSearch(e.target.value)}
                placeholder="Search player, email, message..."
                className="w-full bg-slate-50 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
              {supportSearch && (
                <button
                  onClick={() => setSupportSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex bg-slate-100 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl p-0.5 space-x-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'open', label: 'Awaiting', count: supportStats?.openCount },
                { id: 'replied', label: 'Replied' },
                { id: 'resolved', label: 'Resolved' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSupportFilter(f.id)}
                  className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center space-x-1 ${
                    supportFilter === f.id
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{f.label}</span>
                  {f.count > 0 && (
                    <span className={`px-1 py-0.2 rounded-full text-[9px] font-black ${
                      supportFilter === f.id ? 'bg-black text-amber-400' : 'bg-rose-500 text-white'
                    }`}>
                      {f.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto max-h-[580px] divide-y divide-slate-100 dark:divide-casino-border/50">
            {supportConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-gray-500 space-y-2">
                <Headphones className="w-8 h-8 mx-auto opacity-40 text-amber-500" />
                <p className="text-xs font-semibold">No player inquiries found</p>
                <p className="text-[11px] opacity-70">
                  {supportSearch || supportFilter !== 'all'
                    ? 'Try clearing the search or status filter'
                    : 'New player support messages will appear here in real time'}
                </p>
              </div>
            ) : (
              supportConversations.map((c) => {
                const isSelected = selectedSupportUserId === c.user_id;
                const hasUnread = Number(c.unread_by_admin_count || 0) > 0;
                const status = c.latest_status || 'open';
                return (
                  <div
                    key={c.user_id}
                    onClick={() => loadSupportThread(c.user_id)}
                    className={`p-3 sm:p-3.5 cursor-pointer transition-all border-l-4 ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 dark:bg-amber-500/10'
                        : hasUnread
                        ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500'
                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center space-x-2 truncate">
                        <PlayerAvatar
                          player={{
                            username: c.username,
                            photo_url: c.photo_url,
                            avatar_url: c.photo_url,
                          }}
                          size="sm"
                        />
                        <div className="truncate">
                          <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                            {c.username}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-gray-400 truncate block">
                            {c.email}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0 space-y-1">
                        <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono whitespace-nowrap">
                          {c.last_message_at
                            ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            status === 'open'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                              : status === 'replied'
                              ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {status === 'open' ? 'Awaiting' : status === 'replied' ? 'Replied' : 'Resolved'}
                        </span>
                      </div>
                    </div>

                    {/* Subject badge & snippet */}
                    <div className="mt-1 space-y-1">
                      {c.last_subject && (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold border border-amber-500/20 truncate max-w-full">
                          {c.last_subject}
                        </span>
                      )}
                      <p className="text-[11px] text-slate-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                        {c.last_sender_role === 'admin' ? (
                          <strong className="text-amber-600 dark:text-amber-400 mr-1 font-semibold">Staff:</strong>
                        ) : null}
                        {c.last_message}
                      </p>
                    </div>

                    {/* Bottom indicators */}
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 dark:border-white/5 text-[10px]">
                      <span className="text-slate-400 dark:text-gray-500 font-mono">
                        {c.coin_balance !== undefined && c.coin_balance !== null
                          ? `${formatCoins(c.coin_balance)} Coins`
                          : ''}
                      </span>
                      {hasUnread && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white animate-pulse">
                          {c.unread_by_admin_count} new message{c.unread_by_admin_count > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Chat History & Reply Composer */}
        <div
          className={`lg:col-span-7 xl:col-span-8 flex flex-col bg-slate-50/60 dark:bg-casino-dark/40 ${
            !selectedSupportUserId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {!selectedSupportUserId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400 shadow-inner">
                <Headphones className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Player Support Desk
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                  Select a player inquiry from the ticket queue on the left to inspect the full conversation history, review account details, and send real-time responses.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full">
              {/* Selected Player Header */}
              <div className="p-3.5 sm:p-4 bg-white dark:bg-casino-card border-b border-slate-200 dark:border-casino-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  {/* Mobile back to list button */}
                  <button
                    onClick={() => setSelectedSupportUserId(null)}
                    className="lg:hidden p-1.5 rounded-lg bg-slate-100 dark:bg-casino-dark border border-slate-200 dark:border-casino-border text-slate-600 dark:text-gray-300"
                    title="Back to Tickets"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <PlayerAvatar
                    player={{
                      username: activeSupportThread.player?.username,
                      photo_url: activeSupportThread.player?.photo_url,
                      avatar_url: activeSupportThread.player?.photo_url,
                    }}
                    size="md"
                  />
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        {activeSupportThread.player?.username}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        {formatCoins(activeSupportThread.player?.coin_balance)} Coins
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          activeSupportThread.player?.is_banned
                            ? 'bg-rose-500/20 text-rose-500 border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                        }`}
                      >
                        {activeSupportThread.player?.is_banned ? 'Suspended' : 'Active'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-gray-400">
                      {activeSupportThread.player?.email} • Role: {activeSupportThread.player?.role}
                    </p>
                  </div>
                </div>

                {/* Status Actions */}
                <div className="flex items-center space-x-2">
                  {activeSupportThread.messages?.length > 0 && (
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleUpdateSupportStatus('open')}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-colors"
                      >
                        Mark Awaiting
                      </button>
                      <button
                        onClick={() => handleUpdateSupportStatus('resolved')}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-colors flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Resolved</span>
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => loadSupportThread(selectedSupportUserId)}
                    disabled={supportThreadLoading}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-casino-dark dark:hover:bg-casino-border border border-slate-200 dark:border-casino-border text-slate-600 dark:text-gray-300 transition-colors"
                    title="Refresh Messages"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${supportThreadLoading ? 'animate-spin text-amber-500' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Messages Stream */}
              <div className="flex-1 p-4 overflow-y-auto max-h-[440px] space-y-3.5">
                {supportThreadLoading ? (
                  <div className="flex items-center justify-center py-12 space-x-2 text-slate-400 dark:text-gray-500">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                    <span className="text-xs">Loading message thread...</span>
                  </div>
                ) : activeSupportThread.messages?.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 dark:text-gray-500 space-y-1">
                    <p className="text-xs">No messages yet in this inquiry thread.</p>
                  </div>
                ) : (
                  activeSupportThread.messages.map((m) => {
                    const isPlayer = m.sender_role === 'player';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isPlayer ? 'items-start' : 'items-end'}`}
                      >
                        {/* Sender Info & Time */}
                        <div className="flex items-center space-x-1.5 mb-1 text-[11px] text-slate-400 dark:text-gray-400">
                          {isPlayer ? (
                            <>
                              <span className="font-bold text-slate-700 dark:text-gray-200">
                                {activeSupportThread.player?.username}
                              </span>
                              <span>•</span>
                              <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </>
                          ) : (
                            <>
                              <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span>•</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center space-x-1">
                                <Shield className="w-3 h-3" />
                                <span>Staff ({m.admin_username || user.username})</span>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Message Bubble */}
                        <div
                          className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-sm text-xs leading-relaxed whitespace-pre-wrap ${
                            isPlayer
                              ? 'bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border text-slate-800 dark:text-gray-100 rounded-tl-sm'
                              : 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-medium rounded-tr-sm shadow-amber-500/10'
                          }`}
                        >
                          {isPlayer && m.subject && (
                            <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1 border-b border-slate-100 dark:border-white/10 pb-1">
                              Topic: {m.subject}
                            </div>
                          )}
                          <p>{m.message}</p>
                        </div>

                        {/* Status below staff message */}
                        {!isPlayer && (
                          <div className="flex items-center space-x-1 text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                            <CheckCheck className="w-3 h-3" />
                            <span>Sent to player</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Canned Quick Responses Bar */}
              <div className="px-3.5 py-2 bg-slate-100/70 dark:bg-casino-dark/70 border-t border-slate-200 dark:border-casino-border flex items-center space-x-1.5 overflow-x-auto text-[11px]">
                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase flex-shrink-0 mr-1">
                  Quick:
                </span>
                {[
                  '👋 Hello! How can we assist you today?',
                  '✅ Buy coins confirmed: Your coins have been added to your balance.',
                  '🏦 Cash-out processed: Funds sent to your bank account.',
                  '📸 Please provide your transaction reference or payment screenshot.',
                  '✨ We have resolved this inquiry. Thank you for playing!',
                ].map((canned, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSupportReplyText(canned)}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-casino-card hover:bg-amber-500/10 border border-slate-200 dark:border-casino-border text-slate-700 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 whitespace-nowrap transition-colors flex-shrink-0"
                  >
                    {canned}
                  </button>
                ))}
              </div>

              {/* Reply Composer Area */}
              <div className="p-3.5 bg-white dark:bg-casino-card border-t border-slate-200 dark:border-casino-border space-y-2">
                <textarea
                  rows="3"
                  value={supportReplyText}
                  onChange={(e) => setSupportReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSendSupportReply('replied');
                    }
                  }}
                  placeholder="Type your official reply to player... (Press Ctrl+Enter to send)"
                  className="w-full bg-slate-50 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500">
                    Tip: Press <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-gray-300 font-mono text-[9px]">Ctrl+Enter</kbd> to quick send
                  </span>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleSendSupportReply('resolved')}
                      disabled={!supportReplyText.trim() || supportSending}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-colors flex items-center space-x-1.5 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Send & Resolve</span>
                    </button>

                    <button
                      onClick={() => handleSendSupportReply('replied')}
                      disabled={!supportReplyText.trim() || supportSending}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40 transition-colors flex items-center space-x-1.5 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{supportSending ? 'Sending...' : 'Send Reply'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
        <div className="relative w-full max-w-6xl bg-slate-100 dark:bg-casino-dark border border-slate-300 dark:border-casino-border rounded-2xl shadow-2xl overflow-hidden p-4 sm:p-6 my-auto">
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-casino-border">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>Admin Support Help Desk</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 uppercase">
                    Staff Portal
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Inspect player tickets and reply to support messages in real time
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              title="Close Help Desk"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[82vh] overflow-y-auto pr-1">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return content;
}
