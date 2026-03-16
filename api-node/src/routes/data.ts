import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { ok, fail } from '../utils/response.js'

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

type UserData = {
  subjects: unknown[]
  attendance_logs: unknown[]
  timetable: unknown[]
  semester_results: unknown[]
  manual_courses: unknown[]
  user_preferences: unknown[]
  skills: unknown[]
  system_logs: unknown[]
  user_profile?: unknown
}

async function collectUserData(userId: string): Promise<UserData> {
  const [subjects, attendance_logs, timetable, semester_results, manual_courses, user_preferences, skills, system_logs] = await Promise.all([
    prisma.subject.findMany({ where: { user_id: userId } }),
    prisma.attendanceLog.findMany({ where: { user_id: userId } }),
    prisma.timetable.findMany({ where: { user_id: userId } }),
    prisma.semesterResult.findMany({ where: { user_id: userId } }),
    prisma.manualCourse.findMany({ where: { user_id: userId } }),
    prisma.userPreference.findMany({ where: { user_id: userId } }),
    prisma.skill.findMany({ where: { user_id: userId } }),
    prisma.systemLog.findMany({ where: { user_id: userId }, orderBy: { timestamp: 'desc' }, take: 500 }),
  ])
  return { subjects, attendance_logs, timetable, semester_results, manual_courses, user_preferences, skills, system_logs }
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
    const body = req.body as { data?: UserData }
    if (!body?.data) { fail(res, 'Invalid import file format', 'INVALID_FORMAT'); return }

    const importData = body.data
    const idMap = new Map<string, string>()

    // 1. Create auto-backup first
    const [user, backupData] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      collectUserData(userId),
    ])
    if (user) backupData.user_profile = user

    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    await prisma.userBackup.create({
      data: { user_id: userId, backup_type: 'pre_import_auto', data: backupData as any, expires_at: expires },
    })

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

    function mapAttendanceStatus(status: string): any {
      const s = String(status || 'present').toLowerCase().trim()
      if (s.includes('present')) return 'present'
      if (s.includes('absent')) return 'absent'
      if (s.includes('late')) return 'late'
      if (s.includes('medical')) return 'medical'
      if (s.includes('duty')) return 'duty'
      if (s.includes('substituted')) return 'substituted'
      if (s.includes('cancelled')) return 'cancelled'
      return 'present'
    }

    // 2. Clear existing data and 3-9. Insert new data sequentially
    try {
      // Clear existing records
      const subs = await prisma.subject.findMany({ where: { user_id: userId }, select: { id: true } })
      await prisma.subject.deleteMany({ where: { id: { in: subs.map((s: any) => s.id) } } })
      await prisma.attendanceLog.deleteMany({ where: { user_id: userId } })
      await prisma.timetable.deleteMany({ where: { user_id: userId } })
      await prisma.semesterResult.deleteMany({ where: { user_id: userId } })
      await prisma.manualCourse.deleteMany({ where: { user_id: userId } })
      await prisma.userPreference.deleteMany({ where: { user_id: userId } })
      await prisma.skill.deleteMany({ where: { user_id: userId } })
      await prisma.systemLog.deleteMany({ where: { user_id: userId } })

      // Insert subjects
      if (importData.subjects?.length) {
        const subjectsData = (importData.subjects as any[]).map(s => {
          const oldId = String(normalizeValue(s._id) ?? normalizeValue(s.id) ?? '')
          const newId = randomUUID()
          if (oldId) idMap.set(oldId, newId)
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
        await prisma.subject.createMany({ data: subjectsData })
      }

      // Insert attendance logs
      if (importData.attendance_logs?.length) {
        const logsData = (importData.attendance_logs as any[]).map(l => {
          const oldSubId = String(normalizeValue(l.subject_id) ?? '')
          const newSubId = idMap.get(oldSubId) ?? oldSubId
          const timestamp = normalizeValue(l.timestamp)
          return {
            id: randomUUID(),
            user_id: userId,
            subject_id: newSubId,
            subject_name: String(l.subject_name ?? ''),
            date: String(normalizeValue(l.date) ?? ''),
            status: mapAttendanceStatus(String(normalizeValue(l.status) ?? 'present')),
            type: String(l.type ?? 'Lecture'),
            notes: l.notes ?? null,
            semester: l.semester != null ? Number(normalizeValue(l.semester)) : null,
            substituted_by: l.substituted_by ? (idMap.get(String(normalizeValue(l.substituted_by))) ?? String(normalizeValue(l.substituted_by))) : null,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
          }
        })
        await prisma.attendanceLog.createMany({ data: logsData as any })
      }

      // Insert timetable
      if (importData.timetable?.length) {
        const timetableData = (importData.timetable as any[]).map(t => {
          const schedule = JSON.parse(JSON.stringify(t.schedule ?? {}))
          for (const day of Object.keys(schedule)) {
            if (Array.isArray(schedule[day])) {
              for (const slot of schedule[day]) {
                const sRef = String(normalizeValue(slot.subject_id ?? slot.subjectId) ?? '')
                if (sRef && idMap.has(sRef)) {
                  slot.subject_id = idMap.get(sRef)
                  delete slot.subjectId
                }
              }
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
        await prisma.timetable.createMany({ data: timetableData as any })
      }

      // Semester results
      if (importData.semester_results?.length) {
        await prisma.semesterResult.createMany({
          data: (importData.semester_results as any[]).map(r => ({
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
          })),
        })
      }

      // Manual courses
      if (importData.manual_courses?.length) {
        await prisma.manualCourse.createMany({
          data: (importData.manual_courses as any[]).map(c => {
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
          }),
        })
      }

      // User preferences
      if (importData.user_preferences?.length) {
        const pref = (importData.user_preferences as any[])[0]
        await prisma.userPreference.upsert({
          where: { user_id: userId },
          create: { user_id: userId, preferences: pref.preferences ?? {} },
          update: { preferences: pref.preferences ?? {} },
        })
      }

      // Skills
      if (importData.skills?.length) {
        await prisma.skill.createMany({
          data: (importData.skills as any[]).map(s => ({
            id: randomUUID(),
            user_id: userId,
            name: String(s.name ?? ''),
            category: s.category ?? null,
            level: s.level ?? null,
            progress: Number(s.progress ?? 0),
            notes: s.notes ?? '',
          })),
        })
      }

      // Restore profile
      if (importData.user_profile) {
        const profile = { ...(importData.user_profile as Record<string, unknown>) }
        const allowedFields = [
          'name', 'picture', 'branch', 'course', 'college', 'batch',
          'enrollment_number', 'mother_name', 'father_name', 'gender',
          'phone_number', 'admission_year', 'headline', 'linkedin_url',
          'github_url', 'portfolio_url', 'current_semester', 'target_attendance', 'attendance_threshold', 'warning_threshold'
        ]
        const numericFields = ['current_semester', 'target_attendance', 'attendance_threshold', 'warning_threshold']
        const filteredProfile: Record<string, unknown> = {}
        for (const key of allowedFields) {
          if (profile[key] !== undefined) {
            filteredProfile[key] = numericFields.includes(key) ? Number(profile[key]) : profile[key]
          }
        }
        await prisma.user.update({ where: { id: userId }, data: filteredProfile as any })
      }
    } catch (txErr: any) {
      console.error('[data/import] Transaction failed at:', txErr.table || 'unknown', txErr)
      throw txErr;
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
    const [s, al, t, sr, mc, up, sk, sl] = await Promise.all([
      prisma.subject.deleteMany({ where: { user_id: userId } }),
      // attendance_logs cascade-deleted with subjects — but also delete orphans
      prisma.attendanceLog.deleteMany({ where: { user_id: userId } }),
      prisma.timetable.deleteMany({ where: { user_id: userId } }),
      prisma.semesterResult.deleteMany({ where: { user_id: userId } }),
      prisma.manualCourse.deleteMany({ where: { user_id: userId } }),
      prisma.userPreference.deleteMany({ where: { user_id: userId } }),
      prisma.skill.deleteMany({ where: { user_id: userId } }),
      prisma.systemLog.deleteMany({ where: { user_id: userId } }),
    ])

    const summary = { subjects: s.count, attendance_logs: al.count, timetable: t.count, semester_results: sr.count, manual_courses: mc.count, user_preferences: up.count, skills: sk.count, system_logs: sl.count }

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
        headline: null,
        linkedin_url: null,
        github_url: null,
        portfolio_url: null,
        current_semester: 1,
        target_attendance: 75,
        attendance_threshold: 75,
        warning_threshold: 76,
        biometrics: {},
        picture: null
      }
    })

    console.warn(`🚨 DELETE ALL DATA for user ${userId} from IP: ${req.ip}`)

    await prisma.systemLog.create({
      data: { user_id: userId, action: 'Account Reset', description: `All personal data deleted. Backup ID: ${backup.id}. Summary: ${JSON.stringify(summary)}. IP: ${req.ip}.` },
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

    // Clear current data and restore all sequentially
    try {
      // Clear current records
      await prisma.subject.deleteMany({ where: { user_id: userId } })
      await prisma.attendanceLog.deleteMany({ where: { user_id: userId } })
      await prisma.timetable.deleteMany({ where: { user_id: userId } })
      await prisma.semesterResult.deleteMany({ where: { user_id: userId } })
      await prisma.manualCourse.deleteMany({ where: { user_id: userId } })
      await prisma.userPreference.deleteMany({ where: { user_id: userId } })
      await prisma.skill.deleteMany({ where: { user_id: userId } })
      await prisma.systemLog.deleteMany({ where: { user_id: userId } })

      // Restore subjects with ID mapping
      const idMap = new Map<string, string>()
      if (data.subjects?.length) {
        const subjectsData = (data.subjects as any[]).map(s => {
          const oldId = String(s._id ?? s.id ?? '')
          const newId = randomUUID()
          if (oldId) idMap.set(oldId, newId)
          return { id: newId, user_id: userId, name: String(s.name ?? ''), code: String(s.code ?? ''), professor: String(s.professor ?? ''), classroom: String(s.classroom ?? ''), semester: Number(s.semester ?? 1), type: String(s.type ?? 'theory'), credits: s.credits != null ? Number(s.credits) : null, attended: Number(s.attended ?? 0), total: Number(s.total ?? 0), target: Number(s.target ?? 75), categories: Array.isArray(s.categories) ? s.categories : ['Theory'], practicals: s.practicals ?? null, assignments: s.assignments ?? null, syllabus: s.syllabus ?? null }
        })
        await prisma.subject.createMany({ data: subjectsData })
      }

      if (data.attendance_logs?.length) {
        await prisma.attendanceLog.createMany({
          data: (data.attendance_logs as any[]).map(l => ({ id: randomUUID(), user_id: userId, subject_id: idMap.get(String(l.subject_id ?? '')) ?? String(l.subject_id ?? ''), subject_name: String(l.subject_name ?? ''), date: String(l.date ?? ''), status: l.status ?? 'present', type: String(l.type ?? 'Lecture'), notes: l.notes ?? null, semester: l.semester != null ? Number(l.semester) : null, substituted_by: l.substituted_by ? (idMap.get(String(l.substituted_by)) ?? String(l.substituted_by)) : null, timestamp: l.timestamp ? new Date(l.timestamp) : new Date() })) as any,
        })
      }

      if (data.timetable?.length) {
        await prisma.timetable.createMany({
          data: (data.timetable as any[]).map(t => { const schedule = JSON.parse(JSON.stringify(t.schedule ?? {})); for (const day of Object.keys(schedule)) { if (Array.isArray(schedule[day])) for (const slot of schedule[day]) { const sRef = String(slot.subject_id ?? ''); if (sRef && idMap.has(sRef)) slot.subject_id = idMap.get(sRef) } } return { id: randomUUID(), user_id: userId, semester: Number(t.semester ?? 1), schedule, periods: t.periods ?? null } }) as any,
        })
      }

      if (data.semester_results?.length) {
        await prisma.semesterResult.createMany({ data: (data.semester_results as any[]).map(r => ({ id: randomUUID(), user_id: userId, semester: Number(r.semester ?? 1), subjects: r.subjects ?? [], sgpa: Number(r.sgpa ?? 0), total_credits: Number(r.total_credits ?? 0), student_info: r.student_info ?? null, source: r.source ?? 'manual' })) })
      }

      if (data.manual_courses?.length) {
        await prisma.manualCourse.createMany({
          data: (data.manual_courses as any[]).map(c => {
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
              extra: Object.keys(extra).length ? extra : null
            }
          })
        })
      }

      if (data.user_preferences?.length) {
        const pref = (data.user_preferences as any[])[0]
        await prisma.userPreference.upsert({ where: { user_id: userId }, create: { user_id: userId, preferences: pref.preferences ?? {} }, update: { preferences: pref.preferences ?? {} } })
      }

      if (data.skills?.length) {
        await prisma.skill.createMany({ data: (data.skills as any[]).map(s => ({ id: randomUUID(), user_id: userId, name: String(s.name ?? ''), category: s.category ?? null, level: s.level ?? null, progress: Number(s.progress ?? 0), notes: s.notes ?? '' })) })
      }
    } catch (txErr) {
        throw txErr;
    }

    ok(res, { message: 'Backup restored successfully' })
  } catch (err) {
    console.error('[data/restore]', err)
    fail(res, 'Restore failed', 'RESTORE_FAILED', 500)
  }
})

export default router
