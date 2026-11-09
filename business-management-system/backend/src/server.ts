import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;

