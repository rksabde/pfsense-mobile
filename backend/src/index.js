require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { authenticate, login } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required when running behind nginx
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login endpoint (no auth required)
app.post('/api/auth/login', login);

// Protected routes
const clientsRouter = require('./routes/clients');
const statsRouter = require('./routes/stats');

app.use('/api/clients', authenticate, clientsRouter);
app.use('/api/stats', authenticate, statsRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`pfSense Manager API running on port ${PORT}`);
  console.log(`pfSense URL: ${process.env.PFSENSE_URL}`);
  console.log(`Blocked alias: ${process.env.BLOCKED_ALIAS_NAME || 'BLOCKED'}`);
});
