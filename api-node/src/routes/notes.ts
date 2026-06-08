import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { ok, created, fail } from '../utils/response.js'
import { getClientIp } from '../utils/ip.js'
import { buildViewCacheId, clearUserViewCache, readViewCache, writeViewCache } from '../utils/viewCache.js'

const router = Router()
router.use(requireAuth)

async function sysLog(req: AuthRequest, user_id: string, action: string, description: string) {
  const ip = getClientIp(req)
  const user_agent = (req.headers['user-agent'] as string) || null
  await prisma.systemLog.create({ data: { user_id, action, description, ip, user_agent } }).catch(() => null)
}

const TodoItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
  priority: z.string().optional().default('medium'),
  dueDate: z.string().optional(),
})

const NoteSchema = z.object({
  title: z.string().optional().default(''),
  content: z.string().optional().default(''),
  is_todo: z.boolean().optional().default(false),
  todos: z.array(TodoItemSchema).optional().default([]),
  category: z.string().optional().default('General'),
  color: z.string().optional().default(''),
  is_pinned: z.boolean().optional().default(false),
  is_archived: z.boolean().optional().default(false),
})

/* GET /api/notes */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const cacheId = buildViewCacheId('notes', {})
    const cached = await readViewCache<any[]>(userId, cacheId)
    if (cached) {
      ok(res, cached, 200, 0)
      return
    }

    const notes = await prisma.note.findMany({
      where: { user_id: userId },
      orderBy: [
        { is_pinned: 'desc' },
        { updated_at: 'desc' },
      ],
    })

    ok(res, notes, 200, 0)
    void writeViewCache(userId, cacheId, notes, 60 * 1000).catch(() => {})
  } catch (err) {
    console.error('[notes GET]', err)
    fail(res, 'Failed to fetch notes', 'FETCH_FAILED', 500)
  }
})

/* POST /api/notes */
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const body = NoteSchema.parse(req.body)

    const note = await prisma.note.create({
      data: {
        user_id: userId,
        title: body.title,
        content: body.content,
        is_todo: body.is_todo,
        todos: body.todos as any,
        category: body.category,
        color: body.color,
        is_pinned: body.is_pinned,
        is_archived: body.is_archived,
      },
    })

    sysLog(req, userId, 'Note Created', `Created note: ${body.title || 'Untitled'}`).catch(() => {})
    await clearUserViewCache(userId).catch(() => {})
    created(res, note)
  } catch (err) {
    if (err instanceof z.ZodError) {
      fail(res, 'Validation failed', 'INVALID_PARAMS')
      return
    }
    console.error('[notes POST]', err)
    fail(res, 'Failed to create note', 'CREATE_FAILED', 500)
  }
})

/* PUT /api/notes/:id */
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const noteId = String(req.params.id)
    const data = NoteSchema.partial().parse(req.body)

    const existing = await prisma.note.findFirst({
      where: { id: noteId, user_id: userId },
    })
    if (!existing) {
      fail(res, 'Note not found', 'NOT_FOUND', 404)
      return
    }

    const updated = await prisma.note.update({
      where: { id: noteId },
      data: {
        ...data,
        todos: data.todos !== undefined ? (data.todos as any) : undefined,
      },
    })

    sysLog(req, userId, 'Note Updated', `Updated note: ${updated.title || noteId}`).catch(() => {})
    await clearUserViewCache(userId).catch(() => {})
    ok(res, updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      fail(res, 'Validation failed', 'INVALID_PARAMS')
      return
    }
    console.error('[notes PUT]', err)
    fail(res, 'Failed to update note', 'UPDATE_FAILED', 500)
  }
})

/* DELETE /api/notes/:id */
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const noteId = String(req.params.id)

    const existing = await prisma.note.findFirst({
      where: { id: noteId, user_id: userId },
    })
    if (!existing) {
      fail(res, 'Note not found', 'NOT_FOUND', 404)
      return
    }

    await prisma.note.delete({
      where: { id: noteId },
    })

    sysLog(req, userId, 'Note Deleted', `Deleted note: ${existing.title || noteId}`).catch(() => {})
    await clearUserViewCache(userId).catch(() => {})
    ok(res, { message: 'Note deleted successfully' })
  } catch (err) {
    console.error('[notes DELETE]', err)
    fail(res, 'Failed to delete note', 'DELETE_FAILED', 500)
  }
})

export default router
