/**
 * userFilter.ts
 *
 * Compatibility bridge between the old Flask schema and the new Node schema.
 *
 * Flask stored every document with: { owner_email: "user@gmail.com" }
 * Node stores every document with:  { user_id: ObjectId("...") }
 *
 * The $or filter lets queries find BOTH old Flask data and new Node data
 * without any migration needed.
 *
 * Usage:
 *   READ:  Model.find({ ...uf(req), semester: 1 })
 *   WRITE: Model.create({ ...ownership(req), name: "Math" })
 */

import { Types } from 'mongoose'
import type { AuthRequest } from '../middleware/auth.js'

/** Generate a MongoDB filter that matches documents by EITHER schema.
 *  IMPORTANT: user_id is cast to ObjectId so it works in both .find() AND .aggregate() */
export function uf(req: AuthRequest): Record<string, unknown> {
  const email = req.user?.email?.toLowerCase()
  const id = new Types.ObjectId(req.userId!)
  if (email) {
    return { $or: [{ user_id: id }, { owner_email: email }] }
  }
  return { user_id: id }
}

/**
 * Fields to store when CREATING a new user-owned document.
 * Stores both so the document is findable by both old and new queries.
 */
export function ownership(req: AuthRequest): { user_id: string; owner_email: string } {
  return {
    user_id: req.userId!,
    owner_email: req.user?.email?.toLowerCase() ?? '',
  }
}
