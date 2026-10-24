const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { redisPubClient, redisSubClient, isRedisAvailable } = require('../config/redis');

let io = null;

function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow all origins in dev or any connecting IP
        callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 8000,
  });

  // Enable Redis adapter for horizontal scaling if Redis is operational
  if (isRedisAvailable() && redisPubClient && redisSubClient) {
    try {
      io.adapter(createAdapter(redisPubClient, redisSubClient));
      console.log('✅ Socket.io Redis adapter initialized for multi-instance scaling');
    } catch (err) {
      console.warn('⚠️  Could not attach Redis adapter to Socket.io:', err.message);
    }
  }

  // Socket Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      socket.user = decoded; // { id, username, role }
      next();
    } catch (err) {
      next(new Error('Invalid or expired socket authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    // Join a private room for targeted direct messages (e.g. balance updates)
    socket.join(`user:${userId}`);

    console.log(`🔌 Socket connected: ${socket.id} (User: ${socket.user.username} [${userId}])`);

    socket.on('client:heartbeat', (data) => {
      socket.emit('server:heartbeat_ack', { ts: Date.now(), clientTs: data?.ts });
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet');
  }
  return io;
}

function emitToUser(userId, event, payload) {
  if (io) {
    io.to(`user:${userId}`).emit(event, payload);
  }
}

function emitToRoom(room, event, payload) {
  if (io) {
    io.to(room).emit(event, payload);
  }
}

function emitToAll(event, payload) {
  if (io) {
    io.emit(event, payload);
  }
}

module.exports = {
  initSocketServer,
  getIO,
  emitToUser,
  emitToRoom,
  emitToAll,
};
