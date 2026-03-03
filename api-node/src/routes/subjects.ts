import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { Subject } from '../models/Subject.js'
import { uf, ownership } from '../utils/userFilter.js'

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
    const subjects = await Subject.find({ ...uf(req) })
      .sort({ name: 1 })
      .lean()
    res.json(subjects)
  } catch (err) {
    console.error('[subjects/GET]', err)
    res.status(500).json({ error: 'Failed to fetch subjects' })
  }
})

/* POST /api/subjects */
router.post('/', async (req: AuthRequest, res) => {
  try {
    const body = CreateSubjectSchema.parse(req.body)
    const subject = await Subject.create({ ...body, ...ownership(req) })
    res.status(201).json(subject)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors })
      return
    }
    console.error('[subjects/POST]', err)
    res.status(500).json({ error: 'Failed to create subject' })
  }
})

/* PUT /api/subjects/:id */
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const body = UpdateSubjectSchema.parse(req.body)
    const subject = await Subject.findOneAndUpdate(
      { _id: req.params.id, ...uf(req) },
      { $set: body },
      { new: true },
    )
    if (!subject) {
      res.status(404).json({ error: 'Subject not found' })
      return
    }
    res.json(subject)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors })
      return
    }
    console.error('[subjects/PUT]', err)
    res.status(500).json({ error: 'Failed to update subject' })
  }
})

/* DELETE /api/subjects/:id */
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const subject = await Subject.findOneAndDelete({
      _id: req.params.id,
      ...uf(req),
    })
    if (!subject) {
      res.status(404).json({ error: 'Subject not found' })
      return
    }
    res.json({ message: 'Subject deleted' })
  } catch (err) {
    console.error('[subjects/DELETE]', err)
    res.status(500).json({ error: 'Failed to delete subject' })
  }
})

export default router
