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

    // 1. Clear existing data
    await Promise.all([
      prisma.subject.deleteMany({ where: { user_id: userId } }), // cascades attendance_logs
      prisma.timetable.deleteMany({ where: { user_id: userId } }),
      prisma.semesterResult.deleteMany({ where: { user_id: userId } }),
      prisma.manualCourse.deleteMany({ where: { user_id: userId } }),
      prisma.userPreference.deleteMany({ where: { user_id: userId } }),
      prisma.skill.deleteMany({ where: { user_id: userId } }),
      prisma.systemLog.deleteMany({ where: { user_id: userId } }),
    ])

    // 2. Insert subjects first — build ID map from old id → new id
    if (importData.subjects?.length) {
      const subjectsData = (importData.subjects as any[]).map(s => {
        const oldId = String(s._id ?? s.id ?? '')
        const newId = randomUUID()
        if (oldId) idMap.set(oldId, newId)
        return {
          id: newId,
          user_id: userId,
          name: String(s.name ?? ''),
          code: String(s.code ?? ''),
          professor: String(s.professor ?? ''),
          classroom: String(s.classroom ?? ''),
          semester: Number(s.semester ?? 1),
          type: String(s.type ?? 'theory'),
          credits: s.credits != null ? Number(s.credits) : null,
          attended: Number(s.attended ?? 0),
          total: Number(s.total ?? 0),
          target: Number(s.target ?? 75),
          categories: Array.isArray(s.categories) ? s.categories : ['Theory'],
          practicals: s.practicals ?? null,
          assignments: s.assignments ?? null,
          syllabus: s.syllabus ?? null,
        }
      })
      await prisma.subject.createMany({ data: subjectsData }).catch(() => null)
    }

    // 3. Insert attendance logs — remap subject_id
    if (importData.attendance_logs?.length) {
      const logsData = (importData.attendance_logs as any[]).map(l => {
        const oldSubId = String(l.subject_id ?? '')
        const newSubId = idMap.get(oldSubId) ?? oldSubId
        return {
          id: randomUUID(),
          user_id: userId,
          subject_id: newSubId,
          subject_name: String(l.subject_name ?? ''),
          date: String(l.date ?? ''),
          status: l.status ?? 'present',
          type: String(l.type ?? 'Lecture'),
          notes: l.notes ?? null,
          semester: l.semester != null ? Number(l.semester) : null,
          substituted_by: l.substituted_by ? (idMap.get(String(l.substituted_by)) ?? String(l.substituted_by)) : null,
          timestamp: l.timestamp ? new Date(l.timestamp) : new Date(),
        }
      })
      await prisma.attendanceLog.createMany({ data: logsData as any }).catch(() => null)
    }

    // 4. Insert timetable — remap slot subject_ids
    if (importData.timetable?.length) {
      const timetableData = (importData.timetable as any[]).map(t => {
        const schedule = JSON.parse(JSON.stringify(t.schedule ?? {}))
        for (const day of Object.keys(schedule)) {
          if (Array.isArray(schedule[day])) {
            for (const slot of schedule[day]) {
              const sRef = String(slot.subject_id ?? slot.subjectId ?? '')
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
          semester: Number(t.semester ?? 1),
          schedule,
          periods: t.periods ?? null,
        }
      })
      await prisma.timetable.createMany({ data: timetableData as any }).catch(() => null)
    }

    // 5. Semester results
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
          source: r.source ?? 'manual',
          enrollment_number: r.enrollment_number ?? null,
          semester_label: r.semester_label ?? null,
        })),
      }).catch(() => null)
    }

    // 6. Manual courses
    if (importData.manual_courses?.length) {
      await prisma.manualCourse.createMany({
        data: (importData.manual_courses as any[]).map(c => ({
          id: randomUUID(),
          user_id: userId,
          name: c.name ?? null,
          platform: c.platform ?? c.provider ?? null,
          status: c.status ?? null,
          progress: Number(c.progress ?? c.percentage ?? 0),
          url: c.url ?? null,
          notes: c.notes ?? null,
          extra: c.extra ?? null,
        })),
      }).catch(() => null)
    }

    // 7. User preferences (upsert — 1 per user)
    if (importData.user_preferences?.length) {
      const pref = (importData.user_preferences as any[])[0]
      await prisma.userPreference.upsert({
        where: { user_id: userId },
        create: { user_id: userId, preferences: pref.preferences ?? {} },
        update: { preferences: pref.preferences ?? {} },
      }).catch(() => null)
    }

    // 8. Skills
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
      }).catch(() => null)
    }

    // 9. Restore profile
    if (importData.user_profile) {
      const profile = { ...(importData.user_profile as Record<string, unknown>) }
      delete profile.id; delete profile._id; delete profile.email; delete profile.google_id
      delete profile.created_at; delete profile.updated_at
      await prisma.user.update({ where: { id: userId }, data: profile as any }).catch(() => null)
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

    const body = req.body as { confirmation_email?: string }
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (body.confirmation_email && user) {
      if (body.confirmation_email.toLowerCase() !== user.email.toLowerCase()) {
        fail(res, "Email mismatch. Confirmation email doesn't match your account.", 'EMAIL_MISMATCH', 403)
        return
      }
    }

    // Create auto-backup first
    const backupData = await collectUserData(userId)
    if (user) backupData.user_profile = user

    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    const backup = await prisma.userBackup.create({
      data: { user_id: userId, backup_type: 'pre_delete_auto', data: backupData as any, expires_at: expires },
    })

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

    await prisma.user.update({ where: { id: userId }, data: { course: null, college: null, current_semester: 1, batch: null, picture: null } })

    console.warn(`🚨 DELETE ALL DATA for user ${userId} from IP: ${req.ip}`)

    await prisma.systemLog.create({
      data: { user_id: userId, action: 'Account Reset', description: `All personal data deleted. Backup ID: ${backup.id}. Summary: ${JSON.stringify(summary)}. IP: ${req.ip}.` },
    })

    ok(res, { message: 'All data wiped successfully.', backup_id: backup.id, backup_expires: expires.toISOString(), summary })
  } catch (err) {
    console.error('[data/delete_all]', err)
    fail(res, 'Failed to delete data', 'DELETE_FAILED', 500)
  }
})

// ─── Backups ─────────────────────────────────────────────────────────────────

router.get('/backups', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const backups = await prisma.userBackup.findMany({
      where: { user_id: userId, expires_at: { gt: new Date() } },
      select: { id: true, backup_type: true, created_at: true, expires_at: true },
      orderBy: { created_at: 'desc' },
      take: 10,
    })
    ok(res, { backups: backups.map(b => ({ ...b, _id: b.id })) })
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

    // Clear current data
    await Promise.all([
      prisma.subject.deleteMany({ where: { user_id: userId } }),
      prisma.attendanceLog.deleteMany({ where: { user_id: userId } }),
      prisma.timetable.deleteMany({ where: { user_id: userId } }),
      prisma.semesterResult.deleteMany({ where: { user_id: userId } }),
      prisma.manualCourse.deleteMany({ where: { user_id: userId } }),
      prisma.userPreference.deleteMany({ where: { user_id: userId } }),
      prisma.skill.deleteMany({ where: { user_id: userId } }),
      prisma.systemLog.deleteMany({ where: { user_id: userId } }),
    ])

    // Restore subjects with ID mapping
    const idMap = new Map<string, string>()
    if (data.subjects?.length) {
      const subjectsData = (data.subjects as any[]).map(s => {
        const oldId = String(s._id ?? s.id ?? '')
        const newId = randomUUID()
        if (oldId) idMap.set(oldId, newId)
        return { id: newId, user_id: userId, name: String(s.name ?? ''), code: String(s.code ?? ''), professor: String(s.professor ?? ''), classroom: String(s.classroom ?? ''), semester: Number(s.semester ?? 1), type: String(s.type ?? 'theory'), credits: s.credits != null ? Number(s.credits) : null, attended: Number(s.attended ?? 0), total: Number(s.total ?? 0), target: Number(s.target ?? 75), categories: Array.isArray(s.categories) ? s.categories : ['Theory'], practicals: s.practicals ?? null, assignments: s.assignments ?? null, syllabus: s.syllabus ?? null }
      })
      await prisma.subject.createMany({ data: subjectsData }).catch(() => null)
    }
    if (data.attendance_logs?.length) {
      await prisma.attendanceLog.createMany({
        data: (data.attendance_logs as any[]).map(l => ({ id: randomUUID(), user_id: userId, subject_id: idMap.get(String(l.subject_id ?? '')) ?? String(l.subject_id ?? ''), subject_name: String(l.subject_name ?? ''), date: String(l.date ?? ''), status: l.status ?? 'present', type: String(l.type ?? 'Lecture'), notes: l.notes ?? null, semester: l.semester != null ? Number(l.semester) : null, substituted_by: l.substituted_by ? (idMap.get(String(l.substituted_by)) ?? String(l.substituted_by)) : null, timestamp: l.timestamp ? new Date(l.timestamp) : new Date() })) as any,
      }).catch(() => null)
    }
    if (data.timetable?.length) {
      await prisma.timetable.createMany({
        data: (data.timetable as any[]).map(t => { const schedule = JSON.parse(JSON.stringify(t.schedule ?? {})); for (const day of Object.keys(schedule)) { if (Array.isArray(schedule[day])) for (const slot of schedule[day]) { const sRef = String(slot.subject_id ?? ''); if (sRef && idMap.has(sRef)) slot.subject_id = idMap.get(sRef) } } return { id: randomUUID(), user_id: userId, semester: Number(t.semester ?? 1), schedule, periods: t.periods ?? null } }) as any,
      }).catch(() => null)
    }
    if (data.semester_results?.length) {
      await prisma.semesterResult.createMany({ data: (data.semester_results as any[]).map(r => ({ id: randomUUID(), user_id: userId, semester: Number(r.semester ?? 1), subjects: r.subjects ?? [], sgpa: Number(r.sgpa ?? 0), total_credits: Number(r.total_credits ?? 0), student_info: r.student_info ?? null, source: r.source ?? 'manual' })) }).catch(() => null)
    }
    if (data.manual_courses?.length) {
      await prisma.manualCourse.createMany({ data: (data.manual_courses as any[]).map(c => ({ id: randomUUID(), user_id: userId, name: c.name ?? null, platform: c.platform ?? null, status: c.status ?? null, progress: Number(c.progress ?? 0), url: c.url ?? null, notes: c.notes ?? null })) }).catch(() => null)
    }
    if (data.user_preferences?.length) {
      const pref = (data.user_preferences as any[])[0]
      await prisma.userPreference.upsert({ where: { user_id: userId }, create: { user_id: userId, preferences: pref.preferences ?? {} }, update: { preferences: pref.preferences ?? {} } }).catch(() => null)
    }
    if (data.skills?.length) {
      await prisma.skill.createMany({ data: (data.skills as any[]).map(s => ({ id: randomUUID(), user_id: userId, name: String(s.name ?? ''), category: s.category ?? null, level: s.level ?? null, progress: Number(s.progress ?? 0), notes: s.notes ?? '' })) }).catch(() => null)
    }
    ok(res, { message: 'Backup restored successfully' })
  } catch (err) {
    console.error('[data/restore]', err)
    fail(res, 'Restore failed', 'RESTORE_FAILED', 500)
  }
})

export default router
