import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

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
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const socketUrl = resolveSocketUrl();
    console.log("🔌 Initializing WebSocket connection to:", socketUrl);

    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      setIsConnected(true);
      console.log("⚡ Socket connected to server:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.warn("⚠️ Socket connection error to", socketUrl, ":", err.message);
      setIsConnected(false);
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      console.log("⚡ Socket disconnected:", reason);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return {
    socket: socketRef.current,
    isConnected,
  };
}
