import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { Subject } from '../models/Subject.js'
import { AttendanceLog } from '../models/AttendanceLog.js'
import { SemesterResult } from '../models/SemesterResult.js'
import { ManualCourse } from '../models/ManualCourse.js'
import { SystemLog } from '../models/SystemLog.js'
import { GradeCalculator } from '../lib/calculations.js'
import { ok, created, fail } from '../utils/response.js'
import { uf, ownership } from '../utils/userFilter.js'

const router = Router()
router.use(requireAuth)

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
  credits: z.number().optional(),
  categories: z.array(z.string()).optional().default(['Theory']),
  target: z.number().min(0).max(100).optional().default(75),
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

/* GET /api/academic/subjects */
router.get('/subjects', async (req: AuthRequest, res) => {
  try {
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : undefined
    const query: Record<string, unknown> = { ...uf(req) }
    if (semester) query.semester = semester
    const subjects = await Subject.find(query).sort({ name: 1 }).lean()
    ok(res, subjects)
  } catch (err) {
    console.error('[academic/subjects GET]', err)
    fail(res, 'Failed to fetch subjects', 'FETCH_FAILED', 500)
  }
})

/* GET /api/academic/full_subjects_data */
router.get('/full_subjects_data', async (req: AuthRequest, res) => {
  try {
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : undefined
    const query: Record<string, unknown> = { ...uf(req) }
    if (semester) query.semester = semester

    const subjects = await Subject.find(query).lean()
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
    console.error('[academic/full_subjects_data]', err)
    fail(res, 'Failed to fetch subjects', 'FETCH_FAILED', 500)
  }
})

/* POST /api/academic/subjects */
router.post('/subjects', async (req: AuthRequest, res) => {
  try {
    const body = CreateSubjectSchema.parse(req.body)
    const subject = await Subject.create({ ...body, ...ownership(req) })
    await sysLog(req.userId!, 'Subject Added', `Added '${body.name}' to semester ${body.semester}`)
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
    const userId = req.userId!
    const data = UpdateSubjectSchema.parse(req.body)

    const existing = await Subject.findOne({ _id: req.params.id, ...uf(req) })
    if (!existing) { fail(res, 'Subject not found', 'NOT_FOUND', 404); return }

    const allowedFields = ['name','semester','categories','type','code','professor','classroom','credits','syllabus','target']
    const updateData: Record<string, unknown> = {}

    for (const k of allowedFields) {
      if (k in data) updateData[k] = (data as Record<string, unknown>)[k]
    }
    if ('semester' in updateData) updateData.semester = parseInt(String(updateData.semester))

    // Nested practicals
    if (data.practicals && typeof data.practicals === 'object') {
      const cur = existing.practicals as Record<string, unknown> | undefined
      if (!cur) {
        updateData.practicals = { total: 10, completed: 0, hardcopy: false, ...data.practicals }
      } else {
        for (const [k, v] of Object.entries(data.practicals)) {
          updateData[`practicals.${k}`] = v
        }
      }
    } else if (data.practical_total !== undefined) {
      updateData['practicals.total'] = parseInt(String(data.practical_total))
    }

    // Nested assignments
    if (data.assignments && typeof data.assignments === 'object') {
      const cur = existing.assignments as Record<string, unknown> | undefined
      if (!cur) {
        updateData.assignments = { total: 4, completed: 0, hardcopy: false, ...data.assignments }
      } else {
        for (const [k, v] of Object.entries(data.assignments)) {
          updateData[`assignments.${k}`] = v
        }
      }
    } else if (data.assignment_total !== undefined) {
      updateData['assignments.total'] = parseInt(String(data.assignment_total))
    }

    await Subject.updateOne({ _id: req.params.id, ...uf(req) }, { $set: updateData })
    ok(res, { message: 'Subject updated' })
  } catch (err) {
    if (err instanceof z.ZodError) { fail(res, 'Validation failed', 'INVALID_PARAMS'); return }
    console.error('[academic/subjects/:id PUT]', err)
    fail(res, 'Failed to update subject', 'UPDATE_FAILED', 500)
  }
})

// PATCH is an alias for PUT
router.patch('/subjects/:id', async (req: AuthRequest, res) => {
  req.method = 'PUT'
  // Re-run through the router by forwarding – handled inline
  const data = UpdateSubjectSchema.safeParse(req.body)
  if (!data.success) { fail(res, 'Validation failed', 'INVALID_PARAMS'); return }
  const existing = await Subject.findOne({ _id: req.params.id, ...uf(req) })
  if (!existing) { fail(res, 'Subject not found', 'NOT_FOUND', 404); return }
  const allowed = ['name','semester','categories','type','code','professor','classroom','credits','syllabus','target']
  const updateData: Record<string, unknown> = {}
  for (const k of allowed) { if (k in data.data) updateData[k] = (data.data as Record<string, unknown>)[k] }
  await Subject.updateOne({ _id: req.params.id, ...uf(req) }, { $set: updateData })
  ok(res, { message: 'Subject updated' })
})

/* DELETE /api/academic/subjects/:id */
router.delete('/subjects/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const subject = await Subject.findOneAndDelete({ _id: req.params.id, ...uf(req) })
    if (!subject) { fail(res, 'Subject not found', 'NOT_FOUND', 404); return }

    await AttendanceLog.deleteMany({ subject_id: subject._id, ...uf(req) })
    await sysLog(userId, 'Subject Deleted', `Deleted subject '${subject.name}'`)
    ok(res, { message: 'Subject deleted' })
  } catch (err) {
    console.error('[academic/subjects/:id DELETE]', err)
    fail(res, 'Failed to delete subject', 'DELETE_FAILED', 500)
  }
})

/* POST /api/academic/subjects/:id/attendance-count */
router.post('/subjects/:id/attendance-count', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const attended = parseInt(String(req.body.attended ?? 0))
    const total = parseInt(String(req.body.total ?? 0))
    await Subject.updateOne({ _id: req.params.id, ...uf(req) }, { $set: { attended, total } })
    ok(res, { message: 'Attendance count updated' })
  } catch (err) {
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
        ;(r as Record<string, unknown>).cgpa = cgpaCalc.cgpa
      }
    }

    ok(res, results)
  } catch (err) {
    console.error('[academic/results GET]', err)
    fail(res, 'Failed to fetch results', 'FETCH_FAILED', 500)
  }
})

router.post('/results', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const semester = parseInt(String(req.body.semester))
    const subjectsData = (req.body.subjects ?? []) as Array<Record<string, unknown>>

    const processedSubjects = subjectsData.map((sub) => {
      const calc = GradeCalculator.calculateSubjectResult(sub)
      return {
        ...sub,
        ...calc,
        name: sub.name,
        code: sub.code ?? '',
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

    await sysLog(userId, 'Result Updated', `Semester ${semester} result saved. SGPA: ${sgpaCalc.sgpa}`)
    ok(res, { sgpa: sgpaCalc.sgpa })
  } catch (err) {
    console.error('[academic/results POST]', err)
    fail(res, 'Failed to save results', 'SAVE_FAILED', 500)
  }
})

router.delete('/results/:semester', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const semester = parseInt(req.params.semester as string)
    await SemesterResult.deleteOne({ ...uf(req), semester })
    await sysLog(userId, 'Result Deleted', `Deleted results for Semester ${semester}`)
    ok(res, { message: `Semester ${semester} results deleted` })
  } catch (err) {
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

router.post('/courses/manual', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const data = req.body

    if (Array.isArray(data)) {
      await ManualCourse.deleteMany({ ...uf(req) })
      const items = data.map((c: Record<string, unknown>) => {
        const { _id, ...rest } = c
        void _id
        return { ...rest, ...ownership(req) }
      })
      if (items.length) await ManualCourse.insertMany(items)
    } else {
      await ManualCourse.create({ ...data, ...ownership(req) })
    }

    ok(res, { message: 'Courses saved' })
  } catch (err) {
    console.error('[academic/courses/manual POST]', err)
    fail(res, 'Failed to save courses', 'SAVE_FAILED', 500)
  }
})

router.put('/courses/manual/:id', async (req: AuthRequest, res) => {
  try {
    const { _id, user_id, ...updateData } = req.body as Record<string, unknown>
    void _id; void user_id

    const result = await ManualCourse.findOneAndUpdate(
      { _id: req.params.id, ...uf(req) },
      { $set: updateData },
      { new: true },
    )
    if (!result) { fail(res, 'Course not found', 'NOT_FOUND', 404); return }
    ok(res, { message: 'Course updated' })
  } catch (err) {
    console.error('[academic/courses/manual PUT]', err)
    fail(res, 'Failed to update course', 'UPDATE_FAILED', 500)
  }
})

router.delete('/courses/manual/:id', async (req: AuthRequest, res) => {
  try {
    const result = await ManualCourse.findOneAndDelete({ _id: req.params.id, ...uf(req) })
    if (!result) { fail(res, 'Course not found', 'NOT_FOUND', 404); return }
    ok(res, { message: 'Course deleted' })
  } catch (err) {
    console.error('[academic/courses/manual DELETE]', err)
    fail(res, 'Failed to delete course', 'DELETE_FAILED', 500)
  }
})

export default router
