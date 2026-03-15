/**
 * userFilter.ts
 *
 * Prisma-compatible user filter helpers.
 * All records are keyed by string user_id (Prisma cuid).
 */

import type { AuthRequest } from '../middleware/auth.js'

/** Returns a Prisma where-clause that matches documents by user_id. */
export function uf(req: AuthRequest): { user_id: string } {
  return { user_id: req.userId! }
}

/** Fields to store when CREATING a new user-owned document. */
export function ownership(req: AuthRequest): { user_id: string } {
  return { user_id: req.userId! }
}
