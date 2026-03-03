/**
 * Flask Compatibility Layer
 *
 * URL-rewriting middleware + custom handlers for legacy Flask-style flat
 * endpoints used by the mobile app (v2.x).
 *
 * How it works:
 *   1. `flaskRewrite` middleware intercepts requests at app-root level
 *   2. Rewrites Flask-style URLs (e.g. /api/dashboard_data → /api/dashboard/data)
 *   3. The existing v1 routes handle the rewritten URL — zero logic duplication
 *   4. `compatHandlers` provides actual handlers for endpoints with no v1 equivalent
 *
 * This lets the mobile app work without ANY client-side changes while
 * we migrate it to the v1 API.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { Types } from 'mongoose'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { Subject } from '../models/Subject.js'
import { AttendanceLog } from '../models/AttendanceLog.js'
import { ok, fail } from '../utils/response.js'
import { uf, ownership } from '../utils/userFilter.js'

/* ══════════════════════════════════════════════════════════════
 *  STATIC REWRITE TABLE
 *
 *  Simple path → path rewrites.  Query strings are preserved.
 * ══════════════════════════════════════════════════════════════ */

const STATIC_REWRITES: Record<string, { path: string; method?: string }> = {
  // Auth
  '/api/current_user':          { path: '/api/auth/me' },

  // Dashboard
  '/api/dashboard_data':        { path: '/api/dashboard/data' },
  '/api/reports_data':          { path: '/api/dashboard/reports_data' },

  // Attendance
  '/api/attendance_logs':       { path: '/api/attendance/logs' },
  '/api/mark_attendance':       { path: '/api/attendance/mark' },
  '/api/calendar_data':         { path: '/api/attendance/calendar_data' },
  '/api/classes_for_date':      { path: '/api/attendance/classes-for-date' },

  // Subjects (flat → academic grouped)
  '/api/full_subjects_data':    { path: '/api/academic/full_subjects_data' },

  // Analytics
  '/api/analytics/day_of_week': { path: '/api/dashboard/analytics/day-of-week' },

  // Profile
  '/api/update_profile':        { path: '/api/profile', method: 'PUT' },
  '/api/upload_pfp':            { path: '/api/profile/upload_pfp' },

  // Preferences
  '/api/preferences':           { path: '/api/profile/preferences' },

  // Holidays (only exact /api/holidays — parameterized handled below)
  '/api/holidays':              { path: '/api/timetable/holidays' },

  // Data / Backups
  '/api/backups':               { path: '/api/data/backups' },

  // System Logs
  '/api/system_logs':           { path: '/api/profile/logs' },

  // Results (only exact /api/semester_results)
  '/api/semester_results':      { path: '/api/academic/results' },

  // Courses (only exact /api/courses/manual)
  '/api/courses/manual':        { path: '/api/academic/courses/manual' },

  // Scraper / Notifications
  '/api/notices':               { path: '/api/scraper/notices' },
  '/api/notifications':         { path: '/api/dashboard/notifications' },
}

/* ══════════════════════════════════════════════════════════════
 *  PARAMETERIZED REWRITE RULES
 *
 *  For paths with dynamic segments (e.g. /api/subject_details/:id).
 *  Uses regex to extract parameters.
 * ══════════════════════════════════════════════════════════════ */

const PARAM_REWRITES: Array<{
  pattern: RegExp
  to: (match: RegExpExecArray) => string
  method?: string
}> = [
  // /api/subject_details/:id → /api/academic/subjects/:id
  {
    pattern: /^\/api\/subject_details\/([^/?]+)/,
    to: (m) => `/api/academic/subjects/${m[1]}`,
  },
  // POST /api/edit_attendance/:id → PUT /api/attendance/logs/:id
  {
    pattern: /^\/api\/edit_attendance\/([^/?]+)/,
    to: (m) => `/api/attendance/logs/${m[1]}`,
    method: 'PUT',
  },
  // /api/logs/:id → /api/attendance/logs/:id  (DELETE)
  {
    pattern: /^\/api\/logs\/([^/?]+)/,
    to: (m) => `/api/attendance/logs/${m[1]}`,
  },
  // /api/restore_backup/:id → /api/data/restore_backup/:id
  {
    pattern: /^\/api\/restore_backup\/([^/?]+)/,
    to: (m) => `/api/data/restore_backup/${m[1]}`,
  },
  // /api/semester_results/:semester → /api/academic/results/:semester
  {
    pattern: /^\/api\/semester_results\/([^/?]+)/,
    to: (m) => `/api/academic/results/${m[1]}`,
  },
  // /api/holidays/:id → /api/timetable/holidays/:id
  {
    pattern: /^\/api\/holidays\/([^/?]+)/,
    to: (m) => `/api/timetable/holidays/${m[1]}`,
  },
  // /api/courses/manual/:id → /api/academic/courses/manual/:id
  {
    pattern: /^\/api\/courses\/manual\/([^/?]+)/,
    to: (m) => `/api/academic/courses/manual/${m[1]}`,
  },
  // /api/approve_leave/:id (not implemented yet — will 404 gracefully)
  {
    pattern: /^\/api\/approve_leave\/([^/?]+)/,
    to: (m) => `/api/attendance/approve_leave/${m[1]}`,
  },
]

/* ══════════════════════════════════════════════════════════════
 *  REWRITE MIDDLEWARE
 *
 *  Mount at app root level BEFORE route mounts:
 *    app.use(flaskRewrite)
 *
 *  Works because app.use(fn) at root level preserves req.url
 *  changes across subsequent app.use() calls.
 * ══════════════════════════════════════════════════════════════ */

export function flaskRewrite(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  // Only process /api/* requests (skip /health, static, etc.)
  if (!req.url.startsWith('/api/')) { next(); return }

  // Skip already-versioned URLs (/api/v1/*, /api/v2/*)
  if (/^\/api\/v\d+\//.test(req.url)) { next(); return }

  // Split path from query string
  const qsIdx = req.url.indexOf('?')
  const path = qsIdx >= 0 ? req.url.slice(0, qsIdx) : req.url
  const queryString = qsIdx >= 0 ? req.url.slice(qsIdx) : ''

  // 1) Try static rewrite (O(1) lookup)
  const staticRule = STATIC_REWRITES[path]
  if (staticRule) {
    req.url = staticRule.path + queryString
    if (staticRule.method) req.method = staticRule.method
    next()
    return
  }

  // 2) Try parameterized rewrite (short array scan)
  for (const rule of PARAM_REWRITES) {
    const match = rule.pattern.exec(path)
    if (match) {
      req.url = rule.to(match) + queryString
      if (rule.method) req.method = rule.method
      next()
      return
    }
  }

  // 3) No rewrite — pass through unchanged
  next()
}

/* ══════════════════════════════════════════════════════════════
 *  CUSTOM HANDLERS
 *
 *  Routes that have NO v1 equivalent and need actual logic.
 *  Mount at: app.use('/api', compatHandlers)
 * ══════════════════════════════════════════════════════════════ */

export const compatHandlers = Router()

/** POST /api/mark_all_attendance — batch-mark multiple subjects at once */
compatHandlers.post('/mark_all_attendance', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { subject_ids, status, date } = req.body as {
      subject_ids: string[]
      status: string
      date: string
    }
    if (!subject_ids?.length || !status || !date) {
      fail(res, 'subject_ids, status, and date required', 'MISSING_FIELDS')
      return
    }

    const userId = new Types.ObjectId(req.userId!)
    let marked = 0

    for (const sid of subject_ids) {
      const subject = await Subject.findById(sid).lean()
      if (!subject) continue

      await AttendanceLog.create({
        ...ownership(req),
        subject_id: new Types.ObjectId(sid),
        status,
        date,
        subject_name: subject.name,
      })

      // Recompute counts
      const present = await AttendanceLog.countDocuments({
        subject_id: new Types.ObjectId(sid),
        user_id: userId,
        status: { $in: ['present', 'late'] },
      })
      const total = await AttendanceLog.countDocuments({
        subject_id: new Types.ObjectId(sid),
        user_id: userId,
        status: { $in: ['present', 'absent', 'late'] },
      })
      await Subject.updateOne({ _id: sid }, { $set: { attended: present, total } })
      marked++
    }

    ok(res, { message: `Marked ${marked} subjects`, marked })
  } catch (err) {
    console.error('[compat/mark_all_attendance]', err)
    fail(res, 'Failed to mark attendance', 'MARK_FAILED', 500)
  }
})

/** GET /api/all_semesters_overview — attendance overview across semesters */
compatHandlers.get('/all_semesters_overview', requireAuth, async (req: AuthRequest, res) => {
  try {
    const semesters: Array<Record<string, unknown>> = []

    for (let sem = 1; sem <= 8; sem++) {
      const subjects = await Subject.find({ ...uf(req), semester: sem }).lean()
      if (!subjects.length) continue

      let totalAttended = 0
      let totalClasses = 0

      for (const sub of subjects) {
        totalAttended += sub.attended ?? 0
        totalClasses += sub.total ?? 0
      }

      semesters.push({
        semester: sem,
        total_subjects: subjects.length,
        total_attended: totalAttended,
        total_classes: totalClasses,
        attendance_percentage: totalClasses > 0
          ? Math.round((totalAttended / totalClasses) * 1000) / 10
          : 0,
      })
    }

    ok(res, semesters)
  } catch (err) {
    console.error('[compat/all_semesters_overview]', err)
    fail(res, 'Failed to fetch overview', 'FETCH_FAILED', 500)
  }
})

/** Stub routes for unimplemented Flask features (return empty data) */
compatHandlers.get('/pending_leaves', requireAuth, (_req, res) => {
  ok(res, [])
})

compatHandlers.get('/unresolved_substitutions', requireAuth, (_req, res) => {
  ok(res, [])
})

compatHandlers.post('/mark_substituted', requireAuth, (_req, res) => {
  ok(res, { message: 'Substitution recorded' })
})
