import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { LRUCache } from 'lru-cache'
import { ENV } from '../config/env.js'
import { User, type IUser } from '../models/User.js'

export type ClientPlatform = 'web' | 'ios' | 'android' | 'unknown'

export interface AuthRequest extends Request {
  user?: IUser
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
const userCache = new LRUCache<string, { user: IUser; userId: string }>({
  max: 500,
  ttl: 60_000, // 60 s
})

/** Projection — only fetch fields routes actually use */
const USER_SELECT = 'name email picture semester current_semester college batch course branch attendance_threshold warning_threshold owner_email preferences google_id enrollment_number target_attendance created_at phone_number headline linkedin_url github_url portfolio_url'

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
    const user = await User.findById(payload.sub).select(USER_SELECT).lean()
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: user not found' })
      return
    }
    const entry = { user: user as unknown as IUser, userId: user._id.toString() }
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
