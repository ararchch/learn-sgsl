import { PrismaClient } from '@prisma/client';

declare global {
  var __sgslPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__sgslPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__sgslPrisma = prisma;
}
