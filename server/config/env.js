const path = require('path');
require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET'];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // Fail fast and loudly rather than starting a server that 500s on first query.
  console.error(
    `\nMissing required environment variables: ${missing.join(', ')}\n` +
      'Copy server/.env.example to server/.env and fill in the values.\n'
  );
  process.exit(1);
}

if (process.env.JWT_SECRET === 'change-me' && process.env.NODE_ENV === 'production') {
  console.error('JWT_SECRET is still the placeholder value. Refusing to start in production.');
  process.exit(1);
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  uploadsDir: path.join(__dirname, '..', 'uploads'),
};
