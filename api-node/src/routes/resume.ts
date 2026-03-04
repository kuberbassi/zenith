import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { Experience } from '../models/Experience.js'
import { Certification } from '../models/Certification.js'
import { Project } from '../models/Project.js'
import { Skill } from '../models/Skill.js'
import { ok, fail } from '../utils/response.js'

const router = Router()
router.use(requireAuth)

// --- Experience ---

router.get('/experiences', async (req: AuthRequest, res) => {
    try {
        const experiences = await Experience.find({ user_id: req.userId }).sort({ start_date: -1 }).lean()
        ok(res, experiences)
    } catch (err) {
        fail(res, 'Failed to fetch experiences', 'FETCH_FAILED', 500)
    }
})

router.post('/experiences', async (req: AuthRequest, res) => {
    try {
        const data = { ...req.body, user_id: req.userId }
        const exp = await Experience.create(data)
        ok(res, exp)
    } catch (err) {
        fail(res, 'Failed to evaluate experience', 'CREATE_FAILED', 500)
    }
})

router.put('/experiences/:id', async (req: AuthRequest, res) => {
    try {
        const exp = await Experience.findOneAndUpdate(
            { _id: req.params.id, user_id: req.userId },
            { $set: req.body },
            { new: true }
        )
        if (!exp) return fail(res, 'Not found', 'NOT_FOUND', 404)
        ok(res, exp)
    } catch (err) {
        fail(res, 'Failed to update experience', 'UPDATE_FAILED', 500)
    }
})

router.delete('/experiences/:id', async (req: AuthRequest, res) => {
    try {
        const exp = await Experience.findOneAndDelete({ _id: req.params.id, user_id: req.userId })
        if (!exp) return fail(res, 'Not found', 'NOT_FOUND', 404)
        ok(res, { message: 'Deleted' })
    } catch (err) {
        fail(res, 'Failed to delete experience', 'DELETE_FAILED', 500)
    }
})

// --- Certification ---

router.get('/certifications', async (req: AuthRequest, res) => {
    try {
        const certs = await Certification.find({ user_id: req.userId }).sort({ issue_date: -1 }).lean()
        ok(res, certs)
    } catch (err) {
        fail(res, 'Failed to fetch certifications', 'FETCH_FAILED', 500)
    }
})

router.post('/certifications', async (req: AuthRequest, res) => {
    try {
        const data = { ...req.body, user_id: req.userId }
        const cert = await Certification.create(data)
        ok(res, cert)
    } catch (err) {
        fail(res, 'Failed to create certification', 'CREATE_FAILED', 500)
    }
})

router.put('/certifications/:id', async (req: AuthRequest, res) => {
    try {
        const cert = await Certification.findOneAndUpdate(
            { _id: req.params.id, user_id: req.userId },
            { $set: req.body },
            { new: true }
        )
        if (!cert) return fail(res, 'Not found', 'NOT_FOUND', 404)
        ok(res, cert)
    } catch (err) {
        fail(res, 'Failed to update certification', 'UPDATE_FAILED', 500)
    }
})

router.delete('/certifications/:id', async (req: AuthRequest, res) => {
    try {
        const cert = await Certification.findOneAndDelete({ _id: req.params.id, user_id: req.userId })
        if (!cert) return fail(res, 'Not found', 'NOT_FOUND', 404)
        ok(res, { message: 'Deleted' })
    } catch (err) {
        fail(res, 'Failed to delete certification', 'DELETE_FAILED', 500)
    }
})

// --- Project ---

router.get('/projects', async (req: AuthRequest, res) => {
    try {
        const projects = await Project.find({ user_id: req.userId }).sort({ created_at: -1 }).lean()
        ok(res, projects)
    } catch (err) {
        fail(res, 'Failed to fetch projects', 'FETCH_FAILED', 500)
    }
})

router.post('/projects', async (req: AuthRequest, res) => {
    try {
        const data = { ...req.body, user_id: req.userId }
        const proj = await Project.create(data)
        ok(res, proj)
    } catch (err) {
        fail(res, 'Failed to create project', 'CREATE_FAILED', 500)
    }
})

router.put('/projects/:id', async (req: AuthRequest, res) => {
    try {
        const proj = await Project.findOneAndUpdate(
            { _id: req.params.id, user_id: req.userId },
            { $set: req.body },
            { new: true }
        )
        if (!proj) return fail(res, 'Not found', 'NOT_FOUND', 404)
        ok(res, proj)
    } catch (err) {
        fail(res, 'Failed to update project', 'UPDATE_FAILED', 500)
    }
})

router.delete('/projects/:id', async (req: AuthRequest, res) => {
    try {
        const proj = await Project.findOneAndDelete({ _id: req.params.id, user_id: req.userId })
        if (!proj) return fail(res, 'Not found', 'NOT_FOUND', 404)
        ok(res, { message: 'Deleted' })
    } catch (err) {
        fail(res, 'Failed to delete project', 'DELETE_FAILED', 500)
    }
})

// --- Skill ---

router.get('/skills', async (req: AuthRequest, res) => {
    try {
        const skills = await Skill.find({ user_id: req.userId }).sort({ level: -1, progress: -1 }).lean()
        ok(res, skills)
    } catch (err) {
        fail(res, 'Failed to fetch skills', 'FETCH_FAILED', 500)
    }
})

router.post('/skills', async (req: AuthRequest, res) => {
    try {
        const data = { ...req.body, user_id: req.userId }
        const skill = await Skill.create(data)
        ok(res, skill)
    } catch (err) {
        fail(res, 'Failed to create skill', 'CREATE_FAILED', 500)
    }
})

router.put('/skills/:id', async (req: AuthRequest, res) => {
    try {
        const skill = await Skill.findOneAndUpdate(
            { _id: req.params.id, user_id: req.userId },
            { $set: req.body },
            { new: true }
        )
        if (!skill) return fail(res, 'Not found', 'NOT_FOUND', 404)
        ok(res, skill)
    } catch (err) {
        fail(res, 'Failed to update skill', 'UPDATE_FAILED', 500)
    }
})

router.delete('/skills/:id', async (req: AuthRequest, res) => {
    try {
        const skill = await Skill.findOneAndDelete({ _id: req.params.id, user_id: req.userId })
        if (!skill) return fail(res, 'Not found', 'NOT_FOUND', 404)
        ok(res, { message: 'Deleted' })
    } catch (err) {
        fail(res, 'Failed to delete skill', 'DELETE_FAILED', 500)
    }
})

export default router
