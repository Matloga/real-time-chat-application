const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const conversationRoutes = require('./routes/conversation.routes');
const userRoutes = require('./routes/user.routes');
const ApiError = require('./utils/ApiError');

const app = express();

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), env: config.env });
});

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/users', userRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
app.use((err, req, res, next) => {
  const statusCode = err instanceof ApiError ? err.statusCode : err.statusCode || 500;

  if (statusCode >= 500) {
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    message: statusCode >= 500 && !(err instanceof ApiError) ? 'Internal server error' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
});

module.exports = app;
