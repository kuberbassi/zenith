import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { User } from '../models/User.js'
import { Subject } from '../models/Subject.js'
import { AttendanceLog } from '../models/AttendanceLog.js'
import { SemesterResult } from '../models/SemesterResult.js'
import { ManualCourse } from '../models/ManualCourse.js'
import { Timetable } from '../models/Timetable.js'
import { Skill } from '../models/Skill.js'
import { UserPreference } from '../models/UserPreference.js'
import { Holiday } from '../models/Holiday.js'
import { UserBackup } from '../models/UserBackup.js'
import { SystemLog } from '../models/SystemLog.js'
import { ok, fail } from '../utils/response.js'

const router = Router()
router.use(requireAuth)

// In-memory rate limit for destructive ops (use Redis in production)
const _deleteAttempts = new Map<string, Date>()
const DELETE_COOLDOWN_MS = 5 * 60 * 1000
const MAX_DELETE_ENTRIES = 500

function checkDeleteRateLimit(userId: string): { ok: boolean; waitMinutes: number } {
  const now = new Date()
  const last = _deleteAttempts.get(userId)
  if (last) {
    const diff = now.getTime() - last.getTime()
    if (diff < DELETE_COOLDOWN_MS) {
      const wait = Math.ceil((DELETE_COOLDOWN_MS - diff) / 60000)
      return { ok: false, waitMinutes: wait }
    }
  }
  // Prune stale entries if map grows too large
  if (_deleteAttempts.size > MAX_DELETE_ENTRIES) {
    for (const [key, date] of _deleteAttempts) {
      if (now.getTime() - date.getTime() > DELETE_COOLDOWN_MS) _deleteAttempts.delete(key)
    }
  }
  _deleteAttempts.set(userId, now)
  return { ok: true, waitMinutes: 0 }
}

type UserData = {
  subjects: unknown[]
  attendance_logs: unknown[]
  timetable: unknown[]
  semester_results: unknown[]
  manual_courses: unknown[]
  user_preferences: unknown[]
  skills: unknown[]
  holidays: unknown[]
  system_logs: unknown[]
  user_profile?: unknown
}

async function collectUserData(userId: string, email?: string): Promise<UserData> {
  const uid = new Types.ObjectId(userId)
  // Support both Node schema (user_id: ObjectId) and Flask schema (owner_email: string)
  const f = email
    ? { $or: [{ user_id: uid }, { owner_email: email.toLowerCase() }] }
    : { user_id: uid }
  const [
    subjects,
    attendance_logs,
    timetable,
    semester_results,
    manual_courses,
    user_preferences,
    skills,
    holidays,
    system_logs,
  ] = await Promise.all([
    Subject.find(f).lean(),
    AttendanceLog.find(f).lean(),
    Timetable.find(f).lean(),
    SemesterResult.find(f).lean(),
    ManualCourse.find(f).lean(),
    UserPreference.find(f).lean(),
    Skill.find(f).lean(),
    Holiday.find(f).lean(),
    SystemLog.find(f).lean(),
  ])

  return {
    subjects,
    attendance_logs,
    timetable,
    semester_results,
    manual_courses,
    user_preferences,
    skills,
    holidays,
    system_logs,
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

router.get('/export_data', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = await User.findById(userId).select('-biometrics').lean()

    const data = await collectUserData(userId, req.user?.email)
    if (user) data.user_profile = { ...user, password_hash: undefined, google_id: undefined }

    const payload = {
      metadata: {
        version: '2.0',
        exported_at: new Date().toISOString(),
        source_email: user?.email ?? '',
      },
      data,
    }

    const json = JSON.stringify(payload)
    const email = (user?.email ?? 'user').replace(/@/g, '_at_').replace(/\./g, '_')
    const filename = `acadhub_export_${email}_${new Date().toISOString().slice(0, 10)}.json`

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/json')
    res.send(json)
  } catch (err) {
    console.error('[data/export]', err)
    fail(res, 'Export failed', 'EXPORT_FAILED', 500)
  }
})

// ─── Import ──────────────────────────────────────────────────────────────────

router.post('/import_data', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const uid = new Types.ObjectId(userId)
    const body = req.body as { data?: UserData }
    if (!body?.data) { fail(res, 'Invalid import file format', 'INVALID_FORMAT'); return }

    const importData = body.data
    const idMap = new Map<string, Types.ObjectId>()

    // Get user email for legacy owner_email doc cleanup
    const user = await User.findById(userId).lean()
    const email = user?.email?.toLowerCase()
    const clearFilter = email
      ? { $or: [{ user_id: uid }, { owner_email: email }] }
      : { user_id: uid }

    // 1. Clear existing data (both user_id and owner_email docs)
    await Promise.all([
      Subject.deleteMany(clearFilter),
      AttendanceLog.deleteMany(clearFilter),
      Timetable.deleteMany(clearFilter),
      SemesterResult.deleteMany(clearFilter),
      ManualCourse.deleteMany(clearFilter),
      UserPreference.deleteMany(clearFilter),
      Skill.deleteMany(clearFilter),
      Holiday.deleteMany(clearFilter),
      SystemLog.deleteMany(clearFilter),
    ])

    // Helper: restore BSON-like types
    function restoreTypes(obj: unknown): unknown {
      if (Array.isArray(obj)) return obj.map(restoreTypes)
      if (obj && typeof obj === 'object') {
        const o = obj as Record<string, unknown>
        if ('$oid' in o) return new Types.ObjectId(o.$oid as string)
        if ('$date' in o) {
          const v = o.$date
          if (typeof v === 'number') return new Date(v)
          if (typeof v === 'string') return new Date(v)
          return v
        }
        return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, restoreTypes(v)]))
      }
      return obj
    }

    // 2. Insert subjects first (build ID map)
    if (importData.subjects?.length) {
      const clean = importData.subjects.map((item) => {
        const s = restoreTypes(item) as Record<string, unknown>
        const oldId = String(s._id ?? '')
        const newId = new Types.ObjectId()
        if (oldId) idMap.set(oldId, newId)
        return { ...s, _id: newId, user_id: uid }
      })
      await Subject.insertMany(clean, { ordered: false }).catch(() => null)
    }

    // 3. Insert attendance logs (remap subject_id)
    if (importData.attendance_logs?.length) {
      const clean = importData.attendance_logs.map((item) => {
        const l = restoreTypes(item) as Record<string, unknown>
        const subRef = String(l.subject_id ?? '')
        if (subRef && idMap.has(subRef)) l.subject_id = idMap.get(subRef)
        return { ...l, _id: new Types.ObjectId(), user_id: uid }
      })
      await AttendanceLog.insertMany(clean, { ordered: false }).catch(() => null)
    }

    // 4. Insert timetable (remap slot subject_ids)
    if (importData.timetable?.length) {
      const clean = importData.timetable.map((item) => {
        const t = restoreTypes(item) as Record<string, unknown>
        if (t.schedule && typeof t.schedule === 'object') {
          const sched = t.schedule as Record<string, Array<Record<string, unknown>>>
          for (const day of Object.keys(sched)) {
            for (const slot of sched[day]) {
              const sRef = String(slot.subjectId ?? slot.subject_id ?? '')
              if (sRef && idMap.has(sRef)) {
                slot.subject_id = String(idMap.get(sRef))
                delete slot.subjectId
              }
            }
          }
        }
        return { ...t, _id: new Types.ObjectId(), user_id: uid }
      })
      await Timetable.insertMany(clean, { ordered: false }).catch(() => null)
    }

    // 5. Other collections
    const simpleCollections: Array<{ data: unknown[] | undefined; Model: { insertMany: (d: unknown[], o?: object) => Promise<unknown> } }> = [
      { data: importData.semester_results, Model: SemesterResult },
      { data: importData.manual_courses, Model: ManualCourse },
      { data: importData.user_preferences, Model: UserPreference },
      { data: importData.skills, Model: Skill },
      { data: importData.holidays, Model: Holiday },
      { data: importData.system_logs, Model: SystemLog },
    ]

    for (const { data, Model } of simpleCollections) {
      if (data?.length) {
        const clean = data.map((item) => {
          const d = restoreTypes(item) as Record<string, unknown>
          return { ...d, _id: new Types.ObjectId(), user_id: uid }
        })
        await Model.insertMany(clean, { ordered: false }).catch(() => null)
      }
    }

    // 6. Restore profile
    if (importData.user_profile) {
      const profile = { ...(importData.user_profile as Record<string, unknown>) }
      delete profile._id; delete profile.email; delete profile.password_hash; delete profile.biometrics
      await User.updateOne({ _id: uid }, { $set: profile })
    }

    ok(res, { message: 'Data imported successfully' })
  } catch (err) {
    console.error('[data/import]', err)
    fail(res, 'Import failed', 'IMPORT_FAILED', 500)
  }
})

// ─── Delete All Data ─────────────────────────────────────────────────────────

router.delete('/delete_all_data', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const uid = new Types.ObjectId(userId)

    // Rate limit
    const rl = checkDeleteRateLimit(userId)
    if (!rl.ok) {
      fail(res, `Please wait ${rl.waitMinutes} more minutes before deleting again.`, 'RATE_LIMITED', 429)
      return
    }

    // Optional email confirmation
    const body = req.body as { confirmation_email?: string }
    const user = await User.findById(userId).lean()
    if (body.confirmation_email && user) {
      if (body.confirmation_email.toLowerCase() !== user.email.toLowerCase()) {
        fail(res, "Email mismatch. Confirmation email doesn't match your account.", 'EMAIL_MISMATCH', 403)
        return
      }
    }

    // Create auto-backup first
    const backupData = await collectUserData(userId, user?.email)
    if (user) backupData.user_profile = user

    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    const backup = await UserBackup.create({
      user_id: uid,
      backup_type: 'pre_delete_auto',
      data: backupData,
      created_at: new Date(),
      expires_at: expires,
    })

    // Wipe all collections (user_id AND legacy owner_email docs)
    const collectionsToWipe = [
      Subject, AttendanceLog, Timetable, SemesterResult,
      ManualCourse, UserPreference, Skill, Holiday, SystemLog,
    ]
    const email = user?.email?.toLowerCase()
    const summary: Record<string, number> = {}
    for (const Model of collectionsToWipe) {
      // Delete by user_id (Node docs) and owner_email (Flask legacy docs)
      const filter = email
        ? { $or: [{ user_id: uid }, { owner_email: email }] }
        : { user_id: uid }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const countBefore = await (Model as any).countDocuments(filter)
      const result = await (Model as any).deleteMany(filter)
      if (result.deletedCount !== countBefore) {
        console.warn(`[data/delete] Count mismatch in ${(Model as { modelName: string }).modelName}: expected ${countBefore}, deleted ${result.deletedCount}`)
      }
      summary[(Model as { modelName: string }).modelName] = result.deletedCount
    }

    // Reset profile
    await User.updateOne({ _id: uid }, {
      $set: { course: '', college: '', current_semester: 1, batch: '', picture: null },
    })

    console.warn(`🚨 DELETE ALL DATA for user ${userId} (${email || 'unknown'}) from IP: ${req.ip}`)

    // Re-add audit log
    await SystemLog.create({
      user_id: uid,
      action: 'Account Reset',
      description: `All personal data deleted. Backup ID: ${backup._id}. Summary: ${JSON.stringify(summary)}. IP: ${req.ip}. UA: ${req.headers['user-agent'] || 'Unknown'}`,
    })

    ok(res, {
      message: 'All data wiped successfully.',
      backup_id: String(backup._id),
      backup_expires: expires.toISOString(),
      summary,
    })
  } catch (err) {
    console.error('[data/delete_all]', err)
    fail(res, 'Failed to delete data', 'DELETE_FAILED', 500)
  }
})

// ─── Backups ─────────────────────────────────────────────────────────────────

router.get('/backups', async (req: AuthRequest, res) => {
  try {
    const uid = new Types.ObjectId(req.userId!)
    const backups = await UserBackup.find(
      { user_id: uid, expires_at: { $gt: new Date() } },
      { data: 0 },
    ).sort({ created_at: -1 }).limit(10).lean()

    ok(res, { backups })
  } catch (err) {
    console.error('[data/backups GET]', err)
    fail(res, 'Failed to list backups', 'LIST_FAILED', 500)
  }
})

router.post('/restore_backup/:backupId', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const uid = new Types.ObjectId(userId)

    const backup = await UserBackup.findOne({
      _id: req.params.backupId,
      user_id: uid,
    }).lean()

    if (!backup) { fail(res, 'Backup not found or access denied', 'NOT_FOUND', 404); return }
    if (backup.expires_at && backup.expires_at < new Date()) {
      fail(res, 'This backup has expired', 'EXPIRED', 410); return
    }

    const data = backup.data as UserData
    // Clear current (both Node user_id and Flask owner_email docs)
    const user = await User.findById(uid).lean()
    const email = user?.email?.toLowerCase()
    const clearFilter = email
      ? { $or: [{ user_id: uid }, { owner_email: email }] }
      : { user_id: uid }
    await Promise.all([
      Subject.deleteMany(clearFilter),
      AttendanceLog.deleteMany(clearFilter),
      Timetable.deleteMany(clearFilter),
      SemesterResult.deleteMany(clearFilter),
      ManualCourse.deleteMany(clearFilter),
      UserPreference.deleteMany(clearFilter),
      Skill.deleteMany(clearFilter),
      Holiday.deleteMany(clearFilter),
      SystemLog.deleteMany(clearFilter),
    ])

    // Restore
    const models = [
      { key: 'subjects', Model: Subject },
      { key: 'attendance_logs', Model: AttendanceLog },
      { key: 'timetable', Model: Timetable },
      { key: 'semester_results', Model: SemesterResult },
      { key: 'manual_courses', Model: ManualCourse },
      { key: 'user_preferences', Model: UserPreference },
      { key: 'skills', Model: Skill },
      { key: 'holidays', Model: Holiday },
      { key: 'system_logs', Model: SystemLog },
    ] as const

    for (const { key, Model } of models) {
      const items = (data[key as keyof UserData] as unknown[]) ?? []
      if (items.length) {
        const clean = items.map((item) => ({ ...(item as Record<string, unknown>), _id: new Types.ObjectId(), user_id: uid }))
        await (Model as { insertMany: (d: unknown[], o?: object) => Promise<unknown> }).insertMany(clean, { ordered: false }).catch(() => null)
      }
    }

    ok(res, { message: 'Backup restored successfully' })
  } catch (err) {
    console.error('[data/restore]', err)
    fail(res, 'Restore failed', 'RESTORE_FAILED', 500)
  }
})

export default router
