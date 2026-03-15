import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { ok, fail } from '../utils/response.js'
import { ENV } from '../config/env.js'

const router = Router()
router.use(requireAuth)

function getSlotType(slot: Record<string, unknown>): string {
    const explicit = String(slot.type ?? '').trim().toLowerCase()
    if (explicit) return explicit

    const hasSubjectRef = String(slot.subject_id ?? slot.subjectId ?? '').trim().length > 0
    const hasLabel = String(slot.label ?? slot.name ?? '').trim().length > 0
    if (!hasSubjectRef && hasLabel) return 'custom'

    return 'class'
}

function scoreScheduleBySubjects(schedule: unknown, subjectIds: Set<string>): number {
    if (!schedule || typeof schedule !== 'object') return 0
    let score = 0
    for (const slots of Object.values(schedule as Record<string, unknown>)) {
        if (!Array.isArray(slots)) continue
        for (const rawSlot of slots) {
            if (!rawSlot || typeof rawSlot !== 'object') continue
            const slot = rawSlot as Record<string, unknown>
            if (getSlotType(slot) !== 'class') continue
            const subjectRef = String(slot.subject_id ?? slot.subjectId ?? '').trim()
            if (subjectRef && subjectIds.has(subjectRef)) score++
        }
    }
    return score
}

const ChatSchema = z.object({
    message: z.string().min(1).max(2000),
    history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
    })).max(20).optional().default([]),
})

async function buildFullContext(req: AuthRequest): Promise<string> {
    const userId = req.userId!
    const semester = req.user?.current_semester ?? 1
    const recentDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const [user, subjects, recentLogs, timetable, allTimetables, courses, prefs, skills, resultRows] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.subject.findMany({ where: { user_id: userId, semester } }),
        prisma.attendanceLog.findMany({
            where: {
                user_id: userId,
                date: { gte: recentDate },
                OR: [
                    { semester },
                    { semester: null },
                    { subject: { is: { semester } } },
                ],
            },
            orderBy: { date: 'desc' },
            take: 50,
        }),
        prisma.timetable.findFirst({ where: { user_id: userId, semester } }),
        prisma.timetable.findMany({ where: { user_id: userId }, orderBy: { updated_at: 'desc' } }),
        prisma.manualCourse.findMany({ where: { user_id: userId } }),
        prisma.userPreference.findUnique({ where: { user_id: userId } }),
        prisma.skill.findMany({ where: { user_id: userId } }),
        prisma.semesterResult.findMany({ where: { user_id: userId }, orderBy: { semester: 'asc' } }),
    ])

    let resolvedTimetable = timetable
    if (!resolvedTimetable && subjects.length > 0) {
        const subjectIds = new Set(subjects.map((s: any) => s.id))
        let best: (typeof allTimetables)[number] | null = null
        let bestScore = 0
        for (const candidate of allTimetables) {
            const score = scoreScheduleBySubjects(candidate.schedule, subjectIds as Set<string>)
            if (score > bestScore) {
                bestScore = score
                best = candidate
            }
        }
        if (best && bestScore > 0) resolvedTimetable = best
    }

    const lines: string[] = []

    if (user) {
        lines.push('## User Profile')
        lines.push(`Name: ${user.name}`)
        if (user.college) lines.push(`College: ${user.college}`)
        if (user.course) lines.push(`Course: ${user.course}`)
        if (user.branch) lines.push(`Branch: ${user.branch}`)
        if (user.batch) lines.push(`Batch: ${user.batch}`)
        if (user.enrollment_number) lines.push(`Enrollment: ${user.enrollment_number}`)
        lines.push(`Current Semester: ${semester}`)
        lines.push(`Attendance Target: ${user.attendance_threshold ?? 75}%`)
        lines.push(`Warning Threshold: ${user.warning_threshold ?? 76}%`)
        lines.push('')
    }

    if (resultRows.length) {
        const GRADE_POINTS: Record<string, number> = {
            'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C+': 5, 'C': 4, 'P': 4, 'F': 0, 'Ab': 0, 'I': 0,
        };

        const calcSGPA = (subjects: any[]) => {
            const valid = subjects.filter(s => s.credits && Number(s.credits) > 0);
            if (!valid.length) return 0;
            const totalCr = valid.reduce((a: number, s: any) => a + Number(s.credits), 0);
            const totalPt = valid.reduce((a: number, s: any) => a + (Number(s.credits) * (GRADE_POINTS[s.grade] ?? 0)), 0);
            return Number((totalPt / totalCr).toFixed(2));
        };

        const calcCGPA = (semesters: any[]) => {
            const valid = semesters.map(s => ({
                ...s,
                computedSgpa: s.sgpa ? Number(s.sgpa) : calcSGPA(s.subjects || []),
            })).filter(s => s.computedSgpa > 0);
            if (!valid.length) return 0;
            const total = valid.reduce((a: number, s: any) => a + s.computedSgpa, 0);
            return Number((total / valid.length).toFixed(2));
        };

        const cgpa = calcCGPA(resultRows).toFixed(2);
        
        const allSubjects = resultRows.flatMap((row: any) => Array.isArray(row.subjects) ? row.subjects as Array<Record<string, unknown>> : [])
        const completed = allSubjects.filter((subject: any) => !subject.is_pending && subject.grade !== '-' && subject.grade)
        
        const academicStrength = completed.length > 0 
            ? Math.round((completed.reduce((acc: number, s: any) => acc + (GRADE_POINTS[s.grade] ?? 0), 0) / (completed.length * 10)) * 100) 
            : 0;
        
        const latestSemester = resultRows[resultRows.length - 1]
        const latestSubjects = Array.isArray(latestSemester?.subjects) ? latestSemester.subjects as Array<Record<string, unknown>> : []
        const declaredDate = latestSubjects.find((subject) => subject.declared_date)?.declared_date
        const latestSgpa = latestSemester.sgpa ? Number(latestSemester.sgpa) : calcSGPA(latestSubjects || []);

        lines.push('## Result Analytics (Semester Results)')
        lines.push(`CGPA: ${cgpa}`)
        lines.push(`Academic Strength: ${academicStrength}%`)
        lines.push(`Result Semesters Added: ${resultRows.length}`)
        if (declaredDate) lines.push(`Latest Declared Date: ${String(declaredDate)}`)
        if (latestSemester) {
            lines.push(`Latest Semester: ${latestSemester.semester} | SGPA: ${latestSgpa.toFixed(2)}`)
        }
        lines.push('')
    }

    if (subjects.length) {
        lines.push(`## Subjects & Attendance (Semester ${semester})`)
        let totalAttended = 0
        let totalClasses = 0
        let totalAbsences = 0
        let atRiskCount = 0

        const processedSubjects = []

        for (const sub of subjects) {
            const attended = sub.attended ?? 0
            const total = sub.total ?? 0
            const pct = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0
            const target = sub.target ?? 75
            totalAttended += attended
            totalClasses += total
            totalAbsences += (total - attended)
            
            if (total > 0 && pct < target) atRiskCount++
            if (total > 0) processedSubjects.push({ name: sub.name, percentage: pct })

            const status = total === 0 ? 'No Data' : pct >= target ? 'On Track' : pct >= target - 10 ? 'At Risk' : 'Critical'
            const categories = sub.categories?.length ? sub.categories : ['Theory']

            let line = `- ${sub.name}: ${attended}/${total} = ${pct}% [Target: ${target}%] ${status}`
            if (categories.length) line += ` [${categories.join(', ')}]`

            const practicals = (sub.practicals as Record<string, unknown> | null) ?? null
            const assignments = (sub.assignments as Record<string, unknown> | null) ?? null
            if (practicals && Number(practicals.total ?? 0) > 0) {
                line += ` | Practicals: ${Number(practicals.completed ?? 0)}/${Number(practicals.total ?? 0)}${practicals.hardcopy ? ' submitted' : ''}`
            }
            if (assignments && Number(assignments.total ?? 0) > 0) {
                line += ` | Assignments: ${Number(assignments.completed ?? 0)}/${Number(assignments.total ?? 0)}${assignments.hardcopy ? ' submitted' : ''}`
            }

            if (total > 0 && pct < target) {
                const needed = Math.ceil((target * total - 100 * attended) / (100 - target))
                line += ` -> Need ${needed} more classes to reach ${target}%`
            } else if (total > 0 && pct >= target) {
                const canSkip = Math.floor((100 * attended - target * total) / target)
                if (canSkip > 0) line += ` -> Can safely skip ${canSkip} classes`
            }

            lines.push(line)
        }

        const overallPct = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 1000) / 10 : 0
        
        let bestSubject = processedSubjects.length ? processedSubjects.reduce((a, b) => a.percentage > b.percentage ? a : b) : null
        let worstSubject = processedSubjects.length ? processedSubjects.reduce((a, b) => a.percentage < b.percentage ? a : b) : null
        
        // Calculate basic streak & consistency mock
        let streak = 0
        const dateSet = new Set<string>()
        if (recentLogs.length > 0) {
            for (const log of recentLogs) {
                if (['present', 'late', 'approved_medical', 'substituted'].includes(log.status)) {
                    dateSet.add(log.date)
                }
            }
        }
        streak = Math.min([...dateSet].length, 14) // Rough estimate for AI context
        const consistencyScore = Math.max(0, Math.min(100, Math.round((overallPct * 0.65) + (Math.min(streak, 10) * 3.5))))
        const achievementLevel = overallPct >= 90 ? 'legend' : overallPct >= 82 ? 'elite' : overallPct >= 75 ? 'steady' : overallPct >= 65 ? 'recovery' : 'danger'

        lines.push('')
        lines.push('## Analytics KPIs')
        lines.push(`Overall Attendance: ${totalAttended}/${totalClasses} = ${overallPct}%`)
        lines.push(`Total Absences: ${totalAbsences}`)
        lines.push(`At Risk Subjects: ${atRiskCount}`)
        lines.push(`Consistency Score: ${consistencyScore}%`)
        lines.push(`Achievement Level: ${achievementLevel}`)
        if (bestSubject) lines.push(`Best Subject: ${bestSubject.name} (${bestSubject.percentage}%)`)
        if (worstSubject) lines.push(`Worst Subject: ${worstSubject.name} (${worstSubject.percentage}%)`)
        lines.push('')
    }

    if (recentLogs.length) {
        lines.push('## Recent Attendance Activity')
        const byDate: Record<string, string[]> = {}
        for (const log of recentLogs) {
            if (!byDate[log.date]) byDate[log.date] = []
            byDate[log.date].push(`${log.subject_name}: ${log.status}${log.type ? ` (${log.type})` : ''}`)
        }
        for (const [date, entries] of Object.entries(byDate).slice(0, 7)) {
            lines.push(`  ${date}: ${entries.join(' | ')}`)
        }
        lines.push('')
    }

    if (resolvedTimetable?.schedule) {
        const today = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
        const schedule = resolvedTimetable.schedule as Record<string, Array<Record<string, unknown>>>
        const todaySlots = schedule[today]
        if (todaySlots?.length) {
            lines.push(`## Today's Schedule (${today})`)
            for (const slot of todaySlots) {
                const subName = subjects.find((s: any) => s.id === String(slot.subject_id))?.name || String(slot.label || 'Unknown')
                lines.push(`  ${String(slot.start_time || '')} - ${String(slot.end_time || '')}: ${subName} (${String(slot.type || 'Class')})${slot.classroom ? ` @ ${String(slot.classroom)}` : ''}`)
            }
            lines.push('')
        }
    }

    const today = new Date().toISOString().slice(0, 10)
    if (courses.length) {
        lines.push('## Online Courses & Certifications')
        for (const course of courses) {
            lines.push(`  - ${course.name || 'Untitled'} (${course.platform || 'Unknown'}) - ${course.progress ?? 0}% complete`)
        }
        lines.push('')
    }

    if (skills.length) {
        lines.push('## Skill Inventory')
        lines.push(`  ${skills.map((s: any) => `${s.name} (${s.level || 'Beginner'})`).join(', ')}`)
        lines.push('')
    }

    if (prefs?.preferences) {
        const p = prefs.preferences as Record<string, unknown>
        if (p.theme || p.notifications_enabled !== undefined) {
            lines.push('## App Configuration')
            if (p.theme) lines.push(`  Active Theme: ${String(p.theme)}`)
            if (p.notifications_enabled !== undefined) lines.push(`  Notifications: ${p.notifications_enabled ? 'Active' : 'Muted'}`)
            lines.push('')
        }
    }

    return lines.join('\n') || 'No data available for this user yet.'
}

router.post('/chat', async (req: AuthRequest, res) => {
    try {
        const body = ChatSchema.parse(req.body)

        if (!ENV.GROQ_API_KEY) {
            fail(res, 'AI assistant is not configured. Please set GROQ_API_KEY in your environment.', 'AI_NOT_CONFIGURED', 503)
            return
        }

        let context = 'Context temporarily unavailable.'
        try {
            context = await buildFullContext(req)
        } catch (contextErr) {
            console.error('[ai/chat] context build failed:', contextErr)
        }

        const systemPrompt = `You are AcadHub Assistant, a high-performance AI academic strategist built into the AcadHub platform.

You have direct, real-time access to the student's unified academic database. Your mission is to provide precise reporting and strategic advice.

## Unified Intelligence Context
Here is the exact current snapshot from the student's database:

${context}

## Operational Directives
1. TRUTH ANCHOR: Never estimate, calculate, or hallucinate academic metrics. Quote the exact numbers from the Subjects and Attendance and Overall Attendance sections.
2. PRECISION REPORTING: If the data shows Math: 10/12 = 83.3%, then the attendance is exactly 83.3%.
3. STRATEGIC CALCULATIONS: Use the pre-computed -> Need X more or -> Can safely skip Y values only. Do not perform these calculations yourself.
4. HOLISTIC AWARENESS: Discuss online courses and skills as core components of their profile.
5. TIMETABLE PRECISION: When asked about the schedule, use the Today's Schedule data provided for the specific day.
6. AT-RISK IDENTIFICATION: Proactively mention subjects marked with At Risk or Critical if attendance is discussed.

## Design And Tone
- Tone: Professional, encouraging, and highly competent.
- Formatting: Use clean bullet points and bold text for key metrics.
- Concision: Keep responses under 4 sentences unless deep analysis is requested.
- Data deficit: If a specific data point is missing from the context above, state: I don't have that specific data in your academic profile yet.

## Mission Capabilities
- Report exact attendance and totals per subject.
- Summarize overall semester performance.
- Explain result analytics, CGPA, SGPA, declared dates, and academic strength using the provided Result Analytics data.
- Advise on skip and attend requirements based on target thresholds.
- Detail upcoming schedule and assignment status.
- Analyze skill inventory and course progress.`

        const messages = [
            { role: 'system' as const, content: systemPrompt },
            ...body.history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
            { role: 'user' as const, content: body.message },
        ]

        let response: Response
        try {
            response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${ENV.GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages,
                    max_tokens: 600,
                    temperature: 0.4,
                    top_p: 0.85,
                }),
            })
        } catch (providerErr) {
            console.error('[ai/chat] provider network error:', providerErr)
            fail(res, 'AI provider is unreachable right now. Please try again.', 'AI_PROVIDER_UNREACHABLE', 502)
            return
        }

        if (!response.ok) {
            const error = await response.text()
            console.error('[ai/chat] Groq API error:', response.status, error)
            fail(res, 'AI service temporarily unavailable. Please try again.', 'AI_ERROR', 502)
            return
        }

        const data = await response.json() as {
            choices: Array<{ message: { content: string } }>
            usage?: { total_tokens: number }
        }

        const aiResponse = data.choices?.[0]?.message?.content ?? 'Sorry, I could not process that. Could you try again?'

        ok(res, { response: aiResponse, tokens: data.usage?.total_tokens })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, 'Invalid message', 'VALIDATION_ERROR', 400); return }
        console.error('[ai/chat]', err)
        fail(res, 'Failed to process message', 'SERVER_ERROR', 500)
    }
})

export default router
