import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import compression from 'compression'
import { ENV } from './config/env.js'
import { requireCsrf } from './middleware/auth.js'
import { detectPlatform } from './middleware/platform.js'
import { flaskRewrite, compatHandlers } from './routes/compat.js'
import docsRoutes from './routes/docs.js'
import v1Router from './routes/v1.js'
import { xssSanitize } from './middleware/xss.js'

const app = express()

/* ── Trust Proxy ──────────────────────────────────────────── */
// Required behind reverse proxies (Vercel, Render, etc.) so rate
// limiting keys on the real client IP, not the proxy's IP.
app.set('trust proxy', 1)

/* ── Security ─────────────────────────────────────────────── */
app.use(helmet())
app.use(
  cors({
    origin: ENV.ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

/* ── Rate Limiting ────────────────────────────────────────── */

/** Global API limiter — 100 req / 1 min per IP */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later.', code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
})

/** Strict limiter for heavy / sensitive operations — 10 req / 1 min per IP */
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Rate limit exceeded for heavy operations. Please wait.', code: 'STRICT_RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
})

/** AI limiter — keeps expensive chat completions under control */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  message: { success: false, error: 'AI request limit reached. Please wait before sending another prompt.', code: 'AI_RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
})

/** Rate limiter for PDF upload result parser - 5 req / 1 min per IP */
const pdfUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, error: 'Rate limit exceeded for PDF parsing. Please wait.', code: 'PDF_RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Apply global protection to all /api/* routes
app.use('/api', apiLimiter)

// Aggressively protect scraper + auth (applied before route mounts)
app.use('/api/v1/ipu', strictLimiter)
app.use('/api/ipu', strictLimiter)
app.use('/api/v1/auth', strictLimiter)
app.use('/api/auth', strictLimiter)
app.use('/api/v1/ai', aiLimiter)
app.use('/api/ai', aiLimiter)
app.use('/api/v1/academic/results/parse-pdf', pdfUploadLimiter)
app.use('/api/academic/results/parse-pdf', pdfUploadLimiter)

/* ── Compression ─────────────────────────────────────────── */
app.use(compression({ threshold: 1024 })) // skip tiny responses

/* ── Body Parsing ────────────────────────────────────────── */
app.use('/api/data/import_data', express.json({ limit: '10mb' }))
app.use('/api/v1/data/import_data', express.json({ limit: '10mb' }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(xssSanitize)
if (ENV.NODE_ENV === 'development') {
  app.use(morgan('dev'))
} else if (ENV.NODE_ENV !== 'test') {
  app.use(morgan('short'))
}

/* ── Platform Detection ──────────────────────────────────── */
app.use(detectPlatform)
app.use('/api', requireCsrf)

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
const healthResponse = (_: unknown, res: express.Response) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    api_versions: ['v1'],
    time: new Date().toISOString(),
  })
}
app.get('/health', healthResponse)
// Also at /api/health so Vercel serverless (api/ catch-all) can serve it
app.get('/api/health', healthResponse)
app.use('/api/docs', docsRoutes)

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
