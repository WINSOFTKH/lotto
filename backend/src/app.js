const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiter');

const app = express();

// Trust reverse proxies (Cloudflare, Nginx, Traefik, Caddy) for correct HTTPS & IP detection
app.set('trust proxy', 1);

// Security HTTP headers (disable crossOriginResourcePolicy restriction so IP access works)
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// Robust Cross-Origin Resource Sharing (CORS) allowing localhost, LAN IPs, and custom domains
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server webhooks)
    if (!origin) return callback(null, true);

    // In development mode, permit all origins (including any LAN IP like 10.x.x.x, 192.168.x.x)
    if (config.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // Support comma-separated origins or wildcard in CORS_ORIGIN
    const rawAllowed = (config.CORS_ORIGIN || '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
    const normalizedOrigin = origin.replace(/\/+$/, '');

    if (rawAllowed.length === 0 || rawAllowed.includes('*') || rawAllowed.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // Check if domain matches wildcard pattern (*.example.com)
    const matchesWildcard = rawAllowed.some((pattern) => {
      if (pattern.startsWith('*.')) {
        const rootDomain = pattern.slice(2);
        try {
          const originHost = new URL(normalizedOrigin).hostname;
          return originHost === rootDomain || originHost.endsWith(`.${rootDomain}`);
        } catch {
          return false;
        }
      }
      return false;
    });

    if (matchesWildcard) {
      return callback(null, true);
    }

    // Allow LAN IP formats & localhost
    if (/^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(normalizedOrigin)) {
      return callback(null, true);
    }

    // Allow and log warning for unlisted custom domains so login is not hard-blocked
    console.warn(`[CORS] Request from origin "${origin}" permitted. For strict security, add it to CORS_ORIGIN in backend/.env.`);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-bakong-signature'],
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Request logging
if (config.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiter for general API routes
app.use('/api', apiLimiter);

// Main API Routes (mounted on /api and root alias for flexible custom domain setups)
app.use('/api', routes);
app.use('/', routes);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
