import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { Timetable } from '../models/Timetable.js'
import { Holiday } from '../models/Holiday.js'
import { SystemLog } from '../models/SystemLog.js'
import { ok, fail } from '../utils/response.js'
import { uf, ownership } from '../utils/userFilter.js'

const router = Router()
router.use(requireAuth)

async function sysLog(user_id: string, action: string, description: string) {
  await SystemLog.create({ user_id, action, description }).catch(() => null)
}

// ─── Timetable ───────────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res) => {
  try {
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1

    let doc = await Timetable.findOne({ ...uf(req), semester }).lean()
    if (!doc && semester === 1) {
      // Legacy fallback: try without semester filter
      doc = await Timetable.findOne({ ...uf(req) }).lean()
    }
    ok(res, doc ?? {})
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

    await Timetable.findOneAndUpdate(
      { ...uf(req), semester },
      { $set: { schedule, semester, updated_at: new Date() } },
      { upsert: true },
    )
    await sysLog(userId, 'Schedule Updated', `User updated timetable for Semester ${semester}.`)
    ok(res, { message: 'Timetable updated' })
  } catch (err) {
    console.error('[timetable POST]', err)
    fail(res, 'Failed to update timetable', 'UPDATE_FAILED', 500)
  }
})

// ─── Structure ───────────────────────────────────────────────────────────────

router.post('/structure', async (req: AuthRequest, res) => {
  try {
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1

    await Timetable.findOneAndUpdate(
      { ...uf(req), semester },
      { $set: { periods: req.body, updated_at: new Date() } },
      { upsert: true },
    )
    ok(res, { message: 'Timetable structure saved' })
  } catch (err) {
    console.error('[timetable/structure]', err)
    fail(res, 'Failed to save structure', 'UPDATE_FAILED', 500)
  }
})

// ─── Holidays ────────────────────────────────────────────────────────────────

router.get('/holidays', async (req: AuthRequest, res) => {
  try {
    const holidays = await Holiday.find({ ...uf(req) }).sort({ date: 1 }).lean()
    ok(res, holidays)
  } catch (err) {
    console.error('[timetable/holidays GET]', err)
    fail(res, 'Failed to fetch holidays', 'FETCH_FAILED', 500)
  }
})

router.post('/holidays', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { date, name } = req.body as { date: string; name: string }
    if (!date || !name) { fail(res, 'Date and name required', 'MISSING_FIELDS'); return }

    const holiday = await Holiday.create({ ...ownership(req), date, name })
    ok(res, { message: 'Holiday added', id: String(holiday._id) })
  } catch (err) {
    console.error('[timetable/holidays POST]', err)
    fail(res, 'Failed to add holiday', 'CREATE_FAILED', 500)
  }
})

router.delete('/holidays/:id', async (req: AuthRequest, res) => {
  try {
    const result = await Holiday.findOneAndDelete({ _id: req.params.id, ...uf(req) })
    if (!result) { fail(res, 'Holiday not found', 'NOT_FOUND', 404); return }
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
    const slotData = { ...(req.body as Record<string, unknown>) }
    const day = slotData.day as string | undefined
    if (!day) { fail(res, 'Day required', 'MISSING_FIELD'); return }

    if (!slotData.id && !slotData._id) slotData.id = new Types.ObjectId().toString()

    const doc = await Timetable.findOne({ ...uf(req), semester })
    if (!doc) {
      await Timetable.create({
        ...ownership(req),
        semester,
        schedule: { [day]: [slotData] },
        updated_at: new Date(),
      })
    } else {
      const schedule = (doc.schedule ?? {}) as Record<string, Array<Record<string, unknown>>>
      if (!schedule[day]) schedule[day] = []

      // Replace existing slot at the same start_time instead of stacking
      const newStart = String(slotData.start_time ?? slotData.startTime ?? '')
      const existingIdx = schedule[day].findIndex((s) => {
        const sStart = String(s.start_time ?? s.startTime ?? '')
        return sStart === newStart
      })

      if (existingIdx !== -1) {
        // Preserve the existing slot's id for consistency
        const oldId = schedule[day][existingIdx].id || schedule[day][existingIdx]._id
        schedule[day][existingIdx] = { ...slotData, id: slotData.id || oldId }
      } else {
        schedule[day].push(slotData)
      }

      await Timetable.updateOne({ _id: doc._id }, { $set: { schedule, updated_at: new Date() } })
    }

    ok(res, { message: 'Slot added', id: slotData.id })
  } catch (err) {
    console.error('[timetable/slot POST]', err)
    fail(res, 'Failed to add slot', 'CREATE_FAILED', 500)
  }
})

router.put('/slot/:slotId', async (req: AuthRequest, res) => {
  try {
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1
    const updates = req.body as Record<string, unknown>

    const doc = await Timetable.findOne({ ...uf(req), semester })
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

    await Timetable.updateOne({ _id: doc._id }, { $set: { schedule, updated_at: new Date() } })
    ok(res, { message: 'Slot updated', slot: updatedSlot })
  } catch (err) {
    console.error('[timetable/slot PUT]', err)
    fail(res, 'Server error', 'SERVER_ERROR', 500)
  }
})

router.delete('/slot/:slotId', async (req: AuthRequest, res) => {
  try {
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1

    const doc = await Timetable.findOne({ ...uf(req), semester })
    if (!doc || !doc.schedule) { fail(res, 'Timetable not found', 'NOT_FOUND', 404); return }

    const schedule = JSON.parse(JSON.stringify(doc.schedule)) as Record<string, Array<Record<string, unknown>>>
    let found = false

    for (const day of Object.keys(schedule)) {
      const before = schedule[day].length
      schedule[day] = schedule[day].filter(
        (s) => String(s.id || s._id || '') !== req.params.slotId,
      )
      if (schedule[day].length < before) { found = true }
    }

    if (!found) { fail(res, 'Slot not found', 'NOT_FOUND', 404); return }

    await Timetable.updateOne({ _id: doc._id }, { $set: { schedule, updated_at: new Date() } })
    ok(res, { message: 'Slot deleted' })
  } catch (err) {
    console.error('[timetable/slot DELETE]', err)
    fail(res, 'Failed to delete slot', 'DELETE_FAILED', 500)
  }
})

export default router
