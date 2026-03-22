import { Router } from 'express'
import { createHash } from 'crypto'
import { z } from 'zod'
import { type AxiosInstance } from 'axios'
import * as cheerio from 'cheerio'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { ok, fail } from '../utils/response.js'
import { fetchIpuResults, fetchAllIpuResults, fetchAllIpuResultsWithClient, parseIpuResultsPayload, type ProcessedSubject } from '../services/ipuResultsFetcher.service.js'
import { destroyIpuSessionEverywhere, getHydratedIpuSession, isIpuSessionAuthenticated, persistIpuSessionState, type IpuSession } from '../services/ipuSession.service.js'
import { isMeaningfulValue, mergePreferredRecord } from '../utils/recordMerge.js'
import { buildResultsPayload } from '../utils/resultsPayload.js'

const router = Router()
router.use(requireAuth)

/* ── Constants ─────────────────────────────────────────────────────────── */

const IPU_BASE = 'https://examweb.ggsipu.ac.in'
const IPU_LOGIN_URL = `${IPU_BASE}/web/login.jsp`
const IPU_LOGIN_ACTION = `${IPU_BASE}/web/Login`
const IPU_HOME_URL = `${IPU_BASE}/web/student/studenthome.jsp`
const IPU_PROFILE_URL = `${IPU_BASE}/web/student/profile.jsp`
const IPU_RESULTS_URL = `${IPU_BASE}/web/StudentSearchProcess`

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive',
}

/* ── Per-user axios session store (keeps cookies across requests) ────── */

type ResultStudentInfo = Record<string, unknown>
type LoginFieldNames = {
  username?: string
  password?: string
  captcha?: string
}
type PersistableSemester = {
  semester: string
  semester_num: number
  semester_label: string
  subjects: ProcessedSubject[]
  sgpa: string
  total_credits: number
  total_marks: string
  max_marks: string
  student_info?: Record<string, string>
}

async function scrapeIpuProfile(client: AxiosInstance): Promise<Record<string, string>> {
  const info: Record<string, string> = {}
  try {
    const resp = await client.get(IPU_PROFILE_URL, { timeout: 10_000 })
    const html = resp.data as string
    if (html.toLowerCase().includes('j_username') || html.toLowerCase().includes('login.jsp')) {
      return info // session expired
    }
    const $ = cheerio.load(html)
    const labelMap: Record<string, string> = {
      'enrollment': 'roll_no', 'enrollment no': 'roll_no', 'enrollment no.': 'roll_no',
      'batch': 'batch', 'admission year': 'admission_year',
      'name': 'name',
      "father's name": 'father', 'father': 'father', "father name": 'father',
      "mother's name": 'mother', 'mother': 'mother', "mother name": 'mother',
      'gender': 'gender',
      'email': 'email', 'email id': 'email',
      'contact': 'phone', 'contact no': 'phone', 'contact no.': 'phone', 'mobile': 'phone', 'phone': 'phone',
      'institute': 'institution', 'institution': 'institution',
      'program': 'programme', 'programme': 'programme',
    }
    const extract = (label: string, value: string) => {
      const key = labelMap[label.toLowerCase().replace(/[:.]/g, '').trim()]
      if (key && value && value !== '---' && value !== '-') info[key] = value.trim()
    }
    // Table rows
    $('table tr').each((_i, row) => {
      const cells = $(row).find('td')
      if (cells.length >= 2) extract($(cells[0]).text(), $(cells[1]).text())
    })
    // Definition lists
    $('dl dt').each((_i, el) => extract($(el).text(), $(el).next('dd').text()))
    // Label/value class patterns
    $('[class*="field-label" i], label').each((_i, el) => {
      const val = $(el).next().text() || $(el).siblings('[class*="value" i]').first().text()
      if (val) extract($(el).text(), val)
    })
    console.log('[IPU Profile] Fields scraped:', Object.keys(info))
  } catch (e: any) {
    if (e?.response?.status === 404) {
      console.warn('[IPU Profile] Profile page not found at current path; skipping profile enrichment.')
      return info
    }
    console.error('[IPU Profile] Scrape failed:', e.message)
  }
  return info
}

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
  form.find('input').each((_i, inp) => {
    const name = $(inp).attr('name')
    const type = ($(inp).attr('type') || 'text').toLowerCase()
    if (!name) return
    if (type === 'hidden' || type === 'submit' || type === 'button') {
      hidden[name] = $(inp).attr('value') || ''
    }
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
  const resolved = resolveIpuUrl(action)
  if (/\/web\/login\.jsp$/i.test(resolved)) return IPU_LOGIN_ACTION
  return resolved
}

function normalizeEnrollmentNumber(value: string): string {
  return String(value || '').trim()
}

function preserveSecret(value: string): string {
  return typeof value === 'string' ? value : ''
}

function sanitizeFieldName(value: unknown, fallback: string): string {
  const normalized = String(value ?? '').trim()
  if (!normalized) return fallback
  return /^[A-Za-z0-9_.-]{1,64}$/.test(normalized) ? normalized : fallback
}

function sanitizeHiddenFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, string> = {}
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = sanitizeFieldName(rawKey, '')
    if (!key) continue
    result[key] = String(rawValue ?? '')
  }
  return result
}

function sanitizeFieldNames(value: unknown): Required<LoginFieldNames> {
  const source = (value && typeof value === 'object' && !Array.isArray(value))
    ? (value as LoginFieldNames)
    : {}
  return {
    username: sanitizeFieldName(source.username, 'username'),
    password: sanitizeFieldName(source.password, 'passwd'),
    captcha: sanitizeFieldName(source.captcha, 'captcha'),
  }
}

function sanitizeLoginAction(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return IPU_LOGIN_ACTION
  const resolved = resolveIpuUrl(raw)
  if (!resolved.startsWith(`${IPU_BASE}/`)) return IPU_LOGIN_ACTION
  return resolved
}

function hashPortalPassword(password: string, captcha: string): string {
  return createHash('sha256')
    .update(`${password}${captcha}`, 'utf8')
    .digest('base64')
}

function extractPortalMessage($: cheerio.CheerioAPI): string | null {
  const selectors = [
    '.error',
    '.alert',
    '.danger',
    '.warning',
    '.message',
    '[class*="error" i]',
    '[class*="alert" i]',
    '[class*="warning" i]',
    '#content',
    'h2',
    'h3',
    'p',
  ]

  for (const selector of selectors) {
    const text = $(selector).first().text().replace(/\s+/g, ' ').trim()
    if (text && text.length >= 8) return text
  }
  return null
}



function buildStudentInfoFromSemesters(semesters: PersistableSemester[]): Record<string, string> {
  return semesters.reduce((acc, semester) => {
    const semesterInfo = normalizeStudentInfo((semester as unknown as { student_info?: Record<string, unknown> }).student_info || {})
    return mergePreferredRecord(semesterInfo, acc)
  }, {} as Record<string, string>)
}

function normalizeStudentInfo(info: Record<string, unknown> = {}): Record<string, string> {
  const normalized: Record<string, string> = {}
  const mappings: Array<[string, string]> = [
    ['name', 'name'],
    ['stname', 'name'],
    ['roll_no', 'roll_no'],
    ['nrollno', 'roll_no'],
    ['enrollment_number', 'roll_no'],
    ['father', 'father'],
    ['mother', 'mother'],
    ['email', 'email'],
    ['phone', 'phone'],
    ['mobno', 'phone'],
    ['gender', 'gender'],
    ['batch', 'batch'],
    ['byoa', 'batch'],
    ['admission_year', 'admission_year'],
    ['yoa', 'admission_year'],
    ['institution', 'institution'],
    ['iname', 'institution'],
    ['programme', 'programme'],
    ['prgname', 'programme'],
  ]

  for (const [sourceKey, targetKey] of mappings) {
    const value = info[sourceKey]
    if (!isMeaningfulValue(value)) continue
    normalized[targetKey] = String(value).trim()
  }

  return normalized
}

function extractProfileInfoFromEmbeddedData(raw: string): Record<string, string> {
  if (!raw) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // The payload can be huge because of stimage; strip it if needed and retry.
    const sanitized = raw.replace(/"stimage"\s*:\s*"[\s\S]*?"\s*(,)?/g, (_match, trailingComma) => trailingComma ? '' : '')
    parsed = JSON.parse(sanitized)
  }

  const row = Array.isArray(parsed) ? parsed[0] : null
  if (!row || typeof row !== 'object') return {}
  const data = row as Record<string, unknown>

  return normalizeStudentInfo({
    name: String(data.stname || ''),
    roll_no: String(data.nrollno || ''),
    father: String(data.father || ''),
    mother: String(data.mother || ''),
    email: String(data.email || ''),
    phone: String(data.mobno || ''),
    gender: String(data.gender || ''),
    batch: data.byoa ? String(data.byoa) : '',
    admission_year: data.yoa ? String(data.yoa) : '',
    institution: String(data.iname || ''),
    programme: String(data.prgname || ''),
  })
}

function extractEmbeddedProfileDataBlock(html: string): string {
  const cheerioMatch = cheerio.load(html)('#data').text().trim()
  if (cheerioMatch) return cheerioMatch

  const regexMatch = html.match(/<div[^>]*id=["']data["'][^>]*>([\s\S]*?)<\/div>/i)
  if (regexMatch?.[1]) {
    return regexMatch[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
  }

  const jsonArrayMatch = html.match(/(\[\s*\{\s*"nrollno"[\s\S]*?\}\s*\])/i)
  if (!jsonArrayMatch?.[1]) return ''

  return jsonArrayMatch[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function getSubjectKey(subject: Partial<ProcessedSubject>): string {
  const code = String(subject.code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (code) return `code::${code}`

  const name = String(subject.name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  return `name::${name}`
}

function subjectCompletenessScore(subject: Partial<ProcessedSubject>): number {
  let score = 0
  if (isMeaningfulValue(subject.total_marks)) score += 5
  if (isMeaningfulValue(subject.internal)) score += 2
  if (isMeaningfulValue(subject.external)) score += 2
  if (isMeaningfulValue(subject.grade) && subject.grade !== '-') score += 2
  if (subject.is_pending === false) score += 3
  return score
}

function mergeSubjectPair(current: Partial<ProcessedSubject>, incoming: Partial<ProcessedSubject>): ProcessedSubject {
  const preferred = subjectCompletenessScore(incoming) >= subjectCompletenessScore(current) ? incoming : current
  const fallback = preferred === incoming ? current : incoming
  const merged = mergePreferredRecord(preferred as Record<string, unknown>, fallback as Record<string, unknown>) as unknown as ProcessedSubject

  // Fresh portal payload should be authoritative for marks/status fields, even when
  // a component is intentionally "-" (for example external-only subjects).
  const authoritativeIncomingFields = [
    'name',
    'code',
    'internal',
    'external',
    'total_marks',
    'max_marks',
    'percentage',
    'grade',
    'grade_point',
    'status',
    'is_pending',
    'declared_date',
    'exam_session',
  ] as const

  for (const field of authoritativeIncomingFields) {
    if (!Object.prototype.hasOwnProperty.call(incoming, field)) continue
    const value = incoming[field]
    if (value === undefined || value === null) continue
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed === '' && field !== 'status') continue
      merged[field] = value as never
      continue
    }
    merged[field] = value as never
  }

  if (merged.total_marks === null && typeof merged.internal === 'string' && typeof merged.external === 'string') {
    const internal = parseFloat(merged.internal)
    const external = parseFloat(merged.external)
    if (!Number.isNaN(internal) || !Number.isNaN(external)) {
      merged.total_marks = (Number.isNaN(internal) ? 0 : internal) + (Number.isNaN(external) ? 0 : external)
    }
  }
  return merged
}

function normalizeAndMergeSubjects(subjects: unknown, existingSubjects: unknown = []): ProcessedSubject[] {
  const merged = new Map<string, ProcessedSubject>()
  const allSubjects = [
    ...(Array.isArray(existingSubjects) ? existingSubjects : []),
    ...(Array.isArray(subjects) ? subjects : []),
  ] as Array<Partial<ProcessedSubject>>

  for (const subject of allSubjects) {
    const key = getSubjectKey(subject)
    if (!key || key === '::') continue
    const previous = merged.get(key)
    merged.set(key, previous ? mergeSubjectPair(previous, subject) : mergeSubjectPair(subject, {}))
  }

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function computeSubjectTotals(subjects: ProcessedSubject[]) {
  const completed = subjects.filter(subject => !subject.is_pending && subject.grade !== '-')
  const totalMarks = completed.reduce((sum, subject) => sum + Number(subject.total_marks ?? 0), 0)
  const totalMaxMarks = completed.reduce((sum, subject) => sum + Number(subject.max_marks ?? 100), 0)
  return {
    total_marks: String(totalMarks),
    max_marks: String(totalMaxMarks),
  }
}

function mergeSemestersWithExisting(
  incomingSemesters: PersistableSemester[],
  existingResults: Array<{ semester: number; semester_label: string | null; subjects: unknown; total_marks: string | null; max_marks: string | null; sgpa: number }>
): PersistableSemester[] {
  const bySemester = new Map(existingResults.map(result => [result.semester, result]))
  return incomingSemesters.map((semester) => {
    const existing = bySemester.get(semester.semester_num)
    const mergedSubjects = normalizeAndMergeSubjects(semester.subjects, existing?.subjects)
    const totals = computeSubjectTotals(mergedSubjects)
    return {
      ...semester,
      semester_label: isMeaningfulValue(semester.semester_label) ? semester.semester_label : (existing?.semester_label || `Semester ${semester.semester_num}`),
      subjects: mergedSubjects,
      sgpa: isMeaningfulValue(semester.sgpa) ? semester.sgpa : String(existing?.sgpa ?? 0),
      total_marks: totals.total_marks || existing?.total_marks || '0',
      max_marks: totals.max_marks || existing?.max_marks || '0',
    }
  })
}

/* ═══════════════════════════════════════════════════════════════════════
   HELPERS — DB persistence (uses FetchedSemesterResult from JSON API)
   ═══════════════════════════════════════════════════════════════════════ */

/** Save fetched results to semester_results collection and update user profile */
async function saveResultsToDB(req: AuthRequest, results: {
  enrollment_number: string
  student_info: ResultStudentInfo
  semesters: PersistableSemester[]
}) {
  const userId = req.userId!
  const existingResults = await prisma.semesterResult.findMany({
    where: { user_id: userId },
    select: {
      semester: true,
      semester_label: true,
      subjects: true,
      total_marks: true,
      max_marks: true,
      sgpa: true,
      student_info: true,
    },
  })
  const existingStudentInfo = existingResults.reduce((acc: any, row: any) => {
    const current = (row.student_info ?? {}) as ResultStudentInfo
    return mergePreferredRecord(current, acc)
  }, {} as ResultStudentInfo)
  const mergedStudentInfo = mergePreferredRecord(results.student_info, existingStudentInfo)
  const normalizedSemesters = mergeSemestersWithExisting(results.semesters, existingResults)

  for (const sem of normalizedSemesters) {
    if (!sem.semester_num) continue

    const existingSemResult = await prisma.semesterResult.findFirst({
      where: { user_id: userId, semester: sem.semester_num },
    })
    if (existingSemResult) {
      await prisma.semesterResult.update({
        where: { id: existingSemResult.id },
        data: {
          enrollment_number: results.enrollment_number,
          semester_label: sem.semester_label,
          subjects: sem.subjects as any,
          sgpa: parseFloat(sem.sgpa) || 0,
          total_credits: sem.total_credits,
          total_marks: sem.total_marks,
          max_marks: sem.max_marks,
          student_info: mergedStudentInfo as any,
          source: 'ipu_scraper',
          updated_at: new Date(),
        },
      })
    } else {
      await prisma.semesterResult.create({
        data: {
          user_id: userId,
          enrollment_number: results.enrollment_number,
          semester: sem.semester_num,
          semester_label: sem.semester_label,
          subjects: sem.subjects as any,
          sgpa: parseFloat(sem.sgpa) || 0,
          total_credits: sem.total_credits,
          total_marks: sem.total_marks,
          max_marks: sem.max_marks,
          student_info: mergedStudentInfo as any,
          source: 'ipu_scraper',
        },
      })
    }
  }

  // Update user profile with student info
  const info = results.student_info
  const profileUpdate: Record<string, unknown> = {}
  
  if (isMeaningfulValue(results.enrollment_number)) profileUpdate.enrollment_number = results.enrollment_number
  if (isMeaningfulValue(mergedStudentInfo.name)) profileUpdate.name = mergedStudentInfo.name
  if (isMeaningfulValue(mergedStudentInfo.institution)) profileUpdate.college = mergedStudentInfo.institution
  if (isMeaningfulValue(mergedStudentInfo.programme)) {
    profileUpdate.course = mergedStudentInfo.programme
    profileUpdate.branch = mergedStudentInfo.programme
  }
  if (isMeaningfulValue(mergedStudentInfo.batch)) profileUpdate.batch = mergedStudentInfo.batch
  if (isMeaningfulValue(mergedStudentInfo.admission_year)) profileUpdate.admission_year = mergedStudentInfo.admission_year
  if (isMeaningfulValue(mergedStudentInfo.phone)) profileUpdate.phone_number = mergedStudentInfo.phone
  if (isMeaningfulValue(mergedStudentInfo.gender)) profileUpdate.gender = mergedStudentInfo.gender
  if (isMeaningfulValue(mergedStudentInfo.father)) profileUpdate.father_name = mergedStudentInfo.father
  if (isMeaningfulValue(mergedStudentInfo.mother)) profileUpdate.mother_name = mergedStudentInfo.mother

  // Also update current_semester if we found results for a higher semester
  const maxSemInResults = Math.max(...results.semesters.map(s => s.semester_num), 0)
  if (maxSemInResults > 0) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { current_semester: true } })
    if (user && maxSemInResults > (user.current_semester ?? 0)) {
        profileUpdate.current_semester = maxSemInResults
    }
  }

  if (Object.keys(profileUpdate).length) {
    console.log(`[IPU] Updating profile for user ${userId}:`, Object.keys(profileUpdate))
    await prisma.user.update({ where: { id: userId }, data: profileUpdate as any })
  }


  console.log(`[IPU] Saved ${results.semesters.length} semesters to DB for user ${userId}`)
}

/* ═══════════════════════════════════════════════════════════════════════
   ROUTES
   ═══════════════════════════════════════════════════════════════════════ */

/* ── GET /api/ipu/captcha ─────────────────────────────────────────────── */
router.get('/captcha', async (req: AuthRequest, res) => {
  const userId = req.userId!
  try {
    await destroyIpuSessionEverywhere(userId)
    const session = await getHydratedIpuSession(userId, HEADERS, { forceFresh: true })
    const resp = await session.client.get(IPU_LOGIN_URL, { responseType: 'text' })
    const html = resp.data
    const $ = cheerio.load(html)
    
    const captchaSrc = findCaptchaImg($)
    if (!captchaSrc) return fail(res, 'Could not locate CAPTCHA image on the IPU login page.', 'CAPTCHA_NOT_FOUND', 422)
    
    const imgResp = await session.client.get(captchaSrc, { responseType: 'arraybuffer' })
    const b64 = Buffer.from(imgResp.data, 'binary').toString('base64')
    
    session.markCaptchaIssued()
    await persistIpuSessionState(userId, session)

    ok(res, {
      captcha_image: `data:image/png;base64,${b64}`,
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
  const parsed = AutoFetchSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, parsed.error.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400)
  }
  const enrollment = normalizeEnrollmentNumber(parsed.data.enrollment_number)
  const pwd = preserveSecret(parsed.data.password)

  if (!enrollment || !pwd) return fail(res, 'Enrollment number and password are required.', 'MISSING_FIELDS', 400)

  try {
    const session = await getHydratedIpuSession(req.userId!, HEADERS, { forceFresh: true })
    const resp = await session.client.get(IPU_LOGIN_URL, { responseType: 'text' })
    const html = resp.data
    const $ = cheerio.load(html)
    
    // 2. Find CAPTCHA
    const captchaSrc = findCaptchaImg($)
    if (!captchaSrc) return fail(res, 'Could not locate CAPTCHA on login page.', 'CAPTCHA_NOT_FOUND', 422)
    const imgResp = await session.client.get(captchaSrc, { responseType: 'arraybuffer' })
    const b64 = Buffer.from(imgResp.data, 'binary').toString('base64')

    // 4. Extract fields
    session.markCaptchaIssued()
    await persistIpuSessionState(req.userId!, session)

    // 5. No OCR in Node — always return captcha for manual entry
    ok(res, {
      captcha_required: true,
      captcha_image: `data:image/png;base64,${b64}`,
      hidden_fields: extractHiddenFields($),
      field_names: detectFieldNames($),
      login_action: detectLoginAction($),
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
  const userId = req.userId!
  const parsed = FetchResultsSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, parsed.error.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400)
  }
  const enrollment = normalizeEnrollmentNumber(parsed.data.enrollment_number)
  const pwd = preserveSecret(parsed.data.password)
  const cap = String(parsed.data.captcha || '').trim()
  const hidden_fields = sanitizeHiddenFields(parsed.data.hidden_fields)
  const field_names = sanitizeFieldNames(parsed.data.field_names)
  const login_action = sanitizeLoginAction(parsed.data.login_action)

  if (!enrollment || !pwd || !cap) {
    return fail(res, 'Enrollment number, password and CAPTCHA are required.', 'MISSING_FIELDS', 400)
  }

  let browserSession: IpuSession | undefined
  try {
    browserSession = await getHydratedIpuSession(userId, HEADERS)
    const loginSafety = browserSession.canAttemptLogin()
    if (!loginSafety.ok) {
      return fail(res, loginSafety.reason || 'Portal login blocked for safety.', 'LOGIN_BLOCKED', 429)
    }
    const usernameField = field_names.username
    const passwordField = field_names.password
    const captchaField = field_names.captcha
    const loginUrl = login_action
    browserSession.markLoginAttempt()
    console.log('[IPU] Posting login to:', loginUrl)

    const payload = new URLSearchParams()
    const reservedFields = [usernameField, passwordField, captchaField, 'btn_login'].map(s => s.toLowerCase())
    
    for (const [k, v] of Object.entries(hidden_fields)) {
      if (!reservedFields.includes(k.toLowerCase())) {
        payload.append(k, String(v))
      }
    }
    
    payload.append(usernameField, enrollment)
    payload.append(passwordField, pwd)
    payload.append(captchaField, cap)
    payload.append('btn_login', 'Login')

    const loginResp = await browserSession.client.post(loginUrl, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: IPU_LOGIN_URL },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    })
    
    let pageText = String(loginResp.data)
    if (loginResp.status >= 300 && loginResp.status < 400 && loginResp.headers.location) {
      const redirectUrl = resolveIpuUrl(loginResp.headers.location)
      const redirectResp = await browserSession.client.get(redirectUrl)
      pageText = String(redirectResp.data)
    }

    const pageLower = pageText.toLowerCase()
    const $page = cheerio.load(pageText)

    // Log post-login info for debugging
    const postTitle = $page('title').text().trim()
    const postBodyLen = pageText.length
    console.log(`[IPU] Post-login page: title="${postTitle}", length=${postBodyLen}, status=${loginResp.status}`)

    // Check for account lockout (BEFORE other checks)
    const lockoutMsg = detectAccountLockout(pageText)
    if (lockoutMsg) {
      browserSession.markLoginFailure()
      await persistIpuSessionState(userId, browserSession)
      console.warn('[IPU] Account lockout detected:', lockoutMsg)
      return fail(res, lockoutMsg, 'ACCOUNT_LOCKED', 423)
    }

    // Check for captcha validation failure
    if (pageLower.includes('captcha validation fail') || pageLower.includes('captcha fail')) {
      browserSession.markLoginFailure()
      await persistIpuSessionState(userId, browserSession)
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
    if (loginError) {
      browserSession.markLoginFailure()
      await persistIpuSessionState(userId, browserSession)
      return fail(res, loginError, 'LOGIN_FAILED', 401)
    }

    if (stillOnLogin) {
      browserSession.markLoginFailure()
      await persistIpuSessionState(userId, browserSession)
      return fail(res, 'Login failed — incorrect credentials or CAPTCHA. Please try again.', 'LOGIN_FAILED', 401)
    }

    // Successful login — scrape profile first, then fetch results
    browserSession.markLoginSuccess()
    browserSession.authenticatedAt = Date.now()
    await persistIpuSessionState(userId, browserSession)
    console.log('[IPU] Login successful, scraping profile + fetching JSON API data...')
    
    let profileInfo: Record<string, string> = {}
    try {
      profileInfo = await scrapeIpuProfile(browserSession.client)
    } catch (profileErr: any) {
      console.warn('[IPU Profile] profile fetch skipped:', profileErr?.message || profileErr)
    }
    
    let rawSemesters
    const fetchStart = Date.now()
    try {
      rawSemesters = await fetchAllIpuResultsWithClient(browserSession.client, 8)
      const fetchDuration = Date.now() - fetchStart
      console.log(`[IPU results-api] Successfully fetched ${rawSemesters.length} semesters in ${fetchDuration}ms`)
    } catch (fetchErr: any) {
      const fetchDuration = Date.now() - fetchStart
      console.error(`[IPU results-api] Fetch failed after ${fetchDuration}ms:`, fetchErr?.message || fetchErr)
      
      if (fetchErr?.code === 'SESSION_EXPIRED') {
        return fail(res, 'IPU session expired while fetching results. Please log in again.', 'SESSION_EXPIRED', 401)
      }

      return fail(
        res,
        fetchErr?.message || 'Portal login succeeded, but result data could not be read.',
        'RESULTS_FETCH_FAILED',
        fetchErr?.code === 'BAD_RESULTS_RESPONSE' ? 502 : 500,
      )
    }

    if (!rawSemesters || rawSemesters.length === 0) {
      return fail(res, 'No results found on IPU portal.', 'NO_RESULTS', 404)
    }

    const persistableSemesters: PersistableSemester[] = rawSemesters.map(parsed => ({
      semester: String(parsed.semester),
      semester_num: parsed.semester,
      semester_label: `Semester ${parsed.semester}`,
      subjects: parsed.subjects,
      sgpa: String(parsed.sgpa),
      total_credits: parsed.total_credits,
      total_marks: String(parsed.subjects.filter(s => !s.is_pending).reduce((a, s) => a + (s.total_marks ?? 0), 0)),
      max_marks: String(parsed.subjects.filter(s => !s.is_pending).reduce((a, s) => a + (s.max_marks ?? 100), 0)),
      student_info: (parsed.student_info || {}) as Record<string, string>,
    }))

    // Deduplicate: the IPU API sometimes returns the same semester data for multiple euno calls
    const seenSemesters = new Set<number>()
    const uniqueSemesters = persistableSemesters.filter(s => {
      if (seenSemesters.has(s.semester_num)) return false
      seenSemesters.add(s.semester_num)
      return true
    })

    const existingResults = await prisma.semesterResult.findMany({
      where: { user_id: req.userId! },
      select: {
        semester: true,
        semester_label: true,
        subjects: true,
        total_marks: true,
        max_marks: true,
        sgpa: true,
      },
    })

    const semesterStudentInfo = buildStudentInfoFromSemesters(uniqueSemesters)
    const rawResults = {
      enrollment_number: enrollment,
      student_info: mergePreferredRecord(profileInfo, semesterStudentInfo),
      semesters: uniqueSemesters,
    }
    const results = {
      ...rawResults,
      semesters: mergeSemestersWithExisting(rawResults.semesters, existingResults),
    }

    // Compute grade distribution and overall percentage — exclude pending subjects
    const gradeDistribution: Record<string, number> = {}
    const allSubjsFetch = results.semesters.flatMap(s => s.subjects)
    const completedSubjs = allSubjsFetch.filter(s => !s.is_pending && s.grade !== '-')
    for (const sub of completedSubjs) {
      const g = sub.grade || 'F'
      gradeDistribution[g] = (gradeDistribution[g] || 0) + 1
    }
    const totalMarksFetch = completedSubjs.reduce((a, s) => a + (s.total_marks ?? 0), 0)
    const totalMaxFetch = completedSubjs.reduce((a, s) => a + (s.max_marks ?? 100), 0)
    const overallPercentage = totalMaxFetch > 0
      ? parseFloat(((totalMarksFetch / totalMaxFetch) * 100).toFixed(1))
      : 0

    await saveResultsToDB(req, results)

    ok(res, { ...results, gradeDistribution, overallPercentage, totalSubjects: completedSubjs.length })
  } catch (e: any) {
    console.error('[IPU fetch-results] Error:', e.message, e.stack)
    if (e.code === 'SESSION_EXPIRED') {
      return fail(res, 'IPU session expired. Please log in again.', 'SESSION_EXPIRED', 401)
    }
    if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
      return fail(res, `Network error connecting to IPU portal: ${e.message}`, 'NETWORK_ERROR', 502)
    }
    fail(res, `Unexpected error: ${e.message}`, 'INTERNAL_ERROR', 500)
  } finally {
    if (!isIpuSessionAuthenticated(browserSession)) {
      await destroyIpuSessionEverywhere(userId)
    } else if (browserSession) {
      await persistIpuSessionState(userId, browserSession)
    }
  }
})

/* ── GET /api/ipu/saved-results ────────────────────────────────────────── */
router.get('/saved-results', async (req: AuthRequest, res) => {
  try {
    const payload = await buildResultsPayload(req.userId!, { source: 'ipu_scraper' })
    if (!payload.semesters.length) {
      return ok(res, null)
    }
    const totalSubjects = payload.semesters
      .flatMap((semester: any) => semester.subjects || [])
      .filter((subject: any) => !subject.is_pending && subject.grade !== '-')
      .length

    ok(res, { ...payload, totalSubjects, saved: true })
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

const AutoFetchSchema = z.object({
  enrollment_number: z.string().min(1, 'Enrollment number is required'),
  password: z.string().min(1, 'Password is required'),
})

const FetchResultsSchema = z.object({
  enrollment_number: z.string().min(1, 'Enrollment number is required'),
  password: z.string().min(1, 'Password is required'),
  captcha: z.string().min(1, 'CAPTCHA is required'),
  hidden_fields: z.record(z.string(), z.unknown()).optional(),
  field_names: z.object({
    username: z.string().optional(),
    password: z.string().optional(),
    captcha: z.string().optional(),
  }).optional(),
  login_action: z.string().optional(),
})

router.post('/sync-results', async (req: AuthRequest, res) => {
  try {
    const parsed = SyncResultsSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message || 'Validation failed', 'VALIDATION_ERROR', 400)
    }

    const { sessionCookie, semester } = parsed.data
    const userId = req.userId!


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
    const existingResults = await prisma.semesterResult.findMany({
      where: { user_id: userId },
      select: {
        semester: true,
        semester_label: true,
        subjects: true,
        total_marks: true,
        max_marks: true,
        sgpa: true,
      },
    })
    const normalizedFetched = mergeSemestersWithExisting(
      fetched.map(sem => {
        const totals = computeSubjectTotals(sem.subjects)
        return {
          semester: String(sem.semester),
          semester_num: sem.semester,
          semester_label: `Semester ${sem.semester}`,
          subjects: sem.subjects,
          sgpa: String(sem.sgpa),
          total_credits: sem.total_credits,
          total_marks: totals.total_marks,
          max_marks: totals.max_marks,
        }
      }),
      existingResults,
    )

    const savedSemesters = []
    for (const sem of normalizedFetched) {
      const existingInternalResult = await prisma.semesterResult.findFirst({
        where: { user_id: userId, semester: sem.semester_num },
      })
      let doc
      if (existingInternalResult) {
        doc = await prisma.semesterResult.update({
          where: { id: existingInternalResult.id },
          data: {
            enrollment_number: fetched[0].enrollment_number,
            semester_label: sem.semester_label,
            subjects: sem.subjects as any,
            sgpa: parseFloat(sem.sgpa) || 0,
            total_credits: sem.total_credits,
            total_marks: sem.total_marks,
            max_marks: sem.max_marks,
            student_info: mergePreferredRecord(fetched[0].student_info as Record<string, unknown>, {}) as any,
            source: 'ipu_scraper',
            updated_at: new Date(),
          },
        })
      } else {
        doc = await prisma.semesterResult.create({
          data: {
            user_id: userId,
            enrollment_number: fetched[0].enrollment_number,
            semester: sem.semester_num,
            semester_label: sem.semester_label,
            subjects: sem.subjects as any,
            sgpa: parseFloat(sem.sgpa) || 0,
            total_credits: sem.total_credits,
            total_marks: sem.total_marks,
            max_marks: sem.max_marks,
            student_info: mergePreferredRecord(fetched[0].student_info as Record<string, unknown>, {}) as any,
            source: 'ipu_scraper',
          },
        })
      }
      savedSemesters.push(doc)
    }

    // Update user profile with latest student info
    const info = fetched[0].student_info
    const profileUpdate: Record<string, unknown> = {}
    if (isMeaningfulValue(info.name)) profileUpdate.name = info.name
    if (isMeaningfulValue(info.institution)) profileUpdate.college = info.institution
    if (isMeaningfulValue(info.programme)) {
      profileUpdate.course = info.programme
      profileUpdate.branch = info.programme
    }
    if (isMeaningfulValue(info.batch)) profileUpdate.batch = info.batch
    if (isMeaningfulValue(info.admission_year)) profileUpdate.admission_year = info.admission_year
    if (isMeaningfulValue(fetched[0].enrollment_number)) profileUpdate.enrollment_number = fetched[0].enrollment_number

    if (Object.keys(profileUpdate).length) {
      await prisma.user.update({ where: { id: userId }, data: profileUpdate as any })
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
