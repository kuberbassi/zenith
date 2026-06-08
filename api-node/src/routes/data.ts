import { Router } from 'express'
import crypto, { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { ok, fail } from '../utils/response.js'
import { getClientIp } from '../utils/ip.js'
import { normalizeAttendanceStatus } from '../utils/attendanceStatus.js'

const router = Router()
router.use(requireAuth)

// In-memory rate limit for destructive ops
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
  if (_deleteAttempts.size > MAX_DELETE_ENTRIES) {
    for (const [key, date] of _deleteAttempts) {
      if (now.getTime() - date.getTime() > DELETE_COOLDOWN_MS) _deleteAttempts.delete(key)
    }
  }
  _deleteAttempts.set(userId, now)
  return { ok: true, waitMinutes: 0 }
}

// ─── Cryptography Helpers for Secure Backups ──────────────────────────────────
function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET || 'zenith-backup-encryption-key-fallback-secret-2026'
  return crypto.createHash('sha256').update(secret).digest()
}

function encrypt(text: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decrypt(encryptedText: string): string {
  const key = getEncryptionKey()
  const parts = encryptedText.split(':')
  if (parts.length !== 2) throw new Error('Invalid encrypted format')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

type UserData = {
  subjects: unknown[]
  attendance_logs: unknown[]
  timetable?: unknown[]
  timetables?: unknown[]
  semester_results: unknown[]
  manual_courses: unknown[]
  user_preferences?: unknown[]
  user_preference?: unknown[]
  skills: unknown[]
  system_logs: unknown[]
  notes?: unknown[]
  user_profile?: unknown
}

async function collectUserData(userId: string): Promise<UserData> {
  const [subjects, attendance_logs, timetable, semester_results, manual_courses, user_preferences, skills, system_logs, notes] = await Promise.all([
    prisma.subject.findMany({ where: { user_id: userId } }),
    prisma.attendanceLog.findMany({ where: { user_id: userId } }),
    prisma.timetable.findMany({ where: { user_id: userId } }),
    prisma.semesterResult.findMany({ where: { user_id: userId } }),
    prisma.manualCourse.findMany({ where: { user_id: userId } }),
    prisma.userPreference.findMany({ where: { user_id: userId } }),
    prisma.skill.findMany({ where: { user_id: userId } }),
    prisma.systemLog.findMany({ where: { user_id: userId }, orderBy: { timestamp: 'desc' }, take: 500 }),
    prisma.note.findMany({ where: { user_id: userId } }),
  ])
  return { subjects, attendance_logs, timetable, semester_results, manual_courses, user_preferences, skills, system_logs, notes }
}

async function createInBatches<T>(items: T[], worker: (item: T) => Promise<unknown>, batchSize: number = 25) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map(worker))
  }
}

function normalizeValue(val: any): any {
  if (val && typeof val === 'object') {
    if ('$oid' in val) return String(val.$oid)
    if ('$date' in val) return val.$date
    if ('$numberInt' in val) return Number(val.$numberInt)
    if ('$numberLong' in val) return Number(val.$numberLong)
    if ('$numberDouble' in val) return Number(val.$numberDouble)
    if ('$numberDecimal' in val) return Number(val.$numberDecimal)
  }
  return val
}

async function clearUserData(userId: string) {
  const subs = await prisma.subject.findMany({ where: { user_id: userId }, select: { id: true } })
  await prisma.subject.deleteMany({ where: { id: { in: subs.map((s: any) => s.id) } } })
  await prisma.attendanceLog.deleteMany({ where: { user_id: userId } })
  await prisma.timetable.deleteMany({ where: { user_id: userId } })
  await prisma.semesterResult.deleteMany({ where: { user_id: userId } })
  await prisma.manualCourse.deleteMany({ where: { user_id: userId } })
  await prisma.userPreference.deleteMany({ where: { user_id: userId } })
  await prisma.skill.deleteMany({ where: { user_id: userId } })
  await prisma.systemLog.deleteMany({ where: { user_id: userId } })
  await prisma.note.deleteMany({ where: { user_id: userId } })
}

function getSafeProfileUpdate(profile: any) {
  const allowedProfileFields = [
    'name', 'course', 'branch', 'college', 'batch', 'current_semester',
    'enrollment_number', 'target_attendance', 'attendance_threshold', 'warning_threshold',
    'phone_number', 'admission_year',
  ]

  const filteredProfile = Object.fromEntries(
    Object.entries(profile ?? {}).filter(([key]) => allowedProfileFields.includes(key))
  ) as Record<string, any>

  if (filteredProfile.admission_year) filteredProfile.admission_year = String(normalizeValue(filteredProfile.admission_year))
  if (filteredProfile.current_semester) filteredProfile.current_semester = Number(normalizeValue(filteredProfile.current_semester))
  if (filteredProfile.target_attendance) filteredProfile.target_attendance = Number(normalizeValue(filteredProfile.target_attendance))
  if (filteredProfile.attendance_threshold) filteredProfile.attendance_threshold = Number(normalizeValue(filteredProfile.attendance_threshold))
  if (filteredProfile.warning_threshold) filteredProfile.warning_threshold = Number(normalizeValue(filteredProfile.warning_threshold))

  return filteredProfile
}

async function restoreUserData(userId: string, rawData: UserData) {
  const idMap = new Map<string, string>()

  if (rawData.subjects?.length) {
    const subjectsData = (rawData.subjects as any[]).map((s) => {
      const oldId = normalizeValue(s.id ?? s._id)
      const newId = randomUUID()
      if (oldId) idMap.set(String(oldId), newId)
      return {
        id: newId,
        user_id: userId,
        name: String(s.name ?? ''),
        code: String(s.code ?? ''),
        professor: String(s.professor ?? ''),
        classroom: String(s.classroom ?? ''),
        semester: Number(normalizeValue(s.semester) ?? 1),
        type: String(s.type ?? 'theory').toLowerCase(),
        credits: s.credits != null ? Number(normalizeValue(s.credits)) : null,
        attended: Number(normalizeValue(s.attended) ?? 0),
        total: Number(normalizeValue(s.total) ?? 0),
        target: Number(normalizeValue(s.target) ?? 75),
        categories: Array.isArray(s.categories) ? s.categories : ['Theory'],
        practicals: s.practicals ?? null,
        assignments: s.assignments ?? null,
        syllabus: s.syllabus ?? null,
      }
    })
    await createInBatches(subjectsData, (row) => prisma.subject.create({ data: row as any }))
  }

  if (rawData.attendance_logs?.length) {
    const logsData = (rawData.attendance_logs as any[]).map((l) => {
      const oldSubIdVal = normalizeValue(l.subject_id)
      if (!oldSubIdVal) return null
      const newSubId = idMap.get(String(oldSubIdVal))
      if (!newSubId) return null
      const timestamp = normalizeValue(l.timestamp)
      return {
        id: randomUUID(),
        user_id: userId,
        subject_id: newSubId,
        subject_name: String(l.subject_name ?? ''),
        date: String(normalizeValue(l.date) ?? ''),
        status: normalizeAttendanceStatus(normalizeValue(l.status)),
        type: String(l.type ?? 'Lecture'),
        notes: l.notes ?? null,
        semester: l.semester != null ? Number(normalizeValue(l.semester)) : null,
        substituted_by: l.substituted_by ? (idMap.get(String(normalizeValue(l.substituted_by))) || null) : null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      }
    }).filter(Boolean) as any[]
    await createInBatches(logsData, (row) => prisma.attendanceLog.create({ data: row as any }))
  }

  const ttable = rawData.timetable || rawData.timetables
  if (ttable?.length) {
    const timetableData = (ttable as any[]).map((t) => {
      const schedule = JSON.parse(JSON.stringify(t.schedule ?? {}))
      for (const day of Object.keys(schedule)) {
        if (!Array.isArray(schedule[day])) continue
        for (const slot of schedule[day]) {
          const slotType = String(slot.type ?? '').trim().toLowerCase()
          const hasSubjectRef = String(normalizeValue(slot.subject_id ?? slot.subjectId) ?? '').trim().length > 0
          const hasLabel = String(slot.label ?? slot.name ?? '').trim().length > 0
          slot.id = String(normalizeValue(slot.id ?? slot._id) ?? randomUUID())
          delete slot._id
          if (slot.startTime && !slot.start_time) slot.start_time = slot.startTime
          if (slot.endTime && !slot.end_time) slot.end_time = slot.endTime
          delete slot.startTime
          delete slot.endTime
          if (!slot.type) slot.type = hasSubjectRef ? 'class' : (hasLabel ? 'custom' : 'class')
          else slot.type = slotType || 'class'
          const sRef = String(normalizeValue(slot.subject_id ?? slot.subjectId) ?? '')
          if (sRef && idMap.has(sRef)) slot.subject_id = idMap.get(sRef)
          else if (sRef) slot.subject_id = sRef
          delete slot.subjectId
          if (slot.type !== 'class') slot.subject_id = ''
        }
      }
      return {
        id: randomUUID(),
        user_id: userId,
        semester: Number(normalizeValue(t.semester) ?? 1),
        schedule,
        periods: t.periods ?? null,
      }
    })
    await createInBatches(timetableData as any[], (row) => prisma.timetable.create({ data: row as any }))
  }

  if (rawData.semester_results?.length) {
    const resultsData = (rawData.semester_results as any[]).map((r) => ({
      id: randomUUID(),
      user_id: userId,
      semester: Number(r.semester ?? 1),
      subjects: r.subjects ?? [],
      sgpa: Number(r.sgpa ?? 0),
      total_credits: Number(r.total_credits ?? 0),
      student_info: r.student_info ?? null,
      source: String(r.source ?? 'manual').toLowerCase().includes('ipu') ? 'ipu_scraper' : 'manual',
      enrollment_number: r.enrollment_number ?? null,
      semester_label: r.semester_label ?? null,
      total_marks: r.total_marks ?? null,
      max_marks: r.max_marks ?? null,
    }))
    await createInBatches(resultsData as any[], (row) => prisma.semesterResult.create({ data: row as any }))
  }

  if (rawData.manual_courses?.length) {
    const coursesData = (rawData.manual_courses as any[]).map((c) => {
      const extra = c.extra ?? {}
      if (c.instructor && !extra.instructor) extra.instructor = c.instructor
      if (c.enrolledDate && !extra.enrolledDate) extra.enrolledDate = c.enrolledDate
      if (c.targetCompletionDate && !extra.targetCompletionDate) extra.targetCompletionDate = c.targetCompletionDate
      return {
        id: randomUUID(),
        user_id: userId,
        name: String(c.name ?? c.title ?? ''),
        platform: String(c.platform ?? c.provider ?? ''),
        status: String(c.status ?? 'not_started'),
        progress: Number(c.progress ?? c.percentage ?? 0),
        url: c.url ? String(c.url) : null,
        notes: c.notes ? String(c.notes) : null,
        extra: Object.keys(extra).length ? extra : null,
      }
    })
    await createInBatches(coursesData as any[], (row) => prisma.manualCourse.create({ data: row as any }))
  }

  const prefData = rawData.user_preferences || rawData.user_preference
  if (Array.isArray(prefData) ? prefData.length : !!prefData) {
    const pref = Array.isArray(prefData) ? (prefData as any[])[0] : prefData
    await prisma.userPreference.upsert({
      where: { user_id: userId },
      create: { user_id: userId, preferences: pref.preferences ?? {} },
      update: { preferences: pref.preferences ?? {} },
    })
  }

  if (rawData.skills?.length) {
    const skillsData = (rawData.skills as any[]).map((s) => ({
      id: randomUUID(),
      user_id: userId,
      name: String(s.name ?? ''),
      category: s.category ?? null,
      level: s.level ?? null,
      progress: Number(s.progress ?? 0),
      notes: s.notes ?? '',
    }))
    await createInBatches(skillsData as any[], (row) => prisma.skill.create({ data: row as any }))
  }

  if (rawData.system_logs?.length) {
    const systemLogsData = (rawData.system_logs as any[]).map((entry) => ({
      user_id: userId,
      action: String(entry.action ?? 'Imported Log'),
      description: String(entry.description ?? ''),
      ip: entry.ip ? String(entry.ip) : null,
      user_agent: entry.user_agent ? String(entry.user_agent) : null,
      timestamp: entry.timestamp ? new Date(normalizeValue(entry.timestamp)) : new Date(),
    }))
    await createInBatches(systemLogsData as any[], (row) => prisma.systemLog.create({ data: row as any }))
  }

  if (rawData.notes?.length) {
    const notesData = (rawData.notes as any[]).map((n) => ({
      id: randomUUID(),
      user_id: userId,
      title: String(n.title ?? ''),
      content: String(n.content ?? ''),
      is_todo: Boolean(n.is_todo ?? false),
      todos: n.todos ?? [],
      category: String(n.category ?? 'General'),
      color: String(n.color ?? ''),
      is_pinned: Boolean(n.is_pinned ?? false),
      is_archived: Boolean(n.is_archived ?? false),
      created_at: n.created_at ? new Date(normalizeValue(n.created_at)) : new Date(),
      updated_at: n.updated_at ? new Date(normalizeValue(n.updated_at)) : new Date(),
    }))
    await createInBatches(notesData as any[], (row) => prisma.note.create({ data: row as any }))
  }

  if (rawData.user_profile) {
    const filteredProfile = getSafeProfileUpdate(rawData.user_profile)
    if (Object.keys(filteredProfile).length) {
      await prisma.user.update({ where: { id: userId }, data: filteredProfile as any })
    }
  }
}


// ─── Export ──────────────────────────────────────────────────────────────────

router.get('/export_data', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = await prisma.user.findUnique({ where: { id: userId } })

    const data = await collectUserData(userId)
    if (user) {
      const { google_id: _g, ...safeUser } = user as any
      data.user_profile = safeUser
    }

    const payload = {
      metadata: { version: '2.0', exported_at: new Date().toISOString(), source_email: user?.email ?? '' },
      data,
    }

    const json = JSON.stringify(payload)
    const encryptedJson = encrypt(json)

    const securePayload = {
      secure: true,
      payload: encryptedJson,
      checksum: crypto.createHash('sha256').update(encryptedJson).digest('hex')
    }

    const finalJson = JSON.stringify(securePayload)
    const email = (user?.email ?? 'user').replace(/@/g, '_at_').replace(/\./g, '_')
    const filename = `zenith_export_${email}_${new Date().toISOString().slice(0, 10)}.json`

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/json')
    res.send(finalJson)
  } catch (err) {
    console.error('[data/export]', err)
    fail(res, 'Export failed', 'EXPORT_FAILED', 500)
  }
})

// ─── Import ──────────────────────────────────────────────────────────────────

router.post('/import_data', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const body = req.body as any
    let importData: UserData

    if (body && body.secure === true && typeof body.payload === 'string') {
      if (body.checksum) {
        const check = crypto.createHash('sha256').update(body.payload).digest('hex')
        if (check !== body.checksum) {
          fail(res, 'Backup file integrity verification failed. File may be corrupted or altered.', 'INTEGRITY_FAILED', 400)
          return
        }
      }
      try {
        const decryptedText = decrypt(body.payload)
        const decryptedJson = JSON.parse(decryptedText)
        importData = ((decryptedJson as { data?: UserData })?.data ?? decryptedJson) as UserData
      } catch (decErr: any) {
        fail(res, 'Failed to decrypt secure backup file. Key mismatch or corrupted content.', 'DECRYPTION_FAILED', 400)
        return
      }
    } else {
      importData = ((body as { data?: UserData })?.data ?? body) as UserData
    }

    console.log('[data/import] Received keys:', Object.keys(importData))
    if (!importData || typeof importData !== 'object') { fail(res, 'Invalid import file format', 'INVALID_FORMAT'); return }

    const [user, backupData] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      collectUserData(userId),
    ])
    if (user) backupData.user_profile = user

    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    await prisma.userBackup.create({
      data: { user_id: userId, backup_type: 'pre_import_auto', data: backupData as any, expires_at: expires },
    })
    try {
      console.log(`[data/import] Clearing data for user: ${userId}`)
      await clearUserData(userId)
      await restoreUserData(userId, importData)
      ok(res, { message: 'Data imported successfully' })
    } catch (txErr: any) {
      console.error('[data/import] Transaction failed at:', txErr.table || 'unknown', txErr)
      try {
        console.warn(`[data/import] Rolling back import for user: ${userId}`)
        await clearUserData(userId)
        await restoreUserData(userId, backupData)
      } catch (rollbackErr) {
        console.error('[data/import] Rollback failed:', rollbackErr)
      }
      fail(res, `Import failed and previous data was restored: ${txErr.message}`, 'IMPORT_FAILED', 500)
      return
    }

  } catch (err: any) {
    console.error('[data/import] Global error:', err)
    fail(res, `Import failed: ${err.message}`, 'IMPORT_FAILED', 500)
  }
})

// ─── Delete All Data ─────────────────────────────────────────────────────────

router.delete('/delete_all_data', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!

    const rl = checkDeleteRateLimit(userId)
    if (!rl.ok) {
      fail(res, `Please wait ${rl.waitMinutes} more minutes before deleting again.`, 'RATE_LIMITED', 429)
      return
    }

    const body = req.body as { confirmation_email?: string, backup_id?: string }
    const user = await prisma.user.findUnique({ where: { id: userId } })

    // Require backup_id in body
    if (body.confirmation_email && user) {
      if (body.confirmation_email.toLowerCase() !== user.email.toLowerCase()) {
        fail(res, "Email mismatch. Confirmation email doesn't match your account.", 'EMAIL_MISMATCH', 403)
        return
      }
    }

    if (!body.backup_id) {
      fail(res, "Backup required before wipe. Please provide backup_id.", "BACKUP_REQUIRED", 400)
      return
    }

    // Verify backup exists and belongs to user
    const backup = await prisma.userBackup.findFirst({
      where: { id: body.backup_id, user_id: userId }
    })
    if (!backup) {
      fail(res, "Invalid backup_id. Please create a backup first.", "INVALID_BACKUP", 400)
      return
    }

    // Wipe all collections
    const [s, al, t, sr, mc, up, sk, sl, nt] = await Promise.all([
      prisma.subject.deleteMany({ where: { user_id: userId } }),
      // attendance_logs cascade-deleted with subjects — but also delete orphans
      prisma.attendanceLog.deleteMany({ where: { user_id: userId } }),
      prisma.timetable.deleteMany({ where: { user_id: userId } }),
      prisma.semesterResult.deleteMany({ where: { user_id: userId } }),
      prisma.manualCourse.deleteMany({ where: { user_id: userId } }),
      prisma.userPreference.deleteMany({ where: { user_id: userId } }),
      prisma.skill.deleteMany({ where: { user_id: userId } }),
      prisma.systemLog.deleteMany({ where: { user_id: userId } }),
      prisma.note.deleteMany({ where: { user_id: userId } }),
    ])

    const summary = { subjects: s.count, attendance_logs: al.count, timetable: t.count, semester_results: sr.count, manual_courses: mc.count, user_preferences: up.count, skills: sk.count, system_logs: sl.count, notes: nt.count }

    await prisma.user.update({
      where: { id: userId },
      data: {
        branch: null,
        course: null,
        college: null,
        batch: null,
        enrollment_number: null,
        mother_name: null,
        father_name: null,
        gender: null,
        phone_number: null,
        admission_year: null,
        current_semester: 1,
        target_attendance: 75,
        attendance_threshold: 75,
        warning_threshold: 76,
        biometrics: {},
        picture: null
      }
    })

    const clientIp = getClientIp(req)
    console.warn(`🚨 DELETE ALL DATA for user ${userId} from IP: ${clientIp}`)

    await prisma.systemLog.create({
      data: { user_id: userId, action: 'Account Reset', description: `All personal data deleted. Backup ID: ${backup.id}. Summary: ${JSON.stringify(summary)}. IP: ${clientIp}.` },
    })

    const expires = backup.expires_at || new Date()
    ok(res, { message: 'All data wiped successfully.', backup_id: backup.id, backup_expires: expires instanceof Date ? expires.toISOString() : expires, summary })
  } catch (err) {
    console.error('[data/delete_all]', err)
    fail(res, 'Failed to delete data', 'DELETE_FAILED', 500)
  }
})

// ─── Backups ─────────────────────────────────────────────────────────────────

router.post('/backups', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const backupData = await collectUserData(userId)
    if (user) backupData.user_profile = user

    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    const backup = await prisma.userBackup.create({
      data: { user_id: userId, backup_type: 'manual', data: backupData as any, expires_at: expires },
    })

    ok(res, { backup_id: backup.id, expires_at: expires.toISOString() })
  } catch (err) {
    console.error('[data/backups POST]', err)
    fail(res, 'Failed to create backup', 'BACKUP_FAILED', 500)
  }
})

router.get('/backups', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const backups = await prisma.userBackup.findMany({
      where: { user_id: userId, expires_at: { gt: new Date() } },
      select: { id: true, backup_type: true, created_at: true, expires_at: true },
      orderBy: { created_at: 'desc' },
      take: 10,
    })
    ok(res, { backups: backups.map((b: any) => ({ ...b, _id: b.id })) })
  } catch (err) {
    console.error('[data/backups GET]', err)
    fail(res, 'Failed to list backups', 'LIST_FAILED', 500)
  }
})

router.post('/restore_backup/:backupId', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const backupId = String(req.params.backupId)

    const backup = await prisma.userBackup.findFirst({ where: { id: backupId, user_id: userId } })
    if (!backup) { fail(res, 'Backup not found or access denied', 'NOT_FOUND', 404); return }
    if (backup.expires_at && backup.expires_at < new Date()) {
      fail(res, 'This backup has expired', 'EXPIRED', 410); return
    }

    const data = backup.data as UserData
    await clearUserData(userId)
    await restoreUserData(userId, data)

    ok(res, { message: 'Backup restored successfully' })
  } catch (err) {
    console.error('[data/restore]', err)
    fail(res, 'Restore failed', 'RESTORE_FAILED', 500)
  }
})

// ─── Account Data Migration ──────────────────────────────────────────────────

router.post('/migration/initiate', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      fail(res, 'User not found', 'NOT_FOUND', 404)
      return
    }

    const secret = process.env.JWT_SECRET || 'zenith-backup-encryption-key-fallback-secret-2026'
    
    // Sign a token valid for 15 minutes
    const token = jwt.sign(
      {
        from_user_id: userId,
        from_email: user.email,
        purpose: 'account_migration'
      },
      secret,
      { expiresIn: '15m' }
    )

    ok(res, { key: `zenith_migrate_${token}` })
  } catch (err) {
    console.error('[data/migration/initiate]', err)
    fail(res, 'Failed to generate migration key', 'MIGRATION_INIT_FAILED', 500)
  }
})

router.post('/migration/complete', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { key } = req.body

    if (!key || typeof key !== 'string') {
      fail(res, 'Migration key is required', 'KEY_REQUIRED', 400)
      return
    }

    const token = key.startsWith('zenith_migrate_') ? key.replace('zenith_migrate_', '') : key
    const secret = process.env.JWT_SECRET || 'zenith-backup-encryption-key-fallback-secret-2026'

    let decoded: any
    try {
      decoded = jwt.verify(token, secret)
    } catch (err) {
      fail(res, 'Invalid or expired migration key', 'INVALID_KEY', 400)
      return
    }

    if (decoded.purpose !== 'account_migration' || !decoded.from_user_id) {
      fail(res, 'Invalid migration key signature', 'INVALID_KEY_PURPOSE', 400)
      return
    }

    const fromUserId = decoded.from_user_id

    if (fromUserId === userId) {
      fail(res, 'Cannot migrate data to the same account', 'SAME_ACCOUNT', 400)
      return
    }

    // Verify source user exists
    const sourceUser = await prisma.user.findUnique({ where: { id: fromUserId } })
    if (!sourceUser) {
      fail(res, 'Source user account no longer exists', 'SOURCE_NOT_FOUND', 404)
      return
    }

    const destinationUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!destinationUser) {
      fail(res, 'Destination user account not found', 'DEST_NOT_FOUND', 404)
      return
    }

    // 1. Collect backups of both accounts in case of any transaction failure
    const [sourceData, destData] = await Promise.all([
      collectUserData(fromUserId),
      collectUserData(userId)
    ])

    const backupExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days safety backup
    await Promise.all([
      prisma.userBackup.create({
        data: { user_id: fromUserId, backup_type: 'pre_migration_source', data: sourceData as any, expires_at: backupExpires }
      }),
      prisma.userBackup.create({
        data: { user_id: userId, backup_type: 'pre_migration_destination', data: destData as any, expires_at: backupExpires }
      })
    ]).catch(() => null)

    // 2. Clear destination user data to avoid conflicts
    await clearUserData(userId)

    // 3. Restore source data into destination user
    await restoreUserData(userId, sourceData)

    // 4. Update destination profile fields if empty but exist in source
    const updateData: Record<string, any> = {}
    const fields = ['branch', 'course', 'college', 'batch', 'enrollment_number', 'mother_name', 'father_name', 'gender', 'phone_number', 'admission_year']
    for (const f of fields) {
      if (!destinationUser[f as keyof typeof destinationUser] && sourceUser[f as keyof typeof sourceUser]) {
        updateData[f] = sourceUser[f as keyof typeof sourceUser]
      }
    }
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({ where: { id: userId }, data: updateData })
    }

    // 5. Completely clear and purge source user account
    await clearUserData(fromUserId)
    await prisma.user.delete({ where: { id: fromUserId } })

    // Create system log for auditing
    await prisma.systemLog.create({
      data: {
        user_id: userId,
        action: 'Account Migration',
        description: `Successfully migrated all academic data from user ID ${fromUserId} (${decoded.from_email}) to ${destinationUser.email}.`
      }
    }).catch(() => null)

    ok(res, { message: 'Account data migrated successfully.' })
  } catch (err) {
    console.error('[data/migration/complete]', err)
    fail(res, 'Failed to complete migration', 'MIGRATION_FAILED', 500)
  }
})

export default router
