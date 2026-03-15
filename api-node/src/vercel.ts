/**
 * Vercel Serverless Handler
 *
 * This file is the entry point for Vercel deployment.
 * It wraps the Express app as a Vercel-compatible serverless function.
 */
import './config/env.js'
import type { IncomingMessage, ServerResponse } from 'http'
import app from './app.js'

// Vercel expects a default export: (req, res) => void | Promise<void>
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  app(req as any, res as any)
}
