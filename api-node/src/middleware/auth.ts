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

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: no token' })
    return
  }

  const token = authHeader.slice(7)

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
  } catch {
    res.status(401).json({ error: 'Unauthorized: invalid token' })
  }
}

/** Invalidate cache for a specific token (call on logout / profile update) */
export function invalidateAuthCache(token?: string) {
  if (token) userCache.delete(token)
  else userCache.clear()
}
