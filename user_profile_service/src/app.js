const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { connectDatabase } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const preferencesRoutes = require('./routes/preferencesRoutes');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
// Only connect to database if not in test mode
if (process.env.NODE_ENV !== 'test') {
  connectDatabase();
}

// Middleware
app.use(helmet()); // Security headers
app.use(cors());   // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(morgan('dev')); // Request logging

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/preferences', preferencesRoutes);

// Health check endpoint
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Global error handler
app.use(errorHandler);

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`User Profile Service running on port ${PORT}`);
  });
}

module.exports = app;