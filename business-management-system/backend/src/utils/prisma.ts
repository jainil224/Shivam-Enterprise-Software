import { PrismaClient } from '@prisma/client';
import { config } from '../config/env.js';

let prismaInstance: PrismaClient | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: config.isProduction ? ['error'] : ['error', 'warn'],
    });
  }
  return prismaInstance;
};

export const prisma = getPrismaClient();

