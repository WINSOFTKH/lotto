import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Plus,
  Users,
  Coins,
  Trophy,
  RefreshCw,
  Flame,
  Trash2,
  Eye,
  Search,
  X,
  Copy,
  Check,
  Hash,
  ArrowRight,
} from "lucide-react";
import { tableAPI } from "../services/api";
import { formatCoins } from "../utils/formatters";
import CoinIcon from "../components/CoinIcon";

export default function Dashboard({ user, onJoinTable, onQuickPlay }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tableName, setTableName] = useState("");
  const [entryFee, setEntryFee] = useState("100");
  const [quickPlayCoins, setQuickPlayCoins] = useState(100);
  const [allowedEntryFees, setAllowedEntryFees] = useState([50, 100, 250, 500]);
  const [maxPlayersPerTable, setMaxPlayersPerTable] = useState(10);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [createActiveTableId, setCreateActiveTableId] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  // Debounced search when query changes
  useEffect(() => {
    const handler = setTimeout(() => {
      loadTables(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Periodic poll to keep active tables fresh
  useEffect(() => {
    const interval = setInterval(() => {
      loadTables(searchQuery);
    }, 4000);
    return () => clearInterval(interval);
  }, [searchQuery]);

  const loadConfig = async () => {
    try {
      const res = await tableAPI.getConfig();
      if (res.data?.data) {
        setQuickPlayCoins(res.data.data.quickPlayCoins || 100);
        if (res.data.data.maxPlayersPerTable) {
          setMaxPlayersPerTable(res.data.data.maxPlayersPerTable);
        }
        if (res.data.data.allowedEntryFees?.length) {
          setAllowedEntryFees(res.data.data.allowedEntryFees);
          setEntryFee(
            String(
              res.data.data.allowedEntryFees[1] ||
                res.data.data.allowedEntryFees[0],
            ),
          );
        }
      }
    } catch (err) {
      console.warn("Failed to load table config:", err);
    }
  };

  const loadTables = async (query = searchQuery) => {
    try {
      const params =
        query && query.trim() ? { search: query.trim() } : undefined;
      const res = await tableAPI.getTables(params);
      setTables(res.data.data || []);
    } catch (err) {
      console.error("Failed to load tables:", err);
    } finally {
      setLoading(false);
    }
  };

  // Instant client-side filter by Table ID or Name
  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tables;
    const q = searchQuery.trim().toLowerCase();
    return tables.filter(
      (t) =>
        (t.id && t.id.toLowerCase().includes(q)) ||
        (t.name && t.name.toLowerCase().includes(q)),
    );
  }, [tables, searchQuery]);

  // Identify if the logged-in player is actively seated in any waiting or live table
  const activeUserTable = useMemo(() => {
    return tables.find((t) => Boolean(t.is_user_seated));
  }, [tables]);

  const handleDeleteTable = async (tableId, name) => {
    if (
      !window.confirm(
        `Are you sure you want to delete table "${name}"? Only empty tables can be deleted.`,
      )
    ) {
      return;
    }
    try {
      await tableAPI.deleteTable(tableId);
      loadTables();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete table");
    }
  };

  const handleCreateTable = async (e) => {
    e.preventDefault();
    if (!tableName.trim()) return;

    try {
      setCreating(true);
      setError("");
      setCreateActiveTableId(null);
      const res = await tableAPI.createTable({
        name: tableName.trim(),
        entryFee: parseInt(entryFee, 10),
      });
      setShowCreateModal(false);
      setTableName("");
      // Auto join the newly created table
      onJoinTable(res.data.data.id);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create table");
      if (err.response?.data?.activeTableId) {
        setCreateActiveTableId(err.response.data.activeTableId);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-5 sm:space-y-8">
      {/* Hero Banner with Quick Play */}
      <div className="relative rounded-3xl bg-gradient-to-r from-amber-500/10 via-white to-purple-500/10 dark:from-purple-900/60 dark:via-casino-card dark:to-amber-950/40 border border-amber-500/30 dark:border-casino-border p-4 sm:p-10 shadow-xl dark:shadow-2xl overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/15 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-2xl relative z-10 space-y-3 sm:space-y-4">
          <div className="inline-flex items-center space-x-2 bg-amber-500/15 dark:bg-amber-500/10 border border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs px-3 py-1 rounded-full font-bold">
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>High Concurrency Fast Lotto</span>
          </div>

          <h1 className="text-2xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Match 5 Numbers. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 dark:from-amber-400 dark:via-yellow-200 dark:to-amber-500">
              Win 90% of the Pool!
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
            Every table holds up to {maxPlayersPerTable} players. When all seats
            are taken or countdown finishes, the lottery drum starts rolling!
            Numbers drawn 1-99 every 3 seconds until one champion matches all 5
            numbers.
          </p>

          <div className="flex flex-wrap gap-2.5 sm:gap-4 pt-1 sm:pt-2">
            {/* Quick Play Matchmaker Button */}
            <button
              onClick={() => onQuickPlay(quickPlayCoins)}
              className="py-2.5 sm:py-3.5 px-4 sm:px-6 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 hover:from-amber-400 hover:to-yellow-200 text-black shadow-lg shadow-amber-500/20 flex items-center space-x-2 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-black" />
              <span className="inline-flex items-center gap-1.5">
                Quick Play
              </span>
            </button>

            {/* Create Custom Table Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="py-2.5 sm:py-3.5 px-4 sm:px-6 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm bg-casino-card hover:bg-casino-border border border-casino-border text-slate-900 dark:text-white flex items-center space-x-2 transition-all hover:scale-[1.02] shadow-sm"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 dark:text-amber-400" />
              <span>Create New Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tables Lobby Grid Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <span>Active Tables Lobby</span>
            <span className="text-xs bg-slate-200 dark:bg-gray-800 text-slate-700 dark:text-gray-400 px-2 py-0.5 rounded-full border border-slate-300 dark:border-gray-700 font-mono">
              {filteredTables.length} Active
            </span>
          </h2>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
            Join an open table, wait for players, or search by Table ID.
          </p>
        </div>

        {/* Search by Table ID / Name & Refresh */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Table ID or Name..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => loadTables()}
            className="p-2 rounded-xl bg-white dark:bg-casino-card hover:bg-slate-100 dark:hover:bg-casino-border border border-slate-200 dark:border-casino-border text-slate-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors shadow-sm flex-shrink-0"
            title="Refresh Lobby"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Game Alert Banner */}
      {activeUserTable && (
        <div className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border border-emerald-500/40 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-emerald-500/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-black flex items-center justify-center font-black text-lg flex-shrink-0 animate-pulse">
              🎮
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Your Active Game In Progress
                </span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                {activeUserTable.name}
                <span className="ml-2 text-[11px] sm:text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  (
                  {activeUserTable.status === "playing"
                    ? "● Drawing Live"
                    : `Waiting ${activeUserTable.current_players}/${activeUserTable.max_players || 10}`}
                  )
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => onJoinTable(activeUserTable.id)}
            className="py-2 sm:py-2.5 px-4 sm:px-5 rounded-xl font-black text-xs bg-emerald-500 hover:bg-emerald-400 text-black transition-all shadow-md shadow-emerald-500/20 flex items-center space-x-1.5 self-stretch sm:self-auto justify-center hover:scale-[1.02] active:scale-95"
          >
            <span>Return to Game</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tables Grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          Loading lottery tables...
        </div>
      ) : tables.length === 0 ? (
        <div className="text-center py-16 bg-casino-card/40 border border-dashed border-gray-800 rounded-3xl p-8">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-300 mb-1">
            No Active Tables Right Now
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Be the first to create a table and challenge other players!
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="py-2.5 px-5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-black shadow-md transition-all"
          >
            Create Table Now
          </button>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-casino-card/40 border border-dashed border-slate-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8">
          <Search className="w-10 h-10 text-slate-400 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-gray-200 mb-1">
            No Tables Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
            No active table matches "
            <span className="font-mono text-amber-500 font-semibold">
              {searchQuery}
            </span>
            ". Please check the Table ID and try again.
          </p>
          <button
            onClick={() => setSearchQuery("")}
            className="py-2 px-4 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-casino-card dark:hover:bg-casino-border border border-slate-200 dark:border-casino-border text-slate-800 dark:text-gray-200 transition-all shadow-sm"
          >
            Clear Search Filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          {filteredTables.map((table) => {
            const maxSeats = table.max_players || 10;
            const isFull = table.current_players >= maxSeats;
            const isPlaying = table.status === "playing";
            const isSeated = Boolean(table.is_user_seated);

            return (
              <motion.div
                key={table.id}
                whileHover={{ y: -2 }}
                className={`bg-white dark:bg-casino-card border ${
                  isSeated
                    ? "border-emerald-500/80 ring-2 ring-emerald-500/30 shadow-emerald-500/10"
                    : "border-slate-200 dark:border-casino-border hover:border-amber-400/60 dark:hover:border-amber-500/40"
                } rounded-xl sm:rounded-2xl p-2 sm:p-5 shadow-sm sm:shadow-md flex flex-col justify-between transition-all`}
              >
                <div>
                  {/* Top Status & Seat Counter */}
                  <div className="flex items-center justify-between mb-1 sm:mb-2.5">
                    {isSeated ? (
                      <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2.5 py-0.5 rounded-full border bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40 animate-pulse">
                        Your Game
                      </span>
                    ) : (
                      <span
                        className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2.5 py-0.5 rounded-full border ${
                          isPlaying
                            ? "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/30 animate-pulse"
                            : "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30"
                        }`}
                      >
                        {isPlaying ? "● Live" : "Waiting"}
                      </span>
                    )}
                    <span className="text-[10px] sm:text-xs text-slate-500 dark:text-gray-400 flex items-center space-x-1 font-mono">
                      <Users className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-slate-400 dark:text-gray-500" />
                      <strong className="text-slate-900 dark:text-white font-mono">
                        {table.current_players}/{maxSeats}
                      </strong>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-gray-500 hidden sm:inline">
                        (Min 2)
                      </span>
                    </span>
                  </div>

                  {/* Table Name & ID Row */}
                  <div className="flex items-center justify-between gap-1 mb-1 sm:mb-2">
                    <h3
                      className="font-bold sm:font-extrabold text-slate-900 dark:text-white text-xs sm:text-base truncate flex-1 leading-tight"
                      title={table.name}
                    >
                      {table.name}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const shortId = table.id.slice(0, 8);
                        navigator.clipboard.writeText(shortId);
                        setCopiedId(table.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="inline-flex items-center space-x-0.5 sm:space-x-1 px-1 py-0.5 rounded bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-[8px] sm:text-[9px] font-mono text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-colors flex-shrink-0 border border-slate-200/70 dark:border-white/10"
                      title={`Click to copy Table ID: ${table.id.slice(0, 8)}`}
                    >
                      <Hash className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-amber-500" />
                      <span>{table.id.slice(0, 8)}</span>
                      {copiedId === table.id ? (
                        <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-2 h-2 sm:w-2.5 sm:h-2.5 opacity-60" />
                      )}
                    </button>
                  </div>

                  {/* Pool & Fee Stats (Compact Single/Two-Row Box on Mobile) */}
                  <div className="grid grid-cols-2 gap-1 sm:gap-2 bg-slate-50 dark:bg-casino-dark/80 rounded-lg sm:rounded-xl p-1.5 sm:p-3 border border-slate-200 dark:border-casino-border mb-2 sm:mb-4 text-[10px] sm:text-xs">
                    <div className="min-w-0">
                      <span className="text-slate-500 dark:text-gray-400 block text-[8px] sm:text-[10px] truncate">
                        Entry Fee:
                      </span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px] sm:text-xs truncate flex items-center gap-1">
                        <CoinIcon className="w-3.5 h-3.5" />
                        {formatCoins(table.entry_fee)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-slate-500 dark:text-gray-400 block text-[8px] sm:text-[10px] truncate">
                        Winner Prize:
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px] sm:text-xs truncate flex items-center gap-1">
                        <CoinIcon className="w-3.5 h-3.5" />
                        {formatCoins(
                          Math.floor(table.entry_fee * maxSeats * 0.9),
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Join / Spectate Button & Delete Button if 0 players */}
                <div className="flex space-x-1 sm:space-x-2">
                  <button
                    onClick={() => onJoinTable(table.id)}
                    className={`flex-1 py-1.5 sm:py-2.5 px-2 sm:px-4 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center space-x-1 transition-all shadow-sm ${
                      isSeated
                        ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/20 ring-2 ring-emerald-400/50"
                        : isPlaying
                          ? "bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-500/40 dark:hover:bg-purple-800/50"
                          : "bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20"
                    }`}
                  >
                    {isSeated ? (
                      <>
                        <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-black flex-shrink-0" />
                        <span className="truncate">Re-enter Game</span>
                      </>
                    ) : isPlaying ? (
                      <>
                        <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-700 dark:text-purple-300 flex-shrink-0" />
                        <span className="truncate">Watch Live</span>
                      </>
                    ) : (
                      <span className="truncate inline-flex items-center gap-1">
                        <span className="sm:hidden inline-flex items-center gap-1">
                          Join (
                          <CoinIcon className="w-3.5 h-3.5 inline -mt-0.5" />
                          {formatCoins(table.entry_fee)})
                        </span>
                        <span className="hidden sm:inline-flex items-center gap-1">
                          Join Table
                        </span>
                      </span>
                    )}
                  </button>
                  {table.current_players === 0 &&
                    (user?.id === table.created_by ||
                      user?.role === "admin") && (
                      <button
                        onClick={() => handleDeleteTable(table.id, table.name)}
                        className="px-2 sm:px-3 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-xs bg-red-50 hover:bg-red-100 dark:bg-red-600/15 dark:hover:bg-red-600/25 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 transition-colors flex items-center justify-center flex-shrink-0 shadow-sm"
                        title="Delete Empty Table"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                    )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* CREATE TABLE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-casino-card border border-casino-border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">
              Create Lottery Table
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Set your entry coin fee. Table locks when {maxPlayersPerTable}{" "}
              players join.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex flex-col gap-2">
                <span>{error}</span>
                {createActiveTableId && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setError("");
                      setCreateActiveTableId(null);
                      onJoinTable(createActiveTableId);
                    }}
                    className="self-start px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs flex items-center space-x-1 transition-all"
                  >
                    <span>Go to Active Game</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleCreateTable} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Table Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. VIP Phnom Penh Arena"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full bg-casino-dark border border-casino-border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-gray-200 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span>Entry Fee</span>
                  <CoinIcon className="w-3.5 h-3.5 inline -mt-0.5" />
                  <span>:</span>
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {allowedEntryFees.map((fee) => (
                    <button
                      key={fee}
                      type="button"
                      onClick={() => setEntryFee(String(fee))}
                      className={`py-2 rounded-xl text-xs font-black border transition-all ${
                        entryFee === String(fee)
                          ? "bg-amber-500 text-black border-amber-400 shadow-sm"
                          : "bg-casino-dark text-slate-700 dark:text-gray-400 border-casino-border hover:border-gray-400 dark:hover:border-gray-700"
                      }`}
                    >
                      {formatCoins(fee)}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="10"
                  step="10"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  className="w-full bg-casino-dark border border-casino-border rounded-xl px-3.5 py-2 text-sm text-amber-500 dark:text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-200 dark:bg-gray-800 text-slate-700 dark:text-gray-400 hover:text-black dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-black shadow-md disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create & Join"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
