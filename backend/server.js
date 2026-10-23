const http = require("http");
const app = require("./src/app");
const config = require("./src/config/env");
const { pool } = require("./src/config/db");
const { initSocketServer } = require("./src/sockets/socketServer");
const TableSocketHandler = require("./src/sockets/tableSocket");
const TableRecoveryService = require("./src/services/tableRecoveryService");
const KhqrService = require("./src/services/khqrService");

const server = http.createServer(app);

// Initialize Socket.io Server
const io = initSocketServer(server);

// Register socket event handlers per client connection
io.on("connection", (socket) => {
  TableSocketHandler.registerListeners(socket);
});

// Start listening
server.listen(config.PORT, "0.0.0.0", () => {
  console.log(`
=====================================================
🎰  LOTTO 4U REAL-TIME LOTTERY SERVER ONLINE  🎰
=====================================================
📡  Port:          ${config.PORT}
🌍  Environment:   ${config.NODE_ENV}
⚡  Socket.io:     Ready (Rooms & Real-time Drawings)
🗄️  PostgreSQL:    Connection Pool Active
🔗  API Base:      http://127.0.0.1:${config.PORT}/api
=====================================================
  `);

  // Start background scheduler to check & recover crashed tables (started >= 1h ago)
  TableRecoveryService.startScheduler(5);

  // Start background KHQR payment auto-checker worker (throttled to 60s to protect Bakong daily limit of 100)
  KhqrService.startPollingWorker(60);
});

// Graceful shutdown handling
const shutdown = async () => {
  console.log("Shutting down server gracefully...");
  TableRecoveryService.stopScheduler();
  KhqrService.stopPollingWorker();
  server.close(async () => {
    console.log("HTTP and WebSocket server closed.");
    try {
      await pool.end();
      console.log("PostgreSQL connection pool closed.");
    } catch (err) {
      console.error("Error closing DB pool:", err);
    }
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
