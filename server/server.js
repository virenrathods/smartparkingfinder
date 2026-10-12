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

// Middleware
app.use(cors({
  origin: '*', // Allows development client access
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

// Server Startup
async function startServer() {
  try {
    await db.initDb();
    const clientType = db.getClientType().toUpperCase();

    app.listen(PORT, () => {
      console.log('====================================================');
      console.log(`🚗 Smart Parking Finder Server is running!`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`🗄️  Active Database Engine: ${clientType}`);
      console.log(`🛡️  Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log('====================================================');
    });
  } catch (err) {
    console.error('Fatal: Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
