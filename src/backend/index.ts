import { createApp } from './app';
import { config } from './config';
import { initDatabase, closeDatabase } from './database/db';

async function bootstrap(): Promise<void> {
  // Initialize SQLite database
  initDatabase();
  console.log(`[Database] SQLite connected at: ${config.dbPath}`);

  // Create Express application
  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`[Server] DOGFOOD Hackathon Platform running on port ${config.port} (${config.nodeEnv})`);
  });

  // Graceful shutdown handling
  const shutdown = (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      closeDatabase();
      console.log('[Database] SQLite connection closed.');
      process.exit(0);
    });

    // Force exit if shutdown takes too long
    setTimeout(() => {
      console.error('[Server] Forcing shutdown after timeout.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[Bootstrap Error]', err);
  process.exit(1);
});
