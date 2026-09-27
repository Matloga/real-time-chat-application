const http = require('http');
const app = require('./app');
const config = require('./config/env');
const prisma = require('./config/prisma');
const { initSocket } = require('./socket');

const start = async () => {
  // Fail fast with a clear message rather than letting the first request 500.
  try {
    await prisma.$connect();
    console.log('[db] connected to SQL Server');
  } catch (err) {
    console.error('[db] connection failed. Check DATABASE_URL and that SQL Server is running.');
    console.error('[db]', err.message);
    process.exit(1);
  }

  const server = http.createServer(app);
  initSocket(server);

  server.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start();
