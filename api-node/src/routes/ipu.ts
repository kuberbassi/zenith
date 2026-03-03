import { Router } from 'express'
import https from 'https'
import { Types } from 'mongoose'
import axios, { type AxiosInstance } from 'axios'
import * as cheerio from 'cheerio'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { SemesterResult } from '../models/SemesterResult.js'
import { User } from '../models/User.js'
import { ok, fail } from '../utils/response.js'
import { uf, ownership } from '../utils/userFilter.js'

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

const _sessions = new Map<string, AxiosInstance>()

function getSession(userId: string): AxiosInstance {
  if (!_sessions.has(userId)) {
    const jar: Record<string, string> = {}

    const instance = axios.create({
      headers: HEADERS,
      timeout: 20_000,
      maxRedirects: 5,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    })

    // ── cookie interceptors (lightweight cookie-jar) ──
    instance.interceptors.response.use((resp) => {
      const setCookies = resp.headers['set-cookie']
      if (setCookies) {
        for (const raw of setCookies) {
          const m = raw.match(/^([^=]+)=([^;]*)/)
          if (m) jar[m[1]] = m[2]
        }
      }
      return resp
    })

    instance.interceptors.request.use((cfg) => {
      const cookieStr = Object.entries(jar)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
      if (cookieStr) cfg.headers.Cookie = cookieStr
      return cfg
    })

    _sessions.set(userId, instance)
  }
  return _sessions.get(userId)!
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function detectField($form: cheerio.Cheerio<any>, $: cheerio.CheerioAPI, candidates: string[]): string | null {
  if (!$form.length) return null
  for (const name of candidates) {
    const inp = $form.find(`input[name*="${name}" i]`)
    if (inp.length) return inp.attr('name') || null
  }
  return null
}

/** Roman-numeral-aware semester label → number */
function semLabelToNumber(label: string, value: string): string {
  const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 }
  const lc = label.trim().toLowerCase()
  for (const [rom, num] of Object.entries(roman)) {
    if (lc.endsWith(`-${rom}`) || lc.endsWith(` ${rom}`) || lc === rom) return String(num)
  }
  const labDigits = label.match(/\d+/)
  if (labDigits) return labDigits[0]
  const valDigits = value.match(/\d+/)
  if (valDigits) return valDigits[0]
  return label
}

/** Extract student info (name, programme, institution, batch) from any IPU page */
function extractStudentInfo($: cheerio.CheerioAPI): Record<string, string> {
  const info: Record<string, string> = {}
  const patterns: Record<string, string[]> = {
    name: ['student name', 'name'],
    programme: ['programme', 'program', 'course', 'branch'],
    institution: ['institution', 'college', 'school', 'institute'],
    batch: ['batch', 'year'],
  }

  for (const [key, labels] of Object.entries(patterns)) {
    for (const label of labels) {
      // look for text nodes containing the label
      let found = false
      $('td, th, div, span, label, p').each((_i, el) => {
        if (found) return
        const txt = $(el).text().trim().toLowerCase()
        if (!txt.includes(label)) return

        // try sibling
        const sib = $(el).next('td, div, span')
        if (sib.length && sib.text().trim()) {
          info[key] = sib.text().trim()
          found = true
          return
        }
        // try next td in same tr
        const tr = $(el).closest('tr')
        if (tr.length) {
          const tds = tr.find('td')
          tds.each((idx, td) => {
            if (found) return
            if ($(td).text().trim().toLowerCase().includes(label) && idx + 1 < tds.length) {
              const val = $(tds[idx + 1]).text().trim()
              if (val) { info[key] = val; found = true }
            }
          })
        }
      })
      if (found) break
    }
  }
  return info
}

interface SubjectResult {
  code?: string
  name?: string
  internal?: string
  external?: string
  marks?: string
  max_marks?: string
  grade?: string
  grade_points?: string
  credits?: string
  status?: string
}

interface SemesterData {
  semester: string
  semester_num: number
  semester_label: string
  subjects: SubjectResult[]
  sgpa: string | null
  total_marks: string | null
  max_marks: string | null
}

/** Parse a single semester's result page */
function parseSemesterResultPage($: cheerio.CheerioAPI, semNum: string, semLabel: string): SemesterData {
  const sem: SemesterData = {
    semester: semNum,
    semester_num: parseInt(semNum.replace(/\D/g, '') || '0', 10) || 0,
    semester_label: semLabel,
    subjects: [],
    sgpa: null,
    total_marks: null,
    max_marks: null,
  }

  // Find SGPA
  $('td, th, div, span, p').each((_i, el) => {
    const t = $(el).text().trim().toLowerCase()
    if (/(sgpa|s\.g\.p\.a)/.test(t)) {
      const sib = $(el).next('td, div, span')
      if (sib.length) {
        const m = sib.text().match(/[\d.]+/)
        if (m) sem.sgpa = m[0]
      }
    }
  })

  // Find subject table
  $('table').each((_ti, tbl) => {
    if (sem.subjects.length) return // already found

    const rows = $(tbl).find('tr')
    if (rows.length < 2) return

    const headerCells = $(rows[0]).find('th, td')
    const headers = headerCells.map((_i, c) => $(c).text().trim().toLowerCase()).get()
    if (!headers.length) return

    const hasSubject = headers.some((h) => /paper|subject|title|course/.test(h))
    const hasMarks = headers.some((h) => /mark|grade|score|total|credit/.test(h))
    if (!hasSubject && !hasMarks) return

    const subjects: SubjectResult[] = []
    rows.slice(1).each((_ri, row) => {
      const cells = $(row).find('td, th')
      if (cells.length < 2) return
      const texts = cells.map((_i, c) => $(c).text().trim()).get()

      if (texts.every((t) => !t)) return
      const first = texts[0].toLowerCase()
      if (/^(total|sgpa|cgpa|result|grand)/.test(first)) {
        // extract total/max from summary row
        headers.forEach((h, idx) => {
          if (idx >= texts.length) return
          if (/total/.test(h) && texts[idx].match(/[\d.]+/) && !sem.total_marks) sem.total_marks = texts[idx]
          if (/max/.test(h) && texts[idx].match(/[\d.]+/) && !sem.max_marks) sem.max_marks = texts[idx]
        })
        return
      }

      const subj: SubjectResult = {}
      headers.forEach((h, idx) => {
        if (idx >= texts.length || !texts[idx]) return
        const v = texts[idx]
        if (/paper/.test(h) && !/title|name/.test(h)) subj.code = v
        else if (/title|subject|paper name|paper title|course/.test(h)) subj.name = v
        else if (/internal|sessional|minor|\bia\b/.test(h)) subj.internal = v
        else if (/external|theory|major|\bea\b/.test(h)) subj.external = v
        else if (/total|marks obtained|marks/.test(h)) subj.marks = v
        else if (/max|maximum/.test(h)) subj.max_marks = v
        else if (/grade point|gp/.test(h)) subj.grade_points = v
        else if (/grade/.test(h)) subj.grade = v
        else if (/credit|cr/.test(h)) subj.credits = v
        else if (/status|result|pass|fail/.test(h)) subj.status = v
      })
      if (subj.name || subj.code) subjects.push(subj)
    })

    if (subjects.length) sem.subjects = subjects
  })

  return sem
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

/** After login, iterate all semesters and scrape results */
async function scrapeAllSemesters(sess: AxiosInstance, enrollment: string, loginPageHtml?: string) {
  const result: { enrollment_number: string; student_info: Record<string, string>; semesters: SemesterData[] } = {
    enrollment_number: enrollment,
    student_info: {},
    semesters: [],
  }

  // Candidate dashboard URLs (known portal paths)
  const candidateUrls = [
    IPU_HOME_URL,
    `${IPU_BASE}/web/studenthome.jsp`,
    `${IPU_BASE}/web/student/dashboard.jsp`,
    `${IPU_BASE}/web/newStudentDashboard.jsp`,
    `${IPU_BASE}/web/student/result.jsp`,
    `${IPU_BASE}/web/result.jsp`,
    `${IPU_BASE}/web/student/viewresult.jsp`,
    `${IPU_BASE}/web/viewResult.jsp`,
    `${IPU_BASE}/web/student/home.jsp`,
    `${IPU_BASE}/web/home.jsp`,
    `${IPU_BASE}/web/Student/StudentHome.jsp`,
    `${IPU_BASE}/web/Student/Home.jsp`,
    `${IPU_BASE}/web/Student/Result.jsp`,
  ]

  let $home: cheerio.CheerioAPI | null = null
  let dashboardUrl: string | null = null

  // 1) Check the login response itself — it might already be the dashboard
  if (loginPageHtml) {
    const $try = cheerio.load(loginPageHtml)

    // Check for selects (semester, exam type, etc.)
    const sel = $try('select')
    if (sel.length) {
      console.log(`[IPU] Login response contains ${sel.length} select element(s)`)
      $home = $try
    }

    // If no select, look for links to result/dashboard pages and follow them
    if (!$home) {
      const links: string[] = []
      $try('a[href]').each((_i, el) => {
        const href = $try(el).attr('href')?.trim()
        if (href && !href.startsWith('#') && !href.startsWith('javascript')) {
          links.push(resolveIpuUrl(href))
        }
      })
      // Also check frames/iframes
      $try('frame[src], iframe[src]').each((_i, el) => {
        const src = $try(el).attr('src')?.trim()
        if (src) links.push(resolveIpuUrl(src))
      })

      console.log(`[IPU] Post-login page has ${links.length} links. Checking for result pages...`)

      // Prioritize links with result/semester/exam keywords
      const resultLinks = links.filter(l => /result|semester|exam|marks|grade|student|home|dashboard/i.test(l))
      const allToTry = [...new Set([...resultLinks, ...links])]

      for (const link of allToTry.slice(0, 15)) {
        try {
          const resp = await sess.get(link, { validateStatus: (s) => s < 500, timeout: 10_000 })
          if (resp.status === 200 && typeof resp.data === 'string' && resp.data.length > 200) {
            const $try2 = cheerio.load(resp.data)
            if ($try2('select').length || $try2('table').filter((_i, t) => {
              const text = $try2(t).text().toLowerCase()
              return /paper|subject|grade|credit|marks/.test(text)
            }).length) {
              console.log(`[IPU] Found dashboard/results at link: ${link}`)
              $home = $try2
              dashboardUrl = link
              break
            }
          }
        } catch { /* next */ }
      }

      // If still nothing, check if the page itself has result tables
      if (!$home) {
        const tables = $try('table')
        tables.each((_i, tbl) => {
          if ($home) return
          const text = $try(tbl).text().toLowerCase()
          if (/paper|subject|grade|credit|marks|internal|external/.test(text)) {
            console.log('[IPU] Login response itself contains result tables')
            $home = $try
          }
        })
      }
    }
  }

  // 2) Try candidate dashboard URLs
  if (!$home) {
    for (const url of candidateUrls) {
      try {
        const resp = await sess.get(url, { validateStatus: (s) => s < 500, timeout: 10_000 })
        if (resp.status === 200 && typeof resp.data === 'string' && resp.data.length > 200) {
          const $try = cheerio.load(resp.data)
          if ($try('select').length || $try('table').filter((_i, t) => {
            return /paper|subject|grade|credit|marks/.test($try(t).text().toLowerCase())
          }).length) {
            console.log(`[IPU] Found dashboard at candidate URL: ${url}`)
            $home = $try
            dashboardUrl = url
            break
          }
        }
      } catch { /* next */ }
    }
  }

  if (!$home) {
    // Log what we actually got for debugging
    if (loginPageHtml) {
      const $debug = cheerio.load(loginPageHtml)
      const title = $debug('title').text().trim()
      const bodyText = $debug('body').text().trim().substring(0, 300)
      console.warn(`[IPU] Could not find results page. Post-login page title: "${title}", body preview: "${bodyText}"`)
    } else {
      console.warn('[IPU] Could not find any page with results')
    }
    return result
  }

  result.student_info = extractStudentInfo($home)

  // Strategy A: Find semester <select> and iterate options
  let semSelect = $home('select[name*="sem" i], select[name*="term" i], select[name*="annual" i], select[name*="extype" i]')
  if (!semSelect.length) semSelect = $home('select').first()

  if (semSelect.length) {
    const selectName = semSelect.attr('name') || 'semester'
    const options: { value: string; label: string }[] = []
    semSelect.find('option').each((_i, opt) => {
      const val = $home!(opt).attr('value')?.trim() || ''
      const label = $home!(opt).text().trim()
      if (!val || val === '0' || val === '-1' || label.includes('--')) return
      options.push({ value: val, label })
    })
    console.log(`[IPU] Found ${options.length} semester options via select`)

    const semForm = semSelect.closest('form')
    let action = semForm.attr('action')?.trim() || ''
    if (action && !action.startsWith('http')) action = resolveIpuUrl(action)
    if (!action) action = dashboardUrl || IPU_HOME_URL
    const method = (semForm.attr('method') || 'post').toLowerCase()

    const homeHidden: Record<string, string> = {}
    semForm.find('input[type="hidden"]').each((_i, inp) => {
      const nm = $home!(inp).attr('name')
      if (nm) homeHidden[nm] = $home!(inp).attr('value') || ''
    })

    for (const opt of options) {
      const semNum = semLabelToNumber(opt.label, opt.value)
      try {
        const payload: Record<string, string> = { ...homeHidden, [selectName]: opt.value }
        let semResp
        if (method === 'get') {
          semResp = await sess.get(action, { params: payload })
        } else {
          semResp = await sess.post(action, new URLSearchParams(payload).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          })
        }

        if (semResp.status !== 200 || (typeof semResp.data === 'string' && semResp.data.length < 200)) {
          console.warn(`[IPU] Skipping ${opt.label}: bad response`)
          continue
        }

        const $sem = cheerio.load(semResp.data)
        const semData = parseSemesterResultPage($sem, semNum, opt.label)

        if (semData.subjects.length || semData.total_marks) {
          result.semesters.push(semData)
          if (!Object.keys(result.student_info).length) {
            result.student_info = extractStudentInfo($sem)
          }
        }
      } catch (e) {
        console.error(`[IPU] Error fetching semester ${opt.label}:`, e)
      }
    }
  }

  // Strategy B: If no select found, try parsing tables directly from the page
  if (!result.semesters.length) {
    console.log('[IPU] No semester select found. Trying direct table parsing...')
    const tables = $home('table')
    let tableIdx = 0
    tables.each((_i, tbl) => {
      const text = $home!(tbl).text().toLowerCase()
      if (/paper|subject|grade|credit|marks/.test(text)) {
        tableIdx++
        const $wrapper = cheerio.load($home!.html(tbl) || '')
        const semData = parseSemesterResultPage($wrapper, String(tableIdx), `Semester ${tableIdx}`)
        if (semData.subjects.length) {
          result.semesters.push(semData)
        }
      }
    })
    if (result.semesters.length) {
      console.log(`[IPU] Parsed ${result.semesters.length} semesters from direct tables`)
    }
  }

  result.semesters.sort((a, b) => a.semester_num - b.semester_num)
  return result
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
  const det = (candidates: string[]) => detectField(form, $, candidates)
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
   HELPERS — grade calculation & DB persistence
   ═══════════════════════════════════════════════════════════════════════ */

const GRADE_POINTS: Record<string, number> = {
  'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'P': 4, 'F': 0, 'Ab': 0, 'I': 0,
}

function calcSGPA(subjects: SubjectResult[]): number {
  const valid = subjects.filter(s => s.credits && parseFloat(s.credits) > 0)
  if (!valid.length) return 0
  const totalCr = valid.reduce((a, s) => a + parseFloat(s.credits!), 0)
  const totalPt = valid.reduce((a, s) => a + (parseFloat(s.credits!) * (GRADE_POINTS[s.grade ?? ''] ?? 0)), 0)
  return parseFloat((totalPt / totalCr).toFixed(2))
}

/** Save scraped results to semester_results collection and update user profile */
async function saveResultsToDB(req: AuthRequest, results: { enrollment_number: string; student_info: Record<string, string>; semesters: SemesterData[] }) {
  const userId = req.userId!
  const own = ownership(req)

  for (const sem of results.semesters) {
    const semNum = sem.semester_num || parseInt(sem.semester.replace(/\D/g, '') || '0', 10)
    if (!semNum) continue

    const sgpa = sem.sgpa ? parseFloat(sem.sgpa) : calcSGPA(sem.subjects)
    const totalCredits = sem.subjects.reduce((a, s) => a + (parseFloat(s.credits ?? '0') || 0), 0)

    await SemesterResult.findOneAndUpdate(
      { user_id: new Types.ObjectId(userId), semester: semNum },
      {
        $set: {
          ...own,
          enrollment_number: results.enrollment_number,
          semester: semNum,
          semester_label: sem.semester_label || `Semester ${semNum}`,
          subjects: sem.subjects,
          sgpa,
          total_credits: totalCredits,
          total_marks: sem.total_marks || undefined,
          max_marks: sem.max_marks || undefined,
          student_info: results.student_info,
          source: 'ipu_scraper',
          updated_at: new Date(),
        },
      },
      { upsert: true },
    )
  }

  // Update user profile with student info
  const profileUpdate: Record<string, unknown> = {}
  if (results.enrollment_number) profileUpdate.enrollment_number = results.enrollment_number
  if (results.student_info?.institution) profileUpdate.college = results.student_info.institution
  if (results.student_info?.programme) profileUpdate.course = results.student_info.programme
  if (results.student_info?.programme) profileUpdate.branch = results.student_info.programme
  if (results.student_info?.batch) profileUpdate.batch = results.student_info.batch
  if (results.student_info?.name) profileUpdate.name = results.student_info.name

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
  const sess = getSession(req.userId!)
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
  const sess = getSession(req.userId!)
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

    const loginResp = await sess.post(loginUrl, new URLSearchParams(payload).toString(), {
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

    // Successful login — scrape results
    console.log('[IPU] Login successful, scraping semesters...')
    const results = await scrapeAllSemesters(sess, enrollment, pageText)

    // Save to DB for persistent access
    if (results.semesters.length) {
      try {
        await saveResultsToDB(req, results)
      } catch (dbErr) {
        console.error('[IPU] Failed to save results to DB:', dbErr)
      }
    } else {
      console.warn('[IPU] Login succeeded but no semester data found. Returning debug info.')
    }

    ok(res, results)
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

    ok(res, {
      enrollment_number: enrollmentNumber,
      student_info: studentInfo,
      semesters,
      cgpa,
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

export default router
