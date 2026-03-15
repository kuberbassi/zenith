import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import { ENV } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { requireAuth, invalidateAuthCache, type AuthRequest } from '../middleware/auth.js'
import { ok, fail } from '../utils/response.js'

const router = Router()
const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID)

function userResponse(user: Awaited<ReturnType<typeof prisma.user.findUniqueOrThrow>>) {
  return {
    _id: user.id,
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    course: user.course,
    branch: user.branch,
    college: user.college,
    semester: user.current_semester,
    batch: user.batch,
    enrollment_number: user.enrollment_number,
    current_semester: user.current_semester,
    target_attendance: user.target_attendance,
    attendance_threshold: user.attendance_threshold,
    warning_threshold: user.warning_threshold,
    phone_number: user.phone_number,
    headline: user.headline,
    linkedin_url: user.linkedin_url,
    github_url: user.github_url,
    portfolio_url: user.portfolio_url,
    created_at: user.created_at,
  }
}

/* POST /api/auth/google
   Exchange Google ID token for JWT */
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body as { credential: string }
    if (!credential) {
      fail(res, 'credential is required', 'MISSING_FIELD')
      return
    }

    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: ENV.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    if (!payload?.sub) {
      fail(res, 'Invalid Google token', 'INVALID_TOKEN', 401)
      return
    }

    const { sub: google_id, email, name, picture } = payload

    // Upsert user
    const user = await prisma.user.upsert({
      where: { google_id },
      create: { google_id, email: email!, name: name!, picture },
      update: { email: email!, name: name!, picture },
    })

    // Sign JWT
    const token = jwt.sign({ sub: user.id }, ENV.JWT_SECRET, {
      expiresIn: '30d',
    })

    ok(res, { token, user: userResponse(user) })
  } catch (err) {
    console.error('[auth/google]', err)
    fail(res, 'Authentication failed', 'AUTH_FAILED', 500)
  }
})

/* GET /api/auth/me */
router.get('/me', requireAuth, (req: AuthRequest, res) => {
  ok(res, userResponse(req.user!))
})

/* GET /api/auth/debug_db — DEV ONLY */
router.get('/debug_db', requireAuth, async (req: AuthRequest, res) => {
  if (ENV.NODE_ENV === 'production') { fail(res, 'Not available', 'FORBIDDEN', 403); return }
  try {
    const [subjectCount, samples] = await Promise.all([
      prisma.subject.count({ where: { user_id: req.userId! } }),
      prisma.subject.findMany({ where: { user_id: req.userId! }, take: 5 }),
    ])
    res.json({ subjects_count: subjectCount, sample_subjects: samples })
  } catch (err) {
    console.error('[auth/debug_db]', err)
    fail(res, String(err), 'DB_ERROR', 500)
  }
})

/* POST /api/auth/logout  (stateless — just a confirmation) */
router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.slice(7)
  if (token) invalidateAuthCache(token)
  ok(res, { message: 'Logged out' })
})

export default router
