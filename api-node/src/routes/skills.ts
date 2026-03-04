import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { Skill } from '../models/Skill.js'
import { SystemLog } from '../models/SystemLog.js'
import { ok, created, fail } from '../utils/response.js'
import { uf, ownership } from '../utils/userFilter.js'

const router = Router()
router.use(requireAuth)

async function sysLog(user_id: string, action: string, description: string) {
  await SystemLog.create({ user_id, action, description }).catch(() => null)
}

const SkillSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().optional(),
  level: z.string().optional(),
  progress: z.number().min(0).max(100).optional().default(0),
  notes: z.string().optional().default(''),
})

/* GET /api/skills */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const skills = await Skill.find({ ...uf(req) }).sort({ created_at: -1 }).lean()
    ok(res, skills)
  } catch (err) {
    console.error('[skills GET]', err)
    fail(res, 'Failed to fetch skills', 'FETCH_FAILED', 500)
  }
})

/* POST /api/skills */
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const body = SkillSchema.parse(req.body)
    const skill = await Skill.create({ ...body, ...ownership(req) })
    sysLog(userId, 'Skill Added', `Added skill: ${body.name}`).catch(() => {})
    created(res, skill.toObject())
  } catch (err) {
    if (err instanceof z.ZodError) { fail(res, 'Validation failed', 'INVALID_PARAMS'); return }
    console.error('[skills POST]', err)
    fail(res, 'Failed to add skill', 'CREATE_FAILED', 500)
  }
})

/* PUT /api/skills/:id */
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const data = SkillSchema.partial().parse(req.body)

    const result = await Skill.findOneAndUpdate(
      { _id: req.params.id, ...uf(req) },
      { $set: { ...data, updated_at: new Date() } },
      { new: true },
    )
    if (!result) { fail(res, 'Skill not found', 'NOT_FOUND', 404); return }

    sysLog(userId, 'Skill Updated', `Updated skill: ${data.name ?? req.params.id}`).catch(() => {})
    ok(res, { message: 'Skill updated successfully' })
  } catch (err) {
    if (err instanceof z.ZodError) { fail(res, 'Validation failed', 'INVALID_PARAMS'); return }
    console.error('[skills PUT]', err)
    fail(res, 'Failed to update skill', 'UPDATE_FAILED', 500)
  }
})

/* DELETE /api/skills/:id */
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const skill = await Skill.findOneAndDelete({ _id: req.params.id, ...uf(req) })
    if (!skill) { fail(res, 'Skill not found', 'NOT_FOUND', 404); return }

    sysLog(userId, 'Skill Deleted', `Deleted skill: ${skill.name}`).catch(() => {})
    ok(res, { message: 'Skill deleted successfully' })
  } catch (err) {
    console.error('[skills DELETE]', err)
    fail(res, 'Failed to delete skill', 'DELETE_FAILED', 500)
  }
})

export default router
