import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { whatsappSessionService } from './services/whatsapp/whatsappSessionService.js';

const app = express();

// Configure CORS restricted to frontend origin
const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://192.168.') || origin.startsWith('http://10.')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    // The report exports stream the descriptive filename in these headers.
    // Without exposure the browser cannot read them on a cross-origin XHR.
    exposedHeaders: ['Content-Disposition', 'X-Report-Filename'],
  })
);

// Standard JSON body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Mount API routes
app.use('/api', apiRoutes);

// Root fallback endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Business Management System API',
    status: 'online',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// Centralized error handler
app.use(errorHandler);

// Start server (bound strictly to localhost for Phase 1 security)
const server = app.listen(config.port, '127.0.0.1', () => {
  console.log(`[BMS Backend] Server successfully running at http://localhost:${config.port}`);
  console.log(`[BMS Backend] Environment: ${config.nodeEnv}`);
  // Phase 19.3: re-attach persisted WhatsApp sessions. A session WhatsApp no
  // longer accepts surfaces as AUTH_FAILURE and the UI offers a fresh QR code.
  void whatsappSessionService
    .restoreSessions()
    .then((restored) => {
      if (restored.length > 0) {
        console.log(`[BMS Backend] Restored ${restored.length} WhatsApp session(s).`);
      }
    })
    .catch((error: unknown) => {
      console.warn('[BMS Backend] WhatsApp session restore skipped:', error instanceof Error ? error.message : error);
    });
});

// Fail with a readable message instead of an unhandled 'error' event when the
// port is already taken (e.g. a second `npm run dev` or a stale watcher).
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[BMS Backend] Port ${config.port} is already in use on 127.0.0.1. Another backend instance is probably running.`
    );
    console.error(
      `[BMS Backend] Stop the existing server or set a different PORT in backend/.env, then start again.`
    );
    console.error(
      `[BMS Backend] Windows: Get-NetTCPConnection -LocalPort ${config.port} -State Listen | Select-Object OwningProcess`
    );
    process.exit(1);
  }

  if (error.code === 'EACCES') {
    console.error(`[BMS Backend] Not allowed to bind 127.0.0.1:${config.port}. Check firewall or port permissions.`);
    process.exit(1);
  }

  console.error('[BMS Backend] HTTP server error:', error.message);
  process.exit(1);
});

// Graceful shutdown. WhatsApp browsers are destroyed so no orphan Chrome
// process survives the backend, but credentials stay on disk for restore.
const shutdown = (signal: string): void => {
  console.log(`${signal} signal received: closing HTTP server`);
  void whatsappSessionService.shutdownAll().finally(() => {
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Guard against non-fatal browser automation errors (e.g. WhatsApp Web frame detach during navigation).
// Transient navigation races in headless Chrome must never crash the main ERP backend.
process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (
    message.includes('detached Frame') ||
    message.includes('Execution context was destroyed') ||
    message.includes('Target closed') ||
    message.includes('Session closed') ||
    message.includes('Protocol error')
  ) {
    console.warn('[BMS Backend] Handled non-fatal WhatsApp/Puppeteer navigation race:', message);
    return;
  }
  console.error('[BMS Backend] Unhandled Rejection:', reason);
});

export default app;

