import { Router } from 'express'
import https from 'https'
import { Types } from 'mongoose'
import { z } from 'zod'
import axios, { type AxiosInstance } from 'axios'
import * as cheerio from 'cheerio'
import { LRUCache } from 'lru-cache'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { SemesterResult } from '../models/SemesterResult.js'
import { User } from '../models/User.js'
import { ok, fail } from '../utils/response.js'
import { uf, ownership } from '../utils/userFilter.js'
import { fetchIpuResults, fetchAllIpuResults, type ProcessedSubject } from '../services/ipuResultsFetcher.service.js'

const router = Router()
router.use(requireAuth)

/* ── Constants ─────────────────────────────────────────────────────────── */

const IPU_BASE = 'https://examweb.ggsipu.ac.in'
const IPU_LOGIN_URL = `${IPU_BASE}/web/login.jsp`
const IPU_LOGIN_ACTION = `${IPU_BASE}/web/loginaction.do`
const IPU_HOME_URL = `${IPU_BASE}/web/student/studenthome.jsp`

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive',
}

/* ── Per-user axios session store (keeps cookies across requests) ────── */

interface IpuSession {
  client: AxiosInstance
  getCookieString: () => string
}

const _sessions = new LRUCache<string, IpuSession>({ max: 100, ttl: 30 * 60 * 1000 })

function getSession(userId: string): IpuSession {
  if (!_sessions.has(userId)) {
    const jar: Record<string, string> = {}

    const client = axios.create({
      headers: HEADERS,
      timeout: 20_000,
      maxRedirects: 5,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    })

    // ── cookie interceptors (lightweight cookie-jar) ──
    client.interceptors.response.use((resp) => {
      const setCookies = resp.headers['set-cookie']
      if (setCookies) {
        for (const raw of setCookies) {
          const m = raw.match(/^([^=]+)=([^;]*)/) 
          if (m) jar[m[1]] = m[2]
        }
      }
      return resp
    })

    client.interceptors.request.use((cfg) => {
      const cookieStr = Object.entries(jar)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
      if (cookieStr) cfg.headers.Cookie = cookieStr
      return cfg
    })

    const getCookieString = () =>
      Object.entries(jar)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')

    _sessions.set(userId, { client, getCookieString })
  }
  return _sessions.get(userId)!
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

/** Detect if the account is locked/blocked */
function detectAccountLockout(html: string): string | null {
  const lower = html.toLowerCase()
  const lockoutPhrases = [
    'account.*lock', 'account.*block', 'account.*disabled', 'account.*suspend',
    'too many.*attempt', 'maximum.*attempt', 'contact.*department', 'contact.*examination',
    'temporarily.*block', 'temporarily.*lock', 'try.*after', 'try.*later',
  ]
  for (const phrase of lockoutPhrases) {
    if (new RegExp(phrase, 'i').test(lower)) {
      // Extract the actual message
      const $ = cheerio.load(html)
      const msg = $('h2, h3, .error, .alert, .message, #content, .warning, p').filter((_i, el) => {
        return new RegExp(phrase, 'i').test($(el).text())
      }).first().text().trim()
      return msg || 'Your account appears to be locked. Please contact the examination department or wait and try later.'
    }
  }
  return null
}

/** Resolve a relative URL against the IPU base + /web/ context */
function resolveIpuUrl(src: string): string {
  if (src.startsWith('http')) return src
  if (src.startsWith('/')) return IPU_BASE + src
  // Relative path — resolve against /web/ (the login page context)
  return `${IPU_BASE}/web/${src}`
}

/* ── Helper: find CAPTCHA image from login page ──────────────────────── */

function findCaptchaImg($: cheerio.CheerioAPI): string | null {
  let img = $('img#captchaImage, img#captcha')
  if (!img.length) img = $('img[class*="captcha" i]')
  if (!img.length) img = $('img[src*="captcha" i], img[src*="kaptcha" i]')
  if (!img.length) {
    const sec = $(':contains("security check")').last()
    if (sec.length) {
      const container = sec.closest('div, td, tr')
      if (container.length) img = container.find('img').first()
    }
  }
  if (!img.length) return null
  const src = img.attr('src') || ''
  return src ? resolveIpuUrl(src) : null
}

function extractHiddenFields($: cheerio.CheerioAPI): Record<string, string> {
  const hidden: Record<string, string> = {}
  const form = getLoginForm($)
  form.find('input[type="hidden"]').each((_i, inp) => {
    const name = $(inp).attr('name')
    if (name) hidden[name] = $(inp).attr('value') || ''
  })
  return hidden
}

function getLoginForm($: cheerio.CheerioAPI) {
  return $('form[action*="login" i], form[action*="Login" i]').first().length
    ? $('form[action*="login" i], form[action*="Login" i]').first()
    : $('form').first()
}

function detectFieldNames($: cheerio.CheerioAPI) {
  const form = getLoginForm($)
  const det = (candidates: string[]): string | null => {
    if (!form.length) return null
    for (const name of candidates) {
      const inp = form.find(`input[name*="${name}" i]`)
      if (inp.length) return inp.attr('name') || null
    }
    return null
  }
  return {
    username: det(['username', 'j_username', 'userId', 'user_name', 'loginId']) || 'username',
    password: det(['passwd', 'password', 'j_password', 'pass']) || 'passwd',
    captcha: det(['captcha', 'captchaValue', 'vcaptcha', 'kaptcha', 'captchaCode', 'securityCode']) || 'captcha',
  }
}

function detectLoginAction($: cheerio.CheerioAPI): string {
  const form = getLoginForm($)
  const action = form.attr('action')?.trim() || ''
  if (!action) return IPU_LOGIN_ACTION
  return resolveIpuUrl(action)
}

/* ═══════════════════════════════════════════════════════════════════════
   HELPERS — DB persistence (uses FetchedSemesterResult from JSON API)
   ═══════════════════════════════════════════════════════════════════════ */

/** Save fetched results to semester_results collection and update user profile */
async function saveResultsToDB(req: AuthRequest, results: {
  enrollment_number: string
  student_info: Record<string, unknown>
  semesters: Array<{
    semester: string
    semester_num: number
    semester_label: string
    subjects: ProcessedSubject[]
    sgpa: string
    total_credits: number
    total_marks: string
    max_marks: string
  }>
}) {
  const userId = req.userId!
  const own = ownership(req)

  for (const sem of results.semesters) {
    if (!sem.semester_num) continue

    await SemesterResult.findOneAndUpdate(
      { user_id: new Types.ObjectId(userId), semester: sem.semester_num },
      {
        $set: {
          ...own,
          enrollment_number: results.enrollment_number,
          semester: sem.semester_num,
          semester_label: sem.semester_label,
          subjects: sem.subjects,
          sgpa: parseFloat(sem.sgpa) || 0,
          total_credits: sem.total_credits,
          total_marks: sem.total_marks,
          max_marks: sem.max_marks,
          student_info: results.student_info,
          source: 'ipu_scraper',
          updated_at: new Date(),
        },
      },
      { upsert: true },
    )
  }

  // Update user profile with student info
  const info = results.student_info
  const profileUpdate: Record<string, unknown> = {}
  if (results.enrollment_number) profileUpdate.enrollment_number = results.enrollment_number
  if (info.institution) profileUpdate.college = info.institution
  if (info.programme) {
    profileUpdate.course = info.programme
    profileUpdate.branch = info.programme
  }
  if (info.batch) profileUpdate.batch = info.batch
  if (info.name) profileUpdate.name = info.name

  if (Object.keys(profileUpdate).length) {
    await User.updateOne({ _id: userId }, { $set: profileUpdate })
  }

  console.log(`[IPU] Saved ${results.semesters.length} semesters to DB for user ${userId}`)
}

/* ═══════════════════════════════════════════════════════════════════════
   ROUTES
   ═══════════════════════════════════════════════════════════════════════ */

/* ── GET /api/ipu/captcha ─────────────────────────────────────────────── */
router.get('/captcha', async (req: AuthRequest, res) => {
  const { client: sess } = getSession(req.userId!)
  try {
    const resp = await sess.get(IPU_LOGIN_URL)
    const $ = cheerio.load(resp.data)

    const captchaSrc = findCaptchaImg($)
    if (!captchaSrc) return fail(res, 'Could not locate CAPTCHA image on the IPU login page.', 'CAPTCHA_NOT_FOUND', 422)

    // Download CAPTCHA image
    const imgResp = await sess.get(captchaSrc, { responseType: 'arraybuffer' })
    const b64 = Buffer.from(imgResp.data).toString('base64')
    const ct = (imgResp.headers['content-type'] as string) || 'image/jpeg'

    ok(res, {
      captcha_image: `data:${ct};base64,${b64}`,
      hidden_fields: extractHiddenFields($),
      field_names: detectFieldNames($),
      login_action: detectLoginAction($),
    })
  } catch (e: any) {
    console.error('[IPU captcha]', e.message)
    if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
      return fail(res, `Failed to connect to IPU portal: ${e.message}`, 'NETWORK_ERROR', 502)
    }
    fail(res, `Unexpected error: ${e.message}`, 'INTERNAL_ERROR', 500)
  }
})

/* ── POST /api/ipu/auto-fetch ─────────────────────────────────────────── */
router.post('/auto-fetch', async (req: AuthRequest, res) => {
  const { client: sess } = getSession(req.userId!)
  const { enrollment_number = '', password = '' } = req.body || {}
  const enrollment = enrollment_number.trim()
  const pwd = password.trim()

  if (!enrollment || !pwd) return fail(res, 'Enrollment number and password are required.', 'MISSING_FIELDS', 400)

  try {
    // 1. Fetch login page
    const resp = await sess.get(IPU_LOGIN_URL)
    const $ = cheerio.load(resp.data)

    // 2. Find CAPTCHA
    const captchaSrc = findCaptchaImg($)
    if (!captchaSrc) return fail(res, 'Could not locate CAPTCHA on login page.', 'CAPTCHA_NOT_FOUND', 422)

    // 3. Download CAPTCHA
    const imgResp = await sess.get(captchaSrc, { responseType: 'arraybuffer' })
    const b64 = Buffer.from(imgResp.data).toString('base64')
    const ct = (imgResp.headers['content-type'] as string) || 'image/jpeg'

    // 4. Extract fields
    const hiddenFields = extractHiddenFields($)
    const fieldNames = detectFieldNames($)

    // 5. No OCR in Node — always return captcha for manual entry
    const loginAction = detectLoginAction($)
    ok(res, {
      captcha_required: true,
      captcha_image: `data:${ct};base64,${b64}`,
      hidden_fields: hiddenFields,
      field_names: fieldNames,
      login_action: loginAction,
    })
  } catch (e: any) {
    console.error('[IPU auto-fetch]', e.message)
    if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
      return fail(res, `Network error connecting to IPU portal: ${e.message}`, 'NETWORK_ERROR', 502)
    }
    fail(res, `Unexpected error: ${e.message}`, 'INTERNAL_ERROR', 500)
  }
})

/* ── POST /api/ipu/fetch-results ──────────────────────────────────────── */
router.post('/fetch-results', async (req: AuthRequest, res) => {
  const sess = getSession(req.userId!)
  const { enrollment_number = '', password = '', captcha = '', hidden_fields = {}, field_names = {}, login_action = '' } = req.body || {}
  const enrollment = enrollment_number.trim()
  const pwd = password.trim()
  const cap = captcha.trim()

  if (!enrollment || !pwd || !cap) {
    return fail(res, 'Enrollment number, password and CAPTCHA are required.', 'MISSING_FIELDS', 400)
  }

  try {
    // Build login payload
    const payload: Record<string, string> = { ...hidden_fields }
    payload[field_names.username || 'j_username'] = enrollment
    payload[field_names.password || 'j_password'] = pwd
    payload[field_names.captcha || 'captcha'] = cap

    // Use the login action from the captcha step, or fall back to the constant
    const loginUrl = login_action || IPU_LOGIN_ACTION
    console.log('[IPU] Posting login to:', loginUrl)

    const loginResp = await sess.client.post(loginUrl, new URLSearchParams(payload).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 5,
    })

    const pageText: string = loginResp.data
    const pageLower = pageText.toLowerCase()
    const $page = cheerio.load(pageText)

    // Log post-login info for debugging
    const postTitle = $page('title').text().trim()
    const postBodyLen = pageText.length
    console.log(`[IPU] Post-login page: title="${postTitle}", length=${postBodyLen}, status=${loginResp.status}`)
    if (loginResp.request?.res?.responseUrl) {
      console.log(`[IPU] Final redirect URL: ${loginResp.request.res.responseUrl}`)
    }

    // Check for account lockout (BEFORE other checks)
    const lockoutMsg = detectAccountLockout(pageText)
    if (lockoutMsg) {
      console.warn('[IPU] Account lockout detected:', lockoutMsg)
      return fail(res, lockoutMsg, 'ACCOUNT_LOCKED', 423)
    }

    // Check for captcha validation failure
    if (pageLower.includes('captcha validation fail') || pageLower.includes('captcha fail')) {
      return fail(res, 'CAPTCHA validation failed. Please try again with a new CAPTCHA.', 'CAPTCHA_FAILED', 401)
    }

    // Check if still on login page (support both old and new portal field names)
    const loginIndicators = ['j_username', 'j_password', 'loginaction', 'login.jsp', 'name="username"', 'name="passwd"', 'captchaservlet']
    const stillOnLogin = loginIndicators.some((ind) => pageLower.includes(ind))

    // Check for error messages
    const failureSignals = ['invalid', 'incorrect', 'wrong captcha', 'please try again', 'authentication failed', 'login failed', 'unsuccess']
    const errorEls = $page('.error, .alert, .danger, .warning, [class*="error" i], [class*="alert" i], [class*="danger" i], [class*="warning" i]')
    let loginError: string | null = null
    errorEls.each((_i, el) => {
      if (loginError) return
      const t = $page(el).text().trim().toLowerCase()
      if (failureSignals.some((sig) => t.includes(sig))) {
        loginError = $page(el).text().trim() || 'Login failed — check your credentials or CAPTCHA.'
      }
    })
    if (loginError) return fail(res, loginError, 'LOGIN_FAILED', 401)

    if (stillOnLogin) {
      return fail(res, 'Login failed — incorrect credentials or CAPTCHA. Please try again.', 'LOGIN_FAILED', 401)
    }

    // Successful login — fetch results via direct JSON API
    console.log('[IPU] Login successful, fetching JSON API data...')
    const cookieStr = sess.getCookieString()
    const rawSemesters = await fetchAllIpuResults(cookieStr)

    if (!rawSemesters || rawSemesters.length === 0) {
      return fail(res, 'No results found on IPU portal.', 'NO_RESULTS', 404)
    }

    // Deduplicate: the IPU API sometimes returns the same semester data for multiple euno calls
    const seenSemesters = new Set<number>()
    const uniqueSemesters = rawSemesters.filter(s => {
      if (seenSemesters.has(s.semester)) return false
      seenSemesters.add(s.semester)
      return true
    })

    const results = {
      enrollment_number: enrollment,
      student_info: uniqueSemesters[0].student_info as Record<string, unknown>,
      semesters: uniqueSemesters.map(sem => ({
        semester: String(sem.semester),
        semester_num: sem.semester,
        semester_label: `Semester ${sem.semester}`,
        subjects: sem.subjects,
        sgpa: String(sem.sgpa),
        total_credits: sem.total_credits,
        total_marks: String(sem.subjects.reduce((a, s) => a + (s.total_marks || 0), 0)),
        max_marks: String(sem.subjects.reduce((a, s) => a + (s.max_marks || 100), 0)),
      })),
    }

    // Compute grade distribution and overall percentage for the response
    const gradeDistribution: Record<string, number> = {}
    const allSubjsFetch = results.semesters.flatMap(s => s.subjects)
    for (const sub of allSubjsFetch) {
      const g = sub.grade || 'F'
      gradeDistribution[g] = (gradeDistribution[g] || 0) + 1
    }
    const totalMarksFetch = allSubjsFetch.reduce((a, s) => a + (s.total_marks || 0), 0)
    const totalMaxFetch = allSubjsFetch.reduce((a, s) => a + (s.max_marks || 100), 0)
    const overallPercentage = totalMaxFetch > 0
      ? parseFloat(((totalMarksFetch / totalMaxFetch) * 100).toFixed(1))
      : 0

    await saveResultsToDB(req, results)

    ok(res, { ...results, gradeDistribution, overallPercentage, totalSubjects: allSubjsFetch.length })
  } catch (e: any) {
    console.error('[IPU fetch-results]', e.message)
    if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
      return fail(res, `Network error connecting to IPU portal: ${e.message}`, 'NETWORK_ERROR', 502)
    }
    fail(res, `Unexpected error: ${e.message}`, 'INTERNAL_ERROR', 500)
  }
})

/* ── GET /api/ipu/saved-results ────────────────────────────────────────── */
router.get('/saved-results', async (req: AuthRequest, res) => {
  try {
    const results = await SemesterResult.find({
      ...uf(req),
      source: 'ipu_scraper',
    }).sort({ semester: 1 }).lean()

    if (!results.length) {
      return ok(res, null)
    }

    // Build response matching the scraped format
    const studentInfo = results[0]?.student_info || {}
    const enrollmentNumber = results[0]?.enrollment_number || ''

    // Calculate CGPA
    const validSgpas = results.filter(r => r.sgpa > 0)
    const cgpa = validSgpas.length
      ? parseFloat((validSgpas.reduce((a, r) => a + r.sgpa, 0) / validSgpas.length).toFixed(2))
      : 0

    const semesters = results.map(r => ({
      semester: String(r.semester),
      semester_num: r.semester,
      semester_label: r.semester_label || `Semester ${r.semester}`,
      subjects: r.subjects || [],
      sgpa: r.sgpa ? String(r.sgpa) : null,
      total_marks: r.total_marks || null,
      max_marks: r.max_marks || null,
    }))

    // Compute grade distribution and overall percentage from saved subjects
    const gradeDistSaved: Record<string, number> = {}
    const allSubjsSaved = results.flatMap(r => r.subjects || [])
    for (const sub of allSubjsSaved) {
      const g = (sub as any).grade || 'F'
      gradeDistSaved[g] = (gradeDistSaved[g] || 0) + 1
    }
    const totalMarksSaved = allSubjsSaved.reduce((a, s) => a + ((s as any).total_marks || 0), 0)
    const totalMaxSaved = allSubjsSaved.reduce((a, s) => a + ((s as any).max_marks || 100), 0)
    const overallPctSaved = totalMaxSaved > 0
      ? parseFloat(((totalMarksSaved / totalMaxSaved) * 100).toFixed(1))
      : 0

    ok(res, {
      enrollment_number: enrollmentNumber,
      student_info: studentInfo,
      semesters,
      cgpa,
      gradeDistribution: gradeDistSaved,
      overallPercentage: overallPctSaved,
      totalSubjects: allSubjsSaved.length,
      saved: true,
      last_updated: results.reduce((latest, r) => {
        const d = new Date(r.updated_at)
        return d > latest ? d : latest
      }, new Date(0)).toISOString(),
    })
  } catch (err) {
    console.error('[IPU saved-results]', err)
    fail(res, 'Failed to fetch saved results', 'FETCH_FAILED', 500)
  }
})

/* ── POST /api/ipu/sync-results ── Direct JSON API sync ────────────────── */

const SyncResultsSchema = z.object({
  sessionCookie: z.string().min(1, 'Session cookie is required'),
  semester: z.number().int().min(1).max(12).optional(),
})

router.post('/sync-results', async (req: AuthRequest, res) => {
  try {
    const parsed = SyncResultsSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400)
    }

    const { sessionCookie, semester } = parsed.data
    const userId = req.userId!
    const own = ownership(req)

    // Fetch from IPU portal — single semester or all
    let fetched
    if (semester) {
      fetched = [await fetchIpuResults(sessionCookie, semester)]
    } else {
      fetched = await fetchAllIpuResults(sessionCookie)
    }

    if (!fetched.length) {
      return fail(res, 'No results found from the IPU portal', 'NO_RESULTS', 404)
    }

    // Upsert each semester into SemesterResult
    const savedSemesters = []
    for (const sem of fetched) {
      const doc = await SemesterResult.findOneAndUpdate(
        { user_id: new Types.ObjectId(userId), semester: sem.semester },
        {
          $set: {
            ...own,
            enrollment_number: sem.enrollment_number,
            semester: sem.semester,
            semester_label: `Semester ${sem.semester}`,
            subjects: sem.subjects,
            sgpa: sem.sgpa,
            total_credits: sem.total_credits,
            student_info: sem.student_info,
            source: 'ipu_scraper' as const,
            updated_at: new Date(),
          },
        },
        { upsert: true, new: true },
      )
      savedSemesters.push(doc)
    }

    // Update user profile with latest student info
    const info = fetched[0].student_info
    const profileUpdate: Record<string, unknown> = {}
    if (info.name) profileUpdate.name = info.name
    if (info.institution) profileUpdate.college = info.institution
    if (info.programme) {
      profileUpdate.course = info.programme
      profileUpdate.branch = info.programme
    }
    if (info.batch) profileUpdate.batch = info.batch
    if (fetched[0].enrollment_number) profileUpdate.enrollment_number = fetched[0].enrollment_number

    if (Object.keys(profileUpdate).length) {
      await User.updateOne({ _id: userId }, { $set: profileUpdate })
    }

    console.log(`[IPU sync-results] Saved ${savedSemesters.length} semester(s) for user ${userId}`)

    ok(res, {
      semesters: savedSemesters,
      synced_count: savedSemesters.length,
    })
  } catch (err: any) {
    console.error('[IPU sync-results]', err)
    if (err.code === 'SESSION_EXPIRED') {
      return fail(res, 'IPU session expired. Please log in again.', 'SESSION_EXPIRED', 401)
    }
    if (err.code === 'NO_RESULTS') {
      return fail(res, err.message, 'NO_RESULTS', 404)
    }
    fail(res, 'Failed to sync results from IPU portal', 'SYNC_FAILED', 500)
  }
})

export default router
