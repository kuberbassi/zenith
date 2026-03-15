import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { ok, created, fail } from '../utils/response.js'

const router = Router()
router.use(requireAuth)

const CreateSubjectSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(50).optional(),
  professor: z.string().max(200).optional(),
  target: z.number().min(0).max(100).optional().default(75),
  categories: z.array(z.string()).optional(),
})

const UpdateSubjectSchema = CreateSubjectSchema.partial()

/* GET /api/subjects */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { user_id: req.userId! },
      orderBy: { name: 'asc' },
    })
    ok(res, subjects)
  } catch (err) {
    console.error('[subjects/GET]', err)
    fail(res, 'Failed to fetch subjects', 'FETCH_FAILED', 500)
  }
})

/* POST /api/subjects */
router.post('/', async (req: AuthRequest, res) => {
  try {
    const body = CreateSubjectSchema.parse(req.body)
    const subject = await prisma.subject.create({ data: { ...body, user_id: req.userId! } })
    created(res, subject)
  } catch (err) {
    if (err instanceof z.ZodError) {
      fail(res, 'Validation failed', 'VALIDATION_ERROR')
      return
    }
    console.error('[subjects/POST]', err)
    fail(res, 'Failed to create subject', 'CREATE_FAILED', 500)
  }
})

/* PUT /api/subjects/:id */
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const subjectId = String(req.params.id)
    const body = UpdateSubjectSchema.parse(req.body)
    const existing = await prisma.subject.findFirst({ where: { id: subjectId, user_id: req.userId! } })
    if (!existing) {
      fail(res, 'Subject not found', 'NOT_FOUND', 404)
      return
    }
    const subject = await prisma.subject.update({ where: { id: subjectId }, data: body })
    ok(res, subject)
  } catch (err) {
    if (err instanceof z.ZodError) {
      fail(res, 'Validation failed', 'VALIDATION_ERROR')
      return
    }
    console.error('[subjects/PUT]', err)
    fail(res, 'Failed to update subject', 'UPDATE_FAILED', 500)
  }
})

/* DELETE /api/subjects/:id */
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const subjectId = String(req.params.id)
    const existing = await prisma.subject.findFirst({ where: { id: subjectId, user_id: req.userId! } })
    if (!existing) {
      fail(res, 'Subject not found', 'NOT_FOUND', 404)
      return
    }
    await prisma.subject.delete({ where: { id: subjectId } })
    ok(res, { message: 'Subject deleted' })
  } catch (err) {
    console.error('[subjects/DELETE]', err)
    fail(res, 'Failed to delete subject', 'DELETE_FAILED', 500)
  }
})

export default router
