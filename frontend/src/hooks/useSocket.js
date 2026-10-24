import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { onTelegramEvent } from "../services/telegram";

/**
 * Intelligently resolve the Socket.io WebSocket URL:
 * 1. Automatically adapts between localhost (dev) and HTTPS custom domains (prod)
 * 2. Strips invalid `https:` protocols on local servers (preventing ERR_SSL_PROTOCOL_ERROR)
 * 3. Aligns hostnames (localhost vs 127.0.0.1) with the active browser tab
 * 4. Falls back to same-origin for reverse proxy / Cloudflare setups
 */
export function resolveSocketUrl() {
  const envWs = (import.meta.env.VITE_WS_URL || "").trim();
  const envApi = (import.meta.env.VITE_API_URL || "").trim();

  if (typeof window !== "undefined") {
    const isHttps = window.location.protocol === "https:";
    const hostname = window.location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

    // CASE 1: Local Development (Browsing on localhost or 127.0.0.1)
    if (isLocalhost) {
      if (envWs) {
        let cleaned = envWs.replace(/\/+$/, "");
        // Fix accidental https:// on local dev (local port 3500 is plain HTTP)
        cleaned = cleaned.replace(/^https:\/\/(localhost|127\.0\.0\.1)/, "http://$1");
        // Align 127.0.0.1 / localhost with current window tab
        cleaned = cleaned.replace(/(localhost|127\.0\.0\.1)/, hostname);
        return cleaned;
      }

      if (envApi) {
        let cleaned = envApi.replace(/\/+$/, "").replace(/\/api$/, "");
        cleaned = cleaned.replace(/^https:\/\/(localhost|127\.0\.0\.1)/, "http://$1");
        cleaned = cleaned.replace(/(localhost|127\.0\.0\.1)/, hostname);
        return cleaned;
      }

      return `http://${hostname}:3500`;
    }

    // CASE 2: Custom HTTPS Domain (Production, Reverse Proxy, Cloudflare Tunnel)
    if (isHttps) {
      // If explicit remote WS URL provided (and not pointing to localhost)
      if (envWs && !envWs.includes("localhost") && !envWs.includes("127.0.0.1")) {
        return envWs.replace(/\/+$/, "");
      }
      if (envApi && !envApi.includes("localhost") && !envApi.includes("127.0.0.1")) {
        return envApi.replace(/\/+$/, "").replace(/\/api$/, "");
      }
      // Route via same-origin reverse proxy to prevent Mixed Content blocks
      return window.location.origin;
    }

    // CASE 3: Local Network IP (e.g. 192.168.x.x or 10.x.x.x)
    if (envWs) {
      let cleaned = envWs.replace(/\/+$/, "");
      cleaned = cleaned.replace(/^https:/, "http:");
      return cleaned;
    }
    if (envApi) {
      let cleaned = envApi.replace(/\/+$/, "").replace(/\/api$/, "");
      cleaned = cleaned.replace(/^https:/, "http:");
      return cleaned;
    }
    return `http://${hostname}:3500`;
  }

  // Fallback for SSR or non-browser environments
  if (envWs) return envWs.replace(/\/+$/, "").replace(/^https:\/\/(localhost|127\.0\.0\.1)/, "http://$1");
  if (envApi) return envApi.replace(/\/+$/, "").replace(/\/api$/, "").replace(/^https:\/\/(localhost|127\.0\.0\.1)/, "http://$1");
  return "http://localhost:3500";
}

export function useSocket(token) {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      console.log("⚡ Manually triggering socket reconnect...");
      if (!socketRef.current.connected) {
        socketRef.current.connect();
      }
    }
  }, []);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = resolveSocketUrl();
    console.log("🔌 Initializing WebSocket connection to:", socketUrl);

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity, // Never abandon reconnection on mobile lock/sleep
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 10000,
    });

    newSocket.on("connect", () => {
      setIsConnected(true);
      console.log("⚡ Socket connected to server:", newSocket.id);
    });

    newSocket.on("connect_error", (err) => {
      console.warn("⚠️ Socket connection error to", socketUrl, ":", err.message);
      setIsConnected(false);
    });

    newSocket.on("disconnect", (reason) => {
      setIsConnected(false);
      console.log("⚡ Socket disconnected:", reason);
      // If server closed connection or connection dropped abruptly, automatically try reconnecting immediately
      if (reason === "io server disconnect") {
        newSocket.connect();
      }
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Mobile Screen Wake-up & App Foreground Detection
    const handleWakeUp = () => {
      if (document.visibilityState === "visible") {
        console.log("📱 Mobile screen awake / app restored. Checking socket health...");
        if (newSocket) {
          if (!newSocket.connected) {
            console.log("⚡ Socket is disconnected, reconnecting immediately...");
            newSocket.connect();
          } else {
            // Heartbeat check: confirm TCP pipe hasn't become a zombie in background
            newSocket.emit("client:heartbeat", { ts: Date.now() });
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleWakeUp);
    window.addEventListener("pageshow", handleWakeUp);
    window.addEventListener("focus", handleWakeUp);
    const unregisterTgActivated = onTelegramEvent("activated", handleWakeUp);
    const unregisterTgViewport = onTelegramEvent("viewportChanged", handleWakeUp);

    return () => {
      document.removeEventListener("visibilitychange", handleWakeUp);
      window.removeEventListener("pageshow", handleWakeUp);
      window.removeEventListener("focus", handleWakeUp);
      unregisterTgActivated();
      unregisterTgViewport();
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [token]);

  return {
    socket,
    isConnected,
    reconnect,
  };
}
