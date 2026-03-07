import axios from 'axios'

/* ── Types ────────────────────────────────────────────────────────────── */

export interface IpuRawSubject {
  nrollno: string
  stname: string
  byoa: number
  yoa: number
  father: string
  prgcode: string
  prgname: string
  icode: string
  iname: string
  euno: number
  papercode: string
  papername: string
  minorprint: string   // internal marks or "-"
  majorprint: string   // external marks
  moderatedprint: string // total marks
  statuscode: string
  rmonth: number
  ryear: number
  declareddate: string
  eugpa: number        // semester GPA
}

export interface ProcessedSubject {
  name: string
  code: string
  internal: string
  external: string
  total_marks: number | null  // null when result is pending/withheld
  max_marks: number
  percentage: number | null
  grade: string
  grade_point: number | null
  status: string
  is_pending: boolean
}

export interface FetchedSemesterResult {
  enrollment_number: string
  semester: number
  subjects: ProcessedSubject[]
  sgpa: number
  total_credits: number
  student_info: {
    name: string
    father: string
    institution: string
    programme: string
    batch: string
    roll_no: string
    admission_year?: string
  }
}

/* ── Grade Scale (official IPU) ──────────────────────────────────────── */

const IPU_GRADE_SCALE: Record<string, number> = {
  'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C+': 5, 'C': 4, 'P': 4, 'F': 0,
}

function percentageToGrade(pct: number): string {
  if (pct >= 90) return 'O'
  if (pct >= 75) return 'A+'
  if (pct >= 65) return 'A'
  if (pct >= 55) return 'B+'
  if (pct >= 50) return 'B'
  if (pct >= 45) return 'C+'
  if (pct >= 40) return 'C'
  return 'F'
}

/* ── Constants ────────────────────────────────────────────────────────── */

const IPU_RESULTS_URL = 'https://examweb.ggsipu.ac.in/web/StudentSearchProcess'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://examweb.ggsipu.ac.in/web/student/studenthome.jsp',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
}

/* ── Main Service Function ────────────────────────────────────────────── */

/**
 * Fetch results for a specific semester from the IPU portal using a valid session cookie.
 * The IPU endpoint returns JSON directly — no HTML parsing needed.
 */
export async function fetchIpuResults(
  sessionCookie: string,
  semester: number,
): Promise<FetchedSemesterResult> {
  const response = await axios.get<IpuRawSubject[]>(IPU_RESULTS_URL, {
    params: { flag: 2, euno: semester },
    headers: {
      ...BROWSER_HEADERS,
      Cookie: sessionCookie,
    },
    timeout: 15_000,
    validateStatus: (s) => s < 500,
  })

  if (response.status === 401 || response.status === 403) {
    throw Object.assign(new Error('Session expired or unauthorized'), { code: 'SESSION_EXPIRED' })
  }

  if (response.status === 302 || response.status === 301) {
    throw Object.assign(new Error('Session expired — redirected to login'), { code: 'SESSION_EXPIRED' })
  }

  const data = response.data
  if (!Array.isArray(data) || data.length === 0) {
    throw Object.assign(new Error('No results found for this semester'), { code: 'NO_RESULTS' })
  }

  // All entries share the same student info and euno; extract from first record
  const first = data[0]

  const subjects: ProcessedSubject[] = data.map((raw) => {
    const internal = raw.minorprint?.trim() || '-'
    const external = raw.majorprint?.trim() || '-'
    const totalStr = raw.moderatedprint?.trim() || ''

    // Detect pending/withheld results — moderatedprint will be "-" or non-numeric
    const isPending = totalStr === '-' || totalStr === '' || isNaN(parseInt(totalStr))
    const total = isPending ? null : (parseInt(totalStr) || 0)
    const maxMarks = 100
    const pct = total !== null ? parseFloat(((total / maxMarks) * 100).toFixed(2)) : null
    const grade = isPending ? '-' : percentageToGrade(total! / maxMarks * 100)
    const statusRaw = raw.statuscode?.trim() || ''

    return {
      name: raw.papername?.trim() || 'Unknown Subject',
      code: raw.papercode?.trim() || '',
      internal,
      external,
      total_marks: total,
      max_marks: maxMarks,
      percentage: pct,
      grade,
      grade_point: isPending ? null : (IPU_GRADE_SCALE[grade] ?? 0),
      status: statusRaw || (isPending ? 'Pending' : '-'),
      is_pending: isPending,
    }
  })

  return {
    enrollment_number: first.nrollno?.trim() || '',
    semester: first.euno,
    subjects,
    sgpa: first.eugpa ?? 0,
    total_credits: 0, // The raw API doesn't include per-subject credits
    student_info: {
      name: first.stname?.trim() || '',
      father: first.father?.trim() || '',
      institution: first.iname?.trim() || '',
      programme: first.prgname?.trim() || '',
      batch: first.byoa ? String(first.byoa) : '',
      roll_no: first.nrollno?.trim() || '',
      ...(first.yoa ? { admission_year: String(first.yoa) } : {}),
    },
  }
}

/**
 * Fetch results for ALL semesters (1..8) and return whichever have data.
 */
export async function fetchAllIpuResults(
  sessionCookie: string,
  maxSemesters = 8,
): Promise<FetchedSemesterResult[]> {
  const results: FetchedSemesterResult[] = []

  for (let sem = 1; sem <= maxSemesters; sem++) {
    try {
      const result = await fetchIpuResults(sessionCookie, sem)
      results.push(result)
    } catch (err: any) {
      if (err.code === 'SESSION_EXPIRED') throw err
      // NO_RESULTS or other errors → skip this semester
      console.log(`[IPU Direct] No results for semester ${sem}`)
    }
  }

  return results
}
