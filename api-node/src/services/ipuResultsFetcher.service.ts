import axios, { type AxiosInstance } from 'axios'

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
  minorprint: string
  majorprint: string
  moderatedprint: string
  statuscode: string
  rmonth: number
  ryear: number
  declareddate: string
  eugpa: number
}

interface IpuStructuredResultsResponse {
  report?: string
  stprofile?: {
    nrollno?: string
    stname?: string
    byoa?: number
    yoa?: number
    father?: string
    mother?: string
    gender?: string
    email?: string
    mobno?: string
    prgcode?: string
    prgname?: string
    icode?: string
    iname?: string
  }
  header?: string[]
  stresult?: Array<[number, string, string, string, string, string, string, string, string]>
}

export interface ProcessedSubject {
  name: string
  code: string
  internal: string
  external: string
  exam_session?: string
  declared_date?: string
  total_marks: number | null
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

const IPU_GRADE_SCALE: Record<string, number> = {
  O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, 'C+': 5, C: 4, P: 4, F: 0,
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

const IPU_RESULTS_URL = 'https://examweb.ggsipu.ac.in/web/StudentSearchProcess'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.6',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://examweb.ggsipu.ac.in/web/student/studenthome.jsp',
  'X-Requested-With': 'XMLHttpRequest',
  'Sec-GPC': '1',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
}

async function requestSemesterResults(client: AxiosInstance, semester: number) {
  return client.get<IpuRawSubject[] | IpuStructuredResultsResponse>(IPU_RESULTS_URL, {
    params: { flag: 2, euno: semester },
    headers: BROWSER_HEADERS,
    timeout: 15_000,
    validateStatus: (s) => s < 500,
  })
}

function mapRowToSubject(
  paperCode: string,
  paperName: string,
  internalRaw: string,
  externalRaw: string,
  totalRaw: string,
  statusCode: string,
  examSessionRaw?: string,
  declaredDateRaw?: string,
): ProcessedSubject {
  const internal = String(internalRaw || '-').trim() || '-'
  const external = String(externalRaw || '-').trim() || '-'
  const totalStr = String(totalRaw || '').trim()
  const examSession = String(examSessionRaw || '').trim()
  const declaredDate = String(declaredDateRaw || '').trim()
  const isPending = totalStr === '-' || totalStr === '' || Number.isNaN(parseInt(totalStr, 10))
  const total = isPending ? null : (parseInt(totalStr, 10) || 0)
  const maxMarks = 100
  const percentage = total !== null ? parseFloat(((total / maxMarks) * 100).toFixed(2)) : null
  const grade = isPending ? '-' : percentageToGrade((total! / maxMarks) * 100)

  return {
    name: String(paperName || 'Unknown Subject').trim(),
    code: String(paperCode || '').trim(),
    internal,
    external,
    ...(examSession ? { exam_session: examSession } : {}),
    ...(declaredDate ? { declared_date: declaredDate } : {}),
    total_marks: total,
    max_marks: maxMarks,
    percentage,
    grade,
    grade_point: isPending ? null : (IPU_GRADE_SCALE[grade] ?? 0),
    status: String(statusCode || '').trim() || (isPending ? 'Pending' : '-'),
    is_pending: isPending,
  }
}

function mapStructuredResults(data: IpuStructuredResultsResponse, semester: number): FetchedSemesterResult {
  const profile = data.stprofile || {}
  const rows = Array.isArray(data.stresult) ? data.stresult : []

  return {
    enrollment_number: String(profile.nrollno || '').trim(),
    semester,
    subjects: rows.map((row) => mapRowToSubject(row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8])),
    sgpa: 0,
    total_credits: 0,
    student_info: {
      name: String(profile.stname || '').trim(),
      father: String(profile.father || '').trim(),
      institution: String(profile.iname || '').trim(),
      programme: String(profile.prgname || '').trim(),
      batch: profile.byoa ? String(profile.byoa) : '',
      roll_no: String(profile.nrollno || '').trim(),
      ...(profile.yoa ? { admission_year: String(profile.yoa) } : {}),
    },
  }
}

function mapLegacyResults(data: IpuRawSubject[]): FetchedSemesterResult {
  const first = data[0]
  return {
    enrollment_number: first.nrollno?.trim() || '',
    semester: first.euno,
    subjects: data.map((raw) =>
      mapRowToSubject(
        raw.papercode,
        raw.papername,
        raw.minorprint,
        raw.majorprint,
        raw.moderatedprint,
        raw.statuscode,
        `${raw.rmonth},${raw.ryear}`,
        raw.declareddate,
      ),
    ),
    sgpa: first.eugpa ?? 0,
    total_credits: 0,
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

export function parseIpuResultsPayload(
  payload: IpuRawSubject[] | IpuStructuredResultsResponse,
  semester: number,
  status: number,
  contentType: string,
): FetchedSemesterResult {
  const hasStructuredRows = !!payload && typeof payload === 'object' && Array.isArray((payload as IpuStructuredResultsResponse).stresult)

  if ((!Array.isArray(payload) || payload.length === 0) && !hasStructuredRows) {
    throw Object.assign(new Error('No results found for this semester'), {
      code: 'NO_RESULTS',
      meta: { semester, status, contentType },
    })
  }

  return hasStructuredRows
    ? mapStructuredResults(payload as IpuStructuredResultsResponse, semester)
    : mapLegacyResults(payload as IpuRawSubject[])
}

function ensureAuthorized(status: number, data: unknown, semester: number, contentType: string) {
  if (status === 401 || status === 403) {
    throw Object.assign(new Error('Session expired or unauthorized'), { code: 'SESSION_EXPIRED' })
  }

  if (status === 302 || status === 301) {
    throw Object.assign(new Error('Session expired - redirected to login'), { code: 'SESSION_EXPIRED' })
  }

  if (contentType.includes('text/html')) {
    const html = String(data || '').toLowerCase()
    const looksLikeLogin = html.includes('login.jsp') || html.includes('name="username"') || html.includes('name="passwd"')
    throw Object.assign(
      new Error(looksLikeLogin ? 'Session expired - results API returned login page' : 'Results API returned unexpected HTML'),
      { code: looksLikeLogin ? 'SESSION_EXPIRED' : 'BAD_RESULTS_RESPONSE', meta: { semester, status, contentType } },
    )
  }
}

export async function fetchIpuResults(sessionCookie: string, semester: number): Promise<FetchedSemesterResult> {
  const client = axios.create({
    headers: {
      ...BROWSER_HEADERS,
      Cookie: sessionCookie,
    },
  })

  const response = await requestSemesterResults(client, semester)
  const contentType = String(response.headers['content-type'] || '').toLowerCase()
  ensureAuthorized(response.status, response.data, semester, contentType)
  return parseIpuResultsPayload(response.data, semester, response.status, contentType)
}

export async function fetchIpuResultsWithClient(client: AxiosInstance, semester: number): Promise<FetchedSemesterResult> {
  const response = await requestSemesterResults(client, semester)
  const contentType = String(response.headers['content-type'] || '').toLowerCase()
  ensureAuthorized(response.status, response.data, semester, contentType)
  return parseIpuResultsPayload(response.data, semester, response.status, contentType)
}

export async function fetchAllIpuResults(sessionCookie: string, maxSemesters = 8): Promise<FetchedSemesterResult[]> {
  const results: FetchedSemesterResult[] = []
  for (let sem = 1; sem <= maxSemesters; sem++) {
    try {
      results.push(await fetchIpuResults(sessionCookie, sem))
    } catch (err: any) {
      if (err.code === 'SESSION_EXPIRED' || err.code === 'BAD_RESULTS_RESPONSE') throw err
      console.log('[IPU Direct] Semester fetch failed:', err?.meta || err?.message || err)
    }
  }

  return results
}

export async function fetchAllIpuResultsWithClient(client: AxiosInstance, maxSemesters = 8): Promise<FetchedSemesterResult[]> {
  const results: FetchedSemesterResult[] = []
  for (let sem = 1; sem <= maxSemesters; sem++) {
    try {
      results.push(await fetchIpuResultsWithClient(client, sem))
    } catch (err: any) {
      if (err.code === 'SESSION_EXPIRED' || err.code === 'BAD_RESULTS_RESPONSE') throw err
      console.log('[IPU Direct] Semester fetch failed:', err?.meta || err?.message || err)
    }
  }

  return results
}
