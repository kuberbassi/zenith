import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { ENV } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { requireAuth, invalidateAuthCache, type AuthRequest } from '../middleware/auth.js'
import { ok, fail } from '../utils/response.js'

const router = Router()
const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID)

const ACCESS_COOKIE_NAME = 'zenith_access_token'
const REFRESH_COOKIE_NAME = 'zenith_refresh_token'
const CSRF_COOKIE_NAME = 'zenith_csrf_token'
const AUTH_PREF_KEY = 'auth_session'
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

type AuthSessionState = {
  refresh_token_hash?: string
  refresh_expires_at?: number
  refresh_issued_at?: number
}

function getCookieBaseOptions() {
  return {
    httpOnly: true,
    secure: ENV.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
    ...(ENV.COOKIE_DOMAIN ? { domain: ENV.COOKIE_DOMAIN } : {}),
  }
}

function setAccessCookie(res: any, token: string) {
  res.cookie(ACCESS_COOKIE_NAME, token, {
    ...getCookieBaseOptions(),
    maxAge: ACCESS_TOKEN_TTL_MS,
  })
  res.cookie(CSRF_COOKIE_NAME, crypto.randomBytes(24).toString('hex'), {
    httpOnly: false,
    secure: ENV.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
    ...(ENV.COOKIE_DOMAIN ? { domain: ENV.COOKIE_DOMAIN } : {}),
    maxAge: ACCESS_TOKEN_TTL_MS,
  })
}

function setRefreshCookie(res: any, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...getCookieBaseOptions(),
    maxAge: REFRESH_TOKEN_TTL_MS,
  })
}

function clearAuthCookies(res: any) {
  const base = {
    path: '/',
    ...(ENV.COOKIE_DOMAIN ? { domain: ENV.COOKIE_DOMAIN } : {}),
  }
  res.clearCookie(ACCESS_COOKIE_NAME, base)
  res.clearCookie(REFRESH_COOKIE_NAME, base)
  res.clearCookie(CSRF_COOKIE_NAME, base)
}

function readCookie(req: any, name: string): string | null {
  const cookieHeader = String(req.headers.cookie ?? '')
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (rawKey === name) return decodeURIComponent(rawValue.join('='))
  }
  return null
}

function signAccessToken(userId: string) {
  return jwt.sign({ sub: userId }, ENV.JWT_SECRET, { expiresIn: '15m' })
}

function hashRefreshToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function getAuthSessionState(userId: string): Promise<AuthSessionState> {
  const pref = await prisma.userPreference.findUnique({
    where: { user_id: userId },
    select: { preferences: true },
  })
  const preferences = (pref?.preferences ?? {}) as Record<string, unknown>
  const raw = preferences[AUTH_PREF_KEY]
  if (!raw || typeof raw !== 'object') return {}
  const state = raw as Record<string, unknown>
  return {
    refresh_token_hash: typeof state.refresh_token_hash === 'string' ? state.refresh_token_hash : undefined,
    refresh_expires_at: state.refresh_expires_at == null ? undefined : Number(state.refresh_expires_at),
    refresh_issued_at: state.refresh_issued_at == null ? undefined : Number(state.refresh_issued_at),
  }
}

async function persistAuthSessionState(userId: string, session: AuthSessionState | null): Promise<void> {
  const pref = await prisma.userPreference.findUnique({
    where: { user_id: userId },
    select: { preferences: true },
  })
  const current = ((pref?.preferences ?? {}) as Record<string, unknown>) || {}
  const next: Record<string, unknown> = { ...current }

  if (session) next[AUTH_PREF_KEY] = session
  else delete next[AUTH_PREF_KEY]

  await prisma.userPreference.upsert({
    where: { user_id: userId },
    create: { user_id: userId, preferences: next as any },
    update: { preferences: next as any },
  })
}

async function findUserIdByRefreshHash(refreshTokenHash: string): Promise<string | null> {
  const prefRows = await prisma.userPreference.findMany({
    select: { user_id: true, preferences: true },
  })

  for (const row of prefRows) {
    const preferences = (row.preferences ?? {}) as Record<string, unknown>
    const raw = preferences[AUTH_PREF_KEY]
    if (!raw || typeof raw !== 'object') continue
    const session = raw as Record<string, unknown>
    if (session.refresh_token_hash === refreshTokenHash) return row.user_id
  }

  return null
}

async function revokeRefreshSessionByToken(refreshToken: string | null | undefined): Promise<void> {
  if (!refreshToken) return
  const userId = await findUserIdByRefreshHash(hashRefreshToken(refreshToken))
  if (!userId) return
  await persistAuthSessionState(userId, null)
}

async function logAuthEvent(req: any, userId: string, action: string, description: string): Promise<void> {
  const ip = req.ip || req.socket?.remoteAddress || null
  const user_agent = (req.headers['user-agent'] as string) || null
  await prisma.systemLog.create({
    data: { user_id: userId, action, description, ip, user_agent },
  }).catch(() => null)
}

async function issueAuthSession(res: any, userId: string): Promise<void> {
  const accessToken = signAccessToken(userId)
  const refreshToken = crypto.randomBytes(48).toString('hex')
  const now = Date.now()

  await persistAuthSessionState(userId, {
    refresh_token_hash: hashRefreshToken(refreshToken),
    refresh_expires_at: now + REFRESH_TOKEN_TTL_MS,
    refresh_issued_at: now,
  })

  setAccessCookie(res, accessToken)
  setRefreshCookie(res, refreshToken)
}

function userResponse(user: Awaited<ReturnType<typeof prisma.user.findUniqueOrThrow>>) {
  return {
    _id: user.id,
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    course: user.course,
    branch: user.branch,
    college: user.college,
    semester: user.current_semester,
    batch: user.batch,
    enrollment_number: user.enrollment_number,
    current_semester: user.current_semester,
    target_attendance: user.target_attendance,
    attendance_threshold: user.attendance_threshold,
    warning_threshold: user.warning_threshold,
    phone_number: user.phone_number,
    headline: user.headline,
    linkedin_url: user.linkedin_url,
    github_url: user.github_url,
    portfolio_url: user.portfolio_url,
    created_at: user.created_at,
  }
}

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body as { credential: string }
    if (!credential) {
      fail(res, 'credential is required', 'MISSING_FIELD')
      return
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: ENV.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    if (!payload?.sub) {
      fail(res, 'Invalid Google token', 'INVALID_TOKEN', 401)
      return
    }

    const { sub: google_id, email, name, picture } = payload
    let user = await prisma.user.findUnique({ where: { email: email! } })

    if (user) {
      user = await prisma.user.update({
        where: { email: email! },
        data: { google_id, name: name!, picture },
      })
    } else {
      const existingByGoogle = await prisma.user.findUnique({ where: { google_id } })
      if (existingByGoogle) {
        user = await prisma.user.update({
          where: { google_id },
          data: { email: email!, name: name!, picture },
        })
      } else {
        user = await prisma.user.create({
          data: { google_id, email: email!, name: name!, picture },
        })
      }
    }

    await issueAuthSession(res, user.id)
    void logAuthEvent(req, user.id, 'auth_login', 'Signed in with Google OAuth')
    ok(res, { user: userResponse(user) })
  } catch (err) {
    console.error('[auth/google]', err)
    fail(res, 'Authentication failed', 'AUTH_FAILED', 500)
  }
})

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = readCookie(req, REFRESH_COOKIE_NAME)
    if (!refreshToken) {
      clearAuthCookies(res)
      return fail(res, 'Refresh token missing', 'REFRESH_MISSING', 401)
    }

    const userId = await findUserIdByRefreshHash(hashRefreshToken(refreshToken))
    if (!userId) {
      clearAuthCookies(res)
      return fail(res, 'Refresh token invalid', 'REFRESH_INVALID', 401)
    }

    const session = await getAuthSessionState(userId)
    if (!session.refresh_expires_at || session.refresh_expires_at < Date.now()) {
      await persistAuthSessionState(userId, null)
      clearAuthCookies(res)
      return fail(res, 'Refresh token expired', 'REFRESH_EXPIRED', 401)
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      await persistAuthSessionState(userId, null)
      clearAuthCookies(res)
      return fail(res, 'Refresh user not found', 'REFRESH_INVALID', 401)
    }

    await issueAuthSession(res, user.id)
    void logAuthEvent(req, user.id, 'auth_refresh', 'Rotated web refresh token')
    ok(res, { user: userResponse(user) })
  } catch (err) {
    console.error('[auth/refresh]', err)
    fail(res, 'Refresh failed', 'REFRESH_FAILED', 500)
  }
})

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  const authHeader = req.headers.authorization
  if (!req.headers.cookie && authHeader?.startsWith('Bearer ')) {
    setAccessCookie(res, authHeader.slice(7))
  }
  ok(res, userResponse(req.user!))
})

router.get('/debug_db', requireAuth, async (req: AuthRequest, res) => {
  if (ENV.NODE_ENV === 'production') {
    fail(res, 'Not available', 'FORBIDDEN', 403)
    return
  }
  try {
    const [subjectCount, samples] = await Promise.all([
      prisma.subject.count({ where: { user_id: req.userId! } }),
      prisma.subject.findMany({ where: { user_id: req.userId! }, take: 5 }),
    ])
    res.json({ subjects_count: subjectCount, sample_subjects: samples })
  } catch (err) {
    console.error('[auth/debug_db]', err)
    fail(res, String(err), 'DB_ERROR', 500)
  }
})

router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.slice(7)
  if (token) invalidateAuthCache(token)
  const refreshToken = readCookie(req, REFRESH_COOKIE_NAME)
  const userId = refreshToken ? await findUserIdByRefreshHash(hashRefreshToken(refreshToken)).catch(() => null) : null
  await revokeRefreshSessionByToken(refreshToken).catch(() => null)
  if (userId) {
    void logAuthEvent(req, userId, 'auth_logout', 'Signed out from web session')
  }
  clearAuthCookies(res)
  ok(res, { message: 'Logged out' })
})

export default router
