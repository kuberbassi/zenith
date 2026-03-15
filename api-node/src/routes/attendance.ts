import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { ok, created, fail } from '../utils/response.js'

const router = Router()
router.use(requireAuth)

const COUNTED_STATUSES = ['present', 'absent', 'late', 'approved_medical', 'medical', 'duty']
const ATTENDED_STATUSES = ['present', 'late', 'approved_medical', 'medical', 'duty']

async function sysLog(req: AuthRequest, user_id: string, action: string, description: string) {
  const ip = req.ip || req.socket?.remoteAddress || null
  const user_agent = (req.headers['user-agent'] as string) || null
  await prisma.systemLog.create({ data: { user_id, action, description, ip, user_agent } }).catch(() => null)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseTimeToMinutes(raw: string): number {
  const input = String(raw ?? '').trim()
  if (!input) return Number.MAX_SAFE_INTEGER
  const m = input.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!m) return Number.MAX_SAFE_INTEGER
  let hours = parseInt(m[1], 10)
  const minutes = parseInt(m[2], 10)
  const ampm = m[3].toUpperCase()
  if (ampm === 'PM' && hours < 12) hours += 12
  if (ampm === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

function buildSemesterAwareAttendanceFilter(semester: number) {
  return {
    OR: [
      { semester },
      { semester: null },
      { subject: { is: { semester } } },
    ],
  }
}

function getSlotType(slot: Record<string, unknown>): string {
  const explicit = String(slot.type ?? '').trim().toLowerCase()
  if (explicit) return explicit

  const hasSubjectRef = String(slot.subject_id ?? slot.subjectId ?? '').trim().length > 0
  const hasLabel = String(slot.label ?? slot.name ?? '').trim().length > 0
  if (!hasSubjectRef && hasLabel) return 'custom'

  return 'class'
}

function scoreScheduleBySubjects(schedule: unknown, subjectIds: Set<string>): number {
  if (!schedule || typeof schedule !== 'object') return 0
  let score = 0
  for (const slots of Object.values(schedule as Record<string, unknown>)) {
    if (!Array.isArray(slots)) continue
    for (const rawSlot of slots) {
      if (!rawSlot || typeof rawSlot !== 'object') continue
      const slot = rawSlot as Record<string, unknown>
      const slotType = getSlotType(slot)
      if (slotType !== 'class') continue
      const subjectRef = String(slot.subject_id ?? slot.subjectId ?? '').trim()
      if (subjectRef && subjectIds.has(subjectRef)) score++
    }
  }
  return score
}

async function recomputeSubjectStats(subjectId: string, userId: string): Promise<void> {
  const [total, attended] = await Promise.all([
    prisma.attendanceLog.count({ where: { subject_id: subjectId, user_id: userId, status: { in: COUNTED_STATUSES as any[] } } }),
    prisma.attendanceLog.count({ where: { subject_id: subjectId, user_id: userId, status: { in: ATTENDED_STATUSES as any[] } } }),
  ])
  await prisma.subject.update({ where: { id: subjectId }, data: { attended, total } })
}

// ─── schemas ──────────────────────────────────────────────────────────────────

const MarkSchema = z.object({
  subject_id: z.string().min(1),
  status: z.enum(['present', 'absent', 'late', 'approved_medical', 'medical', 'duty', 'substituted', 'cancelled']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  semester: z.number().int().min(1).max(12).optional(),
  substituted_by: z.string().min(1).optional(),
})

const EditLogSchema = z.object({
  status: z.enum(['present', 'absent', 'late', 'approved_medical', 'medical', 'duty', 'substituted', 'cancelled']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  substituted_by: z.string().min(1).optional(),
})

const LogsQuerySchema = z.object({
  limit: z.string().optional().transform(v => Math.min(parseInt(v ?? '50', 10), 500)),
  page: z.string().optional().transform(v => Math.max(parseInt(v ?? '1', 10), 1)),
  subject_id: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  semester: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : undefined),
  status: z.enum(['present', 'absent', 'late', 'approved_medical', 'medical', 'duty', 'substituted', 'cancelled']).optional(),
})

// ─── POST /mark ───────────────────────────────────────────────────────────────

router.post('/mark', async (req: AuthRequest, res) => {
  try {
    const body = MarkSchema.parse(req.body)
    const userId = req.userId!
    const subjectId = body.subject_id
    const markDate = body.date ?? today()
    const logType = body.type ?? 'Lecture'

    const subject = await prisma.subject.findFirst({ where: { id: subjectId, user_id: userId } })
    if (!subject) { fail(res, 'Subject not found', 'NOT_FOUND', 404); return }

    const semester = body.semester ?? subject.semester ?? (req as any).user?.current_semester ?? 1

    // Check for duplicate using compound unique key
    const existing = await prisma.attendanceLog.findUnique({
      where: { user_id_subject_id_date_type: { user_id: userId, subject_id: subjectId, date: markDate, type: logType } },
    })

    if (existing) {
      const updatedSubject = await prisma.subject.findUnique({ where: { id: subjectId } })
      created(res, { log: { ...existing, _id: existing.id }, subject: updatedSubject ? { ...updatedSubject, _id: updatedSubject.id } : null, duplicate: true })
      return
    }

      const log = await prisma.attendanceLog.create({
        data: {
          user_id: userId,
          subject_id: subjectId,
          subject_name: subject.name,
          date: markDate,
          status: body.status as any,
          type: logType,
          semester,
          notes: body.notes ?? '',
          substituted_by: body.substituted_by || null,
        },
      })

      let substituteLog = null
      if (body.status === 'substituted' && body.substituted_by) {
        const subById = body.substituted_by
        const subSubject = await prisma.subject.findFirst({ where: { id: subById, user_id: userId } })
        if (subSubject) {
          const existingSubLog = await prisma.attendanceLog.findFirst({
            where: { user_id: userId, subject_id: subById, date: markDate, type: 'substitution_class' },
          })
          if (!existingSubLog) {
            substituteLog = await prisma.attendanceLog.create({
              data: {
                user_id: userId,
                subject_id: subById,
                subject_name: subSubject.name,
                date: markDate,
                status: 'present',
                type: 'substitution_class',
                notes: `Substitution for ${subject.name}`,
                semester,
              },
            })
          } else {
            substituteLog = existingSubLog
          }
          await recomputeSubjectStats(subById, userId)
        }
      }

      await recomputeSubjectStats(subjectId, userId)

    const updatedSubject = await prisma.subject.findUnique({ where: { id: subjectId } })
    sysLog(req, userId, 'Attendance Marked', `Marked ${subject.name} as ${body.status} on ${markDate}`).catch(() => { })

    created(res, {
      log: { ...log, _id: log.id },
      substitute_log: substituteLog ? { ...substituteLog, _id: substituteLog.id } : null,
      subject: updatedSubject ? { ...updatedSubject, _id: updatedSubject.id } : null,
    })
  } catch (err) {
    if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
    console.error('[attendance/mark]', err)
    fail(res, 'Failed to mark attendance', 'SERVER_ERROR', 500)
  }
})

// ─── GET /logs ────────────────────────────────────────────────────────────────

router.get('/logs', async (req: AuthRequest, res) => {
  try {
    const query = LogsQuerySchema.parse(req.query)
    const { limit, page, subject_id, date, start_date, end_date, semester, status } = query
    const userId = req.userId!

    const where: any = { user_id: userId }
    if (subject_id) where.subject_id = subject_id
    if (date) {
      where.date = date
    } else if (start_date || end_date) {
      where.date = { ...(start_date ? { gte: start_date } : {}), ...(end_date ? { lte: end_date } : {}) }
    }
    if (semester !== undefined) {
      where.AND = [buildSemesterAwareAttendanceFilter(semester)]
    }
    if (status) where.status = status

    const [logs, total] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        orderBy: [{ date: 'desc' }, { timestamp: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { subject: true },
      }),
      prisma.attendanceLog.count({ where }),
    ])

    // Batch-fetch substituted subjects
    const subIds = [...new Set(logs.filter((l: any) => l.substituted_by).map((l: any) => l.substituted_by!))]
    const subSubjects = subIds.length ? await prisma.subject.findMany({ where: { id: { in: subIds as string[] } } }) : []
    const subSubjectMap = new Map(subSubjects.map((s: any) => [s.id, s]))

    const enriched = logs.map((l: any) => ({
      ...l,
      _id: l.id,
      // Backfill subject_name from join if the stored name is empty (old migrated data)
      subject_name: l.subject_name || (l.subject?.name ?? ''),
      subject_info: l.subject ? { ...l.subject, _id: l.subject.id } : null,
      substituted_subject_info: l.substituted_by ? (subSubjectMap.get(l.substituted_by) ?? null) : null,
    }))

    ok(res, { logs: enriched, total, page, limit, pages: Math.ceil(total / limit) })
  } catch (err) {
    if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
    console.error('[attendance/logs]', err)
    fail(res, 'Failed to fetch logs', 'FETCH_FAILED', 500)
  }
})

// ─── GET /classes-for-date ────────────────────────────────────────────────────

const ClassesQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  semester: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : undefined),
})

router.get('/classes-for-date', async (req: AuthRequest, res) => {
  try {
    const query = ClassesQuerySchema.parse(req.query)
    const userId = req.userId!
    const date = query.date ?? today()
    const semester = query.semester ?? (req.user?.current_semester ?? 1)

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayName = dayNames[new Date(date + 'T00:00:00').getDay()]

    const [timetableDocExact, logsForDate, subjects, timetableCandidates] = await Promise.all([
      prisma.timetable.findFirst({ where: { user_id: userId, semester } }),
      prisma.attendanceLog.findMany({ where: { user_id: userId, date } }),
      prisma.subject.findMany({ where: { user_id: userId, semester } }),
      prisma.timetable.findMany({ where: { user_id: userId }, orderBy: { updated_at: 'desc' } }),
    ])

    let timetableDoc = timetableDocExact
    if (!timetableDoc && subjects.length > 0) {
      const subjectIds = new Set(subjects.map((s: any) => s.id))
      let best: (typeof timetableCandidates)[number] | null = null
      let bestScore = 0
      for (const candidate of timetableCandidates) {
        const score = scoreScheduleBySubjects(candidate.schedule, subjectIds as Set<string>)
        if (score > bestScore) {
          bestScore = score
          best = candidate
        }
      }
      if (best && bestScore > 0) timetableDoc = best
    }

    const subjectMap = new Map(subjects.map((s: any) => [s.id, s]))
    type Slot = { subject_id?: string; subjectId?: string; time?: string; type?: string; [k: string]: unknown }
    const schedule = (timetableDoc?.schedule as Record<string, Slot[]> | undefined) ?? {}

    const daySlots: Slot[] = [...(schedule[dayName] ?? [])]
      .filter((s: any) => getSlotType((s as Record<string, unknown>)) === 'class')
      .filter((s: any) => Boolean((s.subject_id ?? s.subjectId ?? '').toString().trim()))
      .sort((a, b) => {
        const aStart = String((a as any).start_time ?? (a as any).startTime ?? (a as any).time ?? '')
        const bStart = String((b as any).start_time ?? (b as any).startTime ?? (b as any).time ?? '')
        return parseTimeToMinutes(aStart) - parseTimeToMinutes(bStart)
      })

    const regularLogs: typeof logsForDate = []
    const substitutionLogs: typeof logsForDate = []
    for (const log of logsForDate) {
      if ((log as any).type === 'substitution_class') {
        substitutionLogs.push(log)
      } else {
        regularLogs.push(log)
      }
    }

    const logsBySubject = new Map<string, any[]>()
    for (const log of regularLogs) {
      const sid = log.subject_id ?? ''
      if (!logsBySubject.has(sid)) logsBySubject.set(sid, [])
      logsBySubject.get(sid)!.push(log)
    }
    for (const [, logs] of logsBySubject) {
      logs.sort((a: any, b: any) => (a.timestamp ?? '').toString().localeCompare((b.timestamp ?? '').toString()))
    }

    const matchedLogIds = new Set<string>()
    const subjectSlotGroups = new Map<string, { slot: Slot; originalIndex: number }[]>()
    daySlots.forEach((slot, idx) => {
      const sid = (slot.subject_id ?? slot.subjectId ?? '') as string
      if (!subjectSlotGroups.has(sid)) subjectSlotGroups.set(sid, [])
      subjectSlotGroups.get(sid)!.push({ slot, originalIndex: idx })
    })

    const slotLogMap = new Map<number, any>()
    for (const [sid, slotsArr] of subjectSlotGroups) {
      const subjectLogs = logsBySubject.get(sid) ?? []
      let currentLogIdx = -1
      for (let i = 0; i < slotsArr.length; i++) {
        const { slot, originalIndex } = slotsArr[i]
        let isNewBlock = true
        if (i > 0) {
          const prevSlot = slotsArr[i - 1].slot
          if ((slot.type ?? '') === (prevSlot.type ?? '')) isNewBlock = false
        }
        if (currentLogIdx === -1) {
          if (subjectLogs.length > 0) currentLogIdx = 0
        } else if (isNewBlock) {
          currentLogIdx++
        }
        const log = (currentLogIdx >= 0 && currentLogIdx < subjectLogs.length) ? subjectLogs[currentLogIdx] : null
        if (log) matchedLogIds.add(log.id)
        slotLogMap.set(originalIndex, log)
      }
    }

    const classes = daySlots.map((slot, idx) => {
      const sid = (slot.subject_id ?? slot.subjectId ?? '') as string
      const subject = subjectMap.get(sid) as Record<string, unknown> | null
      const log = slotLogMap.get(idx) ?? null
      // Provide a subject_name_fallback for cases where the subject_id is stale/unresolvable
      const subjectNameFallback = subject?.name ?? (slot as any).label ?? (slot as any).name ?? ''
      return { slot, subject, subject_name: subjectNameFallback, log, marked: !!log }
    })

    const extraLogs = [
      ...regularLogs.filter((l: any) => !matchedLogIds.has(l.id)),
      ...substitutionLogs,
    ]

    ok(res, {
      date,
      day: dayName,
      classes,
      extra_logs: extraLogs,
      total_scheduled: daySlots.length,
      total_marked: logsForDate.length,
    })
  } catch (err) {
    console.error('[attendance/classes-for-date]', err)
    fail(res, 'Failed to fetch classes for date', 'FETCH_FAILED', 500)
  }
})

// ─── PUT /logs/:logId ─────────────────────────────────────────────────────────

router.put('/logs/:logId', async (req: AuthRequest, res) => {
  try {
    const logId = String(req.params.logId)
    const userId = req.userId!
    const body = EditLogSchema.parse(req.body)

    const log = await prisma.attendanceLog.findFirst({ where: { id: logId, user_id: userId } })
    if (!log) { fail(res, 'Log not found', 'NOT_FOUND', 404); return }

    const wasSubstituted = log.status === 'substituted' && log.substituted_by
    let newSubstitutedBy: string | null | undefined = undefined

      // Changing away from substituted → remove companion log
      if (wasSubstituted && body.status && body.status !== 'substituted') {
        await prisma.attendanceLog.deleteMany({
          where: { user_id: userId, subject_id: log.substituted_by!, date: log.date, type: 'substitution_class' },
        })
        await recomputeSubjectStats(log.substituted_by!, userId)
        newSubstitutedBy = null
      }

      // Switching to substituted with a new substituted_by
      if (body.status === 'substituted' && body.substituted_by) {
        const newSubById = body.substituted_by
        const subSubject = await prisma.subject.findFirst({ where: { id: newSubById, user_id: userId } })
        if (subSubject) {
          if (wasSubstituted && log.substituted_by) {
            await prisma.attendanceLog.deleteMany({
              where: { user_id: userId, subject_id: log.substituted_by, date: log.date, type: 'substitution_class' },
            })
            await recomputeSubjectStats(log.substituted_by, userId)
          }
          await prisma.attendanceLog.create({
            data: {
              user_id: userId,
              subject_id: newSubById,
              subject_name: subSubject.name,
              date: body.date ?? log.date,
              status: 'present',
              type: 'substitution_class',
              notes: `Substitution for ${log.subject_name}`,
              semester: log.semester,
            },
          })
          await recomputeSubjectStats(newSubById, userId)
          newSubstitutedBy = newSubById
        }
      }

      const updatedLog = await prisma.attendanceLog.update({
        where: { id: logId },
        data: {
          ...(body.status ? { status: body.status as any } : {}),
          ...(body.date ? { date: body.date } : {}),
          ...(body.type ? { type: body.type } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(newSubstitutedBy !== undefined ? { substituted_by: newSubstitutedBy } : {}),
        },
      })
      await recomputeSubjectStats(log.subject_id, userId)

    const updatedSubject = await prisma.subject.findUnique({ where: { id: log.subject_id } })

    sysLog(req, userId, 'Attendance Edited', `Edited ${log.subject_name || 'subject'} to ${updatedLog.status} on ${updatedLog.date}`).catch(() => { })

    ok(res, { log: { ...updatedLog, _id: updatedLog.id }, subject: updatedSubject ? { ...updatedSubject, _id: updatedSubject.id } : null })
  } catch (err) {
    if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
    console.error('[attendance/edit-log]', err)
    fail(res, 'Failed to edit log', 'SERVER_ERROR', 500)
  }
})

// ─── DELETE /logs/:logId ──────────────────────────────────────────────────────

router.delete('/logs/:logId', async (req: AuthRequest, res) => {
  try {
    const logId = String(req.params.logId)
    const userId = req.userId!

    const log = await prisma.attendanceLog.findFirst({ where: { id: logId, user_id: userId } })
    if (!log) { fail(res, 'Log not found', 'NOT_FOUND', 404); return }

    const subjectId = log.subject_id

      if (log.status === 'substituted' && log.substituted_by) {
        await prisma.attendanceLog.deleteMany({
          where: { user_id: userId, subject_id: log.substituted_by, date: log.date, type: 'substitution_class' },
        })
        await recomputeSubjectStats(log.substituted_by, userId)
      }

      await prisma.attendanceLog.delete({ where: { id: logId } })
      await recomputeSubjectStats(subjectId, userId)

    const updatedSubject = await prisma.subject.findUnique({ where: { id: subjectId } })

    sysLog(req, userId, 'Attendance Deleted', `Deleted ${log.subject_name} (${log.status}) on ${log.date}`).catch(() => { })

    ok(res, { message: 'Log deleted', subject: updatedSubject ? { ...updatedSubject, _id: updatedSubject.id } : null })
  } catch (err) {
    if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
    console.error('[attendance/delete-log]', err)
    fail(res, 'Failed to delete log', 'SERVER_ERROR', 500)
  }
})

// ─── GET /calendar_data ───────────────────────────────────────────────────────

const CalendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  semester: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : undefined),
})

router.get('/calendar_data', async (req: AuthRequest, res) => {
  try {
    const query = CalendarQuerySchema.parse(req.query)
    const { month, start, end, semester } = query
    const userId = req.userId!

    let startDate: string, endDate: string
    if (start && end) {
      startDate = start; endDate = end
    } else if (month) {
      const [y, m] = month.split('-').map(Number)
      const last = new Date(y, m, 0).getDate()
      startDate = `${month}-01`
      endDate = `${month}-${String(last).padStart(2, '0')}`
    } else {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      startDate = `${y}-${m}-01`
      endDate = `${y}-${m}-${String(last).padStart(2, '0')}`
    }

    const where: any = { user_id: userId, date: { gte: startDate, lte: endDate } }
    if (semester !== undefined) {
      where.AND = [buildSemesterAwareAttendanceFilter(semester)]
    }

    const logs = await prisma.attendanceLog.findMany({
      where,
      select: { id: true, date: true, status: true, subject_name: true, subject_id: true, timestamp: true, semester: true },
      orderBy: [{ date: 'asc' }, { timestamp: 'asc' }],
    })

    const calendar: Record<string, unknown> = {}
    const byDate: Record<string, typeof logs> = {}
    for (const log of logs) {
      if (!byDate[log.date]) byDate[log.date] = []
      byDate[log.date].push(log)
    }
    for (const [d, dlogs] of Object.entries(byDate)) {
      const total = dlogs.filter((l: any) => COUNTED_STATUSES.includes(l.status as any)).length
      const attended = dlogs.filter((l: any) => ATTENDED_STATUSES.includes(l.status as any)).length
      calendar[d] = {
        logs: dlogs,
        total,
        attended,
        percentage: total > 0 ? Math.round((attended / total) * 1000) / 10 : null,
        statuses: [...new Set(dlogs.map((l: any) => l.status))],
      }
    }

    ok(res, { calendar, start_date: startDate, end_date: endDate, total_logs: logs.length })
  } catch (err) {
    if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
    console.error('[attendance/calendar_data]', err)
    fail(res, 'Failed to fetch calendar data', 'FETCH_FAILED', 500)
  }
})

// ─── GET /dashboard (legacy compat) ──────────────────────────────────────────

const DashboardQuerySchema = z.object({
  semester: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : undefined),
})

router.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const query = DashboardQuerySchema.parse(req.query)
    const userId = req.userId!
    const semester = query.semester

    const [subjects, recentLogs] = await Promise.all([
      prisma.subject.findMany({
        where: { user_id: userId, ...(semester !== undefined ? { semester } : {}) },
        orderBy: { name: 'asc' },
      }),
      prisma.attendanceLog.findMany({
        where: { user_id: userId },
        orderBy: [{ date: 'desc' }, { timestamp: 'desc' }],
        take: 30,
      }),
    ])

    const totalAttended = subjects.reduce((s: number, x: any) => s + x.attended, 0)
    const totalClasses = subjects.reduce((s: number, x: any) => s + x.total, 0)
    const overallAttendance = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 1000) / 10 : 0

    ok(res, {
      overall_attendance: overallAttendance,
      subjects: subjects.map((s: any) => ({ ...s, _id: s.id })),
      recent_logs: recentLogs.map((l: any) => ({ ...l, _id: l.id })),
      total_subjects: subjects.length,
      current_semester: req.user?.current_semester ?? 1,
      user: { name: req.user?.name, email: req.user?.email, picture: req.user?.picture },
    })
  } catch (err) {
    if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
    console.error('[attendance/dashboard]', err)
    fail(res, 'Failed to fetch dashboard', 'FETCH_FAILED', 500)
  }
})

export default router
