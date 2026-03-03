/**
 * Vercel Serverless Handler
 *
 * This file is the entry point for Vercel deployment.
 * It wraps the Express app as a Vercel-compatible serverless function
 * and memoises the MongoDB connection across warm invocations.
 */
import './config/env.js'
import type { IncomingMessage, ServerResponse } from 'http'
import { connectDB } from './config/database.js'
import app from './app.js'

let isConnected = false

async function ensureConnected(): Promise<void> {
  if (!isConnected) {
    await connectDB()
    isConnected = true
  }
}

// Vercel expects a default export: (req, res) => void | Promise<void>
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await ensureConnected()
  // Delegate to Express
  app(req as any, res as any)
}
