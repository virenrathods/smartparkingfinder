const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const locationRoutes = require('./routes/location.routes');
const slotRoutes = require('./routes/slot.routes');
const bookingRoutes = require('./routes/booking.routes');
const adminRoutes = require('./routes/admin.routes');
const { errorHandler } = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure permitted origins (e.g. CORS_ORIGIN=https://smart-parking-finder.vercel.app)
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g., automated test runners, curl, health checks)
    if (!origin) return callback(null, true);

    const isDev = process.env.NODE_ENV !== 'production';

    // In local development or testing, permit localhost and 127.0.0.1 on any port
    if (isDev) {
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
    }

    // If allowedOrigins is not explicitly set in development, permit access
    if (allowedOrigins.length === 0 && isDev) {
      return callback(null, true);
    }

    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS policy: Access denied for origin ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    databaseEngine: db.getClientType().toUpperCase()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use(errorHandler);

const { startLifecycleService, stopLifecycleService } = require('./services/lifecycle.service');
const { startReminderService, stopReminderService } = require('./services/reminder.service');

// Server Startup
async function startServer() {
  try {
    // Security guard for production deployments
    if (process.env.NODE_ENV === 'production') {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret || jwtSecret === 'super_secret_jwt_key_diploma_smart_parking_2026') {
        throw new Error('Fatal Security Blocker: In production mode, you must set a strong, unique JWT_SECRET in your hosting dashboard.');
      }
    }

    await db.initDb();
    const clientType = db.getClientType().toUpperCase();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('====================================================');
      console.log(`🚗 Smart Parking Finder Server is running!`);
      console.log(`📡 URL: http://0.0.0.0:${PORT}`);
      console.log(`🗄️  Active Database Engine: ${clientType}`);
      console.log(`🛡️  Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log('====================================================');

      // Start automatic booking lifecycle monitor (runs immediately + every 60s)
      startLifecycleService(60000);

      // Start automated booking reminder service (runs immediately + every 60s)
      const reminderIntervalMs = (Number(process.env.REMINDER_CHECK_INTERVAL_SECONDS) || 60) * 1000;
      startReminderService(reminderIntervalMs);
    });

    // Graceful Shutdown
    const handleShutdown = (signal) => {
      console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
      stopLifecycleService();
      stopReminderService();
      server.close(() => {
        console.log('💤 HTTP server closed. Process exiting.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (err) {
    console.error('Fatal: Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
