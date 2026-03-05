import { Router } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { Subject } from '../models/Subject.js'
import { AttendanceLog } from '../models/AttendanceLog.js'
import { SemesterResult } from '../models/SemesterResult.js'
import { ManualCourse } from '../models/ManualCourse.js'
import { SystemLog } from '../models/SystemLog.js'
import { GradeCalculator } from '../lib/calculations.js'
import { fetchIpuResults } from '../services/ipuClient.js'
import { ok, created, fail } from '../utils/response.js'
import { uf, ownership } from '../utils/userFilter.js'

const router = Router()
router.use(requireAuth)

const MongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID')
const SemesterParamSchema = z.object({ semester: z.string().regex(/^\d+$/).transform(Number) })

async function sysLog(user_id: string, action: string, description: string) {
    await SystemLog.create({ user_id, action, description }).catch(() => null)
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
        const query = SemesterQuerySchema.parse(req.query)
        const semester = query.semester

        const filter: Record<string, unknown> = { ...uf(req) }
        if (semester === 1) {
            filter.$or = [{ semester: 1 }, { semester: { $exists: false } }, { semester: null }]
        } else {
            filter.semester = semester
        }

        const subjects = await Subject.find(filter).sort({ name: 1 }).lean()
        ok(res, subjects)
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400); return }
        console.error('[academic/subjects GET]', err)
        fail(res, 'Failed to fetch subjects', 'FETCH_FAILED', 500)
    }
})

/* GET /api/academic/full_subjects_data */
router.get('/full_subjects_data', async (req: AuthRequest, res) => {
    try {
        const query = SemesterQuerySchema.parse(req.query)
        const semester = query.semester

        const filter: Record<string, unknown> = { ...uf(req) }
        if (semester === 1) {
            filter.$or = [{ semester: 1 }, { semester: { $exists: false } }, { semester: null }]
        } else {
            filter.semester = semester
        }

        const subjects = await Subject.find(filter).lean()
        const enriched = subjects.map((sub) => {
            const attended = sub.attended ?? 0
            const total = sub.total ?? 0
            const pct = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0
            return {
                ...sub,
                percentage: pct,
                status_message: pct < 75 ? 'Low Attendance' : 'On Track',
            }
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

        // Inherit target from user's attendance_threshold if not explicitly set
        const userThreshold = req.user?.attendance_threshold ?? 75
        const target = body.target === 75 ? userThreshold : body.target // 75 is the Zod default, so override it

        const subject = await Subject.create({
            ...body,
            target,
            practicals: { total: body.practical_total, completed: 0, hardcopy: false },
            assignments: { total: body.assignment_total, completed: 0, hardcopy: false },
            ...ownership(req)
        })
        sysLog(req.userId!, 'Subject Added', `Added '${body.name}' to semester ${body.semester}`).catch(() => { })
        created(res, { id: String(subject._id), ...subject.toObject() })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/subjects POST]', err)
        fail(res, 'Failed to create subject', 'CREATE_FAILED', 500)
    }
})

/* GET /api/academic/subjects/:id */
router.get('/subjects/:id', async (req: AuthRequest, res) => {
    try {
        const subject = await Subject.findOne({ _id: req.params.id, ...uf(req) }).lean()
        if (!subject) { fail(res, 'Subject not found', 'NOT_FOUND', 404); return }
        ok(res, subject)
    } catch (err) {
        console.error('[academic/subjects/:id GET]', err)
        fail(res, 'Failed to fetch subject', 'FETCH_FAILED', 500)
    }
})

/* PUT/PATCH /api/academic/subjects/:id */
router.put('/subjects/:id', async (req: AuthRequest, res) => {
    try {
        const userId = new Types.ObjectId(req.userId!)
        const subjectId = MongoIdSchema.parse(req.params.id)
        const data = UpdateSubjectSchema.parse(req.body)

        const existing = await Subject.findOne({ _id: subjectId, ...uf(req) })
        if (!existing) { fail(res, 'Subject not found', 'NOT_FOUND', 404); return }

        const allowedFields = ['name', 'semester', 'categories', 'type', 'code', 'professor', 'classroom', 'credits', 'syllabus', 'target']
        const updateData: Record<string, unknown> = {}

        for (const k of allowedFields) {
            if (k in data) updateData[k] = (data as Record<string, unknown>)[k]
        }

        // Handle practicals
        if (data.practicals) {
            for (const [k, v] of Object.entries(data.practicals)) {
                updateData[`practicals.${k}`] = v
            }
        } else if (data.practical_total !== undefined) {
            updateData['practicals.total'] = data.practical_total
        }

        // Handle assignments
        if (data.assignments) {
            for (const [k, v] of Object.entries(data.assignments)) {
                updateData[`assignments.${k}`] = v
            }
        } else if (data.assignment_total !== undefined) {
            updateData['assignments.total'] = data.assignment_total
        }

        await Subject.updateOne({ _id: subjectId, ...uf(req) }, { $set: updateData })
        ok(res, { message: 'Subject updated' })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/subjects/:id PUT]', err)
        fail(res, 'Failed to update subject', 'UPDATE_FAILED', 500)
    }
})

// PATCH is an alias for PUT
router.patch('/subjects/:id', async (req: AuthRequest, res) => {
    // Re-route to PUT logic internally
    req.method = 'PUT'
    const next = (router as any).handle.bind(router)
    return next(req, res, () => { })
})

/* DELETE /api/academic/subjects/:id */
router.delete('/subjects/:id', async (req: AuthRequest, res) => {
    try {
        const userId = req.userId!
        const subjectId = MongoIdSchema.parse(req.params.id)
        const subject = await Subject.findOneAndDelete({ _id: subjectId, ...uf(req) })
        if (!subject) { fail(res, 'Subject not found', 'NOT_FOUND', 404); return }

        await AttendanceLog.deleteMany({ subject_id: subject._id, ...uf(req) })
        sysLog(userId, 'Subject Deleted', `Deleted subject '${subject.name}'`).catch(() => { })
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
        const subjectId = MongoIdSchema.parse(req.params.id)
        const { attended, total } = AttendanceCountSchema.parse(req.body)

        const result = await Subject.updateOne({ _id: subjectId, ...uf(req) }, { $set: { attended, total } })
        if (result.matchedCount === 0) { fail(res, 'Subject not found', 'NOT_FOUND', 404); return }

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
        const results = await SemesterResult.find({ ...uf(req) }).sort({ semester: 1 }).lean()

        if (results.length) {
            const semesters = results.map((r) => r.subjects as Array<Record<string, unknown>>)
            const cgpaCalc = GradeCalculator.calculateCGPA(semesters)
            for (const r of results) {
                ; (r as Record<string, unknown>).cgpa = cgpaCalc.cgpa
            }
        }

        ok(res, results)
    } catch (err) {
        console.error('[academic/results GET]', err)
        fail(res, 'Failed to fetch results', 'FETCH_FAILED', 500)
    }
})

router.get('/results/analytics', async (req: AuthRequest, res) => {
    try {
        const results = await SemesterResult.find({ ...uf(req) }).sort({ semester: 1 }).lean();
        if (!results.length) {
            ok(res, { cgpa: 0, semesters: [], gradeDistribution: {}, overallPercentage: 0 });
            return;
        }

        const semesters = results.map(r => r.subjects as Array<Record<string, unknown>>);
        const cgpaCalc = GradeCalculator.calculateCGPA(semesters);

        let totalMarks = 0;
        let totalMaxMarks = 0;
        const gradeDist: Record<string, number> = { 'O': 0, 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'F': 0 };

        results.forEach(r => {
            let semTotal = 0;
            let semMax = 0;
            if (Array.isArray(r.subjects)) {
                r.subjects.forEach((s: any) => {
                    semTotal += Number(s.total_marks || 0);
                    semMax += Number(s.max_marks || 100);
                    const g = (s.grade || 'F').toString().toUpperCase();
                    if (gradeDist[g] !== undefined) gradeDist[g]++;
                    else gradeDist[g] = 1;
                });
            }
            (r as any).semester_total_marks = semTotal;
            (r as any).semester_max_marks = semMax;
            (r as any).semester_percentage = semMax > 0 ? (semTotal / semMax) * 100 : 0;
            totalMarks += semTotal;
            totalMaxMarks += semMax;
        });

        ok(res, {
            cgpa: cgpaCalc.cgpa,
            overallPercentage: totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0,
            gradeDistribution: gradeDist,
            totalSubjects: Object.values(gradeDist).reduce((a, b) => a + b, 0),
            totalMarks,
            totalMaxMarks,
            semesters: results
        });
    } catch (err) {
        console.error('[academic/results/analytics GET]', err);
        fail(res, 'Failed to fetch analytics', 'FETCH_FAILED', 500);
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

        const meta = scrapedData[0];
        const studentInfo = {
            name: meta.stname,
            father: meta.father,
            institution: meta.iname,
            programme: meta.prgname,
            batch: meta.byoa,
            roll_no: meta.nrollno,
            enrollment_no: meta.nrollno
        };

        const processedSubjects = scrapedData.map((row) => {
            const internal = parseFloat(row.minorprint === '-' ? '0' : row.minorprint) || 0;
            const external = parseFloat(row.majorprint === '-' ? '0' : row.majorprint) || 0;
            const totalMarks = parseFloat(row.moderatedprint) || (internal + external);

            const sub = {
                name: row.papername,
                code: row.papercode,
                credits: 4,
                internal_theory: internal,
                external_theory: external,
                total_marks: totalMarks,
                max_marks: 100,
                grade: '',
            };

            const calc = GradeCalculator.calculateSubjectResult(sub);
            return { ...sub, ...calc };
        });

        const sgpaCalc = GradeCalculator.calculateSGPA(processedSubjects);
        const finalSgpa = meta.eugpa || sgpaCalc.sgpa;

        await SemesterResult.findOneAndUpdate(
            { ...uf(req), semester },
            {
                $set: {
                    subjects: processedSubjects,
                    sgpa: finalSgpa,
                    total_credits: sgpaCalc.total_credits,
                    student_info: studentInfo,
                    source: 'ipu_scraper',
                    updated_at: new Date(),
                },
            },
            { upsert: true }
        )

        sysLog(userId, 'Results Synced', `Fetched results for Semester ${semester} via direct API`).catch(() => { })
        ok(res, {
            message: 'Results synced successfully',
            sgpa: finalSgpa,
            subjects: processedSubjects.length,
            student_info: studentInfo
        })
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

        const processedSubjects = subjectsData.map((sub) => {
            const calc = GradeCalculator.calculateSubjectResult(sub)
            return {
                ...sub,
                ...calc,
                name: String(sub.name || 'Unknown'),
                code: String(sub.code || ''),
                credits: parseInt(String(sub.credits ?? 0)),
            }
        })

        const sgpaCalc = GradeCalculator.calculateSGPA(processedSubjects)

        await SemesterResult.findOneAndUpdate(
            { ...uf(req), semester },
            {
                $set: {
                    subjects: processedSubjects,
                    sgpa: sgpaCalc.sgpa,
                    total_credits: sgpaCalc.total_credits,
                    updated_at: new Date(),
                },
            },
            { upsert: true },
        )

        sysLog(userId, 'Result Updated', `Semester ${semester} result saved. SGPA: ${sgpaCalc.sgpa}`).catch(() => { })
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
        const result = await SemesterResult.deleteOne({ ...uf(req), semester })
        if (result.deletedCount === 0) { fail(res, 'Result not found', 'NOT_FOUND', 404); return }
        sysLog(userId, 'Result Deleted', `Deleted results for Semester ${semester}`).catch(() => { })
        ok(res, { message: `Semester ${semester} results deleted` })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/results DELETE]', err)
        fail(res, 'Failed to delete results', 'DELETE_FAILED', 500)
    }
})

// ─── Manual / Online Courses ─────────────────────────────────────────────────

router.get('/courses/manual', async (req: AuthRequest, res) => {
    try {
        const courses = await ManualCourse.find({ ...uf(req) }).lean()
        ok(res, courses)
    } catch (err) {
        console.error('[academic/courses/manual GET]', err)
        fail(res, 'Failed to fetch courses', 'FETCH_FAILED', 500)
    }
})

const ManualCourseSchema = z.object({
    name: z.string().min(1).max(200),
    provider: z.string().max(200).optional().default(''),
    status: z.enum(['not_started', 'in_progress', 'completed']).default('not_started'),
    percentage: z.number().min(0).max(100).optional().default(0),
    url: z.string().url().optional().or(z.literal('')),
    notes: z.string().max(1000).optional().default(''),
})

router.get('/courses/manual', async (req: AuthRequest, res) => {
    try {
        const courses = await ManualCourse.find({ ...uf(req) }).lean()
        ok(res, courses)
    } catch (err) {
        console.error('[academic/courses/manual GET]', err)
        fail(res, 'Failed to fetch courses', 'FETCH_FAILED', 500)
    }
})

router.post('/courses/manual', async (req: AuthRequest, res) => {
    try {
        const data = req.body

        if (Array.isArray(data)) {
            // Validate all items
            const items = data.map(c => ManualCourseSchema.parse(c))
            await ManualCourse.deleteMany({ ...uf(req) })
            if (items.length) {
                await ManualCourse.insertMany(items.map(i => ({ ...i, ...ownership(req) })))
            }
        } else {
            const item = ManualCourseSchema.parse(data)
            await ManualCourse.create({ ...item, ...ownership(req) })
        }

        ok(res, { message: 'Courses saved' })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/courses/manual POST]', err)
        fail(res, 'Failed to save courses', 'SAVE_FAILED', 500)
    }
})

router.put('/courses/manual/:id', async (req: AuthRequest, res) => {
    try {
        const courseId = MongoIdSchema.parse(req.params.id)
        const updateData = ManualCourseSchema.partial().parse(req.body)

        const result = await ManualCourse.findOneAndUpdate(
            { _id: courseId, ...uf(req) },
            { $set: updateData },
            { new: true },
        )
        if (!result) { fail(res, 'Course not found', 'NOT_FOUND', 404); return }
        ok(res, { message: 'Course updated', course: result })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/courses/manual PUT]', err)
        fail(res, 'Failed to update course', 'UPDATE_FAILED', 500)
    }
})

router.delete('/courses/manual/:id', async (req: AuthRequest, res) => {
    try {
        const courseId = MongoIdSchema.parse(req.params.id)
        const result = await ManualCourse.findOneAndDelete({ _id: courseId, ...uf(req) })
        if (!result) { fail(res, 'Course not found', 'NOT_FOUND', 404); return }
        ok(res, { message: 'Course deleted' })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, err.errors[0]?.message || 'Validation failed', 'INVALID_PARAMS'); return }
        console.error('[academic/courses/manual DELETE]', err)
        fail(res, 'Failed to delete course', 'DELETE_FAILED', 500)
    }
})

export default router
