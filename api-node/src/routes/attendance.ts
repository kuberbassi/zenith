import { Router } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { AttendanceLog, COUNTED_STATUSES, ATTENDED_STATUSES } from '../models/AttendanceLog.js'
import { Subject } from '../models/Subject.js'
import { Timetable } from '../models/Timetable.js'
import { ok, created, fail } from '../utils/response.js'
import { uf, ownership } from '../utils/userFilter.js'
import { SystemLog } from '../models/SystemLog.js'

const router = Router()
router.use(requireAuth)

async function sysLog(user_id: string, action: string, description: string) {
  await SystemLog.create({ user_id, action, description }).catch(() => null)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Recompute `attended` / `total` on a subject from its attendance logs.
 */
async function recomputeSubjectStats(
  subjectId: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<void> {
  const logs = await AttendanceLog.find({ subject_id: subjectId, user_id: userId }).lean()
  const total = logs.filter(l => COUNTED_STATUSES.includes(l.status)).length
  const attended = logs.filter(l => ATTENDED_STATUSES.includes(l.status)).length
  await Subject.findByIdAndUpdate(subjectId, { attended, total })
}

// ─── schemas ──────────────────────────────────────────────────────────────────

const MarkSchema = z.object({
  subject_id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Subject ID'),
  status: z.enum(['present', 'absent', 'late', 'approved_medical', 'medical', 'duty', 'substituted', 'cancelled']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  semester: z.number().int().min(1).max(12).optional(),
  substituted_by: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
})

const EditLogSchema = z.object({
  status: z.enum(['present', 'absent', 'late', 'approved_medical', 'medical', 'duty', 'substituted', 'cancelled']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  substituted_by: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
})

const LogsQuerySchema = z.object({
  limit: z.string().optional().transform(v => Math.min(parseInt(v ?? '50', 10), 500)),
  page: z.string().optional().transform(v => Math.max(parseInt(v ?? '1', 10), 1)),
  subject_id: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
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
    const userId = new Types.ObjectId(req.userId!)
    const subjectId = new Types.ObjectId(body.subject_id)
    const markDate = body.date ?? today()
    const logType = body.type ?? 'Lecture'

    // Verify subject ownership FIRST
    const subject = await Subject.findOne({ _id: subjectId, ...uf(req) }).lean()
    if (!subject) { fail(res, 'Subject not found', 'NOT_FOUND', 404); return }

    const semester = body.semester ?? subject.semester ?? (req as any).user?.current_semester ?? 1

    const logData = {
      ...ownership(req),
      subject_id: subjectId,
      subject_name: subject.name,
      date: markDate,
      status: body.status,
      type: logType,
      semester,
      notes: body.notes ?? '',
    }

    // Attempt ATOMIC creation using findOneAndUpdate with upsert
    // This combined with the unique index {user_id, subject_id, date, type} prevents race conditions
    const filter = {
      user_id: userId,
      subject_id: subjectId,
      date: markDate,
      type: logType
    }

    // Use findOne to check existence first for better type safety and clarity, 
    // but the atomic findOneAndUpdate is safer against race conditions.
    // We'll use a try-catch for the unique index violation if we used .create()
    // OR just use findOneAndUpdate and handle the result.
    const result = (await AttendanceLog.findOneAndUpdate(
      filter,
      { $setOnInsert: logData },
      { upsert: true, new: true, includeResultMetadata: true }
    )) as any

    const isDuplicate = !result.lastErrorObject?.upserted

    if (isDuplicate) {
      const updatedSubject = await Subject.findById(subjectId).lean()
      created(res, { log: result.value, subject: updatedSubject, duplicate: true })
      return
    }

    // Substitution companion logic (only if not a duplicate)
    let substituteLog = null
    if (body.status === 'substituted' && body.substituted_by) {
      const subById = new Types.ObjectId(body.substituted_by)
      const subSubject = await Subject.findOne({ _id: subById, ...uf(req) }).lean()
      if (subSubject) {
        substituteLog = await AttendanceLog.findOneAndUpdate(
          { user_id: userId, subject_id: subById, date: markDate, type: 'substitution_class' },
          {
            $setOnInsert: {
              ...ownership(req),
              subject_id: subById,
              subject_name: subSubject.name,
              date: markDate,
              status: 'present',
              type: 'substitution_class',
              notes: `Substitution for ${subject.name}`,
              semester: semester,
            }
          },
          { upsert: true, new: true }
        )
        await recomputeSubjectStats(subById, userId)
      }
    }

    await recomputeSubjectStats(subjectId, userId)
    const updatedSubject = await Subject.findById(subjectId).lean()

    sysLog(req.userId!, 'Attendance Marked', `Marked ${subject.name} as ${body.status} on ${markDate}`).catch(() => { })

    created(res, { log: result.value, substitute_log: substituteLog, subject: updatedSubject })
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

    const match: Record<string, unknown> = { ...uf(req) }

    if (subject_id) match.subject_id = new Types.ObjectId(subject_id)

    if (date) {
      match.date = date
    } else if (start_date || end_date) {
      const range: Record<string, string> = {}
      if (start_date) range.$gte = start_date
      if (end_date) range.$lte = end_date
      match.date = range
    }

    if (semester !== undefined) { // Check for undefined, as 0 could be a valid semester
      const semFilter = { $or: [{ semester }, { semester: { $exists: false } }, { semester: null }] }
      match.$and = match.$and ? [...(match.$and as unknown[]), semFilter] : [semFilter]
    }

    if (status) match.status = status

    const [logs, total] = await Promise.all([
      AttendanceLog.aggregate([
        { $match: match },
        { $sort: { date: -1, timestamp: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $lookup: { from: 'subjects', localField: 'subject_id', foreignField: '_id', as: 'subject_info' } },
        { $lookup: { from: 'subjects', localField: 'substituted_by', foreignField: '_id', as: 'substituted_subject_info' } },
        {
          $addFields: {
            subject_info: { $arrayElemAt: ['$subject_info', 0] },
            substituted_subject_info: { $arrayElemAt: ['$substituted_subject_info', 0] },
          }
        },
      ]),
      AttendanceLog.countDocuments(match),
    ])

    ok(res, { logs, total, page, limit, pages: Math.ceil(total / limit) })
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
    const date = query.date ?? today()
    const semester = query.semester ?? (req.user?.current_semester ?? 1)

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayName = dayNames[new Date(date + 'T00:00:00').getDay()]

    const [timetableDoc, logsForDate, subjects] = await Promise.all([
      Timetable.findOne({ ...uf(req), semester }).lean(),
      AttendanceLog.find({ ...uf(req), date }).lean(),
      Subject.find({ ...uf(req), semester }).lean(),
    ])

    const subjectMap = new Map(subjects.map(s => [s._id.toString(), s]))
    type Slot = { subject_id?: string; subjectId?: string; time?: string; type?: string;[k: string]: unknown }
    const schedule = (timetableDoc?.schedule as Record<string, Slot[]> | undefined) ?? {}

    // Filter out break/free/lunch slots and slots without a subject (like Flask)
    // Preserve original timetable array order (no time-string sort — '10:00' sorts before '9:00')
    const daySlots: Slot[] = [...(schedule[dayName] ?? [])]
      .filter(s => {
        const t = (s.type ?? '').toLowerCase()
        return !['break', 'free', 'lunch'].includes(t)
      })
      .filter(s => s.subject_id || s.subjectId)

    // Separate substitution_class logs — they should NOT match timetable slots
    const regularLogs: typeof logsForDate = []
    const substitutionLogs: typeof logsForDate = []
    for (const log of logsForDate) {
      if ((log as any).type === 'substitution_class') {
        substitutionLogs.push(log)
      } else {
        regularLogs.push(log)
      }
    }

    // Build log map from regular logs only
    const logsBySubject = new Map<string, any[]>()
    for (const log of regularLogs) {
      const sid = (log as any).subject_id?.toString() ?? ''
      if (!logsBySubject.has(sid)) logsBySubject.set(sid, [])
      logsBySubject.get(sid)!.push(log)
    }
    // Sort each subject's logs by timestamp
    for (const [, logs] of logsBySubject) {
      logs.sort((a: any, b: any) => (a.timestamp ?? '').toString().localeCompare((b.timestamp ?? '').toString()))
    }

    // Flask-style block matching: share ONE log across consecutive same-subject/same-type slots
    const matchedLogIds = new Set<string>()

    // Group slots by subject_id to process blocks
    const subjectSlotGroups = new Map<string, { slot: Slot; originalIndex: number }[]>()
    daySlots.forEach((slot, idx) => {
      const sid = (slot.subject_id ?? slot.subjectId ?? '') as string
      if (!subjectSlotGroups.has(sid)) subjectSlotGroups.set(sid, [])
      subjectSlotGroups.get(sid)!.push({ slot, originalIndex: idx })
    })

    // Assign logs to slots (per subject, respecting blocks)
    const slotLogMap = new Map<number, any>()
    for (const [sid, slotsArr] of subjectSlotGroups) {
      const subjectLogs = logsBySubject.get(sid) ?? []
      let currentLogIdx = -1

      for (let i = 0; i < slotsArr.length; i++) {
        const { slot, originalIndex } = slotsArr[i]
        let isNewBlock = true
        if (i > 0) {
          const prevSlot = slotsArr[i - 1].slot
          if ((slot.type ?? '') === (prevSlot.type ?? '')) {
            isNewBlock = false
          }
        }

        if (currentLogIdx === -1) {
          if (subjectLogs.length > 0) currentLogIdx = 0
        } else if (isNewBlock) {
          currentLogIdx++
        }
        // Same block → reuse same log (don't advance)

        const log = (currentLogIdx >= 0 && currentLogIdx < subjectLogs.length)
          ? subjectLogs[currentLogIdx]
          : null
        if (log) matchedLogIds.add(log._id.toString())
        slotLogMap.set(originalIndex, log)
      }
    }

    // Build classes array in timetable order
    const classes = daySlots.map((slot, idx) => {
      const sid = (slot.subject_id ?? slot.subjectId ?? '') as string
      const log = slotLogMap.get(idx) ?? null
      return { slot, subject: subjectMap.get(sid) ?? null, log, marked: !!log }
    })

    // Extra logs = unmatched regular logs + all substitution companion logs
    const extraLogs = [
      ...regularLogs.filter((l: any) => !matchedLogIds.has(l._id.toString())),
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

const LogIdParamSchema = z.object({
  logId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Log ID'),
})

router.put('/logs/:logId', async (req: AuthRequest, res) => {
  try {
    const { logId: logIdStr } = LogIdParamSchema.parse(req.params)
    const userId = new Types.ObjectId(req.userId!)
    const logId = new Types.ObjectId(logIdStr)
    const body = EditLogSchema.parse(req.body)

    const log = await AttendanceLog.findOne({ _id: logId, ...uf(req) })
    if (!log) { fail(res, 'Log not found', 'NOT_FOUND', 404); return }

    const wasSubstituted = log.status === 'substituted' && log.substituted_by

    // Changing away from substituted → remove companion log
    if (wasSubstituted && body.status && body.status !== 'substituted') {
      await AttendanceLog.findOneAndDelete({
        ...uf(req), subject_id: log.substituted_by, date: log.date, type: 'substitution_class',
      })
      await recomputeSubjectStats(log.substituted_by as Types.ObjectId, userId)
      log.substituted_by = undefined
    }

    // Switching to substituted with a new substituted_by → update companion
    if (body.status === 'substituted' && body.substituted_by) {
      const newSubById = new Types.ObjectId(body.substituted_by)
      const subSubject = await Subject.findOne({ _id: newSubById, ...uf(req) }).lean()
      if (subSubject) {
        if (wasSubstituted && log.substituted_by) {
          await AttendanceLog.findOneAndDelete({
            ...uf(req), subject_id: log.substituted_by, date: log.date, type: 'substitution_class',
          })
          await recomputeSubjectStats(log.substituted_by as Types.ObjectId, userId)
        }
        await AttendanceLog.create({
          ...ownership(req),
          subject_id: newSubById,
          subject_name: subSubject.name,
          date: body.date ?? log.date,
          status: 'present',
          type: 'substitution_class',
          notes: `Substitution for ${log.subject_name}`,
          semester: log.semester,
        })
        await recomputeSubjectStats(newSubById, userId)
        log.substituted_by = newSubById
      }
    }

    if (body.status) log.status = body.status
    if (body.date) log.date = body.date
    if (body.type) log.type = body.type
    if (body.notes !== undefined) log.notes = body.notes

    await log.save()
    await recomputeSubjectStats(log.subject_id as Types.ObjectId, userId)
    const updatedSubject = await Subject.findById(log.subject_id).lean()

    sysLog(req.userId!, 'Attendance Edited', `Edited ${log.subject_name || 'subject'} to ${log.status} on ${log.date}`).catch(() => { })

    ok(res, { log, subject: updatedSubject })
  } catch (err) {
    if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
    console.error('[attendance/edit-log]', err)
    fail(res, 'Failed to edit log', 'SERVER_ERROR', 500)
  }
})

// ─── DELETE /logs/:logId ──────────────────────────────────────────────────────

router.delete('/logs/:logId', async (req: AuthRequest, res) => {
  try {
    const { logId: logIdStr } = LogIdParamSchema.parse(req.params)
    const userId = new Types.ObjectId(req.userId!)
    const logId = new Types.ObjectId(logIdStr)

    const log = await AttendanceLog.findOne({ _id: logId, ...uf(req) })
    if (!log) { fail(res, 'Log not found', 'NOT_FOUND', 404); return }

    const subjectId = log.subject_id as Types.ObjectId

    if (log.status === 'substituted' && log.substituted_by) {
      await AttendanceLog.findOneAndDelete({
        ...uf(req), subject_id: log.substituted_by, date: log.date, type: 'substitution_class',
      })
      await recomputeSubjectStats(log.substituted_by as Types.ObjectId, userId)
    }

    const deletedSubjectName = log.subject_name || 'Unknown'
    const deletedStatus = log.status
    const deletedDate = log.date
    await log.deleteOne()
    await recomputeSubjectStats(subjectId, userId)
    const updatedSubject = await Subject.findById(subjectId).lean()

    sysLog(req.userId!, 'Attendance Deleted', `Deleted ${deletedSubjectName} (${deletedStatus}) on ${deletedDate}`).catch(() => { })

    ok(res, { message: 'Log deleted', subject: updatedSubject })
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

    const match: Record<string, unknown> = { ...uf(req), date: { $gte: startDate, $lte: endDate } }
    if (semester !== undefined) {
      const semFilter = { $or: [{ semester }, { semester: { $exists: false } }, { semester: null }] }
      match.$and = match.$and ? [...(match.$and as unknown[]), semFilter] : [semFilter]
    }

    const logs = await AttendanceLog.find(match)
      .select('date status subject_name subject_id timestamp semester')
      .sort({ date: 1, timestamp: 1 })
      .lean()

    // Group by date and build summary
    const calendar: Record<string, unknown> = {}
    const byDate: Record<string, typeof logs> = {}
    for (const log of logs) {
      if (!byDate[log.date]) byDate[log.date] = []
      byDate[log.date].push(log)
    }
    for (const [d, dlogs] of Object.entries(byDate)) {
      const total = dlogs.filter(l => COUNTED_STATUSES.includes(l.status)).length
      const attended = dlogs.filter(l => ATTENDED_STATUSES.includes(l.status)).length
      calendar[d] = {
        logs: dlogs,
        total,
        attended,
        percentage: total > 0 ? Math.round((attended / total) * 1000) / 10 : null,
        statuses: [...new Set(dlogs.map(l => l.status))],
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
    const semester = query.semester

    const subjectFilter: Record<string, unknown> = { ...uf(req) }
    if (semester !== undefined) subjectFilter.semester = semester

    const [subjects, recentLogs] = await Promise.all([
      Subject.find(subjectFilter).sort({ name: 1 }).lean(),
      AttendanceLog.find({ ...uf(req) }).sort({ date: -1, timestamp: -1 }).limit(30).lean(),
    ])

    const totalAttended = subjects.reduce((s, x) => s + x.attended, 0)
    const totalClasses = subjects.reduce((s, x) => s + x.total, 0)
    const overallAttendance = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 1000) / 10 : 0

    ok(res, {
      overall_attendance: overallAttendance,
      subjects,
      recent_logs: recentLogs,
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
