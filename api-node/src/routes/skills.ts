import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { ok, created, fail } from '../utils/response.js'

const router = Router()
router.use(requireAuth)

async function sysLog(req: AuthRequest, user_id: string, action: string, description: string) {
  const ip = req.ip || (req as any).socket?.remoteAddress || null
  const user_agent = (req.headers['user-agent'] as string) || null
  await prisma.systemLog.create({ data: { user_id, action, description, ip, user_agent } }).catch(() => null)
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
    const skills = await prisma.skill.findMany({
      where: { user_id: req.userId! },
      orderBy: { created_at: 'desc' },
    })
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
    const skill = await prisma.skill.create({ data: { ...body, user_id: userId } })
    sysLog(req, userId, 'Skill Added', `Added skill: ${body.name}`).catch(() => {})
    created(res, skill)
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
    const skillId = String(req.params.id)
    const data = SkillSchema.partial().parse(req.body)
    const existing = await prisma.skill.findFirst({ where: { id: skillId, user_id: userId } })
    if (!existing) { fail(res, 'Skill not found', 'NOT_FOUND', 404); return }

    await prisma.skill.update({ where: { id: skillId }, data })
    sysLog(req, userId, 'Skill Updated', `Updated skill: ${data.name ?? skillId}`).catch(() => {})
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
    const skillId = String(req.params.id)
    const skill = await prisma.skill.findFirst({ where: { id: skillId, user_id: userId } })
    if (!skill) { fail(res, 'Skill not found', 'NOT_FOUND', 404); return }
    await prisma.skill.delete({ where: { id: skillId } })
    sysLog(req, userId, 'Skill Deleted', `Deleted skill: ${skill.name}`).catch(() => {})
    ok(res, { message: 'Skill deleted successfully' })
  } catch (err) {
    console.error('[skills DELETE]', err)
    fail(res, 'Failed to delete skill', 'DELETE_FAILED', 500)
  }
})

export default router
