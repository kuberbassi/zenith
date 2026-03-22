import { prisma } from '../config/prisma.js'

export type CachedViewEntry<T> = {
  data: T
  cached_at: string
  expires_at: string
}

const VIEW_CACHE_KEY = 'view_cache'

export function buildViewCacheId(name: string, scope: Record<string, unknown>) {
  return `${name}:${JSON.stringify(scope)}`
}

export async function readViewCache<T>(userId: string, cacheId: string): Promise<T | null> {
  const pref = await prisma.userPreference.findUnique({
    where: { user_id: userId },
    select: { preferences: true },
  })
  const prefs = ((pref?.preferences ?? {}) as Record<string, unknown>) || {}
  const root = (prefs[VIEW_CACHE_KEY] as Record<string, unknown> | undefined) || {}
  const entry = root[cacheId] as CachedViewEntry<T> | undefined
  if (!entry?.expires_at) return null
  if (Date.now() > new Date(entry.expires_at).getTime()) return null
  return entry.data ?? null
}

export async function writeViewCache<T>(userId: string, cacheId: string, data: T, ttlMs: number): Promise<void> {
  const pref = await prisma.userPreference.findUnique({
    where: { user_id: userId },
    select: { preferences: true },
  })
  const prefs = ((pref?.preferences ?? {}) as Record<string, unknown>) || {}
  const existingRoot = (prefs[VIEW_CACHE_KEY] as Record<string, unknown> | undefined) || {}
  const now = Date.now()
  const nextRoot: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(existingRoot)) {
    const expiresAt = new Date(String((value as any)?.expires_at || 0)).getTime()
    if (expiresAt > now) nextRoot[key] = value
  }

  nextRoot[cacheId] = {
    data,
    cached_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttlMs).toISOString(),
  }

  await prisma.userPreference.upsert({
    where: { user_id: userId },
    create: { user_id: userId, preferences: { ...prefs, [VIEW_CACHE_KEY]: nextRoot } as any },
    update: { preferences: { ...prefs, [VIEW_CACHE_KEY]: nextRoot } as any },
  })
}

export async function clearUserViewCache(userId: string) {
  const existing = await prisma.userPreference.findUnique({
    where: { user_id: userId },
    select: { preferences: true },
  })
  if (!existing?.preferences) return
  const prefs = { ...(existing.preferences as Record<string, unknown>) }
  if (!(VIEW_CACHE_KEY in prefs)) return
  delete prefs[VIEW_CACHE_KEY]
  await prisma.userPreference.update({
    where: { user_id: userId },
    data: { preferences: prefs as any },
  })
}
