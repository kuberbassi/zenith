import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { ok, fail } from '../utils/response.js'

const router = Router()
router.use(requireAuth)

router.get('/experiences', async (req: AuthRequest, res) => {
    try {
        const experiences = await prisma.experience.findMany({
            where: { user_id: req.userId! },
            orderBy: { start_date: 'desc' },
        })
        ok(res, experiences)
    } catch {
        fail(res, 'Failed to fetch experiences', 'FETCH_FAILED', 500)
    }
})

router.post('/experiences', async (req: AuthRequest, res) => {
    try {
        const exp = await prisma.experience.create({ data: { ...req.body, user_id: req.userId! } })
        ok(res, exp)
    } catch {
        fail(res, 'Failed to create experience', 'CREATE_FAILED', 500)
    }
})

router.put('/experiences/:id', async (req: AuthRequest, res) => {
    try {
        const experienceId = String(req.params.id)
        const result = await prisma.experience.updateMany({
            where: { id: experienceId, user_id: req.userId! },
            data: req.body,
        })
        if (result.count === 0) return fail(res, 'Not found', 'NOT_FOUND', 404)
        const exp = await prisma.experience.findUnique({ where: { id: experienceId } })
        ok(res, exp)
    } catch {
        fail(res, 'Failed to update experience', 'UPDATE_FAILED', 500)
    }
})

router.delete('/experiences/:id', async (req: AuthRequest, res) => {
    try {
        const experienceId = String(req.params.id)
        const result = await prisma.experience.deleteMany({ where: { id: experienceId, user_id: req.userId! } })
        if (result.count === 0) return fail(res, 'Not found', 'NOT_FOUND', 404)
        ok(res, { message: 'Deleted' })
    } catch {
        fail(res, 'Failed to delete experience', 'DELETE_FAILED', 500)
    }
})

router.get('/certifications', async (req: AuthRequest, res) => {
    try {
        const certs = await prisma.certification.findMany({
            where: { user_id: req.userId! },
            orderBy: { issue_date: 'desc' },
        })
        ok(res, certs)
    } catch {
        fail(res, 'Failed to fetch certifications', 'FETCH_FAILED', 500)
    }
})

router.post('/certifications', async (req: AuthRequest, res) => {
    try {
        const cert = await prisma.certification.create({ data: { ...req.body, user_id: req.userId! } })
        ok(res, cert)
    } catch {
        fail(res, 'Failed to create certification', 'CREATE_FAILED', 500)
    }
})

router.put('/certifications/:id', async (req: AuthRequest, res) => {
    try {
        const certificationId = String(req.params.id)
        const result = await prisma.certification.updateMany({
            where: { id: certificationId, user_id: req.userId! },
            data: req.body,
        })
        if (result.count === 0) return fail(res, 'Not found', 'NOT_FOUND', 404)
        const cert = await prisma.certification.findUnique({ where: { id: certificationId } })
        ok(res, cert)
    } catch {
        fail(res, 'Failed to update certification', 'UPDATE_FAILED', 500)
    }
})

router.delete('/certifications/:id', async (req: AuthRequest, res) => {
    try {
        const certificationId = String(req.params.id)
        const result = await prisma.certification.deleteMany({ where: { id: certificationId, user_id: req.userId! } })
        if (result.count === 0) return fail(res, 'Not found', 'NOT_FOUND', 404)
        ok(res, { message: 'Deleted' })
    } catch {
        fail(res, 'Failed to delete certification', 'DELETE_FAILED', 500)
    }
})

router.get('/projects', async (req: AuthRequest, res) => {
    try {
        const projects = await prisma.project.findMany({
            where: { user_id: req.userId! },
            orderBy: { created_at: 'desc' },
        })
        ok(res, projects)
    } catch {
        fail(res, 'Failed to fetch projects', 'FETCH_FAILED', 500)
    }
})

router.post('/projects', async (req: AuthRequest, res) => {
    try {
        const proj = await prisma.project.create({ data: { ...req.body, user_id: req.userId! } })
        ok(res, proj)
    } catch {
        fail(res, 'Failed to create project', 'CREATE_FAILED', 500)
    }
})

router.put('/projects/:id', async (req: AuthRequest, res) => {
    try {
        const projectId = String(req.params.id)
        const result = await prisma.project.updateMany({
            where: { id: projectId, user_id: req.userId! },
            data: req.body,
        })
        if (result.count === 0) return fail(res, 'Not found', 'NOT_FOUND', 404)
        const proj = await prisma.project.findUnique({ where: { id: projectId } })
        ok(res, proj)
    } catch {
        fail(res, 'Failed to update project', 'UPDATE_FAILED', 500)
    }
})

router.delete('/projects/:id', async (req: AuthRequest, res) => {
    try {
        const projectId = String(req.params.id)
        const result = await prisma.project.deleteMany({ where: { id: projectId, user_id: req.userId! } })
        if (result.count === 0) return fail(res, 'Not found', 'NOT_FOUND', 404)
        ok(res, { message: 'Deleted' })
    } catch {
        fail(res, 'Failed to delete project', 'DELETE_FAILED', 500)
    }
})

router.get('/skills', async (req: AuthRequest, res) => {
    try {
        const skills = await prisma.skill.findMany({
            where: { user_id: req.userId! },
            orderBy: [{ level: 'desc' }, { progress: 'desc' }],
        })
        ok(res, skills)
    } catch {
        fail(res, 'Failed to fetch skills', 'FETCH_FAILED', 500)
    }
})

router.post('/skills', async (req: AuthRequest, res) => {
    try {
        const skill = await prisma.skill.create({ data: { ...req.body, user_id: req.userId! } })
        ok(res, skill)
    } catch {
        fail(res, 'Failed to create skill', 'CREATE_FAILED', 500)
    }
})

router.put('/skills/:id', async (req: AuthRequest, res) => {
    try {
        const skillId = String(req.params.id)
        const result = await prisma.skill.updateMany({
            where: { id: skillId, user_id: req.userId! },
            data: req.body,
        })
        if (result.count === 0) return fail(res, 'Not found', 'NOT_FOUND', 404)
        const skill = await prisma.skill.findUnique({ where: { id: skillId } })
        ok(res, skill)
    } catch {
        fail(res, 'Failed to update skill', 'UPDATE_FAILED', 500)
    }
})

router.delete('/skills/:id', async (req: AuthRequest, res) => {
    try {
        const skillId = String(req.params.id)
        const result = await prisma.skill.deleteMany({ where: { id: skillId, user_id: req.userId! } })
        if (result.count === 0) return fail(res, 'Not found', 'NOT_FOUND', 404)
        ok(res, { message: 'Deleted' })
    } catch {
        fail(res, 'Failed to delete skill', 'DELETE_FAILED', 500)
    }
})

export default router
