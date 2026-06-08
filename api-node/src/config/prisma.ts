import { PrismaNeonHttp } from '@prisma/adapter-neon'
import { PrismaClient } from '../generated/prisma/client.js'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createPrismaClient() {
  const adapter = new PrismaNeonHttp(process.env.DATABASE_URL!, {})
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = createPrismaClient()

