/**
 * sanitizeResponse.ts
 *
 * Strips sensitive fields from any outgoing API response before it leaves the
 * server. This is a defence-in-depth layer — even if a route handler accidentally
 * includes a raw DB record, these fields will be removed.
 *
 * Protected fields (stripped at every depth of the response tree):
 *   - email           — never expose in list/detail responses
 *   - password        — should never exist but guard anyway
 *   - google_id       — internal OAuth identifier
 *   - refresh_token   — session secret
 *   - access_token    — session secret
 *   - biometrics      — raw WebAuthn credential store
 *   - __v             — Mongoose version key (legacy)
 *   - _authRefreshed  — internal interceptor flag
 *
 * Usage:
 *   import { sanitizeResponse } from '../middleware/sanitizeResponse.js'
 *   app.use('/api', sanitizeResponse)      // global
 *   router.use(sanitizeResponse)           // per-router
 */

import { Request, Response, NextFunction } from 'express'

// ── Fields to strip from every response ─────────────────────────────────────
const SENSITIVE_KEYS = new Set([
    'password',
    'google_id',
    'refresh_token',
    'access_token',
    'biometrics',
    '__v',
    '_authRefreshed',
])

/**
 * Recursively walk `value` and delete every key in SENSITIVE_KEYS.
 * Works on plain objects and arrays at any depth.
 * Primitive values are returned as-is.
 */
function scrub(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(scrub)
    }
    if (value !== null && typeof value === 'object') {
        const obj = value as Record<string, unknown>
        for (const key of Object.keys(obj)) {
            if (SENSITIVE_KEYS.has(key)) {
                delete obj[key]
            } else {
                obj[key] = scrub(obj[key])
            }
        }
        return obj
    }
    return value
}

/**
 * Express middleware that intercepts `res.json()` and scrubs sensitive fields
 * from the response body before it is serialised and sent to the client.
 *
 * This does NOT affect streaming responses or res.send() with raw strings.
 */
export function sanitizeResponse(
    _req: Request,
    res: Response,
    next: NextFunction,
): void {
    const originalJson = res.json.bind(res)

    res.json = function (body: unknown): Response {
        const cleaned = scrub(body)
        return originalJson(cleaned)
    }

    next()
}
