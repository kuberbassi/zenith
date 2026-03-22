import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { LRUCache } from 'lru-cache'
import { ENV } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import type { User } from '../generated/prisma/client.js'

export type ClientPlatform = 'web' | 'ios' | 'android' | 'unknown'

export interface AuthRequest extends Request {
  user?: User
  userId?: string
  /** Detected client platform (set by detectPlatform middleware) */
  platform?: ClientPlatform
  /** API version being called (e.g. 'v1') */
  apiVersion?: string
}

/* ── User cache ───────────────────────────────────────────────
 *  Caches verified JWT → user lookups for 60 seconds.
 *  Eliminates redundant DB queries for rapid-fire requests.
 * ──────────────────────────────────────────────────────────── */
const userCache = new LRUCache<string, { user: User; userId: string }>({
  max: 500,
  ttl: 60_000, // 60 s
})

function readCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (rawKey === name) return decodeURIComponent(rawValue.join('='))
  }
  return null
}

function getAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return readCookie(req, 'acadhub_access_token')
}

export function getCsrfTokenFromRequest(req: Request): string | null {
  return readCookie(req, 'acadhub_csrf_token')
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: no token' })
    return
  }

  // ── Cache hit ──
  const cached = userCache.get(token)
  if (cached) {
    req.user = cached.user
    req.userId = cached.userId
    return next()
  }

  // ── Verify + lookup ──
  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET) as { sub: string }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: user not found' })
      return
    }
    const entry = { user, userId: user.id }
    userCache.set(token, entry)
    req.user = entry.user
    req.userId = entry.userId
    next()
  } catch (error: any) {
    const code = error?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
    const message = error?.name === 'TokenExpiredError'
      ? 'Unauthorized: token expired'
      : 'Unauthorized: invalid token'
    res.status(401).json({ error: message, code })
  }
}

/** Invalidate cache for a specific token (call on logout / profile update) */
export function invalidateAuthCache(token?: string) {
  if (token) userCache.delete(token)
  else userCache.clear()
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    next()
    return
  }

  const authCookie = readCookie(req, 'acadhub_access_token')
  if (!authCookie || req.path.includes('/auth/')) {
    next()
    return
  }

  const cookieToken = readCookie(req, 'acadhub_csrf_token')
  const headerToken = String(req.headers['x-csrf-token'] ?? '').trim()
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ success: false, error: 'Invalid CSRF token', code: 'CSRF_INVALID' })
    return
  }

  next()
}
