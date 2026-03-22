export function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized !== '' && normalized !== '-' && normalized !== '---' && normalized.toLowerCase() !== 'null'
  }
  return true
}

export function mergePreferredRecord<T extends Record<string, unknown>>(primary: T, fallback: T): T {
  const merged: Record<string, unknown> = { ...fallback }
  for (const [key, value] of Object.entries(primary)) {
    if (isMeaningfulValue(value)) merged[key] = value
  }
  return merged as T
}
