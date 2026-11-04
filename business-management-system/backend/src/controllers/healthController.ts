import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/env.js';

export const getHealth = (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    application: 'Business Management System (BMS)',
    version: '1.0.0',
    environment: config.nodeEnv,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

export const getDbHealth = async (_req: Request, res: Response) => {
  const startTime = Date.now();

  if (!config.databaseUrl) {
    return res.status(200).json({
      status: 'disconnected',
      database: 'PostgreSQL',
      message: 'DATABASE_URL is not configured in environment variables.',
      timestamp: new Date().toISOString(),
      latencyMs: 0,
    });
  }

  try {
    // Execute a fast and safe query (SELECT 1)
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    return res.status(200).json({
      status: 'connected',
      database: 'PostgreSQL',
      message: 'Database connection verified successfully (SELECT 1 passed).',
      timestamp: new Date().toISOString(),
      latencyMs,
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown database connection error';

    // Log internally but do not crash the server
    console.warn('[Database Health Check Warning]:', errorMessage);

    return res.status(200).json({
      status: 'error',
      database: 'PostgreSQL',
      message: 'Failed to connect to PostgreSQL. Please check server status and credentials.',
      timestamp: new Date().toISOString(),
      latencyMs,
    });
  }
};

