import { Router } from 'express'
import { Types } from 'mongoose'
import { requireAuth, invalidateAuthCache, type AuthRequest } from '../middleware/auth.js'
import { User } from '../models/User.js'
import { UserPreference } from '../models/UserPreference.js'
import { Subject } from '../models/Subject.js'
import { SystemLog } from '../models/SystemLog.js'
import { ok, fail } from '../utils/response.js'
import { uf } from '../utils/userFilter.js'
import multer from 'multer'

const router = Router()
router.use(requireAuth)

// Multer: memory storage for base64 conversion
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

async function sysLog(user_id: string, action: string, description: string) {
  await SystemLog.create({ user_id, action, description }).catch(() => null)
}

// ─── Profile ─────────────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean()
    if (!user) { fail(res, 'User not found', 'USER_NOT_FOUND', 404); return }

    // Merge preferences thresholds
    const prefs = await UserPreference.findOne({ ...uf(req) }).lean()
    const merged = { ...user } as Record<string, unknown>
    if (prefs?.preferences) {
      const p = prefs.preferences as Record<string, unknown>
      if ('attendance_threshold' in p) merged.attendance_threshold = p.attendance_threshold
      if ('warning_threshold' in p) merged.warning_threshold = p.warning_threshold
      else if ('min_attendance' in p) merged.warning_threshold = p.min_attendance
    }

    // Sync course / branch aliases
    if (merged.course && !merged.branch) merged.branch = merged.course
    if (merged.branch && !merged.course) merged.course = merged.branch

    ok(res, merged)
  } catch (err) {
    console.error('[profile GET]', err)
    fail(res, 'Failed to fetch profile', 'FETCH_FAILED', 500)
  }
})

router.put('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const data = req.body as Record<string, unknown>
    const allowedFields = ['name', 'branch', 'college', 'semester', 'batch', 'course', 'attendance_threshold', 'warning_threshold', 'enrollment_number', 'phone_number', 'headline', 'linkedin_url', 'github_url', 'portfolio_url']
    const updateData: Record<string, unknown> = {}

    for (const k of allowedFields) {
      if (k in data) updateData[k] = data[k]
    }
    // Map 'semester' → 'current_semester' for schema compatibility
    if ('semester' in updateData) {
      updateData.current_semester = parseInt(String(updateData.semester))
      delete updateData.semester
    }

    // Sync course / branch
    if ('course' in updateData && !('branch' in updateData)) updateData.branch = updateData.course
    else if ('branch' in updateData && !('course' in updateData)) updateData.course = updateData.branch

    // Sync target_attendance = attendance_threshold
    if ('attendance_threshold' in updateData) {
      updateData.target_attendance = updateData.attendance_threshold
    }

    console.log(`[profile PUT] Updating user ${userId}:`, updateData)
    const result = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true })
    console.log(`[profile PUT] New user doc exists:`, !!result)
    if (result) {
      console.log(`[profile PUT] Saved phone_number:`, result.phone_number)
    }

    // Mirror thresholds to UserPreference doc for consistency
    const thresholdMirror: Record<string, unknown> = {}
    if ('attendance_threshold' in data) thresholdMirror.attendance_threshold = data.attendance_threshold
    if ('warning_threshold' in data) thresholdMirror.warning_threshold = data.warning_threshold
    if (Object.keys(thresholdMirror).length) {
      const existing = await UserPreference.findOne({ ...uf(req) }).lean()
      const existingPrefs = (existing?.preferences ?? {}) as Record<string, unknown>
      const merged = { ...existingPrefs, ...thresholdMirror }
      await UserPreference.findOneAndUpdate(
        existing ? { _id: existing._id } : { user_id: new Types.ObjectId(userId) },
        { $set: { user_id: new Types.ObjectId(userId), preferences: merged, updated_at: new Date() } },
        { upsert: true },
      )
    }

    invalidateAuthCache(req.headers.authorization?.slice(7))
    sysLog(userId, 'Profile Updated', 'User updated their profile information.').catch(() => { })
    ok(res, { message: 'Profile updated' })
  } catch (err) {
    console.error('[profile PUT]', err)
    fail(res, 'Internal error', 'INTERNAL_ERROR', 500)
  }
})

// Alias for Flask compat (POST also accepted for profile update)
router.post('/', async (req: AuthRequest, res) => {
  const userId = req.userId!
  try {
    const body = req.body as Record<string, unknown>
    const allowed = ['name', 'branch', 'course', 'college', 'batch', 'enrollment_number', 'current_semester',
      'attendance_threshold', 'warning_threshold', 'target_attendance', 'phone_number', 'headline', 'linkedin_url', 'github_url', 'portfolio_url']
    const updateData: Record<string, unknown> = {}
    for (const k of allowed) { if (k in body) updateData[k] = body[k] }
    if (Object.keys(updateData).length === 0) { ok(res, { message: 'No changes' }); return }

    console.log(`[profile POST] Updating user ${userId}:`, updateData)
    const result = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true })
    console.log(`[profile POST] Result exists:`, !!result)

    invalidateAuthCache(req.headers.authorization?.slice(7))
    ok(res, { message: 'Profile updated' })
  } catch (err) {
    console.error('[profile POST]', err)
    fail(res, 'Internal error', 'INTERNAL_ERROR', 500)
  }
})

// ─── Profile Picture ─────────────────────────────────────────────────────────

router.post('/upload_pfp', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    if (!req.file) { fail(res, 'No file uploaded', 'MISSING_FILE'); return }

    const b64 = req.file.buffer.toString('base64')
    const mime = req.file.mimetype || 'image/jpeg'
    const pfpUrl = `data:${mime};base64,${b64}`

    await User.updateOne({ _id: userId }, { $set: { picture: pfpUrl } })
    sysLog(userId, 'PFP Updated', 'User uploaded a new profile picture.').catch(() => { })
    ok(res, { url: pfpUrl })
  } catch (err) {
    console.error('[profile/upload_pfp]', err)
    fail(res, 'Failed to upload profile picture', 'UPLOAD_FAILED', 500)
  }
})

// ─── Preferences ─────────────────────────────────────────────────────────────

const DEFAULT_PREFS = {
  attendance_threshold: 75,
  warning_threshold: 76,
  notifications_enabled: false,
  accent_color: '#6750A4',
}

router.get('/preferences', async (req: AuthRequest, res) => {
  try {
    const doc = await UserPreference.findOne({ ...uf(req) }).lean()
    const merged = { ...DEFAULT_PREFS, ...(doc?.preferences ?? {}) }
    ok(res, merged)
  } catch (err) {
    console.error('[profile/preferences GET]', err)
    fail(res, 'Failed to fetch preferences', 'FETCH_FAILED', 500)
  }
})

router.post('/preferences', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const data = { ...(req.body as Record<string, unknown>) }

    // Normalize alias
    if ('min_attendance' in data) { data.warning_threshold = data.min_attendance; delete data.min_attendance }

    const existing = await UserPreference.findOne({ ...uf(req) }).lean()
    const existingPrefs = (existing?.preferences ?? {}) as Record<string, unknown>
    const merged = { ...existingPrefs, ...data }

    // Update existing doc if found (may be an owner_email doc from Flask), otherwise upsert by user_id
    const filter = existing ? { _id: existing._id } : { user_id: userId }
    await UserPreference.findOneAndUpdate(
      filter,
      { $set: { user_id: userId, preferences: merged, updated_at: new Date() } },
      { upsert: true },
    )

    // Mirror thresholds to user doc
    const mirror: Record<string, unknown> = {}
    if ('attendance_threshold' in data) {
      mirror.attendance_threshold = data.attendance_threshold
      mirror.target_attendance = data.attendance_threshold // keep in sync
    }
    if ('warning_threshold' in data) mirror.warning_threshold = data.warning_threshold
    if (Object.keys(mirror).length) await User.updateOne({ _id: userId }, { $set: mirror })

    invalidateAuthCache(req.headers.authorization?.slice(7))
    sysLog(userId, 'Preferences Updated', `Updated preferences: ${Object.keys(data).join(', ')}`).catch(() => { })

    ok(res, { message: 'Preferences saved' })
  } catch (err) {
    console.error('[profile/preferences POST]', err)
    fail(res, 'Failed to save preferences', 'SAVE_FAILED', 500)
  }
})

// ─── Sync Thresholds to Subjects ─────────────────────────────────────────────

router.post('/sync-thresholds', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = await User.findById(userId).lean()
    if (!user) { fail(res, 'User not found', 'NOT_FOUND', 404); return }

    const threshold = user.attendance_threshold ?? 75
    const semester = req.body.semester ? parseInt(String(req.body.semester)) : undefined

    const filter: Record<string, unknown> = { user_id: userId }
    if (semester) filter.semester = semester

    const result = await Subject.updateMany(filter, { $set: { target: threshold } })

    sysLog(userId, 'Thresholds Synced', `Updated ${result.modifiedCount} subjects to ${threshold}% target${semester ? ` (semester ${semester})` : ''}`).catch(() => { })
    ok(res, { message: `Updated ${result.modifiedCount} subjects`, threshold, modified: result.modifiedCount })
  } catch (err) {
    console.error('[profile/sync-thresholds]', err)
    fail(res, 'Failed to sync thresholds', 'SYNC_FAILED', 500)
  }
})

// ─── Biometric ───────────────────────────────────────────────────────────────

router.post('/biometric/register', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { public_key, device_id = 'default' } = req.body as { public_key?: string; device_id?: string }
    if (!public_key) { fail(res, 'Public key required', 'KEY_REQUIRED'); return }

    await User.updateOne(
      { _id: userId },
      { $set: { [`biometrics.${device_id}`]: { public_key, registered_at: new Date() } } },
    )
    ok(res, { message: 'Biometric credential registered' })
  } catch (err) {
    console.error('[profile/biometric/register]', err)
    fail(res, 'Failed to register biometric', 'REGISTER_FAILED', 500)
  }
})

// ─── System Logs ─────────────────────────────────────────────────────────────

router.get('/logs', async (req: AuthRequest, res) => {
  try {
    const logs = await SystemLog.find({ ...uf(req) }).sort({ timestamp: -1 }).limit(50).lean()
    ok(res, logs)
  } catch (err) {
    console.error('[profile/logs]', err)
    fail(res, 'Failed to fetch logs', 'FETCH_FAILED', 500)
  }
})

export default router
