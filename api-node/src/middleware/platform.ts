/**
 * Platform Detection Middleware
 *
 * Detects client platform (web, ios, android) from headers/user-agent.
 * Sets req.platform for downstream route logic.
 *
 * Header priority:
 *   1. X-Platform header (explicit, mobile SDKs should set this)
 *   2. User-Agent sniffing (fallback)
 */

import type { Response, NextFunction } from 'express'
import type { AuthRequest, ClientPlatform } from '../types/index.js'

export function detectPlatform(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void {
  // 1. Explicit header (preferred — mobile app should send this)
  const header = (req.headers['x-platform'] as string || '').toLowerCase()
  if (['ios', 'android', 'web'].includes(header)) {
    req.platform = header as ClientPlatform
    next()
    return
  }

  // 2. User-Agent detection
  const ua = req.headers['user-agent'] ?? ''
  if (/expo|react.native|okhttp|darwin.*mobile/i.test(ua)) {
    if (/android/i.test(ua)) {
      req.platform = 'android'
    } else if (/iphone|ipad|darwin/i.test(ua)) {
      req.platform = 'ios'
    } else {
      req.platform = 'android' // Expo default
    }
  } else {
    req.platform = 'web'
  }

  next()
}
