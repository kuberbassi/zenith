import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { ok, fail } from '../utils/response.js'

const router = Router()
router.use(requireAuth)

async function sysLog(req: AuthRequest, user_id: string, action: string, description: string) {
  const ip = req.ip || (req as any).socket?.remoteAddress || null
  const user_agent = (req.headers['user-agent'] as string) || null
  await prisma.systemLog.create({ data: { user_id, action, description, ip, user_agent } }).catch(() => null)
}

// ─── Validation Schemas ──────────────────────────────────────────────────────

const SlotSchema = z.object({
  day: z.string().min(1, 'Day is required'),
  subject_id: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  type: z.string().optional().default('Lecture'),
}).passthrough()

const HolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  name: z.string().min(1, 'Holiday name is required').max(200),
})

// ─── Timetable ───────────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1
    const [doc, subjects] = await Promise.all([
      prisma.timetable.findUnique({ where: { user_id_semester: { user_id: userId, semester } } }),
      prisma.subject.findMany({ where: { user_id: userId, semester }, select: { id: true, name: true, code: true } }),
    ])

    if (!doc) {
      ok(res, {})
      return
    }

    const byId = new Map(subjects.map((s) => [s.id, s]))
    const schedule = JSON.parse(JSON.stringify(doc.schedule ?? {})) as Record<string, Array<Record<string, unknown>>>

    for (const [day, slots] of Object.entries(schedule)) {
      schedule[day] = (Array.isArray(slots) ? slots : []).map((slot) => {
        const subjectRef = String(slot.subject_id ?? slot.subjectId ?? '').trim()
        const bySubjectId = subjectRef ? byId.get(subjectRef) : undefined
        const subjectFromObject = typeof slot.subject === 'object' && slot.subject !== null
          ? (slot.subject as Record<string, unknown>)
          : null
        const explicitName = String(
          slot.subject_name
          ?? slot.subjectName
          ?? (typeof slot.subject === 'string' ? slot.subject : '')
          ?? subjectFromObject?.name
          ?? '',
        ).trim()

        const resolvedName = bySubjectId?.name || explicitName
        const resolvedCode = bySubjectId?.code || String(subjectFromObject?.code ?? '').trim()

        return {
          ...slot,
          subject_id: subjectRef || undefined,
          subject_name: resolvedName || undefined,
          subject_code: resolvedCode || undefined,
          label: String(slot.label ?? '').trim() || resolvedName || undefined,
        }
      })
    }

    ok(res, { ...doc, _id: doc.id, schedule })
  } catch (err) {
    console.error('[timetable GET]', err)
    fail(res, 'Failed to fetch timetable', 'FETCH_FAILED', 500)
  }
})

router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1
    const schedule = req.body.schedule ?? {}
    await prisma.timetable.upsert({
      where: { user_id_semester: { user_id: userId, semester } },
      create: { user_id: userId, semester, schedule },
      update: { schedule },
    })
    sysLog(req, userId, 'Schedule Updated', `User updated timetable for Semester ${semester}.`).catch(() => { })
    ok(res, { message: 'Timetable updated' })
  } catch (err) {
    console.error('[timetable POST]', err)
    fail(res, 'Failed to update timetable', 'UPDATE_FAILED', 500)
  }
})

// ─── Structure ───────────────────────────────────────────────────────────────

router.post('/structure', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1
    await prisma.timetable.upsert({
      where: { user_id_semester: { user_id: userId, semester } },
      create: { user_id: userId, semester, schedule: {}, periods: req.body },
      update: { periods: req.body },
    })
    ok(res, { message: 'Timetable structure saved' })
  } catch (err) {
    console.error('[timetable/structure]', err)
    fail(res, 'Failed to save structure', 'UPDATE_FAILED', 500)
  }
})

// ─── Holidays ────────────────────────────────────────────────────────────────

router.get('/holidays', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const holidays = await prisma.holiday.findMany({ where: { user_id: userId }, orderBy: { date: 'asc' } })
    ok(res, holidays.map(h => ({ ...h, _id: h.id })))
  } catch (err) {
    console.error('[timetable/holidays GET]', err)
    fail(res, 'Failed to fetch holidays', 'FETCH_FAILED', 500)
  }
})

router.post('/holidays', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const body = HolidaySchema.parse(req.body)
    const holiday = await prisma.holiday.create({ data: { user_id: userId, date: body.date, name: body.name } })
    ok(res, { message: 'Holiday added', id: holiday.id, _id: holiday.id })
  } catch (err) {
    if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
    console.error('[timetable/holidays POST]', err)
    fail(res, 'Failed to add holiday', 'CREATE_FAILED', 500)
  }
})

router.delete('/holidays/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const holidayId = String(req.params.id)
    const existing = await prisma.holiday.findFirst({ where: { id: holidayId, user_id: userId } })
    if (!existing) { fail(res, 'Holiday not found', 'NOT_FOUND', 404); return }
    await prisma.holiday.delete({ where: { id: holidayId } })
    ok(res, { message: 'Holiday deleted' })
  } catch (err) {
    console.error('[timetable/holidays DELETE]', err)
    fail(res, 'Invalid holiday ID', 'INVALID_ID', 400)
  }
})

// ─── Slots ────────────────────────────────────────────────────────────────────

router.post('/slot', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1
    const parsed = SlotSchema.parse(req.body)
    const slotData = { ...parsed } as Record<string, unknown>
    const day = slotData.day as string

    if (!slotData.id && !slotData._id) slotData.id = randomUUID()

    const doc = await prisma.timetable.findUnique({ where: { user_id_semester: { user_id: userId, semester } } })
    if (!doc) {
      await prisma.timetable.create({ data: { user_id: userId, semester, schedule: JSON.parse(JSON.stringify({ [day]: [slotData] })) } })
    } else {
      const schedule = JSON.parse(JSON.stringify(doc.schedule ?? {})) as Record<string, Array<Record<string, unknown>>>
      if (!schedule[day]) schedule[day] = []

      const newStart = String(slotData.start_time ?? (slotData as any).startTime ?? '')
      const existingIdx = schedule[day].findIndex(s => String(s.start_time ?? (s as any).startTime ?? '') === newStart)

      if (existingIdx !== -1) {
        const oldId = schedule[day][existingIdx].id || schedule[day][existingIdx]._id
        schedule[day][existingIdx] = { ...slotData, id: slotData.id || oldId }
      } else {
        schedule[day].push(slotData)
      }

      await prisma.timetable.update({ where: { id: doc.id }, data: { schedule: JSON.parse(JSON.stringify(schedule)) } })
    }

    ok(res, { message: 'Slot added', id: slotData.id })
  } catch (err) {
    console.error('[timetable/slot POST]', err)
    fail(res, 'Failed to add slot', 'CREATE_FAILED', 500)
  }
})

router.put('/slot/:slotId', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1
    const updates = req.body as Record<string, unknown>

    const doc = await prisma.timetable.findUnique({ where: { user_id_semester: { user_id: userId, semester } } })
    if (!doc || !doc.schedule) { fail(res, 'Timetable not found', 'NOT_FOUND', 404); return }

    const schedule = JSON.parse(JSON.stringify(doc.schedule)) as Record<string, Array<Record<string, unknown>>>
    let found = false
    let updatedSlot: Record<string, unknown> = {}

    for (const [day, slots] of Object.entries(schedule)) {
      for (let i = 0; i < slots.length; i++) {
        const curId = String(slots[i].id || slots[i]._id || '')
        if (curId === req.params.slotId) {
          schedule[day][i] = { ...slots[i], ...updates }
          updatedSlot = schedule[day][i]
          found = true
          break
        }
      }
      if (found) break
    }

    if (!found) { fail(res, 'Slot not found', 'NOT_FOUND', 404); return }

    await prisma.timetable.update({ where: { id: doc.id }, data: { schedule: JSON.parse(JSON.stringify(schedule)) } })
    ok(res, { message: 'Slot updated', slot: updatedSlot })
  } catch (err) {
    console.error('[timetable/slot PUT]', err)
    fail(res, 'Server error', 'SERVER_ERROR', 500)
  }
})

router.delete('/slot/:slotId', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1

    const doc = await prisma.timetable.findUnique({ where: { user_id_semester: { user_id: userId, semester } } })
    if (!doc || !doc.schedule) { fail(res, 'Timetable not found', 'NOT_FOUND', 404); return }

    const schedule = JSON.parse(JSON.stringify(doc.schedule)) as Record<string, Array<Record<string, unknown>>>
    let found = false

    for (const day of Object.keys(schedule)) {
      const before = schedule[day].length
      schedule[day] = schedule[day].filter(s => String(s.id || s._id || '') !== req.params.slotId)
      if (schedule[day].length < before) found = true
    }

    if (!found) { fail(res, 'Slot not found', 'NOT_FOUND', 404); return }

    await prisma.timetable.update({ where: { id: doc.id }, data: { schedule: JSON.parse(JSON.stringify(schedule)) } })
    ok(res, { message: 'Slot deleted' })
  } catch (err) {
    console.error('[timetable/slot DELETE]', err)
    fail(res, 'Failed to delete slot', 'DELETE_FAILED', 500)
  }
})

export default router
