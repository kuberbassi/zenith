import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { GradeCalculator } from '../lib/calculations.js'
import { fetchIpuResults } from '../services/ipuClient.js'
import { ok, created, fail } from '../utils/response.js'

const router = Router()
router.use(requireAuth)

function isMeaningfulValue(value: unknown): boolean {
    if (value === null || value === undefined) return false
    if (typeof value === 'string') {
        const normalized = value.trim()
        return normalized !== '' && normalized !== '-' && normalized !== '---' && normalized.toLowerCase() !== 'null'
    }
    return true
}

function mergePreferredRecord<T extends Record<string, unknown>>(primary: T, fallback: T): T {
    const merged: Record<string, unknown> = { ...fallback }
    for (const [key, value] of Object.entries(primary)) {
        if (isMeaningfulValue(value)) merged[key] = value
    }
    return merged as T
}

const SemesterParamSchema = z.object({ semester: z.string().regex(/^\d+$/).transform(Number) })

async function sysLog(req: AuthRequest, user_id: string, action: string, description: string) {
    const ip = req.ip || req.socket?.remoteAddress || null
    const user_agent = (req.headers['user-agent'] as string) || null
    await prisma.systemLog.create({ data: { user_id, action, description, ip, user_agent } }).catch(() => null)
}

// ─── Subjects ────────────────────────────────────────────────────────────────

const CreateSubjectSchema = z.object({
    name: z.string().min(1).max(200),
    semester: z.number().int().min(1).default(1),
    code: z.string().max(50).optional().default(''),
    professor: z.string().max(200).optional().default(''),
    classroom: z.string().max(100).optional().default(''),
    type: z.string().optional().default('theory'),
    credits: z.number().optional().default(0),
    categories: z.array(z.string()).optional().default(['Theory']),
    target: z.number().min(0).max(100).optional().default(75),
    syllabus: z.string().optional().default(''),
    practical_total: z.number().optional().default(10),
    assignment_total: z.number().optional().default(4),
})

const UpdateSubjectSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    semester: z.number().int().min(1).optional(),
    code: z.string().max(50).optional(),
    professor: z.string().max(200).optional(),
    classroom: z.string().max(100).optional(),
    type: z.string().optional(),
    credits: z.number().optional(),
    categories: z.array(z.string()).optional(),
    target: z.number().min(0).max(100).optional(),
    syllabus: z.string().optional(),
    practicals: z.object({ total: z.number().optional(), completed: z.number().optional(), hardcopy: z.boolean().optional() }).optional(),
    assignments: z.object({ total: z.number().optional(), completed: z.number().optional(), hardcopy: z.boolean().optional() }).optional(),
    practical_total: z.number().optional(),
    assignment_total: z.number().optional(),
}).passthrough()

const SemesterQuerySchema = z.object({
    semester: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v, 10) : 1),
})

/* GET /api/academic/subjects */
router.get('/subjects', async (req: AuthRequest, res) => {
    try {
        const { semester } = SemesterQuerySchema.parse(req.query)
        const userId = req.userId!
        const subjects = await prisma.subject.findMany({
            where: {
                user_id: userId,
                ...(semester === 1 ? { OR: [{ semester: 1 }, { semester: null as any }] } : { semester }),
            },
            orderBy: { name: 'asc' },
        })
        ok(res, subjects.map(s => ({ ...s, _id: s.id })))
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
        console.error('[academic/subjects GET]', err)
        fail(res, 'Failed to fetch subjects', 'FETCH_FAILED', 500)
    }
})

/* GET /api/academic/full_subjects_data */
router.get('/full_subjects_data', async (req: AuthRequest, res) => {
    try {
        const { semester } = SemesterQuerySchema.parse(req.query)
        const userId = req.userId!
        const subjects = await prisma.subject.findMany({
            where: {
                user_id: userId,
                ...(semester === 1 ? { OR: [{ semester: 1 }, { semester: null as any }] } : { semester }),
            },
        })
        const enriched = subjects.map(sub => {
            const attended = sub.attended ?? 0
            const total = sub.total ?? 0
            const pct = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0
            return { ...sub, _id: sub.id, percentage: pct, status_message: pct < 75 ? 'Low Attendance' : 'On Track' }
        })
        ok(res, enriched)
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
        console.error('[academic/full_subjects_data GET]', err)
        fail(res, 'Failed to fetch subjects data', 'FETCH_FAILED', 500)
    }
})

/* POST /api/academic/subjects */
router.post('/subjects', async (req: AuthRequest, res) => {
    try {
        const body = CreateSubjectSchema.parse(req.body)
        const userId = req.userId!
        const userThreshold = req.user?.attendance_threshold ?? 75
        const target = body.target === 75 ? userThreshold : body.target
        const subject = await prisma.subject.create({
            data: {
                user_id: userId,
                name: body.name,
                semester: body.semester,
                code: body.code,
                professor: body.professor,
                classroom: body.classroom,
                type: body.type,
                credits: body.credits,
                categories: body.categories,
                target,
                syllabus: body.syllabus,
                practicals: { total: body.practical_total, completed: 0, hardcopy: false },
                assignments: { total: body.assignment_total, completed: 0, hardcopy: false },
            },
        })
        sysLog(req, userId, 'Subject Added', `Added '${body.name}' to semester ${body.semester}`).catch(() => { })
        created(res, { _id: subject.id, ...subject })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/subjects POST]', err)
        fail(res, 'Failed to create subject', 'CREATE_FAILED', 500)
    }
})

/* GET /api/academic/subjects/:id */
router.get('/subjects/:id', async (req: AuthRequest, res) => {
    try {
        const subjectId = String(req.params.id)
        const userId = req.userId!
        const subject = await prisma.subject.findFirst({ where: { id: subjectId, user_id: userId } })
        if (!subject) { fail(res, 'Subject not found', 'NOT_FOUND', 404); return }
        ok(res, { _id: subject.id, ...subject })
    } catch (err) {
        console.error('[academic/subjects/:id GET]', err)
        fail(res, 'Failed to fetch subject', 'FETCH_FAILED', 500)
    }
})

async function handleUpdateSubject(req: AuthRequest, res: any) {
    try {
        const subjectId = String(req.params.id)
        const userId = req.userId!
        const data = UpdateSubjectSchema.parse(req.body)

        const existing = await prisma.subject.findFirst({ where: { id: subjectId, user_id: userId } })
        if (!existing) { fail(res, 'Subject not found', 'NOT_FOUND', 404); return }

        const allowedFields = ['name', 'semester', 'categories', 'type', 'code', 'professor', 'classroom', 'credits', 'syllabus', 'target']
        const updateData: Record<string, unknown> = {}
        for (const k of allowedFields) {
            if (k in data) updateData[k] = (data as Record<string, unknown>)[k]
        }

        // Handle practicals (JSON read-modify-write)
        if (data.practicals || data.practical_total !== undefined) {
            const cur = { ...(((existing.practicals ?? { total: 10, completed: 0, hardcopy: false }) as Record<string, unknown>)) }
            if (data.practicals) {
                for (const [k, v] of Object.entries(data.practicals)) { if (v !== undefined) cur[k] = v }
            } else if (data.practical_total !== undefined) {
                cur['total'] = data.practical_total
            }
            updateData['practicals'] = cur
        }

        // Handle assignments (JSON read-modify-write)
        if (data.assignments || data.assignment_total !== undefined) {
            const cur = { ...(((existing.assignments ?? { total: 4, completed: 0, hardcopy: false }) as Record<string, unknown>)) }
            if (data.assignments) {
                for (const [k, v] of Object.entries(data.assignments)) { if (v !== undefined) cur[k] = v }
            } else if (data.assignment_total !== undefined) {
                cur['total'] = data.assignment_total
            }
            updateData['assignments'] = cur
        }

        await prisma.subject.update({ where: { id: subjectId }, data: updateData })
        ok(res, { message: 'Subject updated' })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/subjects/:id PUT]', err)
        fail(res, 'Failed to update subject', 'UPDATE_FAILED', 500)
    }
}

router.put('/subjects/:id', handleUpdateSubject)
router.patch('/subjects/:id', handleUpdateSubject)

/* DELETE /api/academic/subjects/:id */
router.delete('/subjects/:id', async (req: AuthRequest, res) => {
    try {
        const subjectId = String(req.params.id)
        const userId = req.userId!
        const subject = await prisma.subject.findFirst({ where: { id: subjectId, user_id: userId } })
        if (!subject) { fail(res, 'Subject not found', 'NOT_FOUND', 404); return }
        // onDelete: Cascade in schema auto-deletes attendance_logs
        await prisma.subject.delete({ where: { id: subjectId } })
        sysLog(req, userId, 'Subject Deleted', `Deleted subject '${subject.name}'`).catch(() => { })
        ok(res, { message: 'Subject deleted' })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/subjects/:id DELETE]', err)
        fail(res, 'Failed to delete subject', 'DELETE_FAILED', 500)
    }
})

/* POST /api/academic/subjects/:id/attendance-count */
const AttendanceCountSchema = z.object({
    attended: z.number().int().min(0).default(0),
    total: z.number().int().min(0).default(0),
})

router.post('/subjects/:id/attendance-count', async (req: AuthRequest, res) => {
    try {
        const subjectId = String(req.params.id)
        const userId = req.userId!
        const { attended, total } = AttendanceCountSchema.parse(req.body)
        const existing = await prisma.subject.findFirst({ where: { id: subjectId, user_id: userId } })
        if (!existing) { fail(res, 'Subject not found', 'NOT_FOUND', 404); return }
        await prisma.subject.update({ where: { id: subjectId }, data: { attended, total } })
        ok(res, { message: 'Attendance count updated' })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/attendance-count]', err)
        fail(res, 'Failed to update count', 'UPDATE_FAILED', 500)
    }
})

// ─── Semester Results ────────────────────────────────────────────────────────

router.get('/results', async (req: AuthRequest, res) => {
    try {
        const userId = req.userId!
        const results = await prisma.semesterResult.findMany({
            where: { user_id: userId },
            orderBy: { semester: 'asc' },
        })
        if (results.length) {
            const semesters = results.map(r => r.subjects as Array<Record<string, unknown>>)
            const cgpaCalc = GradeCalculator.calculateCGPA(semesters)
            ok(res, results.map(r => ({ ...r, _id: r.id, cgpa: cgpaCalc.cgpa })))
        } else {
            ok(res, [])
        }
    } catch (err) {
        console.error('[academic/results GET]', err)
        fail(res, 'Failed to fetch results', 'FETCH_FAILED', 500)
    }
})

router.get('/results/analytics', async (req: AuthRequest, res) => {
    try {
        const userId = req.userId!
        const results = await prisma.semesterResult.findMany({
            where: { user_id: userId },
            orderBy: { semester: 'asc' },
        })
        if (!results.length) {
            ok(res, { cgpa: 0, semesters: [], gradeDistribution: {}, overallPercentage: 0 })
            return
        }

        const userDoc = await prisma.user.findUnique({ where: { id: userId } })
        const rawStudentInfo = results.reduce((acc, row) => {
            const current = (row.student_info ?? {}) as Record<string, unknown>
            return mergePreferredRecord(current, acc)
        }, {} as Record<string, unknown>)
        const enrichedStudentInfo = {
            ...(userDoc?.name ? { name: userDoc.name } : {}),
            ...(userDoc?.enrollment_number ? { roll_no: userDoc.enrollment_number } : {}),
            ...(userDoc?.mother_name ? { mother: userDoc.mother_name } : {}),
            ...(userDoc?.phone_number ? { phone: userDoc.phone_number } : {}),
            ...(userDoc?.email ? { email: userDoc.email } : {}),
            ...(userDoc?.gender ? { gender: userDoc.gender } : {}),
            ...(userDoc?.batch ? { batch: userDoc.batch } : {}),
            ...(userDoc?.course ? { programme: userDoc.course } : {}),
            ...(userDoc?.college ? { institution: userDoc.college } : {}),
            ...(userDoc?.admission_year ? { admission_year: userDoc.admission_year } : {}),
            ...rawStudentInfo,
        }

        const mappedSemesters = results.map(r => ({
            semester: String(r.semester),
            semester_num: r.semester,
            semester_label: r.semester_label || `Semester ${r.semester}`,
            subjects: r.subjects || [],
            sgpa: r.sgpa ? String(r.sgpa) : null,
            total_marks: r.total_marks || null,
            max_marks: r.max_marks || null,
        }))

        const semSubjects = results.map(r => r.subjects as Array<Record<string, unknown>>)
        const cgpaCalc = GradeCalculator.calculateCGPA(semSubjects)

        const gradeDist: Record<string, number> = {}
        let totalMarks = 0
        let totalMaxMarks = 0
        results.forEach(r => {
            if (Array.isArray(r.subjects)) {
                (r.subjects as any[]).forEach((s: any) => {
                    if (s.is_pending || s.grade === '-' || s.total_marks === null) return
                    totalMarks += Number(s.total_marks ?? 0)
                    totalMaxMarks += Number(s.max_marks ?? 100)
                    const g = (s.grade || 'F').toString().toUpperCase()
                    gradeDist[g] = (gradeDist[g] || 0) + 1
                })
            }
        })

        const academicStrength = totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 100) : 0

        ok(res, {
            enrollment_number: results.find(r => r.enrollment_number)?.enrollment_number || userDoc?.enrollment_number || '',
            student_info: enrichedStudentInfo,
            last_updated: results.reduce((latest: Date, r) => {
                const d = new Date(r.updated_at)
                return d > latest ? d : latest
            }, new Date(0)).toISOString(),
            cgpa: cgpaCalc.cgpa,
            overallPercentage: totalMaxMarks > 0 ? parseFloat(((totalMarks / totalMaxMarks) * 100).toFixed(1)) : 0,
            academicStrength,
            gradeDistribution: gradeDist,
            totalSubjects: Object.values(gradeDist).reduce((a, b) => a + b, 0),
            totalMarks,
            totalMaxMarks,
            semesters: mappedSemesters,
            saved: true,
        })
    } catch (err) {
        console.error('[academic/results/analytics GET]', err)
        fail(res, 'Failed to fetch analytics', 'FETCH_FAILED', 500)
    }
})

// ─── Results Sync ────────────────────────────────────────────────────────────

const SyncSchema = z.object({
    cookies: z.string().min(1),
    semester: z.number().int().min(1).max(12),
})

router.post('/results/sync', async (req: AuthRequest, res) => {
    try {
        const userId = req.userId!
        const { cookies, semester } = SyncSchema.parse(req.body)

        const scrapedData = await fetchIpuResults(cookies, semester)
        if (!scrapedData || scrapedData.length === 0) {
            fail(res, 'No results found for this session', 'NOT_FOUND', 404)
            return
        }

        const meta = scrapedData[0]
        const studentInfo = {
            name: meta.stname, father: meta.father, institution: meta.iname,
            programme: meta.prgname, batch: meta.byoa, roll_no: meta.nrollno, enrollment_no: meta.nrollno,
        }

        const processedSubjects = scrapedData.map(row => {
            const internal = parseFloat(row.minorprint === '-' ? '0' : row.minorprint) || 0
            const external = parseFloat(row.majorprint === '-' ? '0' : row.majorprint) || 0
            const totalMarks = parseFloat(row.moderatedprint) || (internal + external)
            const sub = { name: row.papername, code: row.papercode, credits: 4, internal_theory: internal, external_theory: external, total_marks: totalMarks, max_marks: 100, grade: '' }
            return { ...sub, ...GradeCalculator.calculateSubjectResult(sub) }
        })

        const sgpaCalc = GradeCalculator.calculateSGPA(processedSubjects)
        const finalSgpa = meta.eugpa || sgpaCalc.sgpa
        const totalMarksSum = processedSubjects.reduce((a, s: any) => a + (parseFloat(s.total_marks) || 0), 0)
        const maxMarksSum = processedSubjects.reduce((a, s: any) => a + (parseFloat(s.max_marks) || 100), 0)
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })

        await prisma.semesterResult.upsert({
            where: { user_id_semester: { user_id: userId, semester } },
            create: { user_id: userId, semester, subjects: processedSubjects, sgpa: finalSgpa, total_credits: sgpaCalc.total_credits, student_info: studentInfo, source: 'ipu_scraper', total_marks: String(totalMarksSum), max_marks: String(maxMarksSum), enrollment_number: meta.nrollno || null, owner_email: user?.email || null },
            update: { subjects: processedSubjects, sgpa: finalSgpa, total_credits: sgpaCalc.total_credits, student_info: studentInfo, source: 'ipu_scraper', total_marks: String(totalMarksSum), max_marks: String(maxMarksSum), enrollment_number: meta.nrollno || null, owner_email: user?.email || null, updated_at: new Date() },
        })

        sysLog(req, userId, 'Results Synced', `Fetched results for Semester ${semester} via direct API`).catch(() => { })
        ok(res, { message: 'Results synced successfully', sgpa: finalSgpa, subjects: processedSubjects.length, student_info: studentInfo })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/results/sync POST]', err)
        fail(res, 'Sync failed', 'SYNC_FAILED', 500)
    }
})

const SaveResultSchema = z.object({
    semester: z.number().int().min(1).max(12),
    subjects: z.array(z.record(z.any())).min(1),
})

router.post('/results', async (req: AuthRequest, res) => {
    try {
        const userId = req.userId!
        const { semester, subjects: subjectsData } = SaveResultSchema.parse(req.body)

        const processedSubjects = subjectsData.map(sub => {
            const calc = GradeCalculator.calculateSubjectResult(sub)
            return { ...sub, ...calc, name: String(sub.name || 'Unknown'), code: String(sub.code || ''), credits: parseInt(String(sub.credits ?? 0)) }
        })

        const sgpaCalc = GradeCalculator.calculateSGPA(processedSubjects)
        const totalMarksSum = processedSubjects.reduce((a: number, s: any) => a + (parseFloat(s.total_marks) || 0), 0)
        const maxMarksSum = processedSubjects.reduce((a: number, s: any) => a + (parseFloat(s.max_marks) || 100), 0)
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, enrollment_number: true } })
        await prisma.semesterResult.upsert({
            where: { user_id_semester: { user_id: userId, semester } },
            create: { user_id: userId, semester, subjects: processedSubjects, sgpa: sgpaCalc.sgpa, total_credits: sgpaCalc.total_credits, total_marks: totalMarksSum ? String(totalMarksSum) : null, max_marks: maxMarksSum ? String(maxMarksSum) : null, owner_email: user?.email || null, enrollment_number: user?.enrollment_number || null },
            update: { subjects: processedSubjects, sgpa: sgpaCalc.sgpa, total_credits: sgpaCalc.total_credits, total_marks: totalMarksSum ? String(totalMarksSum) : null, max_marks: maxMarksSum ? String(maxMarksSum) : null, updated_at: new Date() },
        })

        sysLog(req, userId, 'Result Updated', `Semester ${semester} result saved. SGPA: ${sgpaCalc.sgpa}`).catch(() => { })
        ok(res, { sgpa: sgpaCalc.sgpa })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/results POST]', err)
        fail(res, 'Failed to save results', 'SAVE_FAILED', 500)
    }
})

router.delete('/results/:semester', async (req: AuthRequest, res) => {
    try {
        const userId = req.userId!
        const { semester } = SemesterParamSchema.parse(req.params)
        const { count } = await prisma.semesterResult.deleteMany({ where: { user_id: userId, semester } })
        if (count === 0) { fail(res, 'Result not found', 'NOT_FOUND', 404); return }
        sysLog(req, userId, 'Result Deleted', `Deleted results for Semester ${semester}`).catch(() => { })
        ok(res, { message: `Semester ${semester} results deleted` })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/results DELETE]', err)
        fail(res, 'Failed to delete results', 'DELETE_FAILED', 500)
    }
})

// ─── Manual / Online Courses ─────────────────────────────────────────────────

// Accepts both frontend format (title/progress/instructor/enrolledDate/targetCompletionDate)
// and legacy backend format (name/provider/percentage).
const ManualCourseSchema = z.object({
    title: z.string().max(200).nullish(),
    name: z.string().max(200).nullish(),
    platform: z.string().max(200).nullish(),
    provider: z.string().max(200).nullish(),
    url: z.string().nullish(),
    progress: z.number().min(0).max(100).nullish(),
    percentage: z.number().min(0).max(100).nullish(),
    status: z.enum(['not_started', 'in_progress', 'completed']).nullish(),
    instructor: z.string().max(200).nullish(),
    enrolledDate: z.string().nullish(),
    targetCompletionDate: z.string().nullish(),
    certificateUrl: z.string().nullish(),
    notes: z.string().max(1000).nullish(),
})

function normalizeCourseForSave(raw: z.infer<typeof ManualCourseSchema>) {
    const courseName = raw.title || raw.name || ''
    if (!courseName) throw new Error('Course name/title is required')
    const progress = raw.progress ?? raw.percentage ?? 0
    const computedStatus = raw.status ?? (progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started')
    const platform = raw.platform || raw.provider || null
    const extra: Record<string, string> = {}
    if (raw.instructor) extra.instructor = raw.instructor
    if (raw.enrolledDate) extra.enrolledDate = raw.enrolledDate
    if (raw.targetCompletionDate) extra.targetCompletionDate = raw.targetCompletionDate
    if (raw.certificateUrl) extra.certificateUrl = raw.certificateUrl
    return { name: courseName, platform, status: computedStatus, progress, url: raw.url || null, notes: raw.notes || '', extra }
}

function formatCourseForClient(c: { id: string; name: string | null; platform: string | null; status: string | null; progress: number; url: string | null; notes: string | null; extra: unknown; created_at: Date }) {
    const extra = (c.extra as Record<string, string> | null) ?? {}
    const progress = c.progress ?? 0
    const computedStatus = c.status ?? (progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started')
    return {
        ...c,
        _id: c.id,
        title: c.name ?? extra.title ?? '',
        platform: c.platform ?? 'custom',
        status: computedStatus,
        url: c.url ?? '',
        progress,
        notes: c.notes ?? '',
        instructor: extra.instructor ?? '',
        enrolledDate: extra.enrolledDate ?? c.created_at.toISOString().slice(0, 10),
        targetCompletionDate: extra.targetCompletionDate ?? '',
        certificateUrl: extra.certificateUrl ?? '',
    }
}

router.get('/courses/manual', async (req: AuthRequest, res) => {
    try {
        const userId = req.userId!
        const courses = await prisma.manualCourse.findMany({ where: { user_id: userId } })
        ok(res, courses.map(c => formatCourseForClient(c)))
    } catch (err) {
        console.error('[academic/courses/manual GET]', err)
        fail(res, 'Failed to fetch courses', 'FETCH_FAILED', 500)
    }
})

router.post('/courses/manual', async (req: AuthRequest, res) => {
    try {
        const userId = req.userId!
        const data = req.body
        if (Array.isArray(data)) {
            const items = data.map(c => normalizeCourseForSave(ManualCourseSchema.parse(c)))
            // Neon HTTP adapter does not support transactions — run ops sequentially
            await prisma.manualCourse.deleteMany({ where: { user_id: userId } })
            for (const i of items) {
                await prisma.manualCourse.create({
                    data: {
                        user_id: userId,
                        name: i.name,
                        platform: i.platform,
                        status: i.status,
                        progress: i.progress,
                        url: i.url,
                        notes: i.notes,
                        extra: Object.keys(i.extra).length ? i.extra as any : undefined,
                    },
                })
            }
        } else {
            const item = normalizeCourseForSave(ManualCourseSchema.parse(data))
            await prisma.manualCourse.create({
                data: { user_id: userId, name: item.name, platform: item.platform, status: item.status, progress: item.progress, url: item.url, notes: item.notes, extra: Object.keys(item.extra).length ? item.extra as any : undefined },
            })
        }
        ok(res, { message: 'Courses saved' })
    } catch (err) {
        if (err instanceof z.ZodError) {
            console.error('[academic/courses/manual POST] Zod validation errors:', JSON.stringify(err.errors, null, 2))
            fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return
        }
        if (err instanceof Error && err.message === 'Course name/title is required') { fail(res, err.message, 'INVALID_PARAMS', 400); return }
        console.error('[academic/courses/manual POST]', err)
        fail(res, 'Failed to save courses', 'SAVE_FAILED', 500)
    }
})

router.put('/courses/manual/:id', async (req: AuthRequest, res) => {
    try {
        const courseId = String(req.params.id)
        const userId = req.userId!
        const raw = ManualCourseSchema.partial().parse(req.body)
        const existing = await prisma.manualCourse.findFirst({ where: { id: courseId, user_id: userId } })
        if (!existing) { fail(res, 'Course not found', 'NOT_FOUND', 404); return }

        const existingExtra = (existing.extra as Record<string, string> | null) ?? {}
        const newExtra: Record<string, string> = { ...existingExtra }
        if (raw.instructor !== undefined) newExtra.instructor = raw.instructor ?? ''
        if (raw.enrolledDate !== undefined) newExtra.enrolledDate = raw.enrolledDate ?? ''
        if (raw.targetCompletionDate !== undefined) newExtra.targetCompletionDate = raw.targetCompletionDate ?? ''
        if (raw.certificateUrl !== undefined) newExtra.certificateUrl = raw.certificateUrl ?? ''

        const progress = raw.progress ?? raw.percentage ?? existing.progress
        const computedStatus = raw.status ?? (progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started')

        const course = await prisma.manualCourse.update({
            where: { id: courseId },
            data: {
                ...(raw.title || raw.name ? { name: raw.title || raw.name } : {}),
                ...(raw.platform !== undefined ? { platform: raw.platform || raw.provider || null } : {}),
                status: computedStatus,
                progress,
                ...(raw.url !== undefined ? { url: raw.url || null } : {}),
                ...(raw.notes !== undefined ? { notes: raw.notes } : {}),
                extra: Object.keys(newExtra).length ? newExtra as any : undefined,
            },
        })
        ok(res, { message: 'Course updated', course: formatCourseForClient(course) })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/courses/manual PUT]', err)
        fail(res, 'Failed to update course', 'UPDATE_FAILED', 500)
    }
})

router.delete('/courses/manual/:id', async (req: AuthRequest, res) => {
    try {
        const courseId = String(req.params.id)
        const userId = req.userId!
        const existing = await prisma.manualCourse.findFirst({ where: { id: courseId, user_id: userId } })
        if (!existing) { fail(res, 'Course not found', 'NOT_FOUND', 404); return }
        await prisma.manualCourse.delete({ where: { id: courseId } })
        ok(res, { message: 'Course deleted' })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/courses/manual DELETE]', err)
        fail(res, 'Failed to delete course', 'DELETE_FAILED', 500)
    }
})

export default router
