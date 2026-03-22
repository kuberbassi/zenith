import { prisma } from '../config/prisma.js'
import { GradeCalculator } from '../lib/calculations.js'
import { mergePreferredRecord } from './recordMerge.js'

function normalizeLookup(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

type ResultRow = {
  enrollment_number: string | null
  semester: number
  semester_label: string | null
  subjects: unknown
  sgpa: number
  total_marks: string | null
  max_marks: string | null
  total_credits: number
  student_info: unknown
  updated_at: Date
}

function enrichSemesterSubjects(
  semester: number,
  subjects: unknown,
  subjectIndexBySemester: Map<number, Map<string, { credits: number | null }>>,
): Array<Record<string, unknown>> {
  if (!Array.isArray(subjects)) return []
  const semesterIndex = subjectIndexBySemester.get(semester) || new Map<string, { credits: number | null }>()

  return subjects.map((raw) => {
    const subject = ((raw && typeof raw === 'object') ? raw : {}) as Record<string, unknown>
    const codeKey = normalizeLookup(subject.code)
    const nameKey = normalizeLookup(subject.name)
    const matched = (codeKey && semesterIndex.get(`code:${codeKey}`))
      || (nameKey && semesterIndex.get(`name:${nameKey}`))

    if (!matched || matched.credits == null || subject.credits != null) return subject
    return { ...subject, credits: matched.credits }
  })
}

export async function buildResultsPayload(
  userId: string,
  options?: { source?: 'ipu_scraper' | 'manual' },
) {
  const where = options?.source ? { user_id: userId, source: options.source } : { user_id: userId }
  const [results, userDoc, subjects] = await Promise.all([
    prisma.semesterResult.findMany({
      where,
      orderBy: { semester: 'asc' },
    }),
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.subject.findMany({
      where: { user_id: userId },
      select: { semester: true, code: true, name: true, credits: true },
    }),
  ])

  if (!results.length) {
    return { cgpa: 0, semesters: [], gradeDistribution: {}, overallPercentage: 0, academicStrength: 0 }
  }

  const subjectIndexBySemester = new Map<number, Map<string, { credits: number | null }>>()
  for (const subject of subjects) {
    const semesterIndex = subjectIndexBySemester.get(subject.semester) || new Map<string, { credits: number | null }>()
    const codeKey = normalizeLookup(subject.code)
    const nameKey = normalizeLookup(subject.name)
    if (codeKey) semesterIndex.set(`code:${codeKey}`, { credits: subject.credits })
    if (nameKey) semesterIndex.set(`name:${nameKey}`, { credits: subject.credits })
    subjectIndexBySemester.set(subject.semester, semesterIndex)
  }

  const rawStudentInfo = results.reduce((acc, row) => {
    const current = ((row.student_info ?? {}) as Record<string, unknown>)
    return mergePreferredRecord(current, acc)
  }, {} as Record<string, unknown>)

  const enrichedStudentInfo = {
    ...(userDoc?.name ? { name: userDoc.name } : {}),
    ...(userDoc?.enrollment_number ? { roll_no: userDoc.enrollment_number } : {}),
    ...(userDoc?.mother_name ? { mother: userDoc.mother_name } : {}),
    ...(userDoc?.father_name ? { father: userDoc.father_name } : {}),
    ...(userDoc?.phone_number ? { phone: userDoc.phone_number } : {}),
    ...(userDoc?.email ? { email: userDoc.email } : {}),
    ...(userDoc?.gender ? { gender: userDoc.gender } : {}),
    ...(userDoc?.batch ? { batch: userDoc.batch } : {}),
    ...(userDoc?.course ? { programme: userDoc.course } : {}),
    ...(userDoc?.college ? { institution: userDoc.college } : {}),
    ...(userDoc?.admission_year ? { admission_year: userDoc.admission_year } : {}),
    ...rawStudentInfo,
  }

  const normalizedResults = (results as ResultRow[]).map((row) => {
    const enrichedSubjects = enrichSemesterSubjects(row.semester, row.subjects, subjectIndexBySemester)
    const sgpaCalc = GradeCalculator.calculateSGPA(enrichedSubjects.map((subject) => ({
      credits: Number(subject.credits ?? 0),
      grade_point: Number(subject.grade_point ?? 0),
    })))
    return {
      ...row,
      enrichedSubjects,
      normalizedSgpa: row.sgpa > 0 ? row.sgpa : sgpaCalc.sgpa,
      normalizedCredits: row.total_credits > 0 ? row.total_credits : sgpaCalc.total_credits,
    }
  })

  const cgpaCalc = GradeCalculator.calculateCGPA(
    normalizedResults.map((row) => row.enrichedSubjects.map((subject) => ({
      credits: Number(subject.credits ?? 0),
      grade_point: Number(subject.grade_point ?? 0),
    }))),
  )

  const gradeDistribution: Record<string, number> = {}
  let totalMarks = 0
  let totalMaxMarks = 0
  for (const row of normalizedResults) {
    for (const subject of row.enrichedSubjects) {
      if (subject.is_pending || subject.grade === '-' || subject.total_marks === null) continue
      totalMarks += Number(subject.total_marks ?? 0)
      totalMaxMarks += Number(subject.max_marks ?? 100)
      const grade = String(subject.grade || 'F').toUpperCase()
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1
    }
  }

  const overallPercentage = totalMaxMarks > 0
    ? Number(((totalMarks / totalMaxMarks) * 100).toFixed(1))
    : 0

  return {
    enrollment_number: normalizedResults.find((row) => row.enrollment_number)?.enrollment_number || userDoc?.enrollment_number || '',
    student_info: enrichedStudentInfo,
    last_updated: normalizedResults.reduce((latest, row) => row.updated_at > latest ? row.updated_at : latest, new Date(0)).toISOString(),
    cgpa: cgpaCalc.cgpa,
    semesters: normalizedResults.map((row) => ({
      semester: String(row.semester),
      semester_num: row.semester,
      semester_label: row.semester_label || `Semester ${row.semester}`,
      subjects: row.enrichedSubjects,
      sgpa: row.normalizedSgpa ? String(row.normalizedSgpa) : null,
      total_marks: row.total_marks || null,
      max_marks: row.max_marks || null,
      total_credits: row.normalizedCredits,
    })),
    gradeDistribution,
    overallPercentage,
    academicStrength: totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 100) : 0,
  }
}
