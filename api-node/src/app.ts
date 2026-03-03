import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import compression from 'compression'
import { ENV } from './config/env.js'
import { detectPlatform } from './middleware/platform.js'
import { flaskRewrite, compatHandlers } from './routes/compat.js'
import v1Router from './routes/v1.js'

const app = express()

/* ── Security ─────────────────────────────────────────────── */
app.use(helmet())
app.use(
  cors({
    origin: ENV.ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

/* ── Rate limiting ────────────────────────────────────────── */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

/* ── Compression ─────────────────────────────────────────── */
app.use(compression())

/* ── Body Parsing ────────────────────────────────────────── */
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))
if (ENV.NODE_ENV !== 'test') {
  app.use(morgan('dev'))
}

/* ── Platform Detection ──────────────────────────────────── */
app.use(detectPlatform)

/* ══════════════════════════════════════════════════════════════
 *  API-FIRST ROUTE ARCHITECTURE
 *
 *  Three layers serve both web and mobile clients:
 *
 *  1. /api/v1/*    — Canonical versioned API (primary)
 *  2. /api/*       — Unversioned alias (web backward compat)
 *  3. Flask compat — URL rewrites + custom handlers (mobile v2.x)
 *
 *  Versioning contract:
 *    • v1 is the current stable API
 *    • Breaking changes → increment to v2 (v1 stays)
 *    • Non-breaking additions → add to v1
 *
 * ══════════════════════════════════════════════════════════════ */

/* ── Health ───────────────────────────────────────────────── */
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    api_versions: ['v1'],
    time: new Date().toISOString(),
  })
})

/* ── Flask URL Rewriting (must run before route mounts) ─── */
app.use(flaskRewrite)

/* ── v1 Routes (canonical versioned API) ──────────────────── */
app.use('/api/v1', v1Router)

/* ── Unversioned Alias (web frontend backward compat) ───── */
app.use('/api', v1Router)

/* ── Flask Compat Handlers (routes needing custom logic) ── */
app.use('/api', compatHandlers)

/* ── 404 ──────────────────────────────────────────────────── */
app.use((_, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    hint: 'Use /api/v1/{resource} — see /health for available API versions',
  })
})

/* ── Global error handler ─────────────────────────────────── */
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction,
  ) => {
    console.error('[Error]', err)
    res.status(500).json({
      success: false,
      error: err.message ?? 'Internal server error',
      code: 'INTERNAL_ERROR',
    })
  },
)

export default app
