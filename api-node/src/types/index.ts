/**
 * Shared Types — API-First Architecture
 *
 * Central type definitions shared across middleware, routes, and utils.
 */

import type { Request } from 'express'
import type { User } from '../generated/prisma/client.js'

/* ── Client Platform ──────────────────────────────────────── */
export type ClientPlatform = 'web' | 'ios' | 'android' | 'unknown'

/* ── Auth Request ─────────────────────────────────────────── */
export interface AuthRequest extends Request {
  user?: User
  userId?: string
  platform?: ClientPlatform
  apiVersion?: string
}

/* ── Pagination ───────────────────────────────────────────── */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

/* ── Standard API Envelope ────────────────────────────────── */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
  meta?: {
    pagination?: PaginationMeta
    platform?: ClientPlatform
    apiVersion?: string
    timestamp?: string
    [key: string]: unknown
  }
}
