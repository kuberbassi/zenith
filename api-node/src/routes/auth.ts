import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { ENV } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { requireAuth, invalidateAuthCache, type AuthRequest } from '../middleware/auth.js'
import { ok, fail } from '../utils/response.js'
import { getClientIp } from '../utils/ip.js'
import { triggerAutoBackupIfNeeded } from '../utils/googleDrive.js'
import { encryptSecret } from '../utils/secrets.js'

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

type AuthSession = {
  id: string
  device_id?: string | null
  refresh_token_hash: string
  refresh_expires_at: number
  refresh_issued_at: number
  ip?: string | null
  user_agent?: string | null
  last_active_at: number
}

const AUTH_SESSIONS_KEY = 'auth_sessions'

async function getAuthSessions(userId: string): Promise<AuthSession[]> {
  const pref = await prisma.userPreference.findUnique({
    where: { user_id: userId },
    select: { preferences: true },
  })
  const preferences = (pref?.preferences ?? {}) as Record<string, unknown>
  let sessions: AuthSession[] = []

  const rawSessions = preferences[AUTH_SESSIONS_KEY]
  if (Array.isArray(rawSessions)) {
    sessions = rawSessions as AuthSession[]
  } else {
    // Migrate legacy single session
    const oldSession = preferences[AUTH_PREF_KEY] as Record<string, unknown> | undefined
    if (oldSession && typeof oldSession === 'object' && oldSession.refresh_token_hash) {
      sessions = [{
        id: crypto.randomBytes(16).toString('hex'),
        refresh_token_hash: String(oldSession.refresh_token_hash),
        refresh_expires_at: Number(oldSession.refresh_expires_at ?? (Date.now() + REFRESH_TOKEN_TTL_MS)),
        refresh_issued_at: Number(oldSession.refresh_issued_at ?? Date.now()),
        last_active_at: Date.now(),
      }]
    }
  }

  const now = Date.now()
  const activeSessions = sessions.filter(s => s.refresh_expires_at > now)

  // Deduplicate active sessions on the fly by device_id (or user_agent + ip if device_id is missing)
  const seenDevices = new Set<string>()
  const seenUaIp = new Set<string>()
  const deduplicated: AuthSession[] = []

  for (const s of activeSessions) {
    if (s.device_id) {
      if (seenDevices.has(s.device_id)) continue
      seenDevices.add(s.device_id)
    } else if (s.user_agent && s.ip) {
      const key = `${s.user_agent}-${s.ip}`
      if (seenUaIp.has(key)) continue
      seenUaIp.add(key)
    }
    deduplicated.push(s)
  }

  if (deduplicated.length !== sessions.length || (!rawSessions && sessions.length > 0)) {
    await persistAuthSessions(userId, deduplicated)
  }

  return deduplicated
}

async function persistAuthSessions(userId: string, sessions: AuthSession[]): Promise<void> {
  const pref = await prisma.userPreference.findUnique({
    where: { user_id: userId },
    select: { preferences: true },
  })
  const current = ((pref?.preferences ?? {}) as Record<string, unknown>) || {}
  const next = { ...current }
  next[AUTH_SESSIONS_KEY] = sessions
  delete next[AUTH_PREF_KEY] // Clear legacy single session key

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
    const rawSessions = preferences[AUTH_SESSIONS_KEY]
    if (Array.isArray(rawSessions)) {
      const found = (rawSessions as AuthSession[]).some(s => s.refresh_token_hash === refreshTokenHash)
      if (found) return row.user_id
    } else {
      const oldSession = preferences[AUTH_PREF_KEY] as Record<string, unknown> | undefined
      if (oldSession && oldSession.refresh_token_hash === refreshTokenHash) {
        return row.user_id
      }
    }
  }

  return null
}

async function revokeRefreshSessionByToken(refreshToken: string | null | undefined): Promise<void> {
  if (!refreshToken) return
  const hash = hashRefreshToken(refreshToken)
  const userId = await findUserIdByRefreshHash(hash)
  if (!userId) return

  const sessions = await getAuthSessions(userId)
  const updated = sessions.filter(s => s.refresh_token_hash !== hash)
  await persistAuthSessions(userId, updated)
}

async function logAuthEvent(req: any, userId: string, action: string, description: string): Promise<void> {
  const ip = getClientIp(req)
  const user_agent = (req.headers['user-agent'] as string) || null
  await prisma.systemLog.create({
    data: { user_id: userId, action, description, ip, user_agent },
  }).catch(() => null)
}

async function issueAuthSession(req: any, res: any, userId: string, replaceOldHash?: string): Promise<void> {
  const accessToken = signAccessToken(userId)
  const refreshToken = crypto.randomBytes(48).toString('hex')
  const now = Date.now()

  const ip = getClientIp(req)
  const user_agent = (req.headers['user-agent'] as string) || null
  const deviceId = (req.headers['x-device-id'] as string) || null

  const sessions = await getAuthSessions(userId)
  let filtered = replaceOldHash ? sessions.filter(s => s.refresh_token_hash !== replaceOldHash) : sessions
  if (deviceId) {
    filtered = filtered.filter(s => s.device_id !== deviceId)
  } else if (user_agent && ip) {
    filtered = filtered.filter(s => !(s.user_agent === user_agent && s.ip === ip))
  }

  const newSession: AuthSession = {
    id: crypto.randomBytes(16).toString('hex'),
    device_id: deviceId,
    refresh_token_hash: hashRefreshToken(refreshToken),
    refresh_expires_at: now + REFRESH_TOKEN_TTL_MS,
    refresh_issued_at: now,
    last_active_at: now,
    ip,
    user_agent,
  }

  const updated = [...filtered, newSession]
    .sort((a, b) => b.last_active_at - a.last_active_at)
    .slice(0, 10) // Cap active sessions at 10

  await persistAuthSessions(userId, updated)

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
        data: { google_id, name: name!, picture: user.picture || picture },
      })
    } else {
      const existingByGoogle = await prisma.user.findUnique({ where: { google_id } })
      if (existingByGoogle) {
        user = await prisma.user.update({
          where: { google_id },
          data: { email: email!, name: name!, picture: existingByGoogle.picture || picture },
        })
      } else {
        user = await prisma.user.create({
          data: { google_id, email: email!, name: name!, picture },
        })
      }
    }

    await issueAuthSession(req, res, user.id)
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

    const hash = hashRefreshToken(refreshToken)
    const userId = await findUserIdByRefreshHash(hash)
    if (!userId) {
      clearAuthCookies(res)
      return fail(res, 'Refresh token invalid', 'REFRESH_INVALID', 401)
    }

    const sessions = await getAuthSessions(userId)
    const activeSession = sessions.find(s => s.refresh_token_hash === hash)
    if (!activeSession) {
      clearAuthCookies(res)
      return fail(res, 'Refresh session not found', 'REFRESH_INVALID', 401)
    }

    if (activeSession.refresh_expires_at < Date.now()) {
      await persistAuthSessions(userId, sessions.filter(s => s.refresh_token_hash !== hash))
      clearAuthCookies(res)
      return fail(res, 'Refresh token expired', 'REFRESH_EXPIRED', 401)
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      await persistAuthSessions(userId, sessions.filter(s => s.refresh_token_hash !== hash))
      clearAuthCookies(res)
      return fail(res, 'Refresh user not found', 'REFRESH_INVALID', 401)
    }

    await issueAuthSession(req, res, user.id, hash)
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
  
  // Lazy trigger background backup if Drive is enabled & scheduled
  void triggerAutoBackupIfNeeded(req.userId!).catch(() => null)

  ok(res, userResponse(req.user!))
})

router.post('/google/link-drive', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code, redirectUri } = req.body
    if (!code) {
      fail(res, 'Authorization code is required', 'MISSING_CODE')
      return
    }

    const redirect = redirectUri || 'postmessage'

    if (!ENV.GOOGLE_CLIENT_SECRET) {
      fail(
        res,
        'Google Drive linking is not configured. Set GOOGLE_CLIENT_SECRET for the API server and restart it.',
        'GOOGLE_SECRET_MISSING',
        500
      )
      return
    }

    // Google API requires a client secret for offline access exchange
    const exchangeClient = new OAuth2Client(
      ENV.GOOGLE_CLIENT_ID,
      ENV.GOOGLE_CLIENT_SECRET,
      redirect
    )

    const { tokens } = await exchangeClient.getToken(code)

    if (!tokens.refresh_token) {
      console.warn('[Google Drive] Code flow did not return a refresh token for user:', req.userId)
    }

    const pref = await prisma.userPreference.findUnique({
      where: { user_id: req.userId! }
    })
    
    const current = (pref?.preferences ?? {}) as Record<string, any>
    const nextPrefs = {
      ...current,
      google_drive_linked: true,
      google_drive_refresh_token: tokens.refresh_token
        ? encryptSecret(tokens.refresh_token)
        : current.google_drive_refresh_token,
      google_drive_backup_frequency: current.google_drive_backup_frequency || 'daily',
      google_drive_last_backup: current.google_drive_last_backup || null
    }

    await prisma.userPreference.upsert({
      where: { user_id: req.userId! },
      create: { user_id: req.userId!, preferences: nextPrefs as any },
      update: { preferences: nextPrefs as any }
    })

    ok(res, { 
      message: 'Google Drive connected successfully.',
      has_refresh_token: !!(tokens.refresh_token || current.google_drive_refresh_token)
    })
  } catch (err) {
    console.error('[auth/google/link-drive]', err)
    fail(res, 'Failed to link Google Drive', 'LINK_FAILED', 500)
  }
})

// ─── Active Sessions Management ────────────────────────────────────────────────

router.get('/sessions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const sessions = await getAuthSessions(userId)
    
    const currentRefreshToken = readCookie(req, REFRESH_COOKIE_NAME)
    const currentHash = currentRefreshToken ? hashRefreshToken(currentRefreshToken) : null

    const payload = sessions.map(s => ({
      id: s.id,
      device_id: s.device_id || null,
      ip: s.ip || 'Unknown',
      user_agent: s.user_agent || 'Unknown',
      refresh_issued_at: s.refresh_issued_at,
      last_active_at: s.last_active_at,
      is_current: s.refresh_token_hash === currentHash,
    }))

    ok(res, payload)
  } catch (err) {
    console.error('[auth/sessions GET]', err)
    fail(res, 'Failed to fetch sessions', 'FETCH_FAILED', 500)
  }
})

router.delete('/sessions/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const sessionId = req.params.id
    const sessions = await getAuthSessions(userId)
    const sessionToRevoke = sessions.find(s => s.id === sessionId)
    if (!sessionToRevoke) {
      fail(res, 'Session not found', 'NOT_FOUND', 404)
      return
    }

    const updated = sessions.filter(s => s.id !== sessionId)
    await persistAuthSessions(userId, updated)
    
    void logAuthEvent(req, userId, 'auth_revoke_session', `Revoked device session: ${sessionToRevoke.user_agent || 'Unknown'}`)
    ok(res, { message: 'Session revoked successfully' })
  } catch (err) {
    console.error('[auth/sessions DELETE]', err)
    fail(res, 'Failed to revoke session', 'REVOKE_FAILED', 500)
  }
})

router.delete('/sessions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const currentRefreshToken = readCookie(req, REFRESH_COOKIE_NAME)
    const currentHash = currentRefreshToken ? hashRefreshToken(currentRefreshToken) : null

    const sessions = await getAuthSessions(userId)
    const currentSession = sessions.find(s => s.refresh_token_hash === currentHash)
    const updated = currentSession ? [currentSession] : []
    await persistAuthSessions(userId, updated)
    
    void logAuthEvent(req, userId, 'auth_revoke_other_sessions', 'Revoked all other active sessions')
    ok(res, { message: 'All other sessions revoked successfully' })
  } catch (err) {
    console.error('[auth/sessions/all DELETE]', err)
    fail(res, 'Failed to revoke other sessions', 'REVOKE_FAILED', 500)
  }
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
