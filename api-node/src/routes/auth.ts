import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import { ENV } from '../config/env.js'
import { User } from '../models/User.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { ok } from '../utils/response.js'

const router = Router()
const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID)

/* POST /api/auth/google
   Exchange Google ID token for JWT */
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body as { credential: string }
    if (!credential) {
      res.status(400).json({ error: 'credential is required' })
      return
    }

    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: ENV.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    if (!payload?.sub) {
      res.status(401).json({ error: 'Invalid Google token' })
      return
    }

    const { sub: google_id, email, name, picture } = payload

    // Upsert user
    const user = await User.findOneAndUpdate(
      { google_id },
      { $set: { email, name, picture } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    // Sign JWT
    const token = jwt.sign({ sub: user._id.toString() }, ENV.JWT_SECRET, {
      expiresIn: '30d',
    })

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture,
        google_id: user.google_id,
        course: user.course,
        branch: user.branch,
        college: user.college,
        semester: user.semester,
        batch: user.batch,
        enrollment_number: user.enrollment_number,
        current_semester: user.current_semester,
        target_attendance: user.target_attendance,
        attendance_threshold: user.attendance_threshold,
        warning_threshold: user.warning_threshold,
        created_at: user.created_at,
      },
    })
  } catch (err) {
    console.error('[auth/google]', err)
    res.status(500).json({ error: 'Authentication failed' })
  }
})

/* GET /api/auth/me */
router.get('/me', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!
  ok(res, {
    _id: user._id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    google_id: user.google_id,
    course: user.course,
    branch: user.branch,
    college: user.college,
    semester: user.semester,
    batch: user.batch,
    enrollment_number: user.enrollment_number,
    current_semester: user.current_semester,
    target_attendance: user.target_attendance,
    attendance_threshold: user.attendance_threshold,
    warning_threshold: user.warning_threshold,
    created_at: user.created_at,
  })
})

/* GET /api/auth/debug_db — DEV ONLY, check raw DB contents */
router.get('/debug_db', async (req, res) => {
  if (ENV.NODE_ENV === 'production') { res.status(403).json({ error: 'Not available' }); return }
  try {
    // Raw collection access to bypass Mongoose schema
    const mongoose = await import('mongoose')
    const db = mongoose.default.connection.db
    if (!db) { res.status(500).json({ error: 'No DB connection' }); return }
    const subjects = await db.collection('subjects').find({}).limit(5).toArray()
    const distinctEmails = await db.collection('subjects').distinct('owner_email')
    const distinctUserIds = await db.collection('subjects').distinct('user_id')
    res.json({
      subjects_count: await db.collection('subjects').countDocuments(),
      sample_subjects: subjects,
      distinct_owner_emails: distinctEmails,
      distinct_user_ids: distinctUserIds,
    })
  } catch (err) {
    console.error('[auth/debug_db]', err)
    res.status(500).json({ error: String(err) })
  }
})

/* POST /api/auth/logout  (stateless — just a confirmation) */
router.post('/logout', (_, res) => {
  res.json({ message: 'Logged out' })
})

export default router
