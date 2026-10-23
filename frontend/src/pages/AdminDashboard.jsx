import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Users,
  Sliders,
  DollarSign,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  RefreshCw,
  Save,
  Ban,
  QrCode,
  Coins,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  History,
  Wallet,
  Play,
  Gift,
  Sparkles,
  Layers,
  Clock,
  X,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Headphones,
  MessageSquare,
  Send,
  Check,
  MessageCircle,
  CheckCheck,
  Building2,
  Plus,
  Trash2,
  Edit3,
  Upload,
  Image,
  Camera,
  User,
  Lock,
  KeyRound,
} from "lucide-react";
import { adminAPI, supportAPI } from "../services/api";
import PlayerAvatar from "../components/PlayerAvatar";
import AdminSupportDesk from "../components/AdminSupportDesk";
import BankLogo from "../components/BankLogo";
import CoinIcon from "../components/CoinIcon";
import { formatCoins } from "../utils/formatters";

const SETTING_TYPE_GROUPS = [
  {
    id: "gameplay",
    label: "Gameplay & Tables",
    icon: Play,
    iconColor: "text-cyan-400",
    borderColor: "border-cyan-500/30",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    description:
      "Game countdowns, seat capacity, table matchmaking fees, and platform house cut",
  },
  {
    id: "topup",
    label: "Buy Coins & Deposits",
    icon: QrCode,
    iconColor: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    description: "Buy coins exchange rate and selectable coin package presets",
  },
  {
    id: "withdrawal",
    label: "Sell Coins & Cash-Out",
    icon: ArrowUpRight,
    iconColor: "text-amber-400",
    borderColor: "border-amber-500/30",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    description:
      "Player sell coins exchange rate and minimum sell coins threshold",
  },
  {
    id: "rewards",
    label: "Rewards & Bonuses",
    icon: Gift,
    iconColor: "text-purple-400",
    borderColor: "border-purple-500/30",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    description:
      "New player welcome registration bonus and daily lucky coins rewards",
  },
  {
    id: "referral",
    label: "Referral Program",
    icon: Users,
    iconColor: "text-indigo-400",
    borderColor: "border-indigo-500/30",
    badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    description:
      "Level A (You) gets 5% from direct B and 1% from sub C when they buy coins",
  },
  {
    id: "telegram",
    label: "Telegram Bot & Mini App",
    icon: Send,
    iconColor: "text-sky-400",
    borderColor: "border-sky-500/30",
    badgeColor: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    description:
      "Telegram Bot API token (@BotFather) for Mini App WebApp authentication and bot services",
  },
];

const SETTING_META_MAP = {
  // === TYPE 1: GAMEPLAY & TABLES ===
  game_auto_start_seconds: {
    type: "gameplay",
    typeName: "Gameplay & Tables",
    order: 1,
    title: "⏱️ Game Auto-Start Countdown (Seconds)",
    help: "Duration in seconds before a game automatically starts once at least 2 players have joined the table.",
    badge: "Gameplay",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    isCountdown: true,
  },
  max_players_per_table: {
    type: "gameplay",
    typeName: "Gameplay & Tables",
    order: 2,
    title: "👥 Max Players Per Table",
    help: "Default maximum number of player seats allowed per lottery table before drawing starts automatically.",
    badge: "Table Limits",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    isMaxPlayers: true,
  },
  quick_play_coins: {
    type: "gameplay",
    typeName: "Gameplay & Tables",
    order: 3,
    title: "⚡ Quick Play Coin Fee",
    help: "Entry fee in coins charged when a player uses the one-click Quick Play button.",
    badge: "Matchmaking",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    isQuickPlayFee: true,
  },
  allowed_entry_fees: {
    type: "gameplay",
    typeName: "Gameplay & Tables",
    order: 4,
    title: "🎲 Custom Table Entry Fee Presets",
    help: "Comma-separated coin amounts selectable by players when creating a new custom table.",
    badge: "Table Creation",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    isFeesList: true,
  },
  platform_fee_percent: {
    type: "gameplay",
    typeName: "Gameplay & Tables",
    order: 5,
    title: "🏛️ Platform House Cut (%)",
    help: "Percentage of the total table coin pool retained by the platform on game completion.",
    badge: "Commission",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    isPlatformFee: true,
  },
  crashed_game_timeout_minutes: {
    type: "gameplay",
    typeName: "Gameplay & Tables",
    order: 6,
    title: "🛡️ Crashed Game Recovery Threshold (Minutes)",
    help: "Minutes an uncompleted playing table can run before the schedule identifies it as crashed and automatically resets it to waiting status.",
    badge: "Auto-Recovery",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    isCrashedTimeout: true,
  },
  crashed_game_timeout_hours: {
    type: "gameplay",
    typeName: "Gameplay & Tables",
    order: 6,
    title: "🛡️ Crashed Game Recovery Threshold (Minutes)",
    help: "Minutes an uncompleted playing table can run before the schedule identifies it as crashed and automatically resets it to waiting status.",
    badge: "Auto-Recovery",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    isCrashedTimeout: true,
  },
  chat_messages_per_minute: {
    type: "gameplay",
    typeName: "Gameplay & Tables",
    order: 7,
    title: "💬 Chat Message Rate Limit (per Minute)",
    help: "Maximum number of chat messages and emoji reactions a player can send per minute during games to prevent spam.",
    badge: "Chat Moderation",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    isChatLimit: true,
  },
  auto_rejoin_enabled: {
    type: "gameplay",
    typeName: "Gameplay & Tables",
    order: 8,
    title: "🔄 Auto Re-Join Current Table",
    help: "Enable or disable automatic table re-joining after game ends for players with enough coins.",
    badge: "Auto Re-Join",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    isAutoRejoinToggle: true,
  },
  auto_rejoin_delay_seconds: {
    type: "gameplay",
    typeName: "Gameplay & Tables",
    order: 9,
    title: "⏱️ Auto Re-Join Countdown Timer (Seconds)",
    help: "Duration in seconds after game completion before players with enough coins automatically re-join the current table for the next round.",
    badge: "Auto Re-Join Timer",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    isAutoRejoinTimer: true,
  },
  bot_players_enabled: {
    type: "gameplay",
    typeName: "Gameplay & Tables",
    order: 9.5,
    title: "🤖 Enable Bot Players (Auto-Join When < 2 Real Players)",
    help: "Enable or disable AI bot players automatically joining seats when a table has fewer than 2 real players so the game can start.",
    badge: "Bot Players",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    isBotToggle: true,
  },
  max_bot_players_per_table: {
    type: "gameplay",
    typeName: "Gameplay & Tables",
    order: 9.6,
    title: "🤖 Max Bot Players Join Seat (Random 1 to Max)",
    help: "Maximum number of bot players (default 9). Each game will randomly seat between 1 and this maximum number of bots (e.g., 3 bots, 5 bots, or 9 bots).",
    badge: "Max Bot Seats",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    isMaxBots: true,
  },
  bot_join_delay_seconds: {
    type: "gameplay",
    typeName: "Gameplay & Tables",
    order: 9.7,
    title: "⏱️ Bot Player Join Delay Timer (Seconds)",
    help: "Wait duration in seconds before bot players join a table seat when fewer than 2 real players are seated (default: 30 seconds).",
    badge: "Bot Join Timer",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    isBotTimer: true,
  },

  // === TYPE 2: BUY COINS & DEPOSITS ===
  topup_coins_per_usd: {
    type: "topup",
    typeName: "Buy Coins & Deposits",
    order: 10,
    title: "🪙 Buy Coins Exchange Rate (Coins per $1 USD)",
    help: "Exchange rate used when players deposit to buy coins. Independent from sell coins rate.",
    badge: "Buy Coins Rate",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    isRate: true,
  },
  topup_coin_presets: {
    type: "topup",
    typeName: "Buy Coins & Deposits",
    order: 11,
    title: "💳 Buy Coins Package Presets",
    help: "Comma-separated coin amounts selectable by players when buying coins (e.g. 50000,100000,200000,5000000).",
    badge: "Coin Packages",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    isTopupPresets: true,
  },
  bakong_api_token: {
    type: "topup",
    typeName: "Buy Coins & Deposits",
    order: 12,
    title: "🔑 Bakong Open API Developer Token",
    help: "Bearer token from NBC Bakong Developer Portal (https://api-bakong.nbc.gov.kh/) to automatically verify KHQR transfers by MD5.",
    badge: "Open API Token",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    isBakongToken: true,
  },
  bakong_developer_email: {
    type: "topup",
    typeName: "Buy Coins & Deposits",
    order: 12.5,
    title: "📧 Bakong Registered Developer Email",
    help: "Registered developer email on api-bakong.nbc.gov.kh used by the server to automatically renew your token before expiration.",
    badge: "Auto-Renew Email",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    isEmail: true,
  },

  // === TYPE 3: SELL COINS & CASH-OUT ===
  coins_per_usd: {
    type: "withdrawal",
    typeName: "Sell Coins & Cash-Out",
    order: 12,
    title: "💵 Sell Coins Exchange Rate (Coins per $1 USD)",
    help: "Exchange rate used when players sell coins into USD for bank cash-outs.",
    badge: "Sell Coins Rate",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    isRate: true,
  },
  min_withdrawal_coins: {
    type: "withdrawal",
    typeName: "Sell Coins & Cash-Out",
    order: 13,
    title: "🏦 Minimum Sell Coins Threshold",
    help: "Minimum coins required to submit a bank sell coins request.",
    badge: "Sell Coins Minimum",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    isMinWithdrawal: true,
  },
  supported_bank_names: {
    type: "withdrawal",
    typeName: "Sell Coins & Cash-Out",
    order: 13.5,
    title: "🏦 Supported Bank Names List",
    help: "Active bank names available for players to select when setting up payment methods and requesting bank cash-outs.",
    badge: "Bank Names",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    isBanksList: true,
  },

  // === TYPE 4: REWARDS & BONUSES ===
  welcome_bonus_coins: {
    type: "rewards",
    typeName: "Rewards & Bonuses",
    order: 14,
    title: "🎁 New Player Registration Bonus (Welcome Coins)",
    help: "Initial bonus coins (starting revenue) automatically credited to a new player upon creating an account or logging in via Telegram.",
    badge: "Welcome Bonus",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    isWelcomeBonus: true,
  },
  daily_bonus_coins: {
    type: "rewards",
    typeName: "Rewards & Bonuses",
    order: 15,
    title: "🎁 Daily Free Claim Coins",
    help: "Coins awarded to players once every 24 hours via the Daily Bonus button.",
    badge: "Daily Rewards",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    isDailyBonus: true,
  },

  // === TYPE 5: REFERRAL PROGRAM (2-TIER: A -> B -> C) ===
  referral_program_enabled: {
    type: "referral",
    typeName: "Referral Program",
    order: 16,
    title: "👥 Referral Program Status",
    help: "Enable or disable the 2-tier referral commission program across the platform.",
    badge: "Referral System",
    badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    isReferralToggle: true,
  },
  referral_bonus_level1_percent: {
    type: "referral",
    typeName: "Referral Program",
    order: 17,
    title: "👑 Level 1 Commission (Direct Referral - Level B)",
    help: "Percentage of buy coins deposit awarded to direct inviter (User A gets % when their friend User B buys coins).",
    badge: "Level 1 Bonus (B)",
    badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    isReferralL1: true,
  },
  referral_bonus_level2_percent: {
    type: "referral",
    typeName: "Referral Program",
    order: 18,
    title: "👥 Level 2 Commission (Sub-Referral - Level C)",
    help: "Percentage of buy coins deposit awarded to second-tier inviter (User A gets % when Level C buys coins).",
    badge: "Level 2 Bonus (C)",
    badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    isReferralL2: true,
  },
  referral_bind_bonus_coins: {
    type: "referral",
    typeName: "Referral Program",
    order: 19,
    title: "🎁 Referral Code Input Reward (Coins for Player)",
    help: "Coins instantly awarded to a player when they enter and bind an inviter referral code (on registration or via Referral page).",
    badge: "Referral Input Bonus",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    isReferralBindBonus: true,
  },

  // === TYPE 6: TELEGRAM BOT & MINI APP ===
  telegram_bot_token: {
    type: "telegram",
    typeName: "Telegram Bot & Mini App",
    order: 26,
    title: "🤖 Telegram Bot Token (@BotFather)",
    help: "API token issued by Telegram @BotFather. Used by backend to cryptographically verify Mini App WebApp initData HMAC hashes and authenticate players.",
    badge: "Bot Token",
    badgeColor: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    isTelegramToken: true,
  },
};

/**
 * Reusable Admin Table Pagination Component (20 items per page)
 */
function TablePagination({
  currentPage,
  totalItems,
  itemsPerPage = 20,
  onPageChange,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  if (totalItems <= itemsPerPage && totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(totalItems, currentPage * itemsPerPage);

  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-casino-border bg-slate-50/70 dark:bg-casino-dark/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="text-slate-500 dark:text-gray-400">
        Showing{" "}
        <span className="font-bold text-slate-800 dark:text-white">
          {startItem}
        </span>{" "}
        to{" "}
        <span className="font-bold text-slate-800 dark:text-white">
          {endItem}
        </span>{" "}
        of{" "}
        <span className="font-bold text-slate-800 dark:text-white">
          {totalItems}
        </span>{" "}
        items
      </div>

      <div className="flex items-center space-x-1 self-center sm:self-auto">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-casino-border text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="First Page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-casino-border text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {getPageNumbers().map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition-all ${
              currentPage === page
                ? "bg-amber-500 text-black shadow-sm"
                : "border border-slate-200 dark:border-casino-border text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-casino-border text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Next Page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-casino-border text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Last Page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Helper to compress/resize uploaded image to max 256x256 Base64
 */
function processImageFile(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxDim = 256;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/png", 0.9);
      callback(dataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Interactive Bank Names & Logos Manager Setting Component
 */
function BankManagerControl({
  settingValue,
  onAdd,
  onUpdate,
  onRemove,
  onReset,
  submitting,
}) {
  const [inputName, setInputName] = useState("");
  const [inputLogo, setInputLogo] = useState("");
  const [logoMode, setLogoMode] = useState("upload"); // 'upload' or 'url'
  const [editingBank, setEditingBank] = useState(null); // { originalName, name, logo }
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

  let rawList = [];
  try {
    const parsed =
      typeof settingValue === "string"
        ? JSON.parse(settingValue)
        : settingValue;
    if (Array.isArray(parsed)) rawList = parsed;
  } catch (e) {
    rawList = [];
  }

  // Normalize list to [{ name, logo }]
  const banks = rawList
    .map((item) => {
      if (typeof item === "string") return { name: item, logo: null };
      if (item && typeof item === "object")
        return { name: item.name || "", logo: item.logo || null };
      return null;
    })
    .filter((b) => b && b.name);

  const SUGGESTIONS = [
    "Vattanac Bank",
    "J Trust Royal Bank",
    "Foreign Trade Bank (FTB)",
    "BIDC Bank Cambodia",
    "Cambodian Public Bank (Campu Bank)",
    "Shinhan Bank Cambodia",
    "Phillip Bank Cambodia",
    "KB PRASAC Bank",
    "Hattha Bank Plc",
    "Orient Bank",
  ];

  const availableSuggestions = SUGGESTIONS.filter(
    (sug) =>
      !banks.some(
        (b) =>
          b.name.toLowerCase().includes(sug.toLowerCase()) ||
          sug.toLowerCase().includes(b.name.toLowerCase()),
      ),
  );

  const handleFileUpload = (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file, (dataUrl) => {
      if (isEdit) {
        setEditingBank((prev) => ({ ...prev, logo: dataUrl }));
      } else {
        setInputLogo(dataUrl);
      }
    });
  };

  const handleAddSubmit = (e) => {
    if (e) e.preventDefault();
    if (!inputName.trim()) return;
    onAdd({
      bankName: inputName.trim(),
      bankLogo: inputLogo.trim() || null,
    });
    setInputName("");
    setInputLogo("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEditSave = () => {
    if (!editingBank || !editingBank.name.trim()) return;
    if (onUpdate) {
      onUpdate(
        editingBank.originalName,
        editingBank.name.trim(),
        editingBank.logo || null,
      );
    }
    setEditingBank(null);
  };

  return (
    <div className="pt-3 border-t border-casino-border/50 space-y-4">
      {/* Header bar: Count */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Building2 className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-white">
            Active Banks & Logos ({banks.length})
          </span>
          <span className="text-[10px] text-gray-400">
            Custom Bank Name + Logo uploaded by Admin
          </span>
        </div>
      </div>

      {/* Active Bank Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {banks.map((b) => (
          <div
            key={b.name}
            className="flex items-center justify-between p-2.5 rounded-xl bg-casino-card/90 border border-casino-border/80 hover:border-amber-500/30 transition-all gap-2 shadow-sm"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <BankLogo bankName={b.name} logoUrl={b.logo} size="md" />
              <div className="min-w-0">
                <span
                  className="text-xs font-bold text-white truncate block"
                  title={b.name}
                >
                  {b.name}
                </span>
                <span className="text-[10px] text-gray-400 flex items-center space-x-1">
                  {b.logo ? (
                    <span className="text-emerald-400 font-semibold">
                      Custom Logo
                    </span>
                  ) : (
                    <span className="text-gray-500">Default Logo</span>
                  )}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-1 flex-shrink-0">
              <button
                type="button"
                onClick={() =>
                  setEditingBank({
                    originalName: b.name,
                    name: b.name,
                    logo: b.logo || "",
                  })
                }
                disabled={submitting}
                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                title={`Edit "${b.name}"`}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onRemove(b.name)}
                disabled={submitting || banks.length <= 1}
                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                title={`Remove "${b.name}"`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal / Inline Editor for Existing Bank */}
      {editingBank && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-600 dark:text-amber-300 flex items-center space-x-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Bank: {editingBank.originalName}</span>
            </span>
            <button
              type="button"
              onClick={() => setEditingBank(null)}
              className="text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white text-xs"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-700 dark:text-gray-400 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={editingBank.name}
                onChange={(e) =>
                  setEditingBank({ ...editingBank, name: e.target.value })
                }
                className="w-full bg-white dark:bg-casino-dark border border-slate-300 dark:border-casino-border focus:border-amber-500 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-700 dark:text-gray-400 mb-1">
                Bank Logo (Upload or URL)
              </label>
              <div className="flex items-center space-x-2">
                <BankLogo
                  bankName={editingBank.name}
                  logoUrl={editingBank.logo}
                  size="sm"
                />
                <input
                  type="file"
                  ref={editFileInputRef}
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, true)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-casino-card hover:bg-slate-100 dark:hover:bg-casino-border border border-slate-300 dark:border-casino-border text-xs text-slate-700 dark:text-gray-300 flex items-center space-x-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>Choose Image</span>
                </button>
                {editingBank.logo && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditingBank({ ...editingBank, logo: null })
                    }
                    className="text-[10px] text-rose-500 dark:text-rose-400 hover:underline"
                  >
                    Clear Logo
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setEditingBank(null)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-casino-card border border-slate-300 dark:border-casino-border text-xs text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-casino-border"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEditSave}
              disabled={submitting || !editingBank.name.trim()}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-md"
            >
              Save Bank Changes
            </button>
          </div>
        </div>
      )}

      {/* Add New Bank Name AND Bank Logo Form */}
      <div className="bg-casino-card/40 border border-casino-border/60 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-white flex items-center space-x-1.5">
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Add New Supported Bank & Logo</span>
          </label>
          <div className="flex items-center space-x-1 bg-casino-dark p-0.5 rounded-lg border border-casino-border text-[10px]">
            <button
              type="button"
              onClick={() => setLogoMode("upload")}
              className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                logoMode === "upload"
                  ? "bg-amber-500 text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Upload Image
            </button>
            <button
              type="button"
              onClick={() => setLogoMode("url")}
              className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                logoMode === "url"
                  ? "bg-amber-500 text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Image URL
            </button>
          </div>
        </div>

        <form onSubmit={handleAddSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            {/* Bank Name Input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-gray-400 mb-1">
                Bank Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="e.g. Vattanac Bank, J Trust Royal Bank..."
                className="w-full bg-white dark:bg-casino-dark border border-slate-300 dark:border-casino-border focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none"
                disabled={submitting}
                required
              />
            </div>

            {/* Bank Logo Selector (Upload or URL) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-gray-400 mb-1">
                Bank Logo{" "}
                <span className="text-gray-500 font-normal">
                  (Optional - file or URL)
                </span>
              </label>

              {logoMode === "upload" ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, false)}
                    className="hidden"
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting}
                    className="flex-1 bg-white dark:bg-casino-dark hover:bg-slate-100 dark:hover:bg-casino-border border border-slate-300 dark:border-casino-border rounded-xl px-3.5 py-2 text-xs text-slate-700 dark:text-gray-300 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span>
                      {inputLogo
                        ? "Change Logo File..."
                        : "Upload Logo File (PNG, JPG, WebP)..."}
                    </span>
                  </button>
                  {inputLogo && (
                    <button
                      type="button"
                      onClick={() => {
                        setInputLogo("");
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
                      }}
                      className="px-2 py-2 text-xs text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300"
                      title="Clear Logo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    value={inputLogo}
                    onChange={(e) => setInputLogo(e.target.value)}
                    placeholder="https://... or /banks/logo.png"
                    className="flex-1 bg-white dark:bg-casino-dark border border-slate-300 dark:border-casino-border focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none font-mono"
                    disabled={submitting}
                  />
                  {inputLogo && (
                    <button
                      type="button"
                      onClick={() => setInputLogo("")}
                      className="p-2 text-xs text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Live Preview Row + Submit Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-casino-border/40">
            <div className="flex items-center space-x-2.5">
              <span className="text-[11px] text-gray-400 font-semibold">
                Preview:
              </span>
              <BankLogo
                bankName={inputName || "Preview Bank"}
                logoUrl={inputLogo}
                size="md"
              />
              <div>
                <span className="text-xs font-bold text-white block">
                  {inputName || "Bank Name will appear here"}
                </span>
                <span className="text-[10px] text-gray-400">
                  {inputLogo
                    ? "Custom Logo Loaded"
                    : "Default/initial icon will be used"}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !inputName.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/30 active:scale-95 transition-all disabled:opacity-40"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{submitting ? "Adding Bank..." : "Add Bank & Logo"}</span>
            </button>
          </div>
        </form>

        {/* Quick Add Suggestions */}
        {availableSuggestions.length > 0 && (
          <div className="pt-2 border-t border-casino-border/30 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-gray-500 font-semibold mr-1">
              Quick Add:
            </span>
            {availableSuggestions.slice(0, 6).map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => onAdd({ bankName: sug, bankLogo: null })}
                disabled={submitting}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-casino-dark hover:bg-emerald-500/15 border border-casino-border hover:border-emerald-500/40 text-[10px] font-bold text-gray-300 hover:text-emerald-300 transition-colors disabled:opacity-40"
                title={`Quick add ${sug}`}
              >
                <Plus className="w-2.5 h-2.5 text-emerald-400" />
                <span>{sug}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard({
  user,
  socket,
  initialTab = "stats",
  initialSupportUserId = null,
  onNavigateAdminAccount,
}) {
  const [activeTab, setActiveTab] = useState(initialTab || "stats");
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalSummary, setWithdrawalSummary] = useState(null);
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState("all");
  const [withdrawalSearch, setWithdrawalSearch] = useState("");
  const [auditLogs, setAuditLogs] = useState([]);

  // Top-Up History state
  const [topups, setTopups] = useState([]);
  const [topupSummary, setTopupSummary] = useState(null);
  const [topupFilter, setTopupFilter] = useState("all");
  const [topupSearch, setTopupSearch] = useState("");

  // Player Coin History (Earnings & Reductions) state
  const [walletTxs, setWalletTxs] = useState([]);
  const [walletSummary, setWalletSummary] = useState(null);
  const [walletDirection, setWalletDirection] = useState("all"); // 'all', 'earned', 'reduced'
  const [walletType, setWalletType] = useState("all");
  const [walletSearch, setWalletSearch] = useState("");

  // User Management state
  const [usersSummary, setUsersSummary] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");

  // Edit User Modal state
  const [editUserModal, setEditUserModal] = useState(null);
  const [editUserUsername, setEditUserUsername] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserCoins, setEditUserCoins] = useState("");
  const [editUserRole, setEditUserRole] = useState("player");
  const [editUserPhoto, setEditUserPhoto] = useState("");
  const [editUserSaving, setEditUserSaving] = useState(false);
  const [editUserError, setEditUserError] = useState("");

  // System Settings Filter by Type state
  const [settingTypeFilter, setSettingTypeFilter] = useState("all");
  const [settingSearch, setSettingSearch] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [telegramBotInfo, setTelegramBotInfo] = useState(null);
  const [testingTgBot, setTestingTgBot] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Rejection modal state
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // Support Help Desk state
  const [supportConversations, setSupportConversations] = useState([]);
  const [supportStats, setSupportStats] = useState({
    totalConversations: 0,
    openCount: 0,
    repliedCount: 0,
    resolvedCount: 0,
    unreadMessagesTotal: 0,
  });
  const [selectedSupportUserId, setSelectedSupportUserId] = useState(null);
  const [activeSupportThread, setActiveSupportThread] = useState({
    player: null,
    messages: [],
  });
  const [supportFilter, setSupportFilter] = useState("all"); // 'all', 'open', 'replied', 'resolved'
  const [supportSearch, setSupportSearch] = useState("");
  const [supportReplyText, setSupportReplyText] = useState("");
  const [supportSending, setSupportSending] = useState(false);
  const [supportThreadLoading, setSupportThreadLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Pagination states (20 items per page)
  const [topupPage, setTopupPage] = useState(1);
  const [walletPage, setWalletPage] = useState(1);
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const [logSearch, setLogSearch] = useState("");

  useEffect(() => {
    setTopupPage(1);
  }, [topupFilter, topupSearch]);
  useEffect(() => {
    setWalletPage(1);
  }, [walletDirection, walletType, walletSearch]);
  useEffect(() => {
    setWithdrawalPage(1);
  }, [withdrawalStatusFilter, withdrawalSearch]);
  useEffect(() => {
    setUsersPage(1);
  }, [userRoleFilter, userSearch]);
  useEffect(() => {
    setLogsPage(1);
  }, [logSearch]);

  // Auto-scroll message stream when active thread messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSupportThread.messages]);

  // Initial load of support stats for tab badge counter
  useEffect(() => {
    supportAPI
      .getConversations({ status: "all", limit: 1 })
      .then((res) => {
        if (res.data?.data?.stats) {
          setSupportStats(res.data.data.stats);
        }
      })
      .catch(() => {});
  }, []);

  // Filter or search changes in support desk
  useEffect(() => {
    if (activeTab === "support") {
      loadSupportConversations(supportFilter, supportSearch);
    }
  }, [supportFilter, supportSearch, activeTab]);

  // Real-time socket listener for incoming player support messages
  useEffect(() => {
    if (!socket) return;
    const handleAdminSupportNewMsg = (data) => {
      // Refresh conversation list & stats badge
      loadSupportConversations(supportFilter, supportSearch);
      // If the currently open thread matches this player, append message immediately
      if (
        selectedSupportUserId &&
        String(selectedSupportUserId) === String(data.userId)
      ) {
        setActiveSupportThread((prev) => {
          if (
            !prev ||
            !prev.player ||
            String(prev.player.id) !== String(data.userId)
          )
            return prev;
          if (prev.messages?.some((m) => m.id === data.id)) return prev;
          return {
            ...prev,
            messages: [
              ...(prev.messages || []),
              {
                id: data.id,
                user_id: data.userId,
                sender_role: "player",
                subject: data.subject,
                message: data.message,
                status: "open",
                created_at: data.createdAt,
              },
            ],
          };
        });
      }
    };

    socket.on("admin:support_new_message", handleAdminSupportNewMsg);
    return () => {
      socket.off("admin:support_new_message", handleAdminSupportNewMsg);
    };
  }, [socket, selectedSupportUserId, supportFilter, supportSearch]);

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const loadTabData = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (activeTab === "stats") {
        const res = await adminAPI.getStats();
        setStats(res.data.data);
      } else if (activeTab === "support") {
        await loadSupportConversations();
      } else if (activeTab === "topups") {
        const res = await adminAPI.getTopups();
        setTopups(res.data.data);
        if (res.data.summary) setTopupSummary(res.data.summary);
      } else if (activeTab === "ledger") {
        const res = await adminAPI.getWalletTransactions();
        setWalletTxs(res.data.data);
        if (res.data.summary) setWalletSummary(res.data.summary);
      } else if (activeTab === "settings") {
        const res = await adminAPI.getSettings();
        setSettings(res.data.data);
        const tgSetting = (res.data.data || []).find(
          (st) => st.key === "telegram_bot_token",
        );
        if (tgSetting?.value) {
          adminAPI
            .verifyTelegramBot(tgSetting.value)
            .then((botRes) => {
              if (botRes.data?.success && botRes.data?.bot) {
                setTelegramBotInfo({
                  ok: true,
                  username: botRes.data.bot.username,
                  name: botRes.data.bot.first_name,
                  id: botRes.data.bot.id,
                });
              }
            })
            .catch(() => {});
        }
      } else if (activeTab === "users") {
        const res = await adminAPI.getUsers();
        setUsersList(res.data.data);
        if (res.data.summary) setUsersSummary(res.data.summary);
      } else if (activeTab === "withdrawals") {
        const res = await adminAPI.getWithdrawals();
        setWithdrawals(res.data.data);
        if (res.data.summary) setWithdrawalSummary(res.data.summary);
      } else if (activeTab === "logs") {
        const res = await adminAPI.getAuditLogs();
        setAuditLogs(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const loadSupportConversations = async (
    status = supportFilter,
    search = supportSearch,
  ) => {
    try {
      const res = await supportAPI.getConversations({ status, search });
      if (res.data?.data) {
        setSupportConversations(res.data.data.conversations || []);
        if (res.data.data.stats) {
          setSupportStats(res.data.data.stats);
        }
      }
    } catch (err) {
      console.warn("Failed to load support conversations:", err);
    }
  };

  const loadSupportThread = async (userId) => {
    try {
      setSupportThreadLoading(true);
      setSelectedSupportUserId(userId);
      const res = await supportAPI.getConversationMessages(userId);
      if (res.data?.data) {
        setActiveSupportThread(res.data.data);
        loadSupportConversations();
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to load player message thread",
      );
    } finally {
      setSupportThreadLoading(false);
    }
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialSupportUserId) {
      loadSupportThread(initialSupportUserId);
    }
  }, [initialSupportUserId]);

  const handleSendSupportReply = async (status = "replied") => {
    if (!selectedSupportUserId || !supportReplyText.trim() || supportSending)
      return;
    try {
      setSupportSending(true);
      const res = await supportAPI.reply(selectedSupportUserId, {
        message: supportReplyText.trim(),
        status,
      });
      if (res.data?.data) {
        setActiveSupportThread((prev) => ({
          ...prev,
          messages: [...prev.messages, res.data.data],
        }));
        setSupportReplyText("");
        setMessage("Reply successfully sent to player");
        loadSupportConversations();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send reply");
    } finally {
      setSupportSending(false);
    }
  };

  const handleUpdateSupportStatus = async (status) => {
    if (!selectedSupportUserId) return;
    try {
      await supportAPI.updateStatus(selectedSupportUserId, status);
      setMessage(`Thread status updated to ${status}`);
      loadSupportThread(selectedSupportUserId);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update status");
    }
  };

  // Filtered Top-Ups
  const filteredTopups = useMemo(() => {
    return topups.filter((t) => {
      if (topupFilter !== "all" && t.status !== topupFilter) return false;
      if (topupSearch.trim()) {
        const q = topupSearch.toLowerCase();
        const match =
          (t.username && t.username.toLowerCase().includes(q)) ||
          (t.email && t.email.toLowerCase().includes(q)) ||
          (t.md5_hash && t.md5_hash.toLowerCase().includes(q)) ||
          (t.id && t.id.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [topups, topupFilter, topupSearch]);

  // Filtered Wallet Transactions (Earnings & Reductions)
  const filteredWalletTxs = useMemo(() => {
    return walletTxs.filter((tx) => {
      const isCredit = Number(tx.amount) > 0;
      if (walletDirection === "earned" && !isCredit) return false;
      if (walletDirection === "reduced" && isCredit) return false;
      if (walletType !== "all" && tx.type !== walletType) return false;
      if (walletSearch.trim()) {
        const q = walletSearch.toLowerCase();
        const match =
          (tx.username && tx.username.toLowerCase().includes(q)) ||
          (tx.email && tx.email.toLowerCase().includes(q)) ||
          (tx.description && tx.description.toLowerCase().includes(q)) ||
          (tx.reference_id && tx.reference_id.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [walletTxs, walletDirection, walletType, walletSearch]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      if (userRoleFilter !== "all" && u.role !== userRoleFilter) return false;
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        const match =
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.role && u.role.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [usersList, userRoleFilter, userSearch]);

  // Filtered Withdrawals (Search & Status)
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      if (
        withdrawalStatusFilter !== "all" &&
        w.status !== withdrawalStatusFilter
      )
        return false;
      if (withdrawalSearch.trim()) {
        const q = withdrawalSearch.trim().toLowerCase();
        const match =
          (w.username && w.username.toLowerCase().includes(q)) ||
          (w.email && w.email.toLowerCase().includes(q)) ||
          (w.bank_name && w.bank_name.toLowerCase().includes(q)) ||
          (w.account_number && w.account_number.toLowerCase().includes(q)) ||
          (w.account_name && w.account_name.toLowerCase().includes(q)) ||
          (w.id && w.id.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [withdrawals, withdrawalStatusFilter, withdrawalSearch]);

  // Aggregate Withdrawal Summary Metrics (by status and total USD/coins)
  const effectiveWithdrawalSummary = useMemo(() => {
    if (withdrawalSummary) return withdrawalSummary;
    const s = {
      total_count: withdrawals.length,
      total_usd: withdrawals.reduce(
        (acc, w) => acc + Number(w.amount_usd || 0),
        0,
      ),
      total_coins: withdrawals.reduce(
        (acc, w) => acc + Number(w.coin_amount || 0),
        0,
      ),
      approved_count: 0,
      approved_usd: 0,
      approved_coins: 0,
      pending_count: 0,
      pending_usd: 0,
      pending_coins: 0,
      rejected_count: 0,
      rejected_usd: 0,
      rejected_coins: 0,
      cancelled_count: 0,
      cancelled_usd: 0,
      cancelled_coins: 0,
    };
    withdrawals.forEach((w) => {
      const amt = Number(w.amount_usd || 0);
      const coins = Number(w.coin_amount || 0);
      if (w.status === "approved") {
        s.approved_count += 1;
        s.approved_usd += amt;
        s.approved_coins += coins;
      } else if (w.status === "pending") {
        s.pending_count += 1;
        s.pending_usd += amt;
        s.pending_coins += coins;
      } else if (w.status === "rejected") {
        s.rejected_count += 1;
        s.rejected_usd += amt;
        s.rejected_coins += coins;
      } else if (w.status === "cancelled") {
        s.cancelled_count += 1;
        s.cancelled_usd += amt;
        s.cancelled_coins += coins;
      }
    });
    return s;
  }, [withdrawalSummary, withdrawals]);

  const totalAllUsersCoins = Number(
    usersSummary?.total_all_users_coins ??
      usersList.reduce((acc, u) => acc + parseInt(u.coin_balance || 0, 10), 0),
  );

  const totalPlayerCoins = Number(
    usersSummary?.total_player_coins ??
      usersList
        .filter((u) => u.role === "player")
        .reduce((acc, u) => acc + parseInt(u.coin_balance || 0, 10), 0),
  );

  // Paginated lists (20 items per page)
  const paginatedTopups = useMemo(() => {
    const start = (topupPage - 1) * 20;
    return filteredTopups.slice(start, start + 20);
  }, [filteredTopups, topupPage]);

  const paginatedWalletTxs = useMemo(() => {
    const start = (walletPage - 1) * 20;
    return filteredWalletTxs.slice(start, start + 20);
  }, [filteredWalletTxs, walletPage]);

  const paginatedWithdrawals = useMemo(() => {
    const start = (withdrawalPage - 1) * 20;
    return filteredWithdrawals.slice(start, start + 20);
  }, [filteredWithdrawals, withdrawalPage]);

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * 20;
    return filteredUsers.slice(start, start + 20);
  }, [filteredUsers, usersPage]);

  const filteredAuditLogs = useMemo(() => {
    if (!logSearch.trim()) return auditLogs;
    const q = logSearch.trim().toLowerCase();
    return auditLogs.filter(
      (log) =>
        (log.admin_username && log.admin_username.toLowerCase().includes(q)) ||
        (log.action && log.action.toLowerCase().includes(q)) ||
        (log.target_type && log.target_type.toLowerCase().includes(q)) ||
        (log.target_id && String(log.target_id).toLowerCase().includes(q)) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(q)),
    );
  }, [auditLogs, logSearch]);

  const paginatedAuditLogs = useMemo(() => {
    const start = (logsPage - 1) * 20;
    return filteredAuditLogs.slice(start, start + 20);
  }, [filteredAuditLogs, logsPage]);

  // Ordered & Filtered Settings by Type
  const orderedSettings = useMemo(() => {
    return [...settings].sort((a, b) => {
      const orderA = SETTING_META_MAP[a.key]?.order ?? 99;
      const orderB = SETTING_META_MAP[b.key]?.order ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.key.localeCompare(b.key);
    });
  }, [settings]);

  const filteredSettings = useMemo(() => {
    return orderedSettings.filter((s) => {
      const meta = SETTING_META_MAP[s.key] || {};
      const itemType = s.type || meta.type || "general";
      if (settingTypeFilter !== "all" && itemType !== settingTypeFilter) {
        return false;
      }
      if (settingSearch.trim()) {
        const q = settingSearch.toLowerCase();
        const matchKey = s.key.toLowerCase().includes(q);
        const matchTitle = (meta.title || "").toLowerCase().includes(q);
        const matchHelp = (meta.help || s.description || "")
          .toLowerCase()
          .includes(q);
        const matchVal = String(s.value).toLowerCase().includes(q);
        const matchBadge = (meta.badge || "").toLowerCase().includes(q);
        if (
          !matchKey &&
          !matchTitle &&
          !matchHelp &&
          !matchVal &&
          !matchBadge
        ) {
          return false;
        }
      }
      return true;
    });
  }, [orderedSettings, settingTypeFilter, settingSearch]);

  const handleTestTelegramBot = async (tokenOverride) => {
    try {
      setTestingTgBot(true);
      setError("");
      const tokenInput = document.getElementById("setting-telegram_bot_token");
      const tokenVal =
        tokenOverride !== undefined
          ? tokenOverride
          : (tokenInput ? tokenInput.value : "") ||
            settings.find((st) => st.key === "telegram_bot_token")?.value;
      const res = await adminAPI.verifyTelegramBot(tokenVal);
      if (res.data?.success && res.data?.bot) {
        setTelegramBotInfo({
          ok: true,
          username: res.data.bot.username,
          name: res.data.bot.first_name,
          id: res.data.bot.id,
        });
        setMessage(res.data.message || "Telegram Bot connected successfully!");
      } else {
        setTelegramBotInfo({
          ok: false,
          error: res.data?.error || "Verification failed",
        });
        setError(res.data?.error || "Verification failed");
      }
    } catch (e) {
      setTelegramBotInfo({
        ok: false,
        error: e.response?.data?.error || "Error contacting Telegram API",
      });
      setError(e.response?.data?.error || "Error contacting Telegram API");
    } finally {
      setTestingTgBot(false);
    }
  };

  const handleUpdateSetting = async (key, value) => {
    try {
      setError("");
      await adminAPI.updateSetting(key, value);
      setMessage(`Setting '${key}' updated successfully!`);
      if (key === "telegram_bot_token") {
        handleTestTelegramBot(value);
      }
      loadTabData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update setting");
    }
  };

  const [bankSubmitting, setBankSubmitting] = useState(false);

  const handleAddBank = async (bankData) => {
    const payload =
      typeof bankData === "string" ? { bankName: bankData } : bankData;
    if (!payload?.bankName || !payload.bankName.trim()) return;
    try {
      setBankSubmitting(true);
      setError("");
      const res = await adminAPI.addBank(payload);
      setMessage(
        res.data?.message || `Bank "${payload.bankName}" added successfully`,
      );
      loadTabData();
    } catch (err) {
      setError(
        err.response?.data?.error || `Failed to add bank "${payload.bankName}"`,
      );
    } finally {
      setBankSubmitting(false);
    }
  };

  const handleUpdateBank = async (oldName, newName, newLogo) => {
    try {
      setBankSubmitting(true);
      setError("");
      const res = await adminAPI.updateBank({
        oldName,
        bankName: newName,
        bankLogo: newLogo,
      });
      setMessage(
        res.data?.message ||
          `Bank "${newName || oldName}" updated successfully`,
      );
      loadTabData();
    } catch (err) {
      setError(
        err.response?.data?.error || `Failed to update bank "${oldName}"`,
      );
    } finally {
      setBankSubmitting(false);
    }
  };

  const handleRemoveBank = async (bankName) => {
    if (
      !window.confirm(
        `Are you sure you want to remove "${bankName}" from the supported banks list?`,
      )
    ) {
      return;
    }
    try {
      setBankSubmitting(true);
      setError("");
      const res = await adminAPI.removeBank(bankName);
      setMessage(
        res.data?.message || `Bank "${bankName}" removed successfully`,
      );
      loadTabData();
    } catch (err) {
      setError(
        err.response?.data?.error || `Failed to remove bank "${bankName}"`,
      );
    } finally {
      setBankSubmitting(false);
    }
  };

  const handleResetBanks = async () => {
    if (
      !window.confirm(
        "Reset supported banks to the default Cambodian banks list (ABA, ACLEDA, Wing, Canadia, Sathapana, Prince, Chip Mong)?",
      )
    ) {
      return;
    }
    try {
      setBankSubmitting(true);
      setError("");
      const res = await adminAPI.resetBanks();
      setMessage(res.data?.message || "Supported banks reset to defaults");
      loadTabData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reset banks");
    } finally {
      setBankSubmitting(false);
    }
  };

  const handleRecoverCrashedTables = async () => {
    try {
      setRecovering(true);
      setError("");
      setMessage("");
      const res = await adminAPI.recoverCrashedTables();
      setMessage(res.data.message);
      loadTabData();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Failed to scan and recover crashed tables",
      );
    } finally {
      setRecovering(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      setError("");
      await adminAPI.updateRole(userId, role);
      setMessage("User role updated!");
      loadTabData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update user role");
    }
  };

  const handleToggleBan = async (userId, currentBanned) => {
    try {
      setError("");
      await adminAPI.toggleBan(userId, !currentBanned);
      setMessage(`User account ${!currentBanned ? "banned" : "unbanned"}!`);
      loadTabData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to toggle ban");
    }
  };

  const openEditUserModal = (targetUser) => {
    setEditUserModal(targetUser);
    setEditUserUsername(targetUser.username || "");
    setEditUserEmail(targetUser.email || "");
    setEditUserPassword("");
    setEditUserCoins(
      targetUser.coin_balance !== undefined
        ? String(targetUser.coin_balance)
        : "0",
    );
    setEditUserRole(targetUser.role || "player");
    setEditUserPhoto(targetUser.photo_url || targetUser.photoUrl || "");
    setEditUserError("");
  };

  const handleSaveUserAccount = async (e) => {
    e.preventDefault();
    if (!editUserModal) return;
    try {
      setEditUserSaving(true);
      setEditUserError("");
      const payload = {
        username: editUserUsername.trim(),
        email: editUserEmail.trim().toLowerCase(),
        role: editUserRole,
        coinBalance: Number(editUserCoins) || 0,
        photoUrl: editUserPhoto ? editUserPhoto.trim() : null,
      };
      if (editUserPassword && editUserPassword.trim().length > 0) {
        payload.password = editUserPassword.trim();
      }

      await adminAPI.updateUserAccount(editUserModal.id, payload);
      setMessage(`Account for ${editUserUsername} updated successfully!`);
      setEditUserModal(null);
      loadTabData();
    } catch (err) {
      setEditUserError(
        err.response?.data?.error ||
          err.message ||
          "Failed to update user account",
      );
    } finally {
      setEditUserSaving(false);
    }
  };

  const handleProcessWithdrawal = async (id, action, reason = "") => {
    try {
      setError("");
      await adminAPI.processWithdrawal(id, { action, reason });
      setMessage(
        `Sell coins request ${action === "approve" ? "approved" : "rejected and refunded"}!`,
      );
      setRejectId(null);
      setRejectReason("");
      loadTabData();
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to process sell coins request",
      );
    }
  };

  const [approvingTopupId, setApprovingTopupId] = useState(null);

  const handleApproveTopup = async (id, username, amountUsd, coinAmount) => {
    if (
      !window.confirm(
        `Approve Buy Coins for ${username}?\nCrediting +${formatCoins(coinAmount)} coins ($${Number(amountUsd).toFixed(2)} USD).`,
      )
    ) {
      return;
    }
    try {
      setApprovingTopupId(id);
      setError("");
      await adminAPI.approveTopup(id);
      setMessage(
        `Buy coins deposit for ${username} approved & credited successfully!`,
      );
      loadTabData();
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to approve buy coins deposit",
      );
    } finally {
      setApprovingTopupId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Admin Title & Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-casino-border pb-4">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 dark:text-amber-400" />
              <span>Admin & Operations Console</span>
            </h1>
            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-gray-400">
              <span>
                Authenticated as{" "}
                <strong className="text-amber-600 dark:text-amber-400">
                  {user.username}
                </strong>{" "}
                ({user.role})
              </span>
              {user.role === "admin" && onNavigateAdminAccount && (
                <button
                  onClick={onNavigateAdminAccount}
                  className="inline-flex items-center space-x-1 text-amber-600 dark:text-amber-400 hover:underline font-bold"
                >
                  <User className="w-3 h-3" />
                  <span>Update Account</span>
                </button>
              )}
            </div>
          </div>
          <button
            onClick={loadTabData}
            disabled={loading}
            className="sm:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-casino-border text-slate-700 dark:text-gray-300 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin text-amber-500" : ""}`}
            />
          </button>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Direct Link to Update Admin Account */}
          {user.role === "admin" && onNavigateAdminAccount && (
            <button
              onClick={onNavigateAdminAccount}
              className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all"
              title="Update Admin Account (Username, Email, Password, Profile Image)"
            >
              <User className="w-3.5 h-3.5" />
              <span>Update Admin Account</span>
            </button>
          )}

          {/* Tab switcher */}
          <div className="flex bg-slate-100 dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-xl p-1 space-x-1 overflow-x-auto max-w-full">
            {[
              { id: "stats", label: "Overview", icon: DollarSign },
              { id: "topups", label: "Buy Coins", icon: QrCode },
              { id: "ledger", label: "Coin History", icon: History },
              { id: "withdrawals", label: "Sell Coins", icon: CheckCircle2 },
              { id: "settings", label: "System Settings", icon: Sliders },
              { id: "users", label: "User RBAC", icon: Users },
              {
                id: "support",
                label: "Support Desk",
                icon: Headphones,
                badge:
                  supportStats?.openCount > 0
                    ? supportStats.openCount
                    : supportStats?.unreadMessagesTotal > 0
                      ? supportStats.unreadMessagesTotal
                      : null,
              },
              { id: "logs", label: "Audit Logs", icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap relative ${
                    activeTab === tab.id
                      ? "bg-amber-500 text-black shadow-md"
                      : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge ? (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        activeTab === tab.id
                          ? "bg-black text-amber-400"
                          : "bg-rose-500 text-white animate-pulse"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <button
            onClick={loadTabData}
            disabled={loading}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-casino-border text-xs font-bold text-slate-700 dark:text-gray-300 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-500" : ""}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-700 dark:text-red-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: OVERVIEW METRICS */}
      {activeTab === "stats" && stats && (
        <div className="space-y-4 sm:space-y-6">
          {/* 8 Compact Operational Cards (2-col mobile, 4-col desktop) */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
            {/* 1. Live Tables Playing */}
            <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-sm hover:border-cyan-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate max-w-[65%]">
                    Tables Playing
                  </span>
                  {Number(
                    stats.total_tables_playing ?? stats.active_tables ?? 0,
                  ) > 0 ? (
                    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[9px] sm:text-[10px] font-bold border border-cyan-500/30">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
                      </span>
                      <span>LIVE</span>
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-gray-500 text-[9px] sm:text-[10px] font-medium">
                      Idle
                    </span>
                  )}
                </div>
                <div className="text-base sm:text-2xl md:text-3xl font-black font-mono tracking-tight text-cyan-600 dark:text-cyan-400">
                  {stats.total_tables_playing ?? stats.active_tables ?? 0}
                </div>
              </div>
              <span className="text-[9px] sm:text-[11px] text-slate-400 dark:text-gray-500 block mt-1 truncate">
                Active games running
              </span>
            </div>

            {/* 2. Live Players Playing */}
            <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-sm hover:border-emerald-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate max-w-[65%]">
                    Players Playing
                  </span>
                  {Number(stats.total_players_playing || 0) > 0 ? (
                    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] sm:text-[10px] font-bold border border-emerald-500/30">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      <span>IN GAME</span>
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-gray-500 text-[9px] sm:text-[10px] font-medium">
                      0 Active
                    </span>
                  )}
                </div>
                <div className="text-base sm:text-2xl md:text-3xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                  {stats.total_players_playing || 0}
                </div>
              </div>
              <span className="text-[9px] sm:text-[11px] text-slate-400 dark:text-gray-500 block mt-1 truncate">
                Players in live tables
              </span>
            </div>

            {/* 3. Total Coins Playing */}
            <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-sm hover:border-amber-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate max-w-[65%]">
                    Coins Playing
                  </span>
                  <div className="p-1 sm:p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                    <CoinIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <div className="text-base sm:text-2xl md:text-3xl font-black font-mono tracking-tight text-amber-500 dark:text-amber-400 truncate">
                  {formatCoins(stats.total_coins_playing)}
                </div>
              </div>
              <span className="text-[9px] sm:text-[11px] text-slate-400 dark:text-gray-500 block mt-1 truncate">
                Locked in active tables
              </span>
            </div>

            {/* 4. Total Registered Users */}
            <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-sm hover:border-indigo-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate max-w-[65%]">
                    Registered Users
                  </span>
                  <div className="p-1 sm:p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className="text-base sm:text-2xl md:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white truncate">
                  {stats.total_users || 0}
                </div>
              </div>
              <span className="text-[9px] sm:text-[11px] text-slate-400 dark:text-gray-500 block mt-1 truncate">
                {stats.total_players || 0} active players
              </span>
            </div>

            {/* 5. Pending Cash-Outs */}
            <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-sm hover:border-rose-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate max-w-[65%]">
                    Pending Payouts
                  </span>
                  <div className="p-1 sm:p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className="text-base sm:text-2xl md:text-3xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 truncate">
                  {stats.pending_withdrawals || 0}
                </div>
              </div>
              <span className="text-[9px] sm:text-[11px] text-rose-500 dark:text-rose-300 block mt-1 truncate">
                ${Number(stats.pending_withdrawal_usd || 0).toLocaleString()}{" "}
                USD pending
              </span>
            </div>

            {/* 6. Total Buy Coins Deposits */}
            <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-sm hover:border-emerald-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate max-w-[65%]">
                    Buy Coins
                  </span>
                  <div className="p-1 sm:p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <QrCode className="w-3 h-3 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className="text-base sm:text-2xl md:text-3xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
                  ${Number(stats.total_topup_usd || 0).toFixed(2)}
                </div>
              </div>
              <span className="text-[9px] sm:text-[11px] text-slate-400 dark:text-gray-500 block mt-1 truncate">
                {stats.completed_topups_count || 0} deposits settled
              </span>
            </div>

            {/* 7. Coins Injected via Buy Coins */}
            <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-sm hover:border-purple-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate max-w-[65%]">
                    Coins Injected
                  </span>
                  <div className="p-1 sm:p-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Wallet className="w-3 h-3 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className="text-base sm:text-2xl md:text-3xl font-black font-mono tracking-tight text-purple-600 dark:text-purple-400 truncate">
                  {formatCoins(stats.total_topup_coins)}
                </div>
              </div>
              <span className="text-[9px] sm:text-[11px] text-slate-400 dark:text-gray-500 block mt-1 truncate">
                Purchased via QR code
              </span>
            </div>

            {/* 8. Circulating Player Coin Reserves */}
            <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-sm hover:border-amber-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate max-w-[65%]">
                    Player Reserves
                  </span>
                  <div className="p-1 sm:p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                    <CoinIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <div className="text-base sm:text-2xl md:text-3xl font-black font-mono tracking-tight text-amber-600 dark:text-amber-400 truncate">
                  {formatCoins(stats.total_player_coins)}
                </div>
              </div>
              <span className="text-[9px] sm:text-[11px] text-slate-400 dark:text-gray-500 block mt-1 truncate">
                Coins held in player wallets
              </span>
            </div>
          </div>

          {/* Circulating Reserves & Inflow Highlights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 sm:gap-4">
            {/* Player Coin Reserves */}
            <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm lg:col-span-2 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1 sm:p-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10">
                    <CoinIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-gray-200 block">
                      Player Coin Reserves in Circulation
                    </span>
                    <span className="text-[10px] sm:text-xs text-slate-400 dark:text-gray-400">
                      Total liquid coins held in player accounts
                    </span>
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  Backed by Reserves
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-2 border-t border-slate-100 dark:border-casino-border/60">
                <div className="bg-slate-50 dark:bg-casino-subcard p-2 sm:p-3 rounded-lg sm:rounded-xl border border-slate-100 dark:border-casino-border/40">
                  <span className="text-[10px] sm:text-xs text-slate-500 dark:text-gray-400 block font-medium">
                    Player Wallets Total
                  </span>
                  <span className="text-sm sm:text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                    {formatCoins(stats.total_player_coins)}{" "}
                    <span className="text-[10px] sm:text-xs font-normal">
                      COINS
                    </span>
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-casino-subcard p-2 sm:p-3 rounded-lg sm:rounded-xl border border-slate-100 dark:border-casino-border/40">
                  <span className="text-[10px] sm:text-xs text-slate-500 dark:text-gray-400 block font-medium">
                    All Accounts Combined
                  </span>
                  <span className="text-sm sm:text-xl font-black font-mono text-slate-800 dark:text-slate-200">
                    {formatCoins(stats.total_all_users_coins)}{" "}
                    <span className="text-[10px] sm:text-xs font-normal">
                      COINS
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-gray-200 block mb-0.5">
                  Admin Operations
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 dark:text-gray-400 block">
                  Quick navigation to operational consoles
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5 sm:gap-2 pt-3">
                <button
                  onClick={() => setActiveTab("topups")}
                  className="px-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] sm:text-xs shadow-sm transition-all flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-1.5 text-center"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Buy Coins</span>
                </button>
                <button
                  onClick={() => setActiveTab("withdrawals")}
                  className="px-2 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold text-[10px] sm:text-xs transition-all flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-1.5 text-center"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Payouts</span>
                </button>
                <button
                  onClick={() => setActiveTab("ledger")}
                  className="px-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-casino-dark dark:hover:bg-casino-border border border-slate-200 dark:border-casino-border text-slate-700 dark:text-gray-200 font-bold text-[10px] sm:text-xs transition-all flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-1.5 text-center"
                >
                  <CoinIcon className="w-4 h-4" />
                  <span>Ledger</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DYNAMIC SYSTEM SETTINGS (ORDERED BY TYPE) */}
      {activeTab === "settings" && (
        <div className="bg-casino-card border border-casino-border rounded-2xl p-4 sm:p-6 space-y-5">
          {/* Header & Controls */}
          <div className="border-b border-casino-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <span>System Settings (Ordered by Type)</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Organized by operational type: Gameplay, Buy Coins, Sell Coins,
                and Player Rewards.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={settingSearch}
                  onChange={(e) => setSettingSearch(e.target.value)}
                  placeholder="Search setting key, name..."
                  className="bg-casino-dark border border-casino-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 w-44 sm:w-56"
                />
              </div>

              <button
                onClick={handleRecoverCrashedTables}
                disabled={recovering}
                className="px-3 py-1.5 rounded-xl bg-casino-dark hover:bg-casino-border text-amber-400 hover:text-amber-300 text-xs font-bold flex items-center space-x-1.5 transition-all border border-amber-500/40 shadow-sm active:scale-95 disabled:opacity-50"
                title="Scan and recover games started >= 1h ago that never finished"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {recovering ? "Scanning..." : "Recover Crashed Games"}
                </span>
              </button>

              <button
                onClick={loadTabData}
                className="px-3 py-1.5 rounded-xl bg-casino-dark hover:bg-casino-border text-gray-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-casino-border"
                title="Refresh Settings"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Type Filter Navigation Bar */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-casino-dark border border-casino-border rounded-xl">
            <button
              onClick={() => setSettingTypeFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                settingTypeFilter === "all"
                  ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>All Types ({orderedSettings.length})</span>
            </button>
            {SETTING_TYPE_GROUPS.map((grp) => {
              const IconComp = grp.icon;
              const count = orderedSettings.filter(
                (s) => (s.type || SETTING_META_MAP[s.key]?.type) === grp.id,
              ).length;
              const isActive = settingTypeFilter === grp.id;
              return (
                <button
                  key={grp.id}
                  onClick={() => setSettingTypeFilter(grp.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    isActive
                      ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <IconComp
                    className={`w-3.5 h-3.5 ${isActive ? "text-black" : grp.iconColor}`}
                  />
                  <span>
                    {grp.label} ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Settings List: Grouped by Type when 'all' & no search, or direct filtered list */}
          <div className="space-y-6">
            {settingTypeFilter === "all" && !settingSearch.trim() ? (
              SETTING_TYPE_GROUPS.map((grp) => {
                const grpSettings = orderedSettings.filter(
                  (s) => (s.type || SETTING_META_MAP[s.key]?.type) === grp.id,
                );
                if (grpSettings.length === 0) return null;
                const GroupIcon = grp.icon;

                return (
                  <div key={grp.id} className="space-y-3">
                    {/* Category Type Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-casino-border/60">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`p-1.5 rounded-lg bg-casino-dark border ${grp.borderColor}`}
                        >
                          <GroupIcon className={`w-4 h-4 ${grp.iconColor}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white flex items-center space-x-2">
                            <span>{grp.label}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${grp.badgeColor}`}
                            >
                              {grpSettings.length} Settings
                            </span>
                          </h4>
                          <p className="text-[11px] text-gray-400">
                            {grp.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Settings cards inside this type */}
                    <div className="space-y-3.5">
                      {grpSettings.map((s, idx) => {
                        const meta = SETTING_META_MAP[s.key] || {
                          type: s.type || "general",
                          typeName: s.type_label || "System",
                          order: idx + 1,
                          title: s.key,
                          help:
                            s.description || "System configuration parameter",
                          badge: "System",
                          badgeColor:
                            "bg-amber-500/10 text-amber-400 border-amber-500/30",
                        };

                        return (
                          <div
                            key={s.key}
                            className="bg-casino-dark/80 rounded-2xl p-4 sm:p-5 border border-casino-border hover:border-amber-500/30 transition-all space-y-3 shadow-md"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300">
                                    #{meta.order || idx + 1}
                                  </span>
                                  <span
                                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${meta.badgeColor}`}
                                  >
                                    {meta.badge}
                                  </span>
                                  <span className="text-sm font-black text-white">
                                    {meta.title}
                                  </span>
                                </div>
                                <span className="font-mono text-[11px] text-gray-500 block">
                                  {s.key}
                                </span>
                                <p className="text-xs text-gray-400">
                                  {meta.help}
                                </p>
                              </div>

                              {!meta.isBanksList && (
                                <div className="flex items-center space-x-2 self-end sm:self-auto flex-shrink-0">
                                  <input
                                    type="text"
                                    defaultValue={s.value}
                                    id={`setting-${s.key}`}
                                    className={`bg-casino-card border border-casino-border focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono ${meta.isBakongToken || meta.isTelegramToken ? "w-56 sm:w-80 md:w-96" : meta.isEmail ? "w-56 sm:w-72" : "w-44 sm:w-60"} focus:outline-none transition-colors`}
                                    placeholder={
                                      meta.isTelegramToken
                                        ? "8219102429:AAGni_6EC..."
                                        : meta.isBakongToken
                                          ? "Paste Bearer token here..."
                                          : meta.isEmail
                                            ? "developer@example.com"
                                            : "Value..."
                                    }
                                  />
                                  <button
                                    onClick={() => {
                                      const val = document.getElementById(
                                        `setting-${s.key}`,
                                      ).value;
                                      handleUpdateSetting(s.key, val);
                                    }}
                                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs flex items-center space-x-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
                                  >
                                    <Save className="w-4 h-4" />
                                    <span>Save</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Quick Presets for Custom Fees */}
                            {meta.isFeesList && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Active Presets:
                                </span>
                                {s.value.split(",").map((val) => {
                                  const trimmed = val.trim();
                                  if (!trimmed) return null;
                                  return (
                                    <span
                                      key={trimmed}
                                      className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono font-bold text-[11px]"
                                    >
                                      {trimmed} Coins
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Quick Presets for Countdown */}
                            {meta.isCountdown && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Quick Presets:
                                </span>
                                {["10", "15", "20", "30", "45", "60"].map(
                                  (sec) => (
                                    <button
                                      key={sec}
                                      type="button"
                                      onClick={() => {
                                        const input = document.getElementById(
                                          `setting-${s.key}`,
                                        );
                                        if (input) input.value = sec;
                                        handleUpdateSetting(s.key, sec);
                                      }}
                                      className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                        s.value === sec
                                          ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                          : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                      }`}
                                    >
                                      {sec}s
                                    </button>
                                  ),
                                )}
                              </div>
                            )}

                            {/* Quick Presets for Max Players */}
                            {meta.isMaxPlayers && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Quick Presets:
                                </span>
                                {[
                                  "2",
                                  "3",
                                  "4",
                                  "6",
                                  "8",
                                  "10",
                                  "12",
                                  "16",
                                  "20",
                                ].map((num) => (
                                  <button
                                    key={num}
                                    type="button"
                                    onClick={() => {
                                      const input = document.getElementById(
                                        `setting-${s.key}`,
                                      );
                                      if (input) input.value = num;
                                      handleUpdateSetting(s.key, num);
                                    }}
                                    className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                      s.value === num
                                        ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                        : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                    }`}
                                  >
                                    {num} Players
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Quick Presets for Quick Play Fee */}
                            {meta.isQuickPlayFee && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Quick Fees:
                                </span>
                                {[
                                  "50",
                                  "100",
                                  "250",
                                  "500",
                                  "1000",
                                  "2000",
                                ].map((fee) => (
                                  <button
                                    key={fee}
                                    type="button"
                                    onClick={() => {
                                      const input = document.getElementById(
                                        `setting-${s.key}`,
                                      );
                                      if (input) input.value = fee;
                                      handleUpdateSetting(s.key, fee);
                                    }}
                                    className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                      s.value === fee
                                        ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                        : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                    }`}
                                  >
                                    {fee} Coins
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Quick Presets for Platform Fee Cut */}
                            {meta.isPlatformFee && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Quick Cuts:
                                </span>
                                {["5", "8", "10", "12", "15", "20"].map(
                                  (pct) => (
                                    <button
                                      key={pct}
                                      type="button"
                                      onClick={() => {
                                        const input = document.getElementById(
                                          `setting-${s.key}`,
                                        );
                                        if (input) input.value = pct;
                                        handleUpdateSetting(s.key, pct);
                                      }}
                                      className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                        s.value === pct
                                          ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                          : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                      }`}
                                    >
                                      {pct}%
                                    </button>
                                  ),
                                )}
                              </div>
                            )}

                            {/* Quick Presets for Crashed Game Timeout */}
                            {meta.isCrashedTimeout && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Quick Thresholds:
                                </span>
                                {["5", "10", "15", "30", "60", "120"].map(
                                  (mins) => (
                                    <button
                                      key={mins}
                                      type="button"
                                      onClick={() => {
                                        const input = document.getElementById(
                                          `setting-${s.key}`,
                                        );
                                        if (input) input.value = mins;
                                        handleUpdateSetting(s.key, mins);
                                      }}
                                      className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                        s.value === mins
                                          ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                          : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                      }`}
                                    >
                                      {mins} Mins
                                    </button>
                                  ),
                                )}
                              </div>
                            )}

                            {/* Quick Presets for Chat Rate Limit */}
                            {meta.isChatLimit && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Quick Presets:
                                </span>
                                {["5", "10", "15", "20", "30", "60"].map(
                                  (lim) => (
                                    <button
                                      key={lim}
                                      type="button"
                                      onClick={() => {
                                        const input = document.getElementById(
                                          `setting-${s.key}`,
                                        );
                                        if (input) input.value = lim;
                                        handleUpdateSetting(s.key, lim);
                                      }}
                                      className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                        s.value === lim
                                          ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                          : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                      }`}
                                    >
                                      {lim} msgs/min
                                    </button>
                                  ),
                                )}
                              </div>
                            )}

                            {/* Quick Presets for Auto Re-Join Toggle */}
                            {meta.isAutoRejoinToggle && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  State Presets:
                                </span>
                                {[
                                  {
                                    label: "✅ Enabled (Auto-Seat next round)",
                                    val: "true",
                                  },
                                  {
                                    label: "⛔ Disabled (Manual join only)",
                                    val: "false",
                                  },
                                ].map((opt) => (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => {
                                      const input = document.getElementById(
                                        `setting-${s.key}`,
                                      );
                                      if (input) input.value = opt.val;
                                      handleUpdateSetting(s.key, opt.val);
                                    }}
                                    className={`px-3 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                      String(s.value).toLowerCase() === opt.val
                                        ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                        : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Quick Presets for Auto Re-Join Timer */}
                            {meta.isAutoRejoinTimer && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Countdown Presets:
                                </span>
                                {["3", "5", "7", "10", "15", "20", "30"].map(
                                  (sec) => (
                                    <button
                                      key={sec}
                                      type="button"
                                      onClick={() => {
                                        const input = document.getElementById(
                                          `setting-${s.key}`,
                                        );
                                        if (input) input.value = sec;
                                        handleUpdateSetting(s.key, sec);
                                      }}
                                      className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                        String(s.value) === sec
                                          ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                          : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                      }`}
                                    >
                                      {sec}s
                                    </button>
                                  ),
                                )}
                              </div>
                            )}

                            {/* Quick Presets for Bot Players Toggle */}
                            {meta.isBotToggle && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Bot Status:
                                </span>
                                {[
                                  {
                                    label:
                                      "✅ Enabled (Auto-Join Bots when < 2 Players)",
                                    val: "true",
                                  },
                                  {
                                    label: "⛔ Disabled (Human Players Only)",
                                    val: "false",
                                  },
                                ].map((opt) => (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => {
                                      const input = document.getElementById(
                                        `setting-${s.key}`,
                                      );
                                      if (input) input.value = opt.val;
                                      handleUpdateSetting(s.key, opt.val);
                                    }}
                                    className={`px-3 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                      String(s.value).toLowerCase() === opt.val
                                        ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                        : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Quick Presets for Max Bot Players */}
                            {meta.isMaxBots && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Max Bot Seats:
                                </span>
                                {["1", "2", "3", "4", "5", "7", "9"].map(
                                  (cnt) => (
                                    <button
                                      key={cnt}
                                      type="button"
                                      onClick={() => {
                                        const input = document.getElementById(
                                          `setting-${s.key}`,
                                        );
                                        if (input) input.value = cnt;
                                        handleUpdateSetting(s.key, cnt);
                                      }}
                                      className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                        String(s.value) === cnt
                                          ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                          : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                      }`}
                                    >
                                      {cnt} {cnt === "1" ? "Bot" : "Bots"}
                                    </button>
                                  ),
                                )}
                              </div>
                            )}

                            {/* Quick Presets for Bot Join Delay Timer */}
                            {meta.isBotTimer && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Bot Wait Timer Presets:
                                </span>
                                {["5", "10", "15", "20", "30", "45", "60"].map(
                                  (sec) => (
                                    <button
                                      key={sec}
                                      type="button"
                                      onClick={() => {
                                        const input = document.getElementById(
                                          `setting-${s.key}`,
                                        );
                                        if (input) input.value = sec;
                                        handleUpdateSetting(s.key, sec);
                                      }}
                                      className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                        String(s.value) === sec
                                          ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                          : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                      }`}
                                    >
                                      {sec}s
                                    </button>
                                  ),
                                )}
                              </div>
                            )}

                            {/* Quick Presets for Exchange Rates */}
                            {meta.isRate && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Quick Rates:
                                </span>
                                {[
                                  "3000",
                                  "3500",
                                  "4000",
                                  "4100",
                                  "4200",
                                  "4500",
                                  "5000",
                                  "10000",
                                  "11500",
                                ].map((rate) => (
                                  <button
                                    key={rate}
                                    type="button"
                                    onClick={() => {
                                      const input = document.getElementById(
                                        `setting-${s.key}`,
                                      );
                                      if (input) input.value = rate;
                                      handleUpdateSetting(s.key, rate);
                                    }}
                                    className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                      s.value === rate
                                        ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                        : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                    }`}
                                  >
                                    {rate}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Quick Presets for Top-Up Packages */}
                            {meta.isTopupPresets && (
                              <div className="pt-2 border-t border-casino-border/50 space-y-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                    Active Packages:
                                  </span>
                                  {s.value.split(",").map((val) => {
                                    const trimmed = val.trim();
                                    const num = parseInt(trimmed, 10);
                                    if (isNaN(num)) return null;
                                    return (
                                      <span
                                        key={trimmed}
                                        className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-[11px]"
                                      >
                                        {num.toLocaleString()} Coins
                                      </span>
                                    );
                                  })}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                  <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                    One-Click Presets:
                                  </span>
                                  {[
                                    {
                                      label: "[50k, 100k, 200k, 5M]",
                                      val: "50000,100000,200000,5000000",
                                    },
                                    {
                                      label: "[10k, 50k, 100k, 500k]",
                                      val: "10000,50000,100000,500000",
                                    },
                                    {
                                      label: "[100k, 250k, 500k, 1M]",
                                      val: "100000,250000,500000,1000000",
                                    },
                                  ].map((preset) => (
                                    <button
                                      key={preset.val}
                                      type="button"
                                      onClick={() => {
                                        const input = document.getElementById(
                                          `setting-${s.key}`,
                                        );
                                        if (input) input.value = preset.val;
                                        handleUpdateSetting(s.key, preset.val);
                                      }}
                                      className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold transition-all ${
                                        s.value === preset.val
                                          ? "bg-amber-500 text-black border-amber-400 shadow-sm"
                                          : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                      }`}
                                    >
                                      {preset.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Bakong Token Helper & 1-Click Renew */}
                            {meta.isBakongToken && (
                              <div className="pt-2.5 border-t border-casino-border/50 space-y-2 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {s.tokenDetails?.valid ? (
                                      <>
                                        <span
                                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                            s.tokenDetails.isExpired
                                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                              : s.tokenDetails.daysRemaining <=
                                                  7
                                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                          }`}
                                        >
                                          <span
                                            className={`w-1.5 h-1.5 rounded-full ${s.tokenDetails.isExpired ? "bg-rose-400 animate-pulse" : s.tokenDetails.daysRemaining <= 7 ? "bg-amber-400 animate-ping" : "bg-emerald-400"}`}
                                          />
                                          {s.tokenDetails.isExpired
                                            ? "Token Expired"
                                            : `Expires: ${s.tokenDetails.formattedExpiry} (${s.tokenDetails.daysRemaining} days left)`}
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-medium">
                                          🔄 Auto-Renew: Every 2 Months{" "}
                                          {s.tokenDetails.formattedRenewAt
                                            ? `(Next: ${s.tokenDetails.formattedRenewAt})`
                                            : ""}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-[11px] text-gray-400">
                                        Valid for 90 days. Paste token above or
                                        renew via API:
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <a
                                      href="https://api-bakong.nbc.gov.kh"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1 rounded-lg bg-casino-dark hover:bg-casino-border border border-casino-border text-[11px] text-gray-300 hover:text-white transition-colors"
                                    >
                                      NBC Portal ↗
                                    </a>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const devEmailSetting = settings
                                          .find(
                                            (st) =>
                                              st.key ===
                                              "bakong_developer_email",
                                          )
                                          ?.value?.trim();
                                        const email = window.prompt(
                                          "Enter your registered Bakong developer email:",
                                          devEmailSetting || "",
                                        );
                                        if (!email || !email.trim()) return;
                                        try {
                                          setMessage(
                                            "Requesting token renewal from NBC Bakong...",
                                          );
                                          const res =
                                            await adminAPI.renewBakongToken(
                                              email.trim(),
                                            );
                                          if (res.data?.success) {
                                            setMessage(
                                              res.data.message ||
                                                "Token renewed successfully!",
                                            );
                                            loadTabData();
                                          } else {
                                            setError(
                                              res.data?.error ||
                                                "Renewal failed",
                                            );
                                          }
                                        } catch (e) {
                                          setError(
                                            e.response?.data?.error ||
                                              "Error contacting Bakong API",
                                          );
                                        }
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 transition-colors"
                                    >
                                      Renew Token
                                    </button>
                                  </div>
                                </div>
                                <p className="text-[11px] text-gray-400">
                                  Auto-renews every 2 months (60 days) to keep a
                                  safe 30-day buffer before the 90-day token
                                  expires. The background worker checks every 12
                                  hours and auto-renews with NBC using your
                                  registered developer email below.
                                </p>
                              </div>
                            )}

                            {/* Telegram Bot Token Helper & Test Button */}
                            {meta.isTelegramToken && (
                              <div className="pt-2.5 border-t border-casino-border/50 space-y-2 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {telegramBotInfo?.ok ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        🤖 Bot Connected: @
                                        {telegramBotInfo.username} (
                                        {telegramBotInfo.name} · ID:{" "}
                                        {telegramBotInfo.id})
                                      </span>
                                    ) : telegramBotInfo?.error ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                        ⚠️ Bot Error: {telegramBotInfo.error}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-gray-400">
                                        Verify connectivity with Telegram Bot
                                        API:
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <a
                                      href="https://t.me/BotFather"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1 rounded-lg bg-casino-dark hover:bg-casino-border border border-casino-border text-[11px] text-gray-300 hover:text-white transition-colors"
                                    >
                                      @BotFather ↗
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleTestTelegramBot()}
                                      disabled={testingTgBot}
                                      className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-[11px] font-bold text-sky-300 transition-colors disabled:opacity-50"
                                    >
                                      {testingTgBot
                                        ? "Testing..."
                                        : "Test Bot Token"}
                                    </button>
                                  </div>
                                </div>
                                <p className="text-[11px] text-gray-400">
                                  Telegram Mini App uses this bot token to
                                  cryptographically verify{" "}
                                  <code className="text-sky-300">initData</code>{" "}
                                  HMAC signatures when players open the mini app
                                  or sign in. Obtain or manage tokens from
                                  Telegram's official{" "}
                                  <a
                                    href="https://t.me/BotFather"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sky-400 underline"
                                  >
                                    @BotFather
                                  </a>
                                  .
                                </p>
                              </div>
                            )}

                            {/* Quick Presets for Min Withdrawal */}
                            {meta.isMinWithdrawal && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Quick Thresholds:
                                </span>
                                {[
                                  "10000",
                                  "25000",
                                  "50000",
                                  "100000",
                                  "200000",
                                ].map((threshold) => (
                                  <button
                                    key={threshold}
                                    type="button"
                                    onClick={() => {
                                      const input = document.getElementById(
                                        `setting-${s.key}`,
                                      );
                                      if (input) input.value = threshold;
                                      handleUpdateSetting(s.key, threshold);
                                    }}
                                    className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                      s.value === threshold
                                        ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                        : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                    }`}
                                  >
                                    {parseInt(threshold, 10).toLocaleString()}{" "}
                                    Coins
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Interactive Bank Names Manager */}
                            {meta.isBanksList && (
                              <BankManagerControl
                                settingValue={s.value}
                                onAdd={handleAddBank}
                                onUpdate={handleUpdateBank}
                                onRemove={handleRemoveBank}
                                onReset={handleResetBanks}
                                submitting={bankSubmitting}
                              />
                            )}

                            {/* Quick Presets for New Player Welcome Bonus */}
                            {meta.isWelcomeBonus && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Quick Bonus Rewards:
                                </span>
                                {["0", "25", "50", "100", "200", "500"].map(
                                  (bonus) => (
                                    <button
                                      key={bonus}
                                      type="button"
                                      onClick={() => {
                                        const input = document.getElementById(
                                          `setting-${s.key}`,
                                        );
                                        if (input) input.value = bonus;
                                        handleUpdateSetting(s.key, bonus);
                                      }}
                                      className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                        s.value === bonus
                                          ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                          : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                      }`}
                                    >
                                      +{parseInt(bonus, 10).toLocaleString()}{" "}
                                      Coins
                                    </button>
                                  ),
                                )}
                              </div>
                            )}

                            {/* Quick Presets for Daily Bonus */}
                            {meta.isDailyBonus && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Quick Bonus Rewards:
                                </span>
                                {["10", "50", "100", "500", "1000", "5000"].map(
                                  (bonus) => (
                                    <button
                                      key={bonus}
                                      type="button"
                                      onClick={() => {
                                        const input = document.getElementById(
                                          `setting-${s.key}`,
                                        );
                                        if (input) input.value = bonus;
                                        handleUpdateSetting(s.key, bonus);
                                      }}
                                      className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                        s.value === bonus
                                          ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                          : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                      }`}
                                    >
                                      +{parseInt(bonus, 10).toLocaleString()}{" "}
                                      Coins
                                    </button>
                                  ),
                                )}
                              </div>
                            )}

                            {/* Quick Presets for Referral Program Status Toggle */}
                            {meta.isReferralToggle && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Program Status:
                                </span>
                                {[
                                  {
                                    label: "✅ Active (3-Tier Program Live)",
                                    val: "true",
                                  },
                                  { label: "⛔ Disabled", val: "false" },
                                ].map((opt) => (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => {
                                      const input = document.getElementById(
                                        `setting-${s.key}`,
                                      );
                                      if (input) input.value = opt.val;
                                      handleUpdateSetting(s.key, opt.val);
                                    }}
                                    className={`px-3 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                      String(s.value).toLowerCase() === opt.val
                                        ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                        : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Quick Presets for Level 1 Commission (Direct Referral - Level B) */}
                            {meta.isReferralL1 && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Level 1 Commission Presets:
                                </span>
                                {[
                                  "1",
                                  "2",
                                  "3",
                                  "5",
                                  "7",
                                  "10",
                                  "15",
                                  "20",
                                ].map((pct) => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={() => {
                                      const input = document.getElementById(
                                        `setting-${s.key}`,
                                      );
                                      if (input) input.value = pct;
                                      handleUpdateSetting(s.key, pct);
                                    }}
                                    className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                      String(s.value) === pct
                                        ? "bg-indigo-500 text-white border-indigo-400 shadow-sm shadow-indigo-500/30"
                                        : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                    }`}
                                  >
                                    {pct}% Deposit
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Quick Presets for Level 2 Commission (Sub-Referral - Level C) */}
                            {meta.isReferralL2 && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Level 2 Commission Presets:
                                </span>
                                {["0.5", "1", "1.5", "2", "3", "5"].map(
                                  (pct) => (
                                    <button
                                      key={pct}
                                      type="button"
                                      onClick={() => {
                                        const input = document.getElementById(
                                          `setting-${s.key}`,
                                        );
                                        if (input) input.value = pct;
                                        handleUpdateSetting(s.key, pct);
                                      }}
                                      className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                        String(s.value) === pct
                                          ? "bg-indigo-500 text-white border-indigo-400 shadow-sm shadow-indigo-500/30"
                                          : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                      }`}
                                    >
                                      {pct}% Deposit
                                    </button>
                                  ),
                                )}
                              </div>
                            )}

                            {/* Quick Presets for Referral Code Input Reward */}
                            {meta.isReferralBindBonus && (
                              <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                                  Reward Presets:
                                </span>
                                {[
                                  "0",
                                  "10",
                                  "25",
                                  "50",
                                  "100",
                                  "200",
                                  "500",
                                ].map((bonus) => (
                                  <button
                                    key={bonus}
                                    type="button"
                                    onClick={() => {
                                      const input = document.getElementById(
                                        `setting-${s.key}`,
                                      );
                                      if (input) input.value = bonus;
                                      handleUpdateSetting(s.key, bonus);
                                    }}
                                    className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                      String(s.value) === bonus
                                        ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                        : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                    }`}
                                  >
                                    +{parseInt(bonus, 10).toLocaleString()}{" "}
                                    Coins
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : filteredSettings.length === 0 ? (
              <div className="py-12 text-center text-gray-500 space-y-2">
                <Sliders className="w-8 h-8 text-gray-600 mx-auto" />
                <p className="text-sm">
                  No settings found matching your search or filter.
                </p>
                <button
                  onClick={() => {
                    setSettingTypeFilter("all");
                    setSettingSearch("");
                  }}
                  className="px-3 py-1 rounded-lg bg-casino-dark border border-casino-border text-xs text-amber-400 font-semibold hover:bg-casino-border"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredSettings.map((s, idx) => {
                  const meta = SETTING_META_MAP[s.key] || {
                    type: s.type || "general",
                    typeName: s.type_label || "System",
                    order: idx + 1,
                    title: s.key,
                    help: s.description || "System configuration parameter",
                    badge: "System",
                    badgeColor:
                      "bg-amber-500/10 text-amber-400 border-amber-500/30",
                  };

                  return (
                    <div
                      key={s.key}
                      className="bg-casino-dark/80 rounded-2xl p-4 sm:p-5 border border-casino-border hover:border-amber-500/30 transition-all space-y-3 shadow-md"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300">
                              #{meta.order || idx + 1}
                            </span>
                            <span
                              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${meta.badgeColor}`}
                            >
                              {meta.badge}
                            </span>
                            <span className="text-sm font-black text-white">
                              {meta.title}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-gray-500 block">
                            {s.key}
                          </span>
                          <p className="text-xs text-gray-400">{meta.help}</p>
                        </div>

                        {!meta.isBanksList && (
                          <div className="flex items-center space-x-2 self-end sm:self-auto flex-shrink-0">
                            <input
                              type="text"
                              defaultValue={s.value}
                              id={`setting-${s.key}`}
                              className={`bg-casino-card border border-casino-border focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono ${meta.isBakongToken || meta.isTelegramToken ? "w-56 sm:w-80 md:w-96" : meta.isEmail ? "w-56 sm:w-72" : "w-44 sm:w-60"} focus:outline-none transition-colors`}
                              placeholder={
                                meta.isTelegramToken
                                  ? "8219102429:AAGni_6EC..."
                                  : meta.isBakongToken
                                    ? "Paste Bearer token here..."
                                    : meta.isEmail
                                      ? "developer@example.com"
                                      : "Value..."
                              }
                            />
                            <button
                              onClick={() => {
                                const val = document.getElementById(
                                  `setting-${s.key}`,
                                ).value;
                                handleUpdateSetting(s.key, val);
                              }}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs flex items-center space-x-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
                            >
                              <Save className="w-4 h-4" />
                              <span>Save</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Quick Presets for Custom Fees */}
                      {meta.isFeesList && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Active Presets:
                          </span>
                          {s.value.split(",").map((val) => {
                            const trimmed = val.trim();
                            if (!trimmed) return null;
                            return (
                              <span
                                key={trimmed}
                                className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono font-bold text-[11px]"
                              >
                                {trimmed} Coins
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Quick Presets for Countdown */}
                      {meta.isCountdown && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Quick Presets:
                          </span>
                          {["10", "15", "20", "30", "45", "60"].map((sec) => (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `setting-${s.key}`,
                                );
                                if (input) input.value = sec;
                                handleUpdateSetting(s.key, sec);
                              }}
                              className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                s.value === sec
                                  ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                  : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                              }`}
                            >
                              {sec}s
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick Presets for Max Players */}
                      {meta.isMaxPlayers && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Quick Presets:
                          </span>
                          {[
                            "2",
                            "3",
                            "4",
                            "6",
                            "8",
                            "10",
                            "12",
                            "16",
                            "20",
                          ].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `setting-${s.key}`,
                                );
                                if (input) input.value = num;
                                handleUpdateSetting(s.key, num);
                              }}
                              className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                s.value === num
                                  ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                  : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                              }`}
                            >
                              {num} Players
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick Presets for Quick Play Fee */}
                      {meta.isQuickPlayFee && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Quick Fees:
                          </span>
                          {["50", "100", "250", "500", "1000", "2000"].map(
                            (fee) => (
                              <button
                                key={fee}
                                type="button"
                                onClick={() => {
                                  const input = document.getElementById(
                                    `setting-${s.key}`,
                                  );
                                  if (input) input.value = fee;
                                  handleUpdateSetting(s.key, fee);
                                }}
                                className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                  s.value === fee
                                    ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                    : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                }`}
                              >
                                {fee} Coins
                              </button>
                            ),
                          )}
                        </div>
                      )}

                      {/* Quick Presets for Platform Fee Cut */}
                      {meta.isPlatformFee && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Quick Cuts:
                          </span>
                          {["5", "8", "10", "12", "15", "20"].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `setting-${s.key}`,
                                );
                                if (input) input.value = pct;
                                handleUpdateSetting(s.key, pct);
                              }}
                              className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                s.value === pct
                                  ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                  : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                              }`}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick Presets for Crashed Game Timeout */}
                      {meta.isCrashedTimeout && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Quick Thresholds:
                          </span>
                          {["5", "10", "15", "30", "60", "120"].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `setting-${s.key}`,
                                );
                                if (input) input.value = mins;
                                handleUpdateSetting(s.key, mins);
                              }}
                              className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                s.value === mins
                                  ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                  : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                              }`}
                            >
                              {mins} Mins
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick Presets for Chat Rate Limit */}
                      {meta.isChatLimit && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Quick Presets:
                          </span>
                          {["5", "10", "15", "20", "30", "60"].map((lim) => (
                            <button
                              key={lim}
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `setting-${s.key}`,
                                );
                                if (input) input.value = lim;
                                handleUpdateSetting(s.key, lim);
                              }}
                              className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                s.value === lim
                                  ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                  : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                              }`}
                            >
                              {lim} msgs/min
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick Presets for Exchange Rates */}
                      {meta.isRate && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Quick Rates:
                          </span>
                          {[
                            "3000",
                            "3500",
                            "4000",
                            "4100",
                            "4200",
                            "4500",
                            "5000",
                            "10000",
                            "11500",
                          ].map((rate) => (
                            <button
                              key={rate}
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `setting-${s.key}`,
                                );
                                if (input) input.value = rate;
                                handleUpdateSetting(s.key, rate);
                              }}
                              className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                s.value === rate
                                  ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                  : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                              }`}
                            >
                              {rate}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick Presets for Top-Up Packages */}
                      {meta.isTopupPresets && (
                        <div className="pt-2 border-t border-casino-border/50 space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                              Active Packages:
                            </span>
                            {s.value.split(",").map((val) => {
                              const trimmed = val.trim();
                              const num = parseInt(trimmed, 10);
                              if (isNaN(num)) return null;
                              return (
                                <span
                                  key={trimmed}
                                  className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-[11px]"
                                >
                                  {num.toLocaleString()} Coins
                                </span>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                              One-Click Presets:
                            </span>
                            {[
                              {
                                label: "[50k, 100k, 200k, 5M]",
                                val: "50000,100000,200000,5000000",
                              },
                              {
                                label: "[10k, 50k, 100k, 500k]",
                                val: "10000,50000,100000,500000",
                              },
                              {
                                label: "[100k, 250k, 500k, 1M]",
                                val: "100000,250000,500000,1000000",
                              },
                            ].map((preset) => (
                              <button
                                key={preset.val}
                                type="button"
                                onClick={() => {
                                  const input = document.getElementById(
                                    `setting-${s.key}`,
                                  );
                                  if (input) input.value = preset.val;
                                  handleUpdateSetting(s.key, preset.val);
                                }}
                                className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold transition-all ${
                                  s.value === preset.val
                                    ? "bg-amber-500 text-black border-amber-400 shadow-sm"
                                    : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bakong Token Helper & 1-Click Renew */}
                      {meta.isBakongToken && (
                        <div className="pt-2.5 border-t border-casino-border/50 space-y-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {s.tokenDetails?.valid ? (
                                <>
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                      s.tokenDetails.isExpired
                                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                        : s.tokenDetails.daysRemaining <= 7
                                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${s.tokenDetails.isExpired ? "bg-rose-400 animate-pulse" : s.tokenDetails.daysRemaining <= 7 ? "bg-amber-400 animate-ping" : "bg-emerald-400"}`}
                                    />
                                    {s.tokenDetails.isExpired
                                      ? "Token Expired"
                                      : `Expires: ${s.tokenDetails.formattedExpiry} (${s.tokenDetails.daysRemaining} days left)`}
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-medium">
                                    🔄 Auto-Renew: Every 2 Months{" "}
                                    {s.tokenDetails.formattedRenewAt
                                      ? `(Next: ${s.tokenDetails.formattedRenewAt})`
                                      : ""}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[11px] text-gray-400">
                                  Valid for 90 days. Paste token above or renew
                                  via API:
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <a
                                href="https://api-bakong.nbc.gov.kh"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-casino-dark hover:bg-casino-border border border-casino-border text-[11px] text-gray-300 hover:text-white transition-colors"
                              >
                                NBC Portal ↗
                              </a>
                              <button
                                type="button"
                                onClick={async () => {
                                  const devEmailSetting = settings
                                    .find(
                                      (st) =>
                                        st.key === "bakong_developer_email",
                                    )
                                    ?.value?.trim();
                                  const email = window.prompt(
                                    "Enter your registered Bakong developer email:",
                                    devEmailSetting || "",
                                  );
                                  if (!email || !email.trim()) return;
                                  try {
                                    setMessage(
                                      "Requesting token renewal from NBC Bakong...",
                                    );
                                    const res = await adminAPI.renewBakongToken(
                                      email.trim(),
                                    );
                                    if (res.data?.success) {
                                      setMessage(
                                        res.data.message ||
                                          "Token renewed successfully!",
                                      );
                                      loadTabData();
                                    } else {
                                      setError(
                                        res.data?.error || "Renewal failed",
                                      );
                                    }
                                  } catch (e) {
                                    setError(
                                      e.response?.data?.error ||
                                        "Error contacting Bakong API",
                                    );
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 transition-colors"
                              >
                                Renew Token
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-400">
                            Auto-renews every 2 months (60 days) to keep a safe
                            30-day buffer before the 90-day token expires. The
                            background worker checks every 12 hours and
                            auto-renews with NBC using your registered developer
                            email below.
                          </p>
                        </div>
                      )}

                      {/* Telegram Bot Token Helper & Test Button */}
                      {meta.isTelegramToken && (
                        <div className="pt-2.5 border-t border-casino-border/50 space-y-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {telegramBotInfo?.ok ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  🤖 Bot Connected: @{telegramBotInfo.username}{" "}
                                  ({telegramBotInfo.name} · ID:{" "}
                                  {telegramBotInfo.id})
                                </span>
                              ) : telegramBotInfo?.error ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                  ⚠️ Bot Error: {telegramBotInfo.error}
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-400">
                                  Verify connectivity with Telegram Bot API:
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <a
                                href="https://t.me/BotFather"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-casino-dark hover:bg-casino-border border border-casino-border text-[11px] text-gray-300 hover:text-white transition-colors"
                              >
                                @BotFather ↗
                              </a>
                              <button
                                type="button"
                                onClick={() => handleTestTelegramBot()}
                                disabled={testingTgBot}
                                className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-[11px] font-bold text-sky-300 transition-colors disabled:opacity-50"
                              >
                                {testingTgBot ? "Testing..." : "Test Bot Token"}
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-400">
                            Telegram Mini App uses this bot token to
                            cryptographically verify{" "}
                            <code className="text-sky-300">initData</code> HMAC
                            signatures when players open the mini app or sign
                            in. Obtain or manage tokens from Telegram's official{" "}
                            <a
                              href="https://t.me/BotFather"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-400 underline"
                            >
                              @BotFather
                            </a>
                            .
                          </p>
                        </div>
                      )}

                      {/* Quick Presets for Min Withdrawal */}
                      {meta.isMinWithdrawal && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Quick Thresholds:
                          </span>
                          {["10000", "25000", "50000", "100000", "200000"].map(
                            (threshold) => (
                              <button
                                key={threshold}
                                type="button"
                                onClick={() => {
                                  const input = document.getElementById(
                                    `setting-${s.key}`,
                                  );
                                  if (input) input.value = threshold;
                                  handleUpdateSetting(s.key, threshold);
                                }}
                                className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                  s.value === threshold
                                    ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                    : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                }`}
                              >
                                {parseInt(threshold, 10).toLocaleString()} Coins
                              </button>
                            ),
                          )}
                        </div>
                      )}

                      {/* Interactive Bank Names Manager */}
                      {meta.isBanksList && (
                        <BankManagerControl
                          settingValue={s.value}
                          onAdd={handleAddBank}
                          onUpdate={handleUpdateBank}
                          onRemove={handleRemoveBank}
                          onReset={handleResetBanks}
                          submitting={bankSubmitting}
                        />
                      )}

                      {/* Quick Presets for New Player Welcome Bonus */}
                      {meta.isWelcomeBonus && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Quick Bonus Rewards:
                          </span>
                          {["0", "25", "50", "100", "200", "500"].map(
                            (bonus) => (
                              <button
                                key={bonus}
                                type="button"
                                onClick={() => {
                                  const input = document.getElementById(
                                    `setting-${s.key}`,
                                  );
                                  if (input) input.value = bonus;
                                  handleUpdateSetting(s.key, bonus);
                                }}
                                className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                  s.value === bonus
                                    ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                    : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                }`}
                              >
                                +{parseInt(bonus, 10).toLocaleString()} Coins
                              </button>
                            ),
                          )}
                        </div>
                      )}

                      {/* Quick Presets for Daily Bonus */}
                      {meta.isDailyBonus && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Quick Bonus Rewards:
                          </span>
                          {["10", "50", "100", "500", "1000", "5000"].map(
                            (bonus) => (
                              <button
                                key={bonus}
                                type="button"
                                onClick={() => {
                                  const input = document.getElementById(
                                    `setting-${s.key}`,
                                  );
                                  if (input) input.value = bonus;
                                  handleUpdateSetting(s.key, bonus);
                                }}
                                className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                  s.value === bonus
                                    ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                    : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                }`}
                              >
                                +{parseInt(bonus, 10).toLocaleString()} Coins
                              </button>
                            ),
                          )}
                        </div>
                      )}

                      {/* Quick Presets for Auto Re-Join Enabled Toggle */}
                      {meta.isAutoRejoinToggle && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            State Presets:
                          </span>
                          {[
                            {
                              label: "✅ Enabled (Auto-Seat next round)",
                              val: "true",
                            },
                            {
                              label: "⛔ Disabled (Manual join only)",
                              val: "false",
                            },
                          ].map((opt) => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `setting-${s.key}`,
                                );
                                if (input) input.value = opt.val;
                                handleUpdateSetting(s.key, opt.val);
                              }}
                              className={`px-3 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                String(s.value).toLowerCase() === opt.val
                                  ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                  : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick Presets for Auto Re-Join Timer */}
                      {meta.isAutoRejoinTimer && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Countdown Presets:
                          </span>
                          {["3", "5", "7", "10", "15", "20", "30"].map(
                            (sec) => (
                              <button
                                key={sec}
                                type="button"
                                onClick={() => {
                                  const input = document.getElementById(
                                    `setting-${s.key}`,
                                  );
                                  if (input) input.value = sec;
                                  handleUpdateSetting(s.key, sec);
                                }}
                                className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                  String(s.value) === sec
                                    ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                    : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                }`}
                              >
                                {sec}s
                              </button>
                            ),
                          )}
                        </div>
                      )}

                      {/* Quick Presets for Bot Players Toggle */}
                      {meta.isBotToggle && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Bot Status:
                          </span>
                          {[
                            {
                              label:
                                "✅ Enabled (Auto-Join Bots when < 2 Players)",
                              val: "true",
                            },
                            {
                              label: "⛔ Disabled (Human Players Only)",
                              val: "false",
                            },
                          ].map((opt) => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `setting-${s.key}`,
                                );
                                if (input) input.value = opt.val;
                                handleUpdateSetting(s.key, opt.val);
                              }}
                              className={`px-3 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                String(s.value).toLowerCase() === opt.val
                                  ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                  : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick Presets for Max Bot Players */}
                      {meta.isMaxBots && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Max Bot Seats:
                          </span>
                          {["1", "2", "3", "4", "5", "7", "9"].map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `setting-${s.key}`,
                                );
                                if (input) input.value = cnt;
                                handleUpdateSetting(s.key, cnt);
                              }}
                              className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                String(s.value) === cnt
                                  ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                  : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                              }`}
                            >
                              {cnt} {cnt === "1" ? "Bot" : "Bots"}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick Presets for Bot Join Delay Timer */}
                      {meta.isBotTimer && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Bot Wait Timer Presets:
                          </span>
                          {["5", "10", "15", "20", "30", "45", "60"].map(
                            (sec) => (
                              <button
                                key={sec}
                                type="button"
                                onClick={() => {
                                  const input = document.getElementById(
                                    `setting-${s.key}`,
                                  );
                                  if (input) input.value = sec;
                                  handleUpdateSetting(s.key, sec);
                                }}
                                className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                  String(s.value) === sec
                                    ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                    : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                }`}
                              >
                                {sec}s
                              </button>
                            ),
                          )}
                        </div>
                      )}

                      {/* Quick Presets for Referral Program Status Toggle */}
                      {meta.isReferralToggle && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Program Status:
                          </span>
                          {[
                            {
                              label: "✅ Active (3-Tier Program Live)",
                              val: "true",
                            },
                            { label: "⛔ Disabled", val: "false" },
                          ].map((opt) => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `setting-${s.key}`,
                                );
                                if (input) input.value = opt.val;
                                handleUpdateSetting(s.key, opt.val);
                              }}
                              className={`px-3 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                String(s.value).toLowerCase() === opt.val
                                  ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                  : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick Presets for Level 1 Commission (Direct Referral - Level B) */}
                      {meta.isReferralL1 && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Level 1 Commission Presets:
                          </span>
                          {["1", "2", "3", "5", "7", "10", "15", "20"].map(
                            (pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  const input = document.getElementById(
                                    `setting-${s.key}`,
                                  );
                                  if (input) input.value = pct;
                                  handleUpdateSetting(s.key, pct);
                                }}
                                className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                  String(s.value) === pct
                                    ? "bg-indigo-500 text-white border-indigo-400 shadow-sm shadow-indigo-500/30"
                                    : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                }`}
                              >
                                {pct}% Deposit
                              </button>
                            ),
                          )}
                        </div>
                      )}

                      {/* Quick Presets for Level 2 Commission (Sub-Referral - Level C) */}
                      {meta.isReferralL2 && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Level 2 Commission Presets:
                          </span>
                          {["0.5", "1", "1.5", "2", "3", "5"].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `setting-${s.key}`,
                                );
                                if (input) input.value = pct;
                                handleUpdateSetting(s.key, pct);
                              }}
                              className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                String(s.value) === pct
                                  ? "bg-indigo-500 text-white border-indigo-400 shadow-sm shadow-indigo-500/30"
                                  : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                              }`}
                            >
                              {pct}% Deposit
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Quick Presets for Referral Code Input Reward */}
                      {meta.isReferralBindBonus && (
                        <div className="pt-2 border-t border-casino-border/50 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 mr-1 font-semibold">
                            Reward Presets:
                          </span>
                          {["0", "10", "25", "50", "100", "200", "500"].map(
                            (bonus) => (
                              <button
                                key={bonus}
                                type="button"
                                onClick={() => {
                                  const input = document.getElementById(
                                    `setting-${s.key}`,
                                  );
                                  if (input) input.value = bonus;
                                  handleUpdateSetting(s.key, bonus);
                                }}
                                className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                                  String(s.value) === bonus
                                    ? "bg-amber-500 text-black border-amber-400 shadow-sm shadow-amber-500/30"
                                    : "bg-casino-card hover:bg-casino-border text-gray-300 border-casino-border"
                                }`}
                              >
                                +{parseInt(bonus, 10).toLocaleString()} Coins
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: USER MANAGEMENT & RBAC */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* User Coins & Accounts Metric Dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* 1. Total Coins of Sum All Users */}
            <div className="bg-gradient-to-br from-amber-500/15 via-casino-card to-casino-card border border-amber-500/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 relative overflow-hidden shadow-lg shadow-amber-500/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-xs text-amber-300 font-bold uppercase tracking-wider truncate">
                  Total User Coins (Sum All Users)
                </span>
                <CoinIcon className="w-5 h-5 flex-shrink-0" />
              </div>
              <div className="text-xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight truncate">
                {formatCoins(totalAllUsersCoins)}{" "}
                <span className="text-xs text-gray-400 font-normal">Coins</span>
              </div>
              <span className="text-[10px] sm:text-xs text-emerald-400 font-semibold block mt-1 truncate">
                Total system balance across all accounts
              </span>
            </div>

            {/* 2. Total Player Coins (Non-Staff) */}
            <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-3 sm:p-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-xs text-gray-400 font-semibold truncate">
                  Player Coins (Non-Staff)
                </span>
                <Users className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              </div>
              <div className="text-xl sm:text-3xl font-black text-cyan-300 font-mono tracking-tight truncate">
                {formatCoins(totalPlayerCoins)}{" "}
                <span className="text-xs text-gray-400 font-normal">Coins</span>
              </div>
              <span className="text-[10px] sm:text-xs text-gray-400 block mt-1 truncate">
                Held by{" "}
                {usersSummary?.player_count ??
                  usersList.filter((u) => u.role === "player").length}{" "}
                active players
              </span>
            </div>

            {/* 3. Total Registered Accounts */}
            <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-3 sm:p-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-xs text-gray-400 font-semibold truncate">
                  Total Registered Users
                </span>
                <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              </div>
              <div className="text-xl sm:text-3xl font-black text-white font-mono tracking-tight truncate">
                {usersSummary?.total_users_count || usersList.length}
              </div>
              <span className="text-[10px] sm:text-xs text-gray-400 block mt-1 truncate">
                {usersSummary?.player_count ??
                  usersList.filter((u) => u.role === "player").length}{" "}
                Players • {usersList.filter((u) => u.role !== "player").length}{" "}
                Staff
              </span>
            </div>

            {/* 4. Active vs Suspended */}
            <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-3 sm:p-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-xs text-gray-400 font-semibold truncate">
                  Account Status
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              </div>
              <div className="text-xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight truncate">
                {usersList.filter((u) => !u.is_banned).length}{" "}
                <span className="text-xs text-gray-400 font-normal">
                  Active
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-rose-400 font-semibold block mt-1 truncate">
                {usersSummary?.banned_count ??
                  usersList.filter((u) => u.is_banned).length}{" "}
                Suspended Accounts
              </span>
            </div>
          </div>

          {/* User Accounts Table Card */}
          <div className="bg-casino-card border border-casino-border rounded-2xl overflow-hidden shadow-xl space-y-0">
            {/* Toolbar */}
            <div className="p-3.5 sm:p-4 border-b border-casino-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center space-x-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>User Accounts & Role-Based Access</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-400">
                  Manage player coin balances, permission roles, and account
                  suspensions
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search username, email..."
                    className="bg-casino-dark border border-casino-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 w-40 sm:w-52"
                  />
                </div>

                {/* Role Filter Pills */}
                <div className="flex bg-casino-dark border border-casino-border rounded-xl p-0.5 space-x-0.5">
                  {["all", "player", "admin", "finance", "moderator"].map(
                    (r) => (
                      <button
                        key={r}
                        onClick={() => setUserRoleFilter(r)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all ${
                          userRoleFilter === r
                            ? "bg-amber-500 text-black shadow-sm"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        {r}
                      </button>
                    ),
                  )}
                </div>

                <button
                  onClick={loadTabData}
                  className="p-1.5 rounded-xl bg-casino-dark hover:bg-casino-border border border-casino-border text-gray-300 hover:text-white transition-colors"
                  title="Refresh Users"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-casino-dark/80 text-gray-400 uppercase font-semibold border-b border-casino-border">
                  <tr>
                    <th className="p-3.5">Username</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Coin Balance</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-casino-border text-gray-200">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-500">
                        No user accounts found matching filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u) => (
                      <tr
                        key={u.id}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="p-3.5 font-bold text-white">
                          <span className="block">{u.username}</span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            #{u.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="p-3.5 text-gray-400">{u.email}</td>
                        <td className="p-3.5 font-bold text-amber-400 font-mono text-sm">
                          {formatCoins(u.coin_balance)}{" "}
                          <span className="text-[10px] text-gray-500 font-normal">
                            Coins
                          </span>
                        </td>
                        <td className="p-3.5">
                          <select
                            value={u.role}
                            onChange={(e) =>
                              handleRoleChange(u.id, e.target.value)
                            }
                            className="bg-casino-dark border border-casino-border rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                          >
                            <option value="player">Player</option>
                            <option value="moderator">Moderator</option>
                            <option value="finance">Finance</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              u.is_banned
                                ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                                : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            {u.is_banned ? "Suspended" : "Active"}
                          </span>
                        </td>
                        <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {user.role === "admin" && (
                            <button
                              onClick={() => {
                                if (
                                  u.id === user.id &&
                                  onNavigateAdminAccount
                                ) {
                                  onNavigateAdminAccount();
                                } else {
                                  openEditUserModal(u);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-black transition-colors"
                              title="Edit Account Details"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleBan(u.id, u.is_banned)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                              u.is_banned
                                ? "bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50"
                                : "bg-rose-600/30 text-rose-400 hover:bg-rose-600/50"
                            }`}
                          >
                            {u.is_banned ? "Unban" : "Suspend"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-2 p-3 md:hidden">
              {filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  No user accounts found.
                </div>
              ) : (
                paginatedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="bg-casino-dark/80 border border-casino-border rounded-xl p-2.5 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">
                          {u.username}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {u.email}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          u.is_banned
                            ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {u.is_banned ? "Suspended" : "Active"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-casino-card/60 text-xs">
                      <div>
                        <span className="text-[9px] text-gray-400 block">
                          Coin Balance
                        </span>
                        <span className="font-extrabold text-amber-400 font-mono">
                          {formatCoins(u.coin_balance)} Coins
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-gray-400 block mb-0.5">
                          Role
                        </span>
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(u.id, e.target.value)
                          }
                          className="bg-casino-dark border border-casino-border rounded px-1.5 py-0.5 text-[11px] text-white"
                        >
                          <option value="player">Player</option>
                          <option value="moderator">Moderator</option>
                          <option value="finance">Finance</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-0.5">
                      {user.role === "admin" && (
                        <button
                          onClick={() => {
                            if (u.id === user.id && onNavigateAdminAccount) {
                              onNavigateAdminAccount();
                            } else {
                              openEditUserModal(u);
                            }
                          }}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-black transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleBan(u.id, u.is_banned)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          u.is_banned
                            ? "bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50"
                            : "bg-rose-600/30 text-rose-400 hover:bg-rose-600/50"
                        }`}
                      >
                        {u.is_banned ? "Unban" : "Suspend"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            <TablePagination
              currentPage={usersPage}
              totalItems={filteredUsers.length}
              itemsPerPage={20}
              onPageChange={setUsersPage}
            />
          </div>
        </div>
      )}

      {/* TAB: TOP-UP HISTORY */}
      {activeTab === "topups" && (
        <div className="space-y-4">
          {/* Summary Cards */}
          {topupSummary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-3 sm:p-5">
                <span className="text-[10px] sm:text-xs text-gray-400 font-semibold block mb-0.5 sm:mb-1">
                  Total USD Deposited
                </span>
                <span className="text-base sm:text-2xl font-black text-emerald-400 font-mono">
                  ${Number(topupSummary.total_usd_received || 0).toFixed(2)}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-500 block mt-0.5">
                  Real cash inflow
                </span>
              </div>
              <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-3 sm:p-5">
                <span className="text-[10px] sm:text-xs text-gray-400 font-semibold block mb-0.5 sm:mb-1">
                  Total Coins Credited
                </span>
                <span className="text-base sm:text-2xl font-black text-amber-400 font-mono">
                  {formatCoins(topupSummary.total_coins_credited)}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-500 block mt-0.5">
                  Coins added to wallets
                </span>
              </div>
              <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-3 sm:p-5">
                <span className="text-[10px] sm:text-xs text-gray-400 font-semibold block mb-0.5 sm:mb-1">
                  Completed Buy Coins
                </span>
                <span className="text-base sm:text-2xl font-black text-white font-mono">
                  {topupSummary.completed_count || 0}
                </span>
                <span className="text-[10px] sm:text-xs text-emerald-400 block mt-0.5">
                  Successfully verified
                </span>
              </div>
              <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-3 sm:p-5">
                <span className="text-[10px] sm:text-xs text-gray-400 font-semibold block mb-0.5 sm:mb-1">
                  Pending Invoices
                </span>
                <span className="text-base sm:text-2xl font-black text-amber-300 font-mono">
                  {topupSummary.pending_count || 0}
                </span>
                <span className="text-[10px] sm:text-xs text-amber-400/80 block mt-0.5">
                  Awaiting payment
                </span>
              </div>
            </div>
          )}

          {/* Buy Coins Table Card */}
          <div className="bg-casino-card border border-casino-border rounded-2xl overflow-hidden shadow-xl space-y-0">
            {/* Toolbar */}
            <div className="p-3.5 sm:p-4 border-b border-casino-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center space-x-2">
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  <span>Player Buy Coins Ledger</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-400">
                  Real-time buy coins transaction history and coin crediting
                  logs
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={topupSearch}
                    onChange={(e) => setTopupSearch(e.target.value)}
                    placeholder="Search player, email, hash..."
                    className="bg-casino-dark border border-casino-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 w-44 sm:w-56"
                  />
                </div>

                {/* Status Filter Pills */}
                <div className="flex bg-casino-dark border border-casino-border rounded-xl p-0.5 space-x-0.5">
                  {["all", "completed", "pending", "expired"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setTopupFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all ${
                        topupFilter === st
                          ? "bg-amber-500 text-black shadow-sm"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <button
                  onClick={loadTabData}
                  className="p-1.5 rounded-xl bg-casino-dark hover:bg-casino-border border border-casino-border text-gray-300 hover:text-white transition-colors"
                  title="Refresh Buy Coins"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-casino-dark/80 text-gray-400 uppercase font-semibold border-b border-casino-border">
                  <tr>
                    <th className="p-3.5">Player</th>
                    <th className="p-3.5">Amount USD</th>
                    <th className="p-3.5">Coins Awarded</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Created Date</th>
                    <th className="p-3.5">Paid At</th>
                    <th className="p-3.5">MD5 Hash / Ref</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-casino-border text-gray-200">
                  {filteredTopups.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-gray-500">
                        No buy coins records found matching filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedTopups.map((t) => {
                      const isCompleted = t.status === "completed";
                      const isPending = t.status === "pending";
                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-white/5 transition-colors"
                        >
                          <td className="p-3.5">
                            <span className="font-bold text-white block">
                              {t.username}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {t.email}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-extrabold text-emerald-400 font-mono text-sm block">
                              ${Number(t.amount_usd).toFixed(2)} USD
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-black text-amber-400 font-mono text-sm block">
                              +{formatCoins(t.coin_amount)}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              Coins
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isCompleted
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : isPending
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                                    : "bg-gray-800 text-gray-400 border border-gray-700"
                              }`}
                            >
                              {isCompleted && (
                                <CheckCircle2 className="w-3 h-3 mr-0.5" />
                              )}
                              <span>{t.status}</span>
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-gray-400">
                            {new Date(t.created_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="p-3.5 font-mono text-[11px]">
                            {t.paid_at ? (
                              <span className="text-emerald-400">
                                {new Date(t.paid_at).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-gray-400">
                            <span
                              title={t.md5_hash}
                              className="bg-casino-dark px-2 py-0.5 rounded border border-casino-border"
                            >
                              #
                              {t.md5_hash
                                ? t.md5_hash.slice(0, 10)
                                : t.id.slice(0, 8)}
                              ...
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            {isPending ? (
                              <button
                                onClick={() =>
                                  handleApproveTopup(
                                    t.id,
                                    t.username,
                                    t.amount_usd,
                                    t.coin_amount,
                                  )
                                }
                                disabled={approvingTopupId === t.id}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[10px] shadow-sm transition-all disabled:opacity-50 inline-flex items-center space-x-1"
                                title="Manually confirm payment & credit coins to player wallet"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>
                                  {approvingTopupId === t.id
                                    ? "Approving..."
                                    : "Approve"}
                                </span>
                              </button>
                            ) : isCompleted ? (
                              <span className="text-[10px] text-emerald-400 font-bold">
                                Credited
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-500">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-2 p-3 md:hidden">
              {filteredTopups.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  No buy coins records found.
                </div>
              ) : (
                paginatedTopups.map((t) => {
                  const isCompleted = t.status === "completed";
                  const isPending = t.status === "pending";
                  return (
                    <div
                      key={t.id}
                      className="bg-casino-dark/80 border border-casino-border rounded-xl p-2.5 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {t.username}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {t.email}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            isCompleted
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : isPending
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                                : "bg-gray-800 text-gray-400 border border-gray-700"
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-casino-card/60 text-xs font-mono">
                        <div>
                          <span className="text-[9px] text-gray-400 block font-sans">
                            USD Paid
                          </span>
                          <span className="font-extrabold text-emerald-400">
                            ${Number(t.amount_usd).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-gray-400 block font-sans">
                            Coins Credited
                          </span>
                          <span className="font-extrabold text-amber-400">
                            +{formatCoins(t.coin_amount)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                        <span>
                          {new Date(t.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span>
                          #
                          {t.md5_hash
                            ? t.md5_hash.slice(0, 8)
                            : t.id.slice(0, 6)}
                        </span>
                      </div>
                      {isPending && (
                        <div className="pt-2 border-t border-casino-border/60">
                          <button
                            onClick={() =>
                              handleApproveTopup(
                                t.id,
                                t.username,
                                t.amount_usd,
                                t.coin_amount,
                              )
                            }
                            disabled={approvingTopupId === t.id}
                            className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-sm transition-all disabled:opacity-50 flex items-center justify-center space-x-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {approvingTopupId === t.id
                                ? "Approving..."
                                : "Approve & Credit Coins"}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            <TablePagination
              currentPage={topupPage}
              totalItems={filteredTopups.length}
              itemsPerPage={20}
              onPageChange={setTopupPage}
            />
          </div>
        </div>
      )}

      {/* TAB: COIN LEDGER (EARNINGS & REDUCTIONS) */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          {/* Summary Cards */}
          {walletSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
              <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-3 sm:p-5">
                <span className="text-[10px] sm:text-xs text-gray-400 font-semibold block mb-0.5 sm:mb-1">
                  Total Ledger Transactions
                </span>
                <span className="text-base sm:text-2xl font-black text-white font-mono">
                  {Number(
                    walletSummary.total_transactions || 0,
                  ).toLocaleString()}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-500 block mt-0.5">
                  Recorded wallet movements
                </span>
              </div>
              <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-3 sm:p-5">
                <span className="text-[10px] sm:text-xs text-gray-400 font-semibold block mb-0.5 sm:mb-1">
                  Total Coins Earned (+)
                </span>
                <span className="text-base sm:text-2xl font-black text-emerald-400 font-mono">
                  +{formatCoins(walletSummary.total_coins_earned)}
                </span>
                <span className="text-[10px] sm:text-xs text-emerald-400/80 block mt-0.5">
                  Wins, Deposits & Bonuses
                </span>
              </div>
              <div className="bg-casino-card border border-casino-border rounded-xl sm:rounded-2xl p-3 sm:p-5">
                <span className="text-[10px] sm:text-xs text-gray-400 font-semibold block mb-0.5 sm:mb-1">
                  Total Coins Reduced (-)
                </span>
                <span className="text-base sm:text-2xl font-black text-rose-400 font-mono">
                  -{formatCoins(walletSummary.total_coins_reduced)}
                </span>
                <span className="text-[10px] sm:text-xs text-rose-300/80 block mt-0.5">
                  Table Entries & Cash-Outs
                </span>
              </div>
            </div>
          )}

          {/* Ledger Table Card */}
          <div className="bg-casino-card border border-casino-border rounded-2xl overflow-hidden shadow-xl space-y-0">
            {/* Toolbar */}
            <div className="p-3.5 sm:p-4 border-b border-casino-border flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center space-x-2">
                  <CoinIcon className="w-5 h-5" />
                  <span>Player Coins History: Earnings & Reductions</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-400">
                  Comprehensive audit ledger tracking all player coin increases
                  (wins, buy coins) and decreases (bets, sell coins)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={walletSearch}
                    onChange={(e) => setWalletSearch(e.target.value)}
                    placeholder="Search player, note, ref..."
                    className="bg-casino-dark border border-casino-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 w-44 sm:w-48"
                  />
                </div>

                {/* Direction Filter */}
                <div className="flex bg-casino-dark border border-casino-border rounded-xl p-0.5 space-x-0.5">
                  {[
                    { id: "all", label: "All" },
                    { id: "earned", label: "Earned (+)" },
                    { id: "reduced", label: "Reduced (-)" },
                  ].map((dir) => (
                    <button
                      key={dir.id}
                      onClick={() => setWalletDirection(dir.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        walletDirection === dir.id
                          ? "bg-amber-500 text-black shadow-sm"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {dir.label}
                    </button>
                  ))}
                </div>

                {/* Type Filter Dropdown */}
                <select
                  value={walletType}
                  onChange={(e) => setWalletType(e.target.value)}
                  className="bg-casino-dark border border-casino-border rounded-xl px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Activity Types</option>
                  <option value="table_win">🏆 Table Wins (+)</option>
                  <option value="table_entry">🎲 Table Entries (-)</option>
                  <option value="khqr_deposit">
                    🪙 Buy Coins Deposits (+)
                  </option>
                  <option value="withdrawal_deduct">
                    🏦 Cash-Out Escrow (-)
                  </option>
                  <option value="withdrawal_refund">
                    ↩️ Cash-Out Refund (+)
                  </option>
                  <option value="table_refund">↩️ Seat Exit Refund (+)</option>
                  <option value="daily_bonus">🎁 Daily Bonus (+)</option>
                  <option value="admin_adjustment">⚙️ Admin Adjustment</option>
                </select>

                <button
                  onClick={loadTabData}
                  className="p-1.5 rounded-xl bg-casino-dark hover:bg-casino-border border border-casino-border text-gray-300 hover:text-white transition-colors"
                  title="Refresh Ledger"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-casino-dark/80 text-gray-400 uppercase font-semibold border-b border-casino-border">
                  <tr>
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5">Player</th>
                    <th className="p-3.5">Activity Type</th>
                    <th className="p-3.5">Coin Flow</th>
                    <th className="p-3.5">Balance After</th>
                    <th className="p-3.5">Description & Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-casino-border text-gray-200">
                  {filteredWalletTxs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-500">
                        No coin transactions found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedWalletTxs.map((tx) => {
                      const isCredit = Number(tx.amount) > 0;
                      const typeLabels = {
                        table_win: {
                          label: "🏆 Table Win",
                          color:
                            "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                        },
                        khqr_deposit: {
                          label: "🪙 Buy Coins Deposit",
                          color:
                            "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
                        },
                        daily_bonus: {
                          label: "🎁 Daily Bonus",
                          color:
                            "bg-amber-500/15 text-amber-300 border-amber-500/30",
                        },
                        table_refund: {
                          label: "↩️ Seat Exit Refund",
                          color:
                            "bg-blue-500/15 text-blue-300 border-blue-500/30",
                        },
                        withdrawal_refund: {
                          label: "↩️ Cash-Out Refund",
                          color:
                            "bg-teal-500/15 text-teal-300 border-teal-500/30",
                        },
                        table_entry: {
                          label: "🎲 Table Entry Fee",
                          color:
                            "bg-rose-500/15 text-rose-300 border-rose-500/30",
                        },
                        withdrawal_deduct: {
                          label: "🏦 Cash-Out Escrow",
                          color:
                            "bg-purple-500/15 text-purple-300 border-purple-500/30",
                        },
                        admin_adjustment: {
                          label: "⚙️ Admin Adjustment",
                          color: "bg-gray-800 text-gray-300 border-gray-700",
                        },
                      };
                      const typeMeta = typeLabels[tx.type] || {
                        label: tx.type,
                        color: "bg-gray-800 text-gray-300 border-gray-700",
                      };

                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-white/5 transition-colors"
                        >
                          <td className="p-3.5 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                            {new Date(tx.created_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="p-3.5">
                            <span className="font-bold text-white block">
                              {tx.username}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {tx.email}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${typeMeta.color}`}
                            >
                              {typeMeta.label}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono">
                            <span
                              className={`font-black text-sm block ${isCredit ? "text-emerald-400" : "text-rose-400"}`}
                            >
                              {isCredit
                                ? `+${formatCoins(tx.amount)}`
                                : formatCoins(tx.amount)}{" "}
                              Coins
                            </span>
                            <span className="text-[10px] text-gray-500 uppercase">
                              {isCredit ? "Earned" : "Reduced"}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono">
                            <span className="font-bold text-gray-200 block text-xs">
                              {formatCoins(tx.balance_after)}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              Coins
                            </span>
                          </td>
                          <td className="p-3.5 text-gray-300 max-w-xs">
                            <span
                              className="block truncate text-xs font-medium"
                              title={tx.description}
                            >
                              {tx.description || "—"}
                            </span>
                            {tx.reference_id && (
                              <span
                                className="font-mono text-[10px] text-gray-500 block truncate"
                                title={tx.reference_id}
                              >
                                Ref: #{tx.reference_id}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-2 p-3 md:hidden">
              {filteredWalletTxs.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  No coin transactions found.
                </div>
              ) : (
                paginatedWalletTxs.map((tx) => {
                  const isCredit = Number(tx.amount) > 0;
                  return (
                    <div
                      key={tx.id}
                      className="bg-casino-dark/80 border border-casino-border rounded-xl p-2.5 space-y-1.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {tx.username}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {new Date(tx.created_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <span
                          className={`font-mono font-black text-xs ${isCredit ? "text-emerald-400" : "text-rose-400"}`}
                        >
                          {isCredit
                            ? `+${formatCoins(tx.amount)}`
                            : formatCoins(tx.amount)}{" "}
                          Coins
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-casino-card/60">
                        <span className="text-gray-300 font-semibold">
                          {tx.type}
                        </span>
                        <span className="text-gray-400 font-mono text-[10px]">
                          Bal: {formatCoins(tx.balance_after)}
                        </span>
                      </div>
                      {tx.description && (
                        <p
                          className="text-[10px] text-gray-400 truncate"
                          title={tx.description}
                        >
                          {tx.description}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            <TablePagination
              currentPage={walletPage}
              totalItems={filteredWalletTxs.length}
              itemsPerPage={20}
              onPageChange={setWalletPage}
            />
          </div>
        </div>
      )}

      {/* TAB 4: WITHDRAWALS & FINANCE APPROVALS */}
      {activeTab === "withdrawals" && (
        <div className="space-y-4 sm:space-y-5">
          {/* Dashboard Summary Cards by Status */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3.5">
            {/* 1. Pending Approvals */}
            <div
              onClick={() =>
                setWithdrawalStatusFilter(
                  withdrawalStatusFilter === "pending" ? "all" : "pending",
                )
              }
              className={`bg-white dark:bg-casino-card border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-sm cursor-pointer transition-all flex flex-col justify-between hover:scale-[1.01] ${
                withdrawalStatusFilter === "pending"
                  ? "border-amber-500 ring-2 ring-amber-500/30"
                  : "border-slate-200 dark:border-casino-border hover:border-amber-500/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate max-w-[65%]">
                    Pending Payouts
                  </span>
                  {Number(effectiveWithdrawalSummary.pending_count || 0) > 0 ? (
                    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] sm:text-[10px] font-bold border border-amber-500/30">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                      </span>
                      <span>ACTION</span>
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-gray-500 text-[9px] sm:text-[10px] font-medium">
                      Idle
                    </span>
                  )}
                </div>
                <div className="text-base sm:text-xl lg:text-2xl font-black font-mono tracking-tight text-amber-500 dark:text-amber-400 truncate">
                  $
                  {Number(effectiveWithdrawalSummary.pending_usd || 0).toFixed(
                    2,
                  )}
                </div>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[9px] sm:text-[11px]">
                <span className="font-bold text-slate-800 dark:text-gray-200">
                  {effectiveWithdrawalSummary.pending_count || 0} Requests
                </span>
                <span className="text-slate-400 dark:text-gray-500 truncate">
                  {formatCoins(effectiveWithdrawalSummary.pending_coins)} Coins
                </span>
              </div>
            </div>

            {/* 2. Approved (Settled) */}
            <div
              onClick={() =>
                setWithdrawalStatusFilter(
                  withdrawalStatusFilter === "approved" ? "all" : "approved",
                )
              }
              className={`bg-white dark:bg-casino-card border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-sm cursor-pointer transition-all flex flex-col justify-between hover:scale-[1.01] ${
                withdrawalStatusFilter === "approved"
                  ? "border-emerald-500 ring-2 ring-emerald-500/30"
                  : "border-slate-200 dark:border-casino-border hover:border-emerald-500/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate max-w-[65%]">
                    Approved (Settled)
                  </span>
                  <div className="p-1 sm:p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </div>
                </div>
                <div className="text-base sm:text-xl lg:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
                  $
                  {Number(effectiveWithdrawalSummary.approved_usd || 0).toFixed(
                    2,
                  )}
                </div>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[9px] sm:text-[11px]">
                <span className="font-bold text-slate-800 dark:text-gray-200">
                  {effectiveWithdrawalSummary.approved_count || 0} Settled
                </span>
                <span className="text-slate-400 dark:text-gray-500 truncate">
                  {formatCoins(effectiveWithdrawalSummary.approved_coins)} Coins
                </span>
              </div>
            </div>

            {/* 3. Rejected by Admin */}
            <div
              onClick={() =>
                setWithdrawalStatusFilter(
                  withdrawalStatusFilter === "rejected" ? "all" : "rejected",
                )
              }
              className={`bg-white dark:bg-casino-card border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-sm cursor-pointer transition-all flex flex-col justify-between hover:scale-[1.01] ${
                withdrawalStatusFilter === "rejected"
                  ? "border-rose-500 ring-2 ring-rose-500/30"
                  : "border-slate-200 dark:border-casino-border hover:border-rose-500/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate max-w-[65%]">
                    Rejected & Refunded
                  </span>
                  <div className="p-1 sm:p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </div>
                </div>
                <div className="text-base sm:text-xl lg:text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 truncate">
                  $
                  {Number(effectiveWithdrawalSummary.rejected_usd || 0).toFixed(
                    2,
                  )}
                </div>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[9px] sm:text-[11px]">
                <span className="font-bold text-slate-800 dark:text-gray-200">
                  {effectiveWithdrawalSummary.rejected_count || 0} Denied
                </span>
                <span className="text-slate-400 dark:text-gray-500 truncate">
                  {formatCoins(effectiveWithdrawalSummary.rejected_coins)} Coins
                </span>
              </div>
            </div>

            {/* 4. Cancelled by Player */}
            <div
              onClick={() =>
                setWithdrawalStatusFilter(
                  withdrawalStatusFilter === "cancelled" ? "all" : "cancelled",
                )
              }
              className={`bg-white dark:bg-casino-card border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-sm cursor-pointer transition-all flex flex-col justify-between hover:scale-[1.01] ${
                withdrawalStatusFilter === "cancelled"
                  ? "border-purple-500 ring-2 ring-purple-500/30"
                  : "border-slate-200 dark:border-casino-border hover:border-purple-500/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate max-w-[65%]">
                    Cancelled by Player
                  </span>
                  <div className="p-1 sm:p-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Ban className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </div>
                </div>
                <div className="text-base sm:text-xl lg:text-2xl font-black font-mono tracking-tight text-purple-600 dark:text-purple-400 truncate">
                  $
                  {Number(
                    effectiveWithdrawalSummary.cancelled_usd || 0,
                  ).toFixed(2)}
                </div>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[9px] sm:text-[11px]">
                <span className="font-bold text-slate-800 dark:text-gray-200">
                  {effectiveWithdrawalSummary.cancelled_count || 0} Recalled
                </span>
                <span className="text-slate-400 dark:text-gray-500 truncate">
                  {formatCoins(effectiveWithdrawalSummary.cancelled_coins)}{" "}
                  Coins
                </span>
              </div>
            </div>

            {/* 5. Total Volume (spans 2 columns on mobile) */}
            <div
              onClick={() => setWithdrawalStatusFilter("all")}
              className={`col-span-2 lg:col-span-1 bg-white dark:bg-casino-card border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-sm cursor-pointer transition-all flex flex-col justify-between hover:scale-[1.01] ${
                withdrawalStatusFilter === "all"
                  ? "border-cyan-500 ring-2 ring-cyan-500/30"
                  : "border-slate-200 dark:border-casino-border hover:border-cyan-500/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate max-w-[65%]">
                    Total Volume
                  </span>
                  <div className="p-1 sm:p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </div>
                </div>
                <div className="text-base sm:text-xl lg:text-2xl font-black font-mono tracking-tight text-cyan-600 dark:text-cyan-400 truncate">
                  $
                  {Number(effectiveWithdrawalSummary.total_usd || 0).toFixed(2)}
                </div>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[9px] sm:text-[11px]">
                <span className="font-bold text-slate-800 dark:text-gray-200">
                  {effectiveWithdrawalSummary.total_count || 0} Total Requests
                </span>
                <span className="text-slate-400 dark:text-gray-500 truncate">
                  {formatCoins(effectiveWithdrawalSummary.total_coins)} Coins
                </span>
              </div>
            </div>
          </div>

          {/* Withdrawals Table Card */}
          <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-2xl overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-casino-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 dark:text-amber-400" />
                  <span>Cash-Out Requests & Settlement Queue</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-gray-400">
                  Manage player cash-out bank transfers, review pending payouts,
                  and track disbursements
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search input */}
                <div className="relative flex-1 sm:flex-none">
                  <Search className="w-3.5 h-3.5 text-slate-400 dark:text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={withdrawalSearch}
                    onChange={(e) => setWithdrawalSearch(e.target.value)}
                    placeholder="Search player, bank, account..."
                    className="w-full sm:w-56 bg-slate-50 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-500 shadow-sm"
                  />
                  {withdrawalSearch && (
                    <button
                      onClick={() => setWithdrawalSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Status Filter Tabs */}
                <div className="flex bg-slate-100 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl p-0.5 space-x-0.5 overflow-x-auto max-w-full">
                  {[
                    {
                      id: "all",
                      label: "All",
                      count: effectiveWithdrawalSummary.total_count,
                    },
                    {
                      id: "pending",
                      label: "Pending",
                      count: effectiveWithdrawalSummary.pending_count,
                    },
                    {
                      id: "approved",
                      label: "Approved",
                      count: effectiveWithdrawalSummary.approved_count,
                    },
                    {
                      id: "rejected",
                      label: "Rejected",
                      count: effectiveWithdrawalSummary.rejected_count,
                    },
                    {
                      id: "cancelled",
                      label: "Cancelled",
                      count: effectiveWithdrawalSummary.cancelled_count,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setWithdrawalStatusFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all whitespace-nowrap flex items-center space-x-1 ${
                        withdrawalStatusFilter === tab.id
                          ? "bg-amber-500 text-black shadow-sm"
                          : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`text-[10px] px-1 rounded-full ${
                          withdrawalStatusFilter === tab.id
                            ? "bg-black/20 text-black"
                            : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-gray-400"
                        }`}
                      >
                        {tab.count || 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-casino-dark/80 text-slate-500 dark:text-gray-400 uppercase font-semibold border-b border-slate-200 dark:border-casino-border">
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Bank Details</th>
                    <th className="p-3.5">Amount (USD & Coins)</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Processed By / Date</th>
                    <th className="p-3.5 text-right">Approve / Reject</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-casino-border text-slate-700 dark:text-gray-200">
                  {filteredWithdrawals.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="p-8 text-center text-slate-400 dark:text-gray-500"
                      >
                        {withdrawalSearch || withdrawalStatusFilter !== "all"
                          ? "No sell coins requests match your search and filter criteria."
                          : "No sell coins requests at this time."}
                      </td>
                    </tr>
                  ) : (
                    paginatedWithdrawals.map((w) => (
                      <tr
                        key={w.id}
                        className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="p-3.5">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {w.username}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-gray-400">
                            {w.email}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-semibold text-slate-800 dark:text-gray-200 block">
                            {w.bank_name}
                          </span>
                          <span className="font-mono text-slate-500 dark:text-gray-400 text-[11px]">
                            {w.account_number} ({w.account_name})
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm block font-mono">
                            ${Number(w.amount_usd || 0).toFixed(2)} USD
                          </span>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                            {formatCoins(w.coin_amount)} Coins
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 ${
                              w.status === "approved"
                                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30"
                                : w.status === "rejected"
                                  ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30"
                                  : w.status === "cancelled"
                                    ? "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-400 border border-slate-300 dark:border-white/10"
                                    : "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 animate-pulse"
                            }`}
                          >
                            <span className="capitalize">{w.status}</span>
                          </span>
                          {w.rejection_reason && (
                            <span
                              className="text-[9px] text-rose-500 dark:text-rose-400 block mt-0.5 truncate max-w-[140px]"
                              title={w.rejection_reason}
                            >
                              Reason: {w.rejection_reason}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-500 dark:text-gray-400 text-[11px]">
                          {w.processed_at ? (
                            <div>
                              <span className="block font-medium text-slate-700 dark:text-gray-300">
                                {w.processed_by_name || "Admin"}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-gray-500">
                                {new Date(w.processed_at).toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-[10px] text-slate-400 dark:text-gray-500">
                                Requested{" "}
                                {new Date(w.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          {w.status === "pending" ? (
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() =>
                                  handleProcessWithdrawal(w.id, "approve")
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1 shadow-sm transition-all"
                                title="Approve Bank Transfer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">
                                  Approve
                                </span>
                              </button>
                              <button
                                onClick={() => setRejectId(w.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1 shadow-sm transition-all"
                                title="Reject and Refund Coins"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Reject</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 dark:text-gray-500 font-medium capitalize">
                              {w.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <TablePagination
              currentPage={withdrawalPage}
              totalItems={filteredWithdrawals.length}
              itemsPerPage={20}
              onPageChange={setWithdrawalPage}
            />
          </div>
        </div>
      )}

      {/* TAB: SUPPORT DESK */}
      {activeTab === "support" && (
        <AdminSupportDesk
          user={user}
          socket={socket}
          initialSelectedUserId={initialSupportUserId}
        />
      )}

      {/* TAB 5: AUDIT TRAIL LOGS */}
      {activeTab === "logs" && (
        <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-2xl overflow-hidden shadow-sm space-y-0">
          {/* Toolbar */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-casino-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <FileText className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Security & Action Audit Trail</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-gray-400">
                Immutable record of administrative actions, user role
                modifications, and operations
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Search admin, action, target..."
                  className="w-full sm:w-56 bg-slate-50 dark:bg-casino-dark border border-slate-200 dark:border-casino-border rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-500 shadow-sm"
                />
                {logSearch && (
                  <button
                    onClick={() => setLogSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                onClick={loadTabData}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-casino-dark dark:hover:bg-casino-border border border-slate-200 dark:border-casino-border text-slate-700 dark:text-gray-300 transition-colors"
                title="Refresh Audit Logs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-casino-dark/80 text-slate-500 dark:text-gray-400 uppercase font-semibold border-b border-slate-200 dark:border-casino-border">
                <tr>
                  <th className="p-3.5">Time</th>
                  <th className="p-3.5">Admin</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Target</th>
                  <th className="p-3.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-casino-border text-slate-700 dark:text-gray-300 font-mono text-[11px]">
                {paginatedAuditLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="p-8 text-center text-slate-400 dark:text-gray-500 font-sans"
                    >
                      {logSearch
                        ? "No audit records match your search query."
                        : "No audit trail logs recorded yet."}
                    </td>
                  </tr>
                ) : (
                  paginatedAuditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="p-3.5 text-slate-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="p-3.5 text-slate-900 dark:text-white font-bold">
                        {log.admin_username || "System"}
                      </td>
                      <td className="p-3.5 text-amber-600 dark:text-amber-400 font-semibold">
                        {log.action}
                      </td>
                      <td className="p-3.5">
                        {log.target_type} ({log.target_id || "-"})
                      </td>
                      <td className="p-3.5 text-slate-500 dark:text-gray-400 truncate max-w-xs">
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <TablePagination
            currentPage={logsPage}
            totalItems={filteredAuditLogs.length}
            itemsPerPage={20}
            onPageChange={setLogsPage}
          />
        </div>
      )}

      {/* REJECT WITHDRAWAL REASON MODAL */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-casino-card border border-casino-border rounded-2xl p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-white">
              Reject & Refund Cash-Out
            </h4>
            <p className="text-xs text-gray-400">
              Coins will be automatically credited back to the user's wallet.
            </p>
            <textarea
              rows="3"
              placeholder="Reason for rejection (e.g. Invalid bank account name)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-casino-dark border border-casino-border rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500"
            />
            <div className="flex space-x-3">
              <button
                onClick={() => setRejectId(null)}
                className="flex-1 py-2 rounded-xl text-xs bg-gray-800 text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleProcessWithdrawal(rejectId, "reject", rejectReason)
                }
                className="flex-1 py-2 rounded-xl text-xs bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                Confirm Rejection & Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN EDIT ANY USER ACCOUNT MODAL */}
      {editUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-casino-card border border-casino-border rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-casino-border">
              <div className="flex items-center space-x-3">
                <PlayerAvatar
                  photoUrl={editUserPhoto || editUserModal.photo_url}
                  username={editUserUsername || editUserModal.username}
                  userId={editUserModal.id}
                  size="md"
                />
                <div>
                  <h4 className="text-base font-bold text-white flex items-center space-x-1.5">
                    <span>Edit Account: {editUserModal.username}</span>
                  </h4>
                  <span className="text-[10px] text-gray-400 font-mono">
                    ID: {editUserModal.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditUserModal(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editUserError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{editUserError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUserAccount} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Username */}
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={editUserUsername}
                    onChange={(e) => setEditUserUsername(e.target.value)}
                    className="w-full bg-casino-dark border border-casino-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    className="w-full bg-casino-dark border border-casino-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Account Role
                  </label>
                  <select
                    value={editUserRole}
                    onChange={(e) => setEditUserRole(e.target.value)}
                    className="w-full bg-casino-dark border border-casino-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="player">Player</option>
                    <option value="moderator">Moderator</option>
                    <option value="finance">Finance</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {/* Coin Balance */}
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Coin Balance
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editUserCoins}
                    onChange={(e) => setEditUserCoins(e.target.value)}
                    className="w-full bg-casino-dark border border-casino-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Reset Password */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Reset Password (Leave blank to keep unchanged)
                </label>
                <input
                  type="password"
                  placeholder="New password (min 6 characters)"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  className="w-full bg-casino-dark border border-casino-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Profile Image URL */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Profile Photo URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/avatar.png"
                  value={editUserPhoto}
                  onChange={(e) => setEditUserPhoto(e.target.value)}
                  className="w-full bg-casino-dark border border-casino-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUserModal(null)}
                  disabled={editUserSaving}
                  className="flex-1 py-2.5 rounded-xl text-xs bg-gray-800 text-gray-400 font-bold hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editUserSaving}
                  className="flex-1 py-2.5 rounded-xl text-xs bg-amber-500 hover:bg-amber-400 text-black font-extrabold shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {editUserSaving
                    ? "Saving Changes..."
                    : "Save Account Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
