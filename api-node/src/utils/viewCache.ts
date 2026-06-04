import { LRUCache } from 'lru-cache'

export type CachedViewEntry<T> = {
  data: T
  cached_at: string
  expires_at: string
}

// Global in-memory cache instance (max 1000 records, 5m default TTL)
const cache = new LRUCache<string, any>({
  max: 1000,
  ttl: 5 * 60 * 1000,
})

export function buildViewCacheId(name: string, scope: Record<string, unknown>) {
  return `${name}:${JSON.stringify(scope)}`
}

export async function readViewCache<T>(userId: string, cacheId: string): Promise<T | null> {
  const key = `${userId}:${cacheId}`
  const entry = cache.get(key)
  if (entry === undefined) return null
  return entry as T
}

export async function writeViewCache<T>(userId: string, cacheId: string, data: T, ttlMs: number): Promise<void> {
  const key = `${userId}:${cacheId}`
  cache.set(key, data, { ttl: ttlMs })
}

export async function clearUserViewCache(userId: string): Promise<void> {
  const prefix = `${userId}:`
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
}

