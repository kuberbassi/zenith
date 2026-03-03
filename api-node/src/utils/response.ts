import type { Response } from 'express'

/* ── Standard API Envelope ────────────────────────────────────
 *
 * Every response follows the same shape:
 *   {
 *     success: boolean,
 *     data?: T,
 *     error?: string,
 *     code?: string,
 *     meta?: { pagination?, timestamp, ... }
 *   }
 *
 * This is the contract that both web and mobile clients rely on.
 * ──────────────────────────────────────────────────────────── */

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export function ok<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data })
}

/** ok() with pagination metadata */
export function paginated<T>(
  res: Response,
  data: T,
  pagination: PaginationMeta,
  statusCode = 200,
) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: { pagination },
  })
}

/** Helper to build PaginationMeta from counts */
export function buildPagination(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit)
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

export function created<T>(res: Response, data: T) {
  return ok(res, data, 201)
}

export function fail(
  res: Response,
  message: string,
  code = 'ERROR',
  statusCode = 400,
) {
  return res.status(statusCode).json({ success: false, error: message, code })
}
