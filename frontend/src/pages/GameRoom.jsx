import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Users,
  Trophy,
  Clock,
  ShieldCheck,
  Play,
  Sparkles,
  ArrowRight,
  Zap,
  Timer,
  RotateCcw,
  Eye,
  X,
} from "lucide-react";
import { tableAPI } from "../services/api";
import BallAnimation from "../components/BallAnimation";
import PlayerSeat from "../components/PlayerSeat";
import WinnerModal from "../components/WinnerModal";
import ExitTableModal from "../components/ExitTableModal";
import TableChat, { FloatingReactions } from "../components/TableChat";
import CoinIcon from "../components/CoinIcon";
import { formatCoins } from "../utils/formatters";
import { onTelegramEvent } from "../services/telegram";

/**
 * Check if a player object or user ID matches the current user
 */
function isMatchingUser(playerOrId, currentUser) {
  if (!playerOrId || !currentUser) return false;
  const pId =
    typeof playerOrId === "object"
      ? playerOrId.user_id !== undefined
        ? playerOrId.user_id
        : playerOrId.userId !== undefined
          ? playerOrId.userId
          : playerOrId.id
      : playerOrId;
  const cId = currentUser.id || currentUser.userId || currentUser._id;

  if (pId !== undefined && cId !== undefined && String(pId) === String(cId)) {
    return true;
  }
  if (
    typeof playerOrId === "object" &&
    playerOrId.username &&
    currentUser.username &&
    playerOrId.username.toLowerCase() === currentUser.username.toLowerCase()
  ) {
    return true;
  }
  return false;
}

/**
 * Orders seated players with fixed hierarchy:
 * 1. Current player on first index (index 0)
 * 2. Host player on second index (index 1) (if distinct from current player)
 * 3. Remaining seated players follow in order
 */
function prioritizePlayers(playerList, currentUser, hostId) {
  if (!Array.isArray(playerList) || playerList.length === 0) {
    return [];
  }
  const copy = [...playerList];

  const isCurrentMatch = (p) => isMatchingUser(p, currentUser);
  const isHostMatch = (p) => {
    if (!p) return false;
    const pId =
      p.user_id !== undefined
        ? p.user_id
        : p.userId !== undefined
          ? p.userId
          : p.id;
    if (
      hostId !== undefined &&
      hostId !== null &&
      pId !== undefined &&
      String(pId) === String(hostId)
    ) {
      return true;
    }
    return Boolean(p.isHost);
  };

  // 1. Find and extract Current Player
  let currentPlayer = null;
  const currentIdx = copy.findIndex(isCurrentMatch);
  if (currentIdx !== -1) {
    [currentPlayer] = copy.splice(currentIdx, 1);
  }

  // 2. Find and extract Host Player from remaining
  let hostPlayer = null;
  const hostIdx = copy.findIndex(isHostMatch);
  if (hostIdx !== -1) {
    [hostPlayer] = copy.splice(hostIdx, 1);
  }

  const result = [];
  if (currentPlayer) {
    result.push(currentPlayer);
  }
  if (hostPlayer) {
    result.push(hostPlayer);
  }
  result.push(...copy);

  return result;
}

export default function GameRoom({
  tableId,
  user,
  socket,
  soundEffects,
  onBackToLobby,
  onUserBalanceUpdate,
  onSwitchTable,
}) {
  const [table, setTable] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentBall, setCurrentBall] = useState(null);
  const [drawnBalls, setDrawnBalls] = useState([]);
  const [totalPoolCount, setTotalPoolCount] = useState(70);
  const [countdown, setCountdown] = useState(null);
  const [autoStartSeconds, setAutoStartSeconds] = useState(null);
  const [countdownResetNotice, setCountdownResetNotice] = useState(null);
  const [winnerData, setWinnerData] = useState(null);
  const [activeRedirectTableId, setActiveRedirectTableId] = useState(null);
  const [autoRejoinConfig, setAutoRejoinConfig] = useState({
    enabled: true,
    delaySeconds: 7,
  });
  const [botPlayersConfig, setBotPlayersConfig] = useState({
    enabled: true,
    maxBotPlayers: 9,
    joinDelaySeconds: 30,
  });
  const [botJoinSeconds, setBotJoinSeconds] = useState(null);
  const [autoRejoinSeconds, setAutoRejoinSeconds] = useState(null);
  const [returnToLobbySeconds, setReturnToLobbySeconds] = useState(null);
  const [rejoinCount, setRejoinCount] = useState(0);
  const rejoinCountRef = useRef(0);
  const autoRejoinTimerRef = useRef(null);
  const returnToLobbyTimerRef = useRef(null);
  const ballHistoryTimerRef = useRef(null);
  const winnerPopupTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const joiningLockRef = useRef(false);
  const wasSeatedBeforeGameEndRef = useRef(false);
  const [joining, setJoining] = useState(false);
  const [joiningCurrent, setJoiningCurrent] = useState(false);
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [error, setError] = useState("");

  // Real-Time In-Game Chat & Emoji Reaction State
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [playerReactions, setPlayerReactions] = useState({});
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [chatRateLimitWarning, setChatRateLimitWarning] = useState(null);
  const chatRateLimitTimerRef = useRef(null);

  // Synchronized table ref to guard against stale websocket events
  const tableRef = useRef(table);
  useEffect(() => {
    tableRef.current = table;
  }, [table]);

  useEffect(() => {
    setError("");
    setActiveRedirectTableId(null);
    setIsChatOpen(false);
    loadTableData();

    // Socket Reconnection Handler: Re-join room & catch up missed balls/state
    const handleReconnect = () => {
      console.log(
        "⚡ GameRoom: Socket connected/reconnected. Re-joining room & refreshing data...",
      );
      if (socket) {
        socket.emit("table:join_room", { tableId });
      }
      loadTableData();
    };

    if (socket) {
      socket.emit("table:join_room", { tableId });
      socket.on("connect", handleReconnect);
      if (socket.io) {
        socket.io.on("reconnect", handleReconnect);
      }

      // Player Joined Listener
      socket.on("table:player_joined", (data) => {
        setPlayers((prev) => {
          const exists = prev.some((p) => p.user_id === data.userId);
          const hostId = data.hostId;
          if (exists) return prev;
          const updated = [
            ...prev,
            {
              user_id: data.userId,
              username: data.username,
              photo_url: data.photo_url || data.photoUrl || null,
              photoUrl: data.photo_url || data.photoUrl || null,
              is_bot: Boolean(data.isBot),
              isBot: Boolean(data.isBot),
              seat_number: data.seatNumber,
              numbers: data.numbers,
              matched_count: 0,
              isHost: hostId ? data.userId === hostId : prev.length === 0,
            },
          ].sort((a, b) => a.seat_number - b.seat_number);

          const luckyCount = new Set(updated.flatMap((p) => p.numbers || []))
            .size;
          setTotalPoolCount(
            luckyCount > 0 ? luckyCount + 20 : updated.length * 5 + 20,
          );

          const mapped = updated.map((p, idx) => ({
            ...p,
            isHost: hostId ? String(p.user_id) === String(hostId) : idx === 0,
          }));
          return prioritizePlayers(mapped, user, hostId);
        });
        setTable((prev) =>
          prev
            ? {
                ...prev,
                current_players: data.currentPlayers,
                host_id: data.hostId || prev.host_id,
              }
            : prev,
        );
        if (data.currentPlayers >= 2) {
          setBotJoinSeconds(null);
        }
      });

      // Player Left / Host Transferred Listener
      socket.on("table:player_left", (data) => {
        const nextHostId = data.newHostId;
        setPlayers((prev) => {
          const filtered = prev.filter(
            (p) => String(p.user_id) !== String(data.userId),
          );
          const luckyCount = new Set(filtered.flatMap((p) => p.numbers || []))
            .size;
          setTotalPoolCount(
            luckyCount > 0
              ? luckyCount + 20
              : Math.max(25, filtered.length * 5 + 20),
          );
          const mapped = filtered.map((p, idx) => ({
            ...p,
            isHost: nextHostId
              ? String(p.user_id) === String(nextHostId)
              : idx === 0,
          }));
          return prioritizePlayers(mapped, user, nextHostId);
        });
        setTable((prev) =>
          prev
            ? {
                ...prev,
                current_players:
                  data.currentPlayers !== undefined
                    ? data.currentPlayers
                    : prev.current_players,
                host_id: nextHostId !== undefined ? nextHostId : prev.host_id,
                host_username:
                  data.newHostUsername !== undefined
                    ? data.newHostUsername
                    : prev.host_username,
              }
            : prev,
        );
        if (data.currentPlayers !== undefined && data.currentPlayers < 2) {
          setAutoStartSeconds(null);
        }
        if (data.currentPlayers !== undefined && data.currentPlayers === 0) {
          setBotJoinSeconds(null);
        }
      });

      // Bot Join Countdown Listener
      socket.on("table:bot_join_countdown", (data) => {
        if (data.endsAt) {
          const sec = Math.max(
            0,
            Math.round((data.endsAt - Date.now()) / 1000),
          );
          setBotJoinSeconds(sec);
        } else if (data.secondsLeft !== undefined) {
          setBotJoinSeconds(data.secondsLeft);
        }
      });

      socket.on("table:bot_join_cancelled", () => {
        setBotJoinSeconds(null);
      });

      // Auto-Start Countdown Listener (resets on new player join)
      socket.on("table:auto_start_countdown", (data) => {
        if (data.endsAt) {
          const sec = Math.max(
            0,
            Math.round((data.endsAt - Date.now()) / 1000),
          );
          setAutoStartSeconds(sec);
        } else if (data.secondsLeft !== undefined) {
          setAutoStartSeconds(data.secondsLeft);
        }
        if (data.isReset) {
          const notice = data.newPlayerUsername
            ? `Timer reset: ${data.newPlayerUsername} joined!`
            : "Timer reset: new player joined!";
          setCountdownResetNotice(notice);
          setTimeout(() => setCountdownResetNotice(null), 4000);
        }
      });

      // Auto-Start Cancelled Listener (e.g. Host clicked Start early or player left)
      socket.on("table:auto_start_cancelled", () => {
        setAutoStartSeconds(null);
        setCountdownResetNotice(null);
      });

      // Table Round Reset Listener (when a completed table starts next round)
      socket.on("table:round_reset", (data) => {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        if (ballHistoryTimerRef.current) {
          clearTimeout(ballHistoryTimerRef.current);
          ballHistoryTimerRef.current = null;
        }
        setDrawnBalls([]);
        setCurrentBall(null);
        setWinnerData(null);
        setPlayers([]);
        setTotalPoolCount(30);
        setAutoStartSeconds(null);
        setCountdown(null);
        setCountdownResetNotice(null);
        setTable((prev) =>
          prev
            ? {
                ...prev,
                status: "waiting",
                current_players: 0,
                host_id: data.hostId || prev.host_id,
              }
            : prev,
        );

        // If this player was counting down to auto-rejoin and someone else reset the round,
        // immediately take seat in the new round so they don't miss it or get desynchronized
        if (autoRejoinTimerRef.current) {
          clearInterval(autoRejoinTimerRef.current);
          autoRejoinTimerRef.current = null;
          setAutoRejoinSeconds(null);
          if (data?.resetByUserId !== user?.id && !joiningLockRef.current) {
            handleJoinCurrentTable();
          }
        }
      });

      // Crashed Game Reset to Waiting Listener (Scheduler recovery)
      socket.on("table:reset_to_waiting", (data) => {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        if (ballHistoryTimerRef.current) {
          clearTimeout(ballHistoryTimerRef.current);
          ballHistoryTimerRef.current = null;
        }
        if (autoRejoinTimerRef.current) {
          clearInterval(autoRejoinTimerRef.current);
          autoRejoinTimerRef.current = null;
        }
        if (returnToLobbyTimerRef.current) {
          clearInterval(returnToLobbyTimerRef.current);
          returnToLobbyTimerRef.current = null;
        }
        setAutoRejoinSeconds(null);
        setReturnToLobbySeconds(null);
        setDrawnBalls([]);
        setCurrentBall(null);
        setWinnerData(null);
        setTotalPoolCount(30);
        setAutoStartSeconds(null);
        setCountdown(null);
        setCountdownResetNotice(null);
        setTable((prev) =>
          prev
            ? {
                ...prev,
                status: "waiting",
              }
            : prev,
        );
        if (data.message) {
          setError(data.message);
        }
      });

      // Game Start Countdown Listener
      socket.on("table:game_start", (data) => {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        if (ballHistoryTimerRef.current) {
          clearTimeout(ballHistoryTimerRef.current);
          ballHistoryTimerRef.current = null;
        }
        if (autoRejoinTimerRef.current) {
          clearInterval(autoRejoinTimerRef.current);
          autoRejoinTimerRef.current = null;
        }
        if (returnToLobbyTimerRef.current) {
          clearInterval(returnToLobbyTimerRef.current);
          returnToLobbyTimerRef.current = null;
        }
        setAutoRejoinSeconds(null);
        setReturnToLobbySeconds(null);
        wasSeatedBeforeGameEndRef.current = (data.players || []).some(
          (p) => (p.user_id || p.userId) === user?.id,
        );
        setAutoStartSeconds(null);
        setCountdownResetNotice(null);
        setCountdown(data.countdownSeconds || 5);
        if (data.totalPoolCount) {
          setTotalPoolCount(data.totalPoolCount);
        }
        const hostId = data.hostId || table?.host_id;
        setTable((prev) =>
          prev
            ? { ...prev, status: "playing", host_id: hostId || prev.host_id }
            : prev,
        );
        if (data.players) {
          const mapped = data.players.map((p, idx) => ({
            ...p,
            user_id: p.user_id || p.userId,
            photo_url: p.photo_url || p.photoUrl || null,
            photoUrl: p.photo_url || p.photoUrl || null,
            isHost: hostId
              ? (p.user_id || p.userId) === hostId
              : p.isHost !== undefined
                ? p.isHost
                : idx === 0,
          }));
          setPlayers(prioritizePlayers(mapped, user, hostId));
        }
        countdownTimerRef.current = setInterval(() => {
          setCountdown((c) => {
            if (c === null || c <= 1) {
              if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;
              }
              return null;
            }
            return c - 1;
          });
        }, 1000);
      });

      // Live Ball Extracted Listener
      socket.on("draw:ball", (data) => {
        // Discard any stale draw:ball events from previous completed sessions!
        if (tableRef.current?.status && tableRef.current.status !== "playing") {
          return;
        }
        // First ball has arrived: clear pre-game countdown
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdown(null);

        setCurrentBall(data.ball);
        if (data.totalPoolCount) {
          setTotalPoolCount(data.totalPoolCount);
        }
        if (soundEffects?.playBallPop) {
          soundEffects.playBallPop();
        }

        // Put number to Drawn Balls History after showing ball for 500ms
        if (ballHistoryTimerRef.current) {
          clearTimeout(ballHistoryTimerRef.current);
        }
        ballHistoryTimerRef.current = setTimeout(() => {
          setDrawnBalls(data.drawnBalls || []);
          if (data.players) {
            setPlayers((prev) => {
              const hostId = data.hostId || table?.host_id;
              const mapped = data.players.map((p, idx) => {
                const prevP = prev.find(
                  (item) =>
                    (item.user_id || item.userId) === (p.user_id || p.userId),
                );
                const isH = hostId
                  ? (p.user_id || p.userId) === hostId
                  : p.isHost !== undefined
                    ? p.isHost
                    : prevP?.isHost !== undefined
                      ? prevP.isHost
                      : idx === 0;
                return {
                  ...p,
                  user_id: p.user_id || p.userId,
                  photo_url:
                    p.photo_url ||
                    p.photoUrl ||
                    prevP?.photo_url ||
                    prevP?.photoUrl ||
                    null,
                  photoUrl:
                    p.photo_url ||
                    p.photoUrl ||
                    prevP?.photo_url ||
                    prevP?.photoUrl ||
                    null,
                  isHost: isH,
                };
              });
              return prioritizePlayers(mapped, user, hostId);
            });
          }
        }, 1000);
      });

      // Winner Announced Listener
      socket.on("draw:winner", (data) => {
        // 1. Clear any pending ball history timer and sync final drawn balls immediately
        if (ballHistoryTimerRef.current) {
          clearTimeout(ballHistoryTimerRef.current);
          ballHistoryTimerRef.current = null;
        }
        if (data.drawnBalls) {
          setDrawnBalls(data.drawnBalls);
        }
        if (data.winningBall) {
          setCurrentBall(data.winningBall);
        }

        // 2. Immediately highlight the winning player on the board with all 5 matches
        setPlayers((prev) => {
          return prev.map((p) => {
            const pId =
              p.user_id !== undefined
                ? p.user_id
                : p.userId !== undefined
                  ? p.userId
                  : p.id;
            const winnerId =
              data.winner?.userId || data.winner?.user_id || data.winner?.id;
            if (String(pId) === String(winnerId) || isMatchingUser(data.winner, p)) {
              return {
                ...p,
                matched_count: 5,
                isWinner: true,
              };
            }
            return p;
          });
        });

        // 3. Mark table status as completed
        setTable((prev) => (prev ? { ...prev, status: "completed" } : prev));

        // 4. Wait 2 seconds (2000ms) after the last match number is shown before popping up the Winner Celebration Modal
        if (winnerPopupTimerRef.current) {
          clearTimeout(winnerPopupTimerRef.current);
        }
        winnerPopupTimerRef.current = setTimeout(() => {
          setWinnerData(data);

          const autoRejoinCfg = data.autoRejoin ||
            autoRejoinConfig || { enabled: true, delaySeconds: 7 };
          if (data.autoRejoin) {
            setAutoRejoinConfig(data.autoRejoin);
          }

          const isPlayerSeated =
            wasSeatedBeforeGameEndRef.current ||
            players.some((p) => (p.user_id || p.userId) === user?.id);
          const currentBalance =
            user?.coinBalance !== undefined ? user.coinBalance : 0;
          const entryFee = table?.entry_fee || 100;
          const hasCoins = currentBalance >= entryFee;

          const duration = autoRejoinCfg.delaySeconds || 7;

          if (isPlayerSeated) {
            if (rejoinCountRef.current < 1) {
              // Player has not re-joined yet: allow ONE re-join!
              if (autoRejoinCfg.enabled && hasCoins) {
                setAutoRejoinSeconds(duration);
              } else {
                setAutoRejoinSeconds(null);
              }
              setReturnToLobbySeconds(null);
            } else {
              // Player already re-joined 1 time: NEXT GAME FINISHED -> automatically return to lobby!
              setAutoRejoinSeconds(null);
              setReturnToLobbySeconds(duration);
            }
          } else {
            setAutoRejoinSeconds(null);
            setReturnToLobbySeconds(null);
          }
        }, 2000);
      });

      // Table Chat History Listener
      socket.on("table:chat_history", (data) => {
        if (data.messages && Array.isArray(data.messages)) {
          setChatMessages(data.messages);
        }
      });

      // New Real-Time Chat / Emoji Reaction Listener
      socket.on("table:new_chat", (data) => {
        setChatMessages((prev) => [...prev.slice(-49), data]);

        // Increment unread count if drawer is closed
        setIsChatOpen((isOpen) => {
          if (!isOpen) {
            setUnreadChatCount((c) => c + 1);
          }
          return isOpen;
        });

        // Trigger reaction/speech bubble on player seat whenever they send an emoji OR text message
        if (data.emoji || data.message) {
          soundEffects?.playEmojiPop?.();

          // Give text messages longer display time (4.5s) so players have time to read
          const displayDuration = data.message ? 4500 : 3200;

          // Set active reaction & message over player seat
          setPlayerReactions((prev) => ({
            ...prev,
            [data.userId]: {
              id: data.id,
              emoji: data.emoji || "",
              message: data.message || "",
              timestamp: Date.now(),
            },
          }));

          // Dismiss seat reaction bubble after display duration
          setTimeout(() => {
            setPlayerReactions((prev) => {
              const copy = { ...prev };
              if (copy[data.userId]?.id === data.id) {
                delete copy[data.userId];
              }
              return copy;
            });
          }, displayDuration);

          // Add to floating screen reactions if emoji exists
          if (data.emoji) {
            setFloatingReactions((prev) => [
              ...prev.slice(-7),
              {
                id: data.id,
                emoji: data.emoji,
                username: data.username,
                userId: data.userId,
              },
            ]);

            // Clear floating reaction after 2.4s
            setTimeout(() => {
              setFloatingReactions((prev) =>
                prev.filter((r) => r.id !== data.id),
              );
            }, 2400);
          }
        }
      });

      // Chat Rate Limit Exceeded Listener (Cooldown Notice)
      socket.on("table:chat_rate_limited", (data) => {
        const warningMsg =
          data?.message ||
          `Chat limit reached. Please wait ${data?.retryAfterSeconds || 5}s.`;
        setChatRateLimitWarning(warningMsg);
        if (chatRateLimitTimerRef.current) {
          clearTimeout(chatRateLimitTimerRef.current);
        }
        chatRateLimitTimerRef.current = setTimeout(() => {
          setChatRateLimitWarning(null);
        }, 4500);
      });
    }

    return () => {
      if (socket) {
        socket.emit("table:leave_room", { tableId });
        socket.off("connect", handleReconnect);
        if (socket.io) {
          socket.io.off("reconnect", handleReconnect);
        }
        socket.off("table:player_joined");
        socket.off("table:player_left");
        socket.off("table:round_reset");
        socket.off("table:reset_to_waiting");
        socket.off("table:game_start");
        socket.off("table:auto_start_countdown");
        socket.off("table:auto_start_cancelled");
        socket.off("table:bot_join_countdown");
        socket.off("table:bot_join_cancelled");
        socket.off("draw:ball");
        socket.off("draw:winner");
        socket.off("table:chat_history");
        socket.off("table:new_chat");
        socket.off("table:chat_rate_limited");
      }
      if (chatRateLimitTimerRef.current) {
        clearTimeout(chatRateLimitTimerRef.current);
      }
      if (ballHistoryTimerRef.current) {
        clearTimeout(ballHistoryTimerRef.current);
        ballHistoryTimerRef.current = null;
      }
      if (winnerPopupTimerRef.current) {
        clearTimeout(winnerPopupTimerRef.current);
        winnerPopupTimerRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [tableId, socket]);

  // Mobile Screen Wake-up & Telegram Foreground State Resync
  useEffect(() => {
    const handleWakeUp = () => {
      if (document.visibilityState === "visible") {
        console.log(
          "📱 GameRoom: Mobile wake-up detected. Ensuring table room connection & syncing data...",
        );
        if (socket) {
          if (!socket.connected) {
            socket.connect();
          } else {
            socket.emit("table:join_room", { tableId });
          }
        }
        loadTableData();
      }
    };

    document.addEventListener("visibilitychange", handleWakeUp);
    window.addEventListener("pageshow", handleWakeUp);
    window.addEventListener("focus", handleWakeUp);
    const unregisterTgActivated = onTelegramEvent("activated", handleWakeUp);
    const unregisterTgViewport = onTelegramEvent(
      "viewportChanged",
      handleWakeUp,
    );

    return () => {
      document.removeEventListener("visibilitychange", handleWakeUp);
      window.removeEventListener("pageshow", handleWakeUp);
      window.removeEventListener("focus", handleWakeUp);
      unregisterTgActivated();
      unregisterTgViewport();
    };
  }, [tableId, socket]);

  // Chat Handlers
  const handleSendEmoji = (emoji) => {
    if (!socket || !tableId) return;
    if (!isUserSeated) return;
    socket.emit("table:send_chat", {
      tableId,
      emoji,
      photoUrl: user?.photoUrl || user?.photo_url || null,
    });
  };

  const handleSendMessage = (text, emoji = "") => {
    if (!socket || !tableId) return;
    if (!isUserSeated) return;
    socket.emit("table:send_chat", {
      tableId,
      message: text,
      emoji,
      photoUrl: user?.photoUrl || user?.photo_url || null,
    });
  };

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next) {
        setUnreadChatCount(0);
      }
      return next;
    });
  };

  // Tick down the 30-second auto-start countdown
  useEffect(() => {
    if (autoStartSeconds === null || autoStartSeconds <= 0) return;
    const interval = setInterval(() => {
      setAutoStartSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoStartSeconds]);

  // Tick down the bot player join delay countdown
  useEffect(() => {
    if (botJoinSeconds === null || botJoinSeconds <= 0) return;
    const interval = setInterval(() => {
      setBotJoinSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [botJoinSeconds]);

  const loadTableData = async (retry = 0) => {
    try {
      const res = await tableAPI.getTable(tableId);
      const data = res.data?.data;
      if (!data) return;

      setError("");
      setActiveRedirectTableId(null);
      setTable(data.table);
      setPlayers(
        prioritizePlayers(data.players || [], user, data.table?.host_id),
      );
      const luckyCount = new Set(
        (data.players || []).flatMap((p) => p.numbers || []),
      ).size;
      const count =
        luckyCount > 0
          ? luckyCount + 20
          : Math.max(30, (data.players?.length || 2) * 5 + 20);
      setTotalPoolCount(count);

      if (data.autoStart?.isCountingDown) {
        setAutoStartSeconds(data.autoStart.secondsLeft);
      } else {
        setAutoStartSeconds(null);
      }

      if (data.botJoinCountdown?.isWaitingForBots) {
        setBotJoinSeconds(data.botJoinCountdown.secondsLeft);
      } else {
        setBotJoinSeconds(null);
      }

      if (data.drawState && data.table?.status === "playing") {
        setDrawnBalls(data.drawState.drawn_numbers || []);
        setCurrentBall(data.drawState.current_ball);
        // Only clear pre-game countdown if balls have ACTUALLY started drawing!
        if (
          (data.drawState.drawn_numbers && data.drawState.drawn_numbers.length > 0) ||
          (data.drawState.current_ball !== null && data.drawState.current_ball !== undefined)
        ) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          setCountdown(null);
        }
      } else if (data.table?.status === "completed") {
        // Table completed while player was away/screen off: retain drawn balls & show winner
        if (data.drawState?.drawn_numbers) {
          setDrawnBalls(data.drawState.drawn_numbers);
        }
        if (data.drawState?.current_ball) {
          setCurrentBall(data.drawState.current_ball);
        }
        setCountdown(null);

        // If winnerData is not yet set, construct it from table and drawState
        setWinnerData((prevWinner) => {
          if (prevWinner) return prevWinner;
          if (data.table?.winner_id) {
            const currentPlayersCount =
              data.table.current_players || (data.players || []).length || 2;
            const totalPool =
              (data.table.entry_fee || 100) * currentPlayersCount;
            return {
              winner: {
                userId: data.table.winner_id,
                username: data.table.winner_name || "Winner",
                photoUrl: data.table.winner_photo_url || null,
              },
              winningBall:
                data.drawState?.winning_ball || data.drawState?.current_ball,
              drawnBalls: data.drawState?.drawn_numbers || [],
              payout: {
                winnerPayout: Math.floor(totalPool * 0.9),
                totalPool,
                platformFee: Math.floor(totalPool * 0.1),
              },
              totalBallsDrawn: data.drawState?.drawn_numbers?.length || 0,
              autoRejoin: data.autoRejoin,
            };
          }
          return null;
        });
      } else {
        setDrawnBalls([]);
        setCurrentBall(null);
      }

      if (data.autoRejoin) {
        setAutoRejoinConfig(data.autoRejoin);
      }
      if (data.botPlayers) {
        setBotPlayersConfig(data.botPlayers);
      }
    } catch (err) {
      console.warn("Failed to load table details:", err?.message || err);
      if (err.response?.status === 404) {
        setError("This table is no longer available.");
        return;
      }
      // If mobile network is still reconnecting right after wake-up, retry once after 1.2s
      if (retry < 2) {
        setTimeout(() => loadTableData(retry + 1), 1200);
      } else {
        setError("Failed to load table details. Reconnecting...");
      }
    }
  };

  const handleCancelAutoRejoin = () => {
    if (winnerPopupTimerRef.current) {
      clearTimeout(winnerPopupTimerRef.current);
      winnerPopupTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (autoRejoinTimerRef.current) {
      clearInterval(autoRejoinTimerRef.current);
      autoRejoinTimerRef.current = null;
    }
    if (returnToLobbyTimerRef.current) {
      clearInterval(returnToLobbyTimerRef.current);
      returnToLobbyTimerRef.current = null;
    }
    setAutoRejoinSeconds(null);
    setReturnToLobbySeconds(null);
  };

  // Auto Re-Join countdown timer effect (Only 1 time allowed!)
  useEffect(() => {
    if (autoRejoinSeconds === null) {
      if (autoRejoinTimerRef.current) {
        clearInterval(autoRejoinTimerRef.current);
        autoRejoinTimerRef.current = null;
      }
      return;
    }

    if (autoRejoinSeconds <= 0) {
      if (autoRejoinTimerRef.current) {
        clearInterval(autoRejoinTimerRef.current);
        autoRejoinTimerRef.current = null;
      }
      setAutoRejoinSeconds(null);
      handleJoinCurrentTable();
      return;
    }

    const interval = setInterval(() => {
      setAutoRejoinSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    autoRejoinTimerRef.current = interval;
    return () => {
      clearInterval(interval);
      if (autoRejoinTimerRef.current === interval) {
        autoRejoinTimerRef.current = null;
      }
    };
  }, [autoRejoinSeconds]);

  // Return to Lobby countdown timer effect (when next game finishes after 1 re-join)
  useEffect(() => {
    if (returnToLobbySeconds === null) {
      if (returnToLobbyTimerRef.current) {
        clearInterval(returnToLobbyTimerRef.current);
        returnToLobbyTimerRef.current = null;
      }
      return;
    }

    if (returnToLobbySeconds <= 0) {
      if (returnToLobbyTimerRef.current) {
        clearInterval(returnToLobbyTimerRef.current);
        returnToLobbyTimerRef.current = null;
      }
      setReturnToLobbySeconds(null);
      handleJoinOtherTable();
      return;
    }

    const interval = setInterval(() => {
      setReturnToLobbySeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    returnToLobbyTimerRef.current = interval;
    return () => {
      clearInterval(interval);
      if (returnToLobbyTimerRef.current === interval) {
        returnToLobbyTimerRef.current = null;
      }
    };
  }, [returnToLobbySeconds]);

  const handleJoinThisTable = async () => {
    if (joiningLockRef.current) return;
    joiningLockRef.current = true;
    try {
      setJoining(true);
      setError("");
      setActiveRedirectTableId(null);
      await tableAPI.joinTable(tableId);
      if (onUserBalanceUpdate) {
        onUserBalanceUpdate();
      }
      await loadTableData();
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to join table";
      if (msg.toLowerCase().includes("already joined")) {
        setError("");
        await loadTableData();
      } else {
        setError(msg);
        if (err.response?.data?.activeTableId) {
          setActiveRedirectTableId(err.response.data.activeTableId);
        }
      }
    } finally {
      joiningLockRef.current = false;
      setJoining(false);
    }
  };

  const handleStartGame = async () => {
    try {
      setStarting(true);
      setError("");
      await tableAPI.startGame(tableId);
      await loadTableData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to start game");
    } finally {
      setStarting(false);
    }
  };

  const handleDeleteTable = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this table? Only empty tables can be deleted.",
      )
    ) {
      return;
    }
    try {
      await tableAPI.deleteTable(tableId);
      onBackToLobby();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete table");
    }
  };

  const handleConfirmExit = async () => {
    handleCancelAutoRejoin();
    try {
      setLeaving(true);
      setError("");
      await tableAPI.leaveTable(tableId);
      if (onUserBalanceUpdate) {
        onUserBalanceUpdate();
      }
      setShowExitModal(false);
      onBackToLobby();
    } catch (err) {
      console.error("Leave table error:", err);
      setError(err.response?.data?.error || "Failed to exit table");
    } finally {
      setLeaving(false);
    }
  };

  const handleBackNavigation = () => {
    if (isUserSeated && table?.status === "waiting") {
      setShowExitModal(true);
      return;
    }
    handleCancelAutoRejoin();
    onBackToLobby();
  };

  const handleJoinCurrentTable = async () => {
    handleCancelAutoRejoin();
    if (ballHistoryTimerRef.current) {
      clearTimeout(ballHistoryTimerRef.current);
      ballHistoryTimerRef.current = null;
    }
    if (joiningLockRef.current) return;
    joiningLockRef.current = true;
    setWinnerData(null);
    setCurrentBall(null);
    setDrawnBalls([]);
    setCountdown(null);
    setAutoStartSeconds(null);
    setCountdownResetNotice(null);
    try {
      setJoiningCurrent(true);
      setError("");
      setActiveRedirectTableId(null);
      await tableAPI.joinTable(tableId);
      // Increment re-join count: user used their 1 allowed re-join
      rejoinCountRef.current += 1;
      setRejoinCount(rejoinCountRef.current);
      if (onUserBalanceUpdate) {
        onUserBalanceUpdate();
      }
      await loadTableData();
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to join current table";
      if (msg.toLowerCase().includes("already joined")) {
        setError("");
        await loadTableData();
      } else {
        setError(msg);
        if (err.response?.data?.activeTableId) {
          setActiveRedirectTableId(err.response.data.activeTableId);
        }
      }
    } finally {
      joiningLockRef.current = false;
      setJoiningCurrent(false);
    }
  };

  const handleJoinOtherTable = async () => {
    handleCancelAutoRejoin();
    try {
      setWinnerData(null);
      await tableAPI.leaveTable(tableId);
    } catch (err) {
      console.warn("Exit table note:", err);
    } finally {
      if (onUserBalanceUpdate) {
        onUserBalanceUpdate();
      }
      onBackToLobby();
    }
  };

  if (!table) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-400">
        Loading Arena...
      </div>
    );
  }

  // Sort players: current user on first index (index 0), host on second index (index 1)
  const sortedPlayers = prioritizePlayers(players, user, table?.host_id);
  const isUserSeated = sortedPlayers.some((p) => isMatchingUser(p, user));
  const activeCount = sortedPlayers.length >= 2 ? sortedPlayers.length : 2;
  const totalPool =
    table.entry_fee *
    (table.status === "playing" || table.status === "completed"
      ? table.current_players || sortedPlayers.length
      : activeCount);
  const winnerPrize = Math.floor(totalPool * 0.9);
  const platformFee = Math.floor(totalPool * 0.1);
  const maxPlayers = table?.max_players || 10;

  // Host Player logic: table.host_id has highest priority, fallback to first seated player
  const hostPlayer = table?.host_id
    ? sortedPlayers.find(
        (p) => String(p.user_id || p.userId) === String(table.host_id),
      ) || {
        username: table.host_username || "Host",
        user_id: table.host_id,
      }
    : sortedPlayers.find((p) => p.isHost) || sortedPlayers[0];

  const isHostUser =
    (table?.host_id && String(user?.id) === String(table.host_id)) ||
    isMatchingUser(hostPlayer, user) ||
    user?.role === "admin";

  // Partition seated players across left & right flanks on desktop (NO EMPTY SEAT PANELS)
  const half = Math.ceil(sortedPlayers.length / 2);
  const leftPlayers = sortedPlayers.slice(0, half);
  const rightPlayers = sortedPlayers.slice(half);

  return (
    <div className="max-w-7xl mx-auto px-2.5 sm:px-4 py-2.5 sm:py-6 space-y-2.5 sm:space-y-6">
      {/* Header bar */}
      <div className="bg-white dark:bg-casino-card border border-slate-200 dark:border-casino-border rounded-2xl p-2.5 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Back Button + Table Info */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            <button
              onClick={handleBackNavigation}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-casino-dark hover:bg-slate-200 dark:hover:bg-casino-border border border-slate-200 dark:border-casino-border text-slate-700 dark:text-gray-400 hover:text-black dark:hover:text-white transition-all active:scale-95 flex-shrink-0"
              title="Back to Lobby"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <h2
                  className="text-sm sm:text-lg font-black text-slate-900 dark:text-white truncate"
                  title={table.name}
                >
                  {table.name}
                </h2>
                <span
                  className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${
                    table.status === "playing"
                      ? "bg-rose-500/20 text-rose-500 dark:text-rose-400 border-rose-500/40 animate-pulse"
                      : table.status === "completed"
                        ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/40"
                        : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
                  }`}
                >
                  {table.status}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-gray-400 font-mono mt-0.5">
                <span>Room: #{table.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>

          {/* Right: Prize Pool Display */}
          <div className="flex items-center space-x-1.5 sm:space-x-3 flex-shrink-0">
            <div className="text-right pl-2.5 sm:pl-3 border-l border-slate-200 dark:border-casino-border/60 flex-shrink-0">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block -mb-0.5">
                🏆 Prize Pool
              </span>
              <div className="flex items-center justify-end space-x-1 sm:space-x-1.5">
                <span className="text-base sm:text-2xl md:text-3xl font-black font-mono tracking-tight text-amber-500 dark:text-amber-400 drop-shadow-sm leading-tight">
                  {formatCoins(winnerPrize)}
                </span>
                <CoinIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 drop-shadow-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2 min-w-0">
            <span>{error}</span>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0 self-start sm:self-auto">
            {activeRedirectTableId && (
              <button
                onClick={() => {
                  const targetId = activeRedirectTableId;
                  setError("");
                  setActiveRedirectTableId(null);
                  if (onSwitchTable && targetId) {
                    onSwitchTable(targetId);
                  } else {
                    onBackToLobby();
                  }
                }}
                className="px-3 py-1.5 rounded-lg font-bold text-xs bg-amber-400 hover:bg-amber-300 text-black transition-all flex items-center justify-center space-x-1 shadow-sm"
              >
                <span>Return to Your Game</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => {
                setError("");
                setActiveRedirectTableId(null);
              }}
              className="p-1 rounded-md text-red-300/70 hover:text-white hover:bg-red-500/30 transition-all"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Watch Only Spectator Status Banner */}
      {!isUserSeated && (
        <div className="bg-gradient-to-r from-purple-500/15 via-indigo-500/10 to-purple-500/15 border border-purple-400/40 rounded-2xl p-3 sm:p-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center flex-shrink-0 shadow-sm border border-purple-400/30">
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs sm:text-sm font-black text-purple-900 dark:text-purple-200 block">
                  Watch Only Mode
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-400/30">
                  Spectator
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-gray-400 leading-tight mt-0.5">
                {table.status === "playing"
                  ? "Watching live game as a spectator."
                  : "You are currently watching without a seat. Take a seat to play!"}
              </p>
            </div>
          </div>

          {table.status === "waiting" && table.current_players < maxPlayers && (
            <button
              onClick={handleJoinThisTable}
              disabled={joining}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-500/20 flex-shrink-0 sm:self-center transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 whitespace-nowrap"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span className="inline-flex items-center gap-1.5">
                Join Game
              </span>
            </button>
          )}
        </div>
      )}

      {/* Countdown Announcement Banner */}
      {countdown !== null && (
        <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black px-2.5 py-1.5 sm:p-3.5 rounded-xl sm:rounded-2xl text-center shadow-md sm:shadow-lg animate-pulse flex items-center justify-center space-x-1.5 sm:space-x-2">
          <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5 fill-black flex-shrink-0" />
          <span className="text-[10px] sm:text-sm uppercase tracking-tight sm:tracking-wide truncate">
            Live Drawing Lucky Numbers begins in {countdown}s...
          </span>
        </div>
      )}

      {/* Main Arena: Center Drum & Seated Players */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Seated Players - DESKTOP ONLY */}
        <div className="hidden lg:block lg:col-span-3 space-y-2">
          {leftPlayers.length > 0 && (
            <span className="text-[11px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider block px-1">
              Active Players ({leftPlayers.length})
            </span>
          )}
          {leftPlayers.map((player, idx) => {
            const seatNum = player.seat_number || player.seatNumber || idx + 1;
            const pId = player.user_id || player.userId || player.id;
            const isPlayerHost =
              (table?.host_id && String(pId) === String(table.host_id)) ||
              Boolean(player.isHost);
            const isCurrent = isMatchingUser(player, user);
            return (
              <PlayerSeat
                key={pId || seatNum || idx}
                seatNumber={seatNum}
                player={player}
                drawnBalls={drawnBalls}
                isCurrentUser={isCurrent}
                isWinner={
                  Boolean(player.isWinner) ||
                  isMatchingUser(winnerData?.winner, player)
                }
                isHost={isPlayerHost}
                activeReaction={playerReactions[pId]}
              />
            );
          })}
        </div>

        {/* Center Arena: Drum Animation & Join Controls */}
        <div className="col-span-1 lg:col-span-6 flex flex-col justify-between space-y-3">
          <BallAnimation
            currentBall={currentBall}
            drawnBalls={drawnBalls}
            isDrawing={table.status === "playing"}
            totalPoolCount={totalPoolCount}
          />

          {/* Interactive Player Quick Emoji Bar & Chat Drawer (hidden for watch-only players) */}
          {isUserSeated && (
            <TableChat
              isOpen={isChatOpen}
              onToggle={handleToggleChat}
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              onSendEmoji={handleSendEmoji}
              currentUserId={user?.id}
              unreadCount={unreadChatCount}
              rateLimitWarning={chatRateLimitWarning}
            />
          )}

          {/* At least 2 Players Game Start Controls */}
          {table.status === "waiting" &&
            (players.length >= 2 ? (
              <div className="bg-gradient-to-r from-emerald-500/10 via-white to-emerald-500/10 dark:from-emerald-950/40 dark:via-casino-card dark:to-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 text-center shadow-md dark:shadow-lg space-y-3">
                <div className="flex items-center justify-center text-xs font-semibold px-1">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5 font-bold">
                    <Users className="w-4 h-4" />
                    <span>
                      Ready to Play! ({players.length} Players Seated)
                    </span>
                  </span>
                </div>

                {/* Auto-Start Countdown Banner (with dynamic reset indicator) */}
                {autoStartSeconds !== null && autoStartSeconds > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-100/90 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300 transition-all shadow-sm">
                    <div className="flex items-center space-x-2">
                      <Timer className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
                      <span className="text-xs font-semibold">
                        Game starts automatically in{" "}
                        <strong className="text-amber-950 dark:text-white font-mono text-sm bg-amber-200/90 dark:bg-amber-500/30 px-2 py-0.5 rounded-lg border border-amber-400/50">
                          {autoStartSeconds}s
                        </strong>
                      </span>
                    </div>
                    {countdownResetNotice && (
                      <div className="flex items-center space-x-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-500/40 animate-pulse">
                        <RotateCcw className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>{countdownResetNotice}</span>
                      </div>
                    )}
                  </div>
                )}

                {isHostUser ? (
                  <>
                    <button
                      onClick={handleStartGame}
                      disabled={starting}
                      className="w-full py-3 px-6 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-black shadow-lg shadow-emerald-500/30 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                    >
                      <Play className="w-4 h-4 fill-black" />
                      <span>
                        {starting
                          ? "Starting Game..."
                          : `Start Game Now (${players.length} Players)`}
                      </span>
                    </button>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">
                      You are the Table Host! Click to start now, or the game
                      will start automatically when countdown ends.
                    </p>
                  </>
                ) : (
                  <div className="py-2.5 px-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs flex items-center justify-center space-x-2 shadow-sm">
                    <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    <span>
                      Waiting for timer or Table Host{" "}
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        ({hostPlayer?.username || "Host"})
                      </strong>{" "}
                      to start early ({players.length}/{maxPlayers} Seated)
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50/80 dark:bg-casino-card/70 border border-amber-300/80 dark:border-casino-border rounded-2xl p-3 text-center text-xs text-amber-900 dark:text-gray-400 flex items-center justify-center space-x-2 shadow-sm">
                <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-spin" />
                <span className="font-medium">
                  Waiting for at least 2 players to start... ({players.length}/
                  {maxPlayers} Seated)
                </span>
              </div>
            ))}

          {/* Post-Game Controls when status === 'completed': 2 Options */}
          {table.status === "completed" && (
            <div className="bg-gradient-to-r from-amber-50/80 via-white to-amber-50/80 dark:from-amber-950/40 dark:via-casino-card dark:to-amber-950/40 border border-amber-400/50 dark:border-amber-500/40 rounded-2xl p-5 text-center shadow-lg dark:shadow-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold px-1">
                <span className="text-amber-600 dark:text-amber-400 flex items-center space-x-1.5 font-bold">
                  <Trophy className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>
                    {returnToLobbySeconds !== null && returnToLobbySeconds > 0
                      ? `Match Finished • Returning to Lobby in ${returnToLobbySeconds}s`
                      : autoRejoinSeconds !== null && autoRejoinSeconds > 0
                        ? `Match Finished • Auto Re-Joining in ${autoRejoinSeconds}s`
                        : "Match Finished"}
                  </span>
                </span>
                <span className="text-amber-600 dark:text-amber-300 font-mono text-[11px] font-bold inline-flex items-center gap-1">
                  <CoinIcon className="w-3.5 h-3.5 inline -mt-0.5" />
                  {formatCoins(table.entry_fee)} / Seat
                </span>
              </div>

              {/* Returning to Lobby Banner inside GameRoom (Timer kept!) */}
              {returnToLobbySeconds !== null && returnToLobbySeconds > 0 && (
                <div className="bg-gradient-to-r from-purple-500/20 via-indigo-500/25 to-purple-500/20 border border-purple-400/70 rounded-xl p-3 flex items-center justify-between text-left shadow-sm animate-pulse">
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500 text-white flex items-center justify-center font-black text-sm flex-shrink-0">
                      <Timer className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-purple-200 block truncate">
                        Returning to Lobby in {returnToLobbySeconds}s...
                      </span>
                      <span className="text-[10px] text-slate-600 dark:text-gray-400 block truncate">
                        Click Re-Join Table to stay and play, or return to
                        lobby.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleJoinOtherTable}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex-shrink-0 shadow-sm"
                  >
                    Lobby Now
                  </button>
                </div>
              )}

              {/* Auto Re-Join Banner inside GameRoom */}
              {autoRejoinSeconds !== null && autoRejoinSeconds > 0 && (
                <div className="bg-gradient-to-r from-amber-500/20 via-yellow-400/30 to-amber-500/20 border border-amber-400/70 rounded-xl p-3 flex items-center justify-between text-left shadow-sm animate-pulse">
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-400 text-black flex items-center justify-center font-black text-sm flex-shrink-0">
                      <Timer className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-amber-300 block truncate">
                        Auto Re-Joining Table in {autoRejoinSeconds}s...
                      </span>
                      <span className="text-[10px] text-slate-600 dark:text-gray-400 flex items-center gap-1 truncate">
                        <CoinIcon className="w-3.5 h-3.5 inline -mt-0.5" />
                        {formatCoins(table.entry_fee)} will be deducted for next
                        round
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelAutoRejoin}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-gray-200 text-xs font-bold transition-all flex-shrink-0 shadow-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Action Buttons: BOTH Re-Join Table and Return to Lobby KEPT! */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  onClick={handleJoinCurrentTable}
                  disabled={joiningCurrent}
                  className="flex-1 py-3.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 hover:from-amber-400 hover:to-yellow-200 text-black shadow-lg shadow-amber-500/25 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 fill-black" />
                  <span className="inline-flex items-center gap-1">
                    {joiningCurrent ? (
                      "Taking Seat..."
                    ) : autoRejoinSeconds !== null && autoRejoinSeconds > 0 ? (
                      <>
                        ⚡ Re-Join Now (
                        <CoinIcon className="w-3.5 h-3.5 inline -mt-0.5" />
                        {formatCoins(table.entry_fee)})
                      </>
                    ) : (
                      <>
                        ⚡ Re-Join Table (
                        <CoinIcon className="w-3.5 h-3.5 inline -mt-0.5" />
                        {formatCoins(table.entry_fee)})
                      </>
                    )}
                  </span>
                </button>

                <button
                  onClick={handleJoinOtherTable}
                  disabled={joiningCurrent}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-casino-dark hover:bg-slate-200 dark:hover:bg-casino-border border border-slate-300 dark:border-casino-border text-slate-800 dark:text-gray-200 hover:text-black dark:hover:text-white px-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>
                    {returnToLobbySeconds !== null && returnToLobbySeconds > 0
                      ? `Back to Lobby (${returnToLobbySeconds}s)`
                      : "Back to Lobby"}
                  </span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-gray-400">
                {isHostUser ? (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    👑 You are the Table Host! You will remain Host for the next
                    round if you do not exit.
                  </span>
                ) : (
                  <span>
                    👑 Table Host{" "}
                    <strong className="text-slate-800 dark:text-gray-200 font-semibold">
                      ({hostPlayer?.username || table.host_username || "Host"})
                    </strong>{" "}
                    will stay the same if they do not exit.
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Mobile-Only Seated Players Grid (Neatly placed below the Lottery Draw Chamber) */}
          <div className="block lg:hidden space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-800 dark:text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>
                  Table Seats ({players.length}/{maxPlayers})
                </span>
              </span>
            </div>

            {sortedPlayers.length > 0 ? (
              <div
                className="grid grid-cols-2 gap-2 sm:gap-2.5 w-full"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                }}
              >
                {sortedPlayers.map((player, idx) => {
                  const seatNum =
                    player.seat_number || player.seatNumber || idx + 1;
                  const pId = player.user_id || player.userId || player.id;
                  const isPlayerHost =
                    (table?.host_id && String(pId) === String(table.host_id)) ||
                    Boolean(player.isHost);
                  const isCurrent = isMatchingUser(player, user);
                  return (
                    <PlayerSeat
                      key={pId || seatNum || idx}
                      seatNumber={seatNum}
                      player={player}
                      drawnBalls={drawnBalls}
                      isCurrentUser={isCurrent}
                      isWinner={
                        Boolean(player.isWinner) ||
                        isMatchingUser(winnerData?.winner, player)
                      }
                      isHost={isPlayerHost}
                      activeReaction={playerReactions[pId]}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-casino-card/50 border border-slate-200 dark:border-casino-border text-center text-xs text-slate-500 dark:text-gray-500">
                No players seated yet. Join the table to play!
              </div>
            )}
          </div>

          {/* Table Rules Notice */}
          <div className="bg-slate-50 dark:bg-casino-dark/70 rounded-2xl p-4 border border-slate-200 dark:border-casino-border text-[11px] text-slate-600 dark:text-gray-400 flex items-start space-x-2.5 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800 dark:text-gray-200 block mb-0.5">
                Fair Play & Fast Payout
              </span>
              Numbers 1-99 are drawn with cryptographic randomness. Winner
              receives 90% instant payout to their wallet. Platform fee is 10%.
            </div>
          </div>
        </div>

        {/* Right Side: Seated Players - DESKTOP ONLY */}
        <div className="hidden lg:block lg:col-span-3 space-y-2">
          {rightPlayers.length > 0 && (
            <span className="text-[11px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider block px-1">
              Active Players ({rightPlayers.length})
            </span>
          )}
          {rightPlayers.map((player, idx) => {
            const seatNum =
              player.seat_number || player.seatNumber || idx + 1 + half;
            const pId = player.user_id || player.userId || player.id;
            const isPlayerHost =
              (table?.host_id && String(pId) === String(table.host_id)) ||
              Boolean(player.isHost);
            const isCurrent = isMatchingUser(player, user);
            return (
              <PlayerSeat
                key={pId || seatNum || idx}
                seatNumber={seatNum}
                player={player}
                drawnBalls={drawnBalls}
                isCurrentUser={isCurrent}
                isWinner={
                  Boolean(player.isWinner) ||
                  isMatchingUser(winnerData?.winner, player)
                }
                isHost={isPlayerHost}
                activeReaction={playerReactions[pId]}
              />
            );
          })}
        </div>
      </div>

      {/* Winner Celebration Modal */}
      <WinnerModal
        isOpen={Boolean(winnerData)}
        winnerData={winnerData}
        entryFee={table.entry_fee}
        isHost={isHostUser}
        hostName={hostPlayer?.username || table.host_username || "Host"}
        joiningCurrent={joiningCurrent}
        onJoinCurrentTable={handleJoinCurrentTable}
        onJoinOtherTable={handleJoinOtherTable}
        playWinnerFanfare={soundEffects?.playWinnerFanfare}
        autoRejoinSeconds={autoRejoinSeconds}
        returnToLobbySeconds={returnToLobbySeconds}
        rejoinCount={rejoinCount}
        onCancelAutoRejoin={handleCancelAutoRejoin}
        hasEnoughCoins={(user?.coinBalance || 0) >= table.entry_fee}
        wasUserSeated={wasSeatedBeforeGameEndRef.current || isUserSeated}
        autoRejoinEnabled={autoRejoinConfig.enabled}
      />

      {/* Redesigned Exit Table Confirmation Modal */}
      <ExitTableModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={handleConfirmExit}
        tableName={table.name}
        entryFee={table.entry_fee}
        loading={leaving}
        error={error}
      />

      {/* Live Floating Screen Emoji Reactions */}
      <FloatingReactions reactions={floatingReactions} />
    </div>
  );
}
