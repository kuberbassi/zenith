import https from 'https'
import axios, { type AxiosInstance } from 'axios'
import { LRUCache } from 'lru-cache'
import { prisma } from '../config/prisma.js'

export interface IpuSession {
  client: AxiosInstance
  getCookieString: () => string
  restoreCookieString: (cookieString: string) => void
  markCaptchaIssued: () => void
  markLoginAttempt: () => void
  markLoginFailure: () => void
  markLoginSuccess: () => void
  canAttemptLogin: () => { ok: boolean; reason?: string }
  serializeState: () => {
    cookieString: string
    captchaIssuedAt: number
    attemptsForCaptcha: number
    failedLoginAttempts: number
    cooldownUntil: number
    authenticatedAt?: number
  }
  hydrateState: (state?: Partial<{
    cookieString: string
    captchaIssuedAt: number
    attemptsForCaptcha: number
    failedLoginAttempts: number
    cooldownUntil: number
    authenticatedAt?: number
  }> | null) => void
  authenticatedAt?: number
}

export type PersistedIpuSessionState = {
  cookieString: string
  captchaIssuedAt: number
  attemptsForCaptcha: number
  failedLoginAttempts: number
  cooldownUntil: number
  authenticatedAt?: number
}

const _sessions = new LRUCache<string, IpuSession>({ max: 100, ttl: 30 * 60 * 1000 })
const IPU_PREF_KEY = 'ipu_session'

export function destroyIpuSession(userId: string) {
  _sessions.delete(userId)
}

export async function loadPersistedIpuSessionState(userId: string): Promise<PersistedIpuSessionState | null> {
  const pref = await prisma.userPreference.findUnique({
    where: { user_id: userId },
    select: { preferences: true },
  })
  const preferences = (pref?.preferences ?? {}) as Record<string, unknown>
  const raw = preferences[IPU_PREF_KEY]
  if (!raw || typeof raw !== 'object') return null
  const state = raw as Record<string, unknown>
  return {
    cookieString: typeof state.cookieString === 'string' ? state.cookieString : '',
    captchaIssuedAt: Number(state.captchaIssuedAt ?? 0),
    attemptsForCaptcha: Number(state.attemptsForCaptcha ?? 0),
    failedLoginAttempts: Number(state.failedLoginAttempts ?? 0),
    cooldownUntil: Number(state.cooldownUntil ?? 0),
    authenticatedAt: state.authenticatedAt == null ? undefined : Number(state.authenticatedAt),
  }
}

export async function persistIpuSessionState(userId: string, session: IpuSession | null): Promise<void> {
  const pref = await prisma.userPreference.findUnique({
    where: { user_id: userId },
    select: { preferences: true },
  })
  const current = ((pref?.preferences ?? {}) as Record<string, unknown>) || {}
  const next: Record<string, unknown> = { ...current }

  if (session) next[IPU_PREF_KEY] = session.serializeState()
  else delete next[IPU_PREF_KEY]

  await prisma.userPreference.upsert({
    where: { user_id: userId },
    create: { user_id: userId, preferences: next as any },
    update: { preferences: next as any },
  })
}

export async function destroyIpuSessionEverywhere(userId: string) {
  destroyIpuSession(userId)
  await persistIpuSessionState(userId, null)
}

export function isIpuSessionAuthenticated(session: IpuSession | undefined) {
  if (!session?.authenticatedAt) return false
  return Date.now() - session.authenticatedAt < 10 * 60 * 1000
}

export function getOrCreateIpuSession(userId: string, headers: Record<string, string>): IpuSession {
  if (!_sessions.has(userId)) {
    const jar: Record<string, string> = {}
    let captchaIssuedAt = 0
    let attemptsForCaptcha = 0
    let failedLoginAttempts = 0
    let cooldownUntil = 0

    const client = axios.create({
      headers,
      timeout: 20_000,
      maxRedirects: 5,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    })

    client.interceptors.response.use((resp) => {
      const setCookies = resp.headers['set-cookie']
      if (setCookies) {
        for (const raw of setCookies) {
          const m = raw.match(/^([^=]+)=([^;]*)/)
          if (m) jar[m[1]] = m[2]
        }
      }
      return resp
    })

    client.interceptors.request.use((cfg) => {
      const cookieStr = Object.entries(jar)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
      if (cookieStr) cfg.headers.Cookie = cookieStr
      return cfg
    })

    const getCookieString = () =>
      Object.entries(jar)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')

    const restoreCookieString = (cookieString: string) => {
      for (const key of Object.keys(jar)) delete jar[key]
      for (const segment of String(cookieString || '').split(';')) {
        const trimmed = segment.trim()
        if (!trimmed) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx <= 0) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim()
        if (key) jar[key] = value
      }
    }

    const markCaptchaIssued = () => {
      captchaIssuedAt = Date.now()
      attemptsForCaptcha = 0
    }
    const markLoginAttempt = () => {
      attemptsForCaptcha += 1
    }
    const markLoginFailure = () => {
      failedLoginAttempts += 1
      cooldownUntil = Date.now() + 15 * 60 * 1000
    }
    const markLoginSuccess = () => {
      attemptsForCaptcha = 0
      failedLoginAttempts = 0
      cooldownUntil = 0
    }
    const canAttemptLogin = () => {
      if (cooldownUntil && Date.now() < cooldownUntil) {
        const minutesLeft = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 60000))
        return { ok: false, reason: `Login retries are paused locally to protect your IPU account. Wait about ${minutesLeft} minute(s), then fetch a fresh CAPTCHA before trying again.` }
      }
      if (!captchaIssuedAt || Date.now() - captchaIssuedAt > 5 * 60 * 1000) {
        return { ok: false, reason: 'CAPTCHA expired. Refresh it before trying again.' }
      }
      if (attemptsForCaptcha >= 1) {
        return { ok: false, reason: 'This CAPTCHA was already submitted once. Refresh it before retrying so the portal does not count repeated failures.' }
      }
      return { ok: true }
    }
    const serializeState = () => ({
      cookieString: getCookieString(),
      captchaIssuedAt,
      attemptsForCaptcha,
      failedLoginAttempts,
      cooldownUntil,
      authenticatedAt: _sessions.get(userId)?.authenticatedAt,
    })
    const hydrateState = (state?: Partial<PersistedIpuSessionState> | null) => {
      restoreCookieString(String(state?.cookieString || ''))
      captchaIssuedAt = Number(state?.captchaIssuedAt ?? 0)
      attemptsForCaptcha = Number(state?.attemptsForCaptcha ?? 0)
      failedLoginAttempts = Number(state?.failedLoginAttempts ?? 0)
      cooldownUntil = Number(state?.cooldownUntil ?? 0)
      const current = _sessions.get(userId)
      if (current) current.authenticatedAt = state?.authenticatedAt == null ? undefined : Number(state.authenticatedAt)
    }

    _sessions.set(userId, {
      client,
      getCookieString,
      restoreCookieString,
      markCaptchaIssued,
      markLoginAttempt,
      markLoginFailure,
      markLoginSuccess,
      canAttemptLogin,
      serializeState,
      hydrateState,
      authenticatedAt: undefined,
    })
  }
  return _sessions.get(userId)!
}

export async function getHydratedIpuSession(userId: string, headers: Record<string, string>, opts?: { forceFresh?: boolean }): Promise<IpuSession> {
  if (opts?.forceFresh) {
    destroyIpuSession(userId)
  }
  const session = getOrCreateIpuSession(userId, headers)
  if (opts?.forceFresh) {
    return session
  }
  const state = await loadPersistedIpuSessionState(userId)
  if (state) {
    session.hydrateState(state)
  }
  return session
}
