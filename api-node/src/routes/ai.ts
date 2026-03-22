import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { ENV } from '../config/env.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { ok, fail } from '../utils/response.js'
import { GradeCalculator, AttendanceCalculator } from '../lib/calculations.js'

const router = Router()
router.use(requireAuth)

const ChatSchema = z.object({
    message: z.string().min(1),
    history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string()
    })).optional()
})

/**
 * Builds a comprehensive data profile for the AI context.
 */
async function buildFullContext(req: AuthRequest): Promise<string> {
    const userId = req.userId!
    const today = new Date().toISOString().split('T')[0]
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const todayStr = days[new Date().getDay()]

    const [user, subjects, recentLogs, allTimetables, courses, prefs, skills, resultRows, systemLogs] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.subject.findMany({ where: { user_id: userId } }),
        prisma.attendanceLog.findMany({ where: { user_id: userId }, orderBy: { date: 'desc' }, take: 20 }),
        prisma.timetable.findMany({ where: { user_id: userId } }),
        prisma.manualCourse.findMany({ where: { user_id: userId } }),
        prisma.userPreference.findUnique({ where: { user_id: userId } }),
        prisma.skill.findMany({ where: { user_id: userId } }),
        prisma.semesterResult.findMany({ where: { user_id: userId }, orderBy: { semester: 'asc' } }),
        prisma.systemLog.findMany({ where: { user_id: userId }, orderBy: { timestamp: 'desc' }, take: 10 })
    ])

    let resolvedTimetable = null
    if (allTimetables.length > 0) {
        let best = allTimetables[0]
        let bestScore = 0
        for (const t of allTimetables) {
            const sch = (t.schedule as any) || {}
            const count = Object.values(sch).flat().length
            if (count > bestScore) { best = t; bestScore = count }
        }
        if (bestScore > 0) resolvedTimetable = best
    }

    const lines: string[] = []

    if (user) {
        lines.push('## User Profile')
        lines.push(`Name: ${user.name || 'Student'}`)
        lines.push(`Institution: ${user.college || 'Unknown'}`)
        lines.push(`Threshold Target: ${user.attendance_threshold || 75}%`)
    }

    if (subjects.length) {
        lines.push('## Subjects & Attendance')
        let totalMarks = 0
        let totalMaxMarks = 0

        for (const sub of subjects) {
            const attended = sub.attended ?? 0
            const total = sub.total ?? 0
            const pct = AttendanceCalculator.calculatePercentage(attended, total)
            lines.push(`  - ${sub.name}: ${pct}% (${attended}/${total}) | Target: ${sub.target ?? 75}%`)
        }
        
        const semesterData = resultRows.map(row => {
            const subs = Array.isArray(row.subjects) ? row.subjects as any[] : [];
            return subs.map(sub => {
                if (sub.is_pending || sub.grade === '-' || sub.total_marks === null) return null;
                totalMarks += Number(sub.total_marks ?? 0)
                totalMaxMarks += Number(sub.max_marks ?? 100)
                return {
                    credits: Number(sub.credits ?? 0),
                    grade_point: GradeCalculator.calculateSubjectResult(sub).grade_point
                };
            }).filter((s): s is { credits: number; grade_point: number } => s !== null);
        });

        const academicStrength = totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 100) : 0;
        const { cgpa } = GradeCalculator.calculateCGPA(semesterData);
        const summary = AttendanceCalculator.getAttendanceSummary(subjects, user?.attendance_threshold ?? 75, user?.warning_threshold ?? 76)
        
        lines.push('')
        lines.push('## Result Analytics')
        lines.push(`Academic Strength: ${academicStrength}% (Aggregate Percentage across all declared results)`)
        if (resultRows.length) {
            const latest = resultRows[resultRows.length - 1]
            lines.push(`Latest Result: Semester ${latest.semester} | SGPA: ${latest.sgpa} | CGPA: ${cgpa}`)
        }

        lines.push('')
        lines.push('## Analytics KPIs')
        lines.push(`Overall Attendance: ${summary.total_attended}/${summary.total_classes} = ${summary.overall_percentage}%`)
    }

    if (resolvedTimetable) {
        const schedule = (resolvedTimetable.schedule as any) || {}
        lines.push('## COMPLETE WEEKLY ACADEMIC SCHEDULE')
        for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
            const slots = schedule[day]
            if (slots?.length) {
                lines.push(`  ### ${day}${day === todayStr ? ' (TODAY)' : ''}`)
                for (const slot of slots) {
                    const subId = String(slot.subject_id || '')
                    const subName = subjects.find((s: any) => String(s.id) === subId)?.name || String(slot.label || 'Activity')
                    lines.push(`    - ${slot.start_time}: ${subName} (${slot.type || 'Lecture'})`)
                }
            } else {
                lines.push(`  ### ${day}${day === todayStr ? ' (TODAY)' : ''}`)
                lines.push(`    - No classes scheduled.`)
            }
        }
        lines.push('')

        const todaySlots = schedule[todayStr]
        if (todaySlots?.length) {
            const todayLogs = recentLogs.filter((l: any) => l.date === today)
            const pending = todaySlots.filter((slot: any) => {
                const subId = String(slot.subject_id || '')
                return !todayLogs.some((log: any) => String(log.subject_id) === subId && log.type === String(slot.type || 'Lecture'))
            })

            if (pending.length) {
                lines.push('## Pending Attendance (To be marked today)')
                for (const p of pending) {
                    const subName = subjects.find((s: any) => String(s.id) === String(p.subject_id))?.name || String(p.label || 'Unknown')
                    lines.push(`  - [ ] ${p.start_time}: ${subName} (${p.type || 'Class'})`)
                }
                lines.push('')
            }
        }
    }

    if (courses.length) {
        lines.push('## Active Online Courses')
        for (const course of courses) {
            lines.push(`  - ${course.name || 'Untitled'} | Progress: ${course.progress ?? 0}% | Status: ${course.status || 'Active'}`)
        }
        lines.push('')
    }

    if (skills.length) {
        lines.push('## Skill Inventory')
        for (const skill of skills) {
             lines.push(`  - ${skill.name}: ${skill.progress || 0}% Mastery (${skill.level || 'Beginner'})`)
        }
        lines.push('')
    }

    if (systemLogs.length) {
        lines.push('## Recent Activity Logs')
        for (const log of systemLogs.slice(0, 5)) {
            lines.push(`  - ${log.timestamp.toISOString().slice(0, 16).replace('T', ' ')}: ${log.action}`)
        }
        lines.push('')
    }

    return lines.join('\n')
}

const systemPrompt = `You are AcadHub Assistant, a high-performance AI academic strategist.

You have direct, real-time access to the student's unified database. Your mission is to provide precise reporting, strategic planning, and automated check-ins.

## Operational Directives
1. TRUTHFULNESS: Use ONLY the provided context. If context is missing, report it.
2. FULL WEEK AWARENESS: You have access to the "COMPLETE WEEKLY ACADEMIC SCHEDULE". When asked about ANY day (Monday-Sunday), browse that specific day's subsection and report the slots. DO NOT say you only know today.
3. PRECISION: Quote exact percentages from "Result Analytics" and "Subjects & Attendance".
4. ACADEMIC STRENGTH: This is the aggregate percentage across all declared results. Refer to it exactly (e.g. 78%).
5. PENDING ACTION: Notice the "Pending Attendance" section for today and remind the student if they have unmarked classes.
6. METRIC UNIFICATION: Use CGPA (Weighted) and Academic Strength as the definitive performance metrics.

## Design And Tone
- Tone: Tactical, professional, and supportive. Use a "Strategist" persona.
- Formatting: Clean bullet points. Bold key metrics.
- Day-Specific Queries: Always browse the "COMPLETE WEEKLY ACADEMIC SCHEDULE" for the requested day.`

async function chatHandler(req: AuthRequest, res: any) {
    try {
        const body = ChatSchema.parse(req.body)
        const { message, history = [] } = body

        let context = ''
        try {
            context = await buildFullContext(req)
        } catch (contextErr) {
            console.error('[ai/chat] context build failed:', contextErr)
            context = 'Profile sync temporarily unavailable.'
        }

        const messages = [
            { role: 'system', content: `${systemPrompt}\n\nCURRENT ACADEMIC CONTEXT:\n${context}` },
            ...history,
            { role: 'user', content: message }
        ]

        if (!ENV.GROQ_API_KEY) {
            fail(res, 'AI API key is not configured.', 'CONFIG_ERROR', 500)
            return
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ENV.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages,
                temperature: 0.2,
                max_tokens: 1024,
                top_p: 1,
                stream: false
            })
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('[ai/chat] Groq API error:', response.status, error)
            fail(res, 'AI service temporarily unavailable. Please try again.', 'AI_ERROR', 502)
            return
        }

        const data = await response.json() as any
        const aiResponse = data.choices?.[0]?.message?.content ?? 'Sorry, I could not process that.'

        ok(res, { response: aiResponse })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, 'Invalid message', 'VALIDATION_ERROR', 400); return }
        console.error('[ai/chat]', err)
        fail(res, 'Failed to process message', 'SERVER_ERROR', 500)
    }
}

router.post('/chat', chatHandler)
router.post('/chat_v2', chatHandler)

export default router
