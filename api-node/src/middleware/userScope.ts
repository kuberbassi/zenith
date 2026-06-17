/**
 * userScope.ts
 *
 * Strict user-ownership enforcement middleware.
 *
 * Problem: Even with JWT auth, a compromised or forged token could try to pass
 * a different user_id in the request body/query and access another user's data.
 *
 * Solution: After requireAuth populates req.userId from the verified JWT, this
 * middleware hard-overwrites any user_id / userId fields in body and query with
 * the authenticated user's ID. Route handlers should always use req.userId —
 * never trust req.body.user_id.
 *
 * Additionally, if the request body contains a `userId` or `user_id` field that
 * does NOT match the authenticated user, the request is rejected with 403.
 *
 * Apply after requireAuth on any route that touches user data:
 *   router.use(requireAuth, enforceUserScope)
 */

import { Response, NextFunction } from 'express'
import type { AuthRequest } from './auth.js'

export function enforceUserScope(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): void {
    const authenticatedId = req.userId

    // requireAuth must run before this middleware
    if (!authenticatedId) {
        res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' })
        return
    }

    // ── Detect and reject cross-user injection attempts ──────────────────────
    const bodyId  = (req.body as Record<string, unknown>)?.user_id
               ?? (req.body as Record<string, unknown>)?.userId
    const queryId = req.query?.user_id ?? req.query?.userId

    if (bodyId && String(bodyId) !== authenticatedId) {
        res.status(403).json({
            success: false,
            error:   'Forbidden: user_id mismatch',
            code:    'USER_SCOPE_VIOLATION',
        })
        return
    }

    if (queryId && String(queryId) !== authenticatedId) {
        res.status(403).json({
            success: false,
            error:   'Forbidden: user_id mismatch in query',
            code:    'USER_SCOPE_VIOLATION',
        })
        return
    }

    // ── Hard-pin the user_id in body and query ────────────────────────────────
    // Prevents route handlers from accidentally reading a spoofed value.
    if (req.body && typeof req.body === 'object') {
        delete (req.body as Record<string, unknown>).user_id
        delete (req.body as Record<string, unknown>).userId
    }
    if (req.query) {
        delete req.query.user_id
        delete req.query.userId
    }

    // The route handler MUST use req.userId — which is immutably set by requireAuth
    next()
}
