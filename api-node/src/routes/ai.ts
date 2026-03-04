import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { User } from '../models/User.js'
import { Subject } from '../models/Subject.js'
import { AttendanceLog } from '../models/AttendanceLog.js'
import { Timetable } from '../models/Timetable.js'
import { Holiday } from '../models/Holiday.js'
import { ManualCourse } from '../models/ManualCourse.js'
import { UserPreference } from '../models/UserPreference.js'
import { Skill } from '../models/Skill.js'
import { ok, fail } from '../utils/response.js'
import { uf } from '../utils/userFilter.js'
import { ENV } from '../config/env.js'

const router = Router()
router.use(requireAuth)

const ChatSchema = z.object({
    message: z.string().min(1).max(2000),
    history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
    })).max(20).optional().default([]),
})

// ── Build comprehensive context from ALL user data ──────────────────────────

async function buildFullContext(req: AuthRequest): Promise<string> {
    const userId = req.userId!
    const semester = req.user?.current_semester ?? 1
    const filter = { ...uf(req) }

    // Parallel fetch all user data
    const [user, subjects, recentLogs, timetable, holidays, courses, prefs, skills] = await Promise.all([
        User.findById(userId).lean(),
        Subject.find({ ...filter, semester }).lean(),
        AttendanceLog.find({ ...filter, semester, date: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) } }).sort({ date: -1 }).limit(50).lean(),
        Timetable.findOne({ ...filter, semester }).lean(),
        Holiday.find(filter).sort({ date: 1 }).lean(),
        ManualCourse.find({ user_id: userId }).lean(),
        UserPreference.findOne({ user_id: userId }).lean(),
        Skill.find({ user_id: userId }).lean(),
    ])

    const lines: string[] = []

    // ── User Profile ─────────────────────────
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

    // ── Subjects & Attendance Overview ─────────────────────────
    if (subjects.length) {
        lines.push(`## Subjects & Attendance (Semester ${semester})`)
        let totalAttended = 0, totalClasses = 0

        for (const sub of subjects) {
            const attended = sub.attended ?? 0
            const total = sub.total ?? 0
            const pct = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0
            const target = sub.target ?? 75
            totalAttended += attended
            totalClasses += total

            const status = total === 0 ? '🔹 No Data' : pct >= target ? '✅ On Track' : pct >= target - 10 ? '⚠️ At Risk' : '🔴 Critical'
            const categories = sub.categories || ((sub as any).category ? [(sub as any).category] : ['Theory'])

            let line = `- ${sub.name}: ${attended}/${total} = ${pct}% [Target: ${target}%] ${status}`
            if (categories.length) line += ` [${categories.join(', ')}]`

            // Practicals & assignments
            const p = sub.practicals as any
            const a = sub.assignments as any
            if (p && p.total > 0) line += ` | Practicals: ${p.completed ?? 0}/${p.total}${p.hardcopy ? ' ✓submitted' : ''}`
            if (a && a.total > 0) line += ` | Assignments: ${a.completed ?? 0}/${a.total}${a.hardcopy ? ' ✓submitted' : ''}`

            // Classes-to-target calculation
            if (total > 0 && pct < target) {
                const needed = Math.ceil((target * total - 100 * attended) / (100 - target))
                line += ` → Need ${needed} more classes to reach ${target}%`
            } else if (total > 0 && pct >= target) {
                const canSkip = Math.floor((100 * attended - target * total) / target)
                if (canSkip > 0) line += ` → Can safely skip ${canSkip} classes`
            }

            lines.push(line)
        }

        const overallPct = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 1000) / 10 : 0
        lines.push(`\nOverall Attendance (Sem ${semester}): ${totalAttended}/${totalClasses} = ${overallPct}%`)
        lines.push('')
    }

    // ── Recent Attendance (14 days) ─────────────────────────
    if (recentLogs.length) {
        lines.push('## Recent Attendance Activity')
        const byDate: Record<string, string[]> = {}
        for (const log of recentLogs) {
            const d = log.date
            if (!byDate[d]) byDate[d] = []
            byDate[d].push(`${log.subject_name}: ${log.status}${log.type ? ` (${log.type})` : ''}`)
        }
        for (const [date, entries] of Object.entries(byDate).slice(0, 7)) {
            lines.push(`  ${date}: ${entries.join(' | ')}`)
        }
        lines.push('')
    }

    // ── Today's Timetable ─────────────────────────
    if (timetable?.schedule) {
        const today = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
        const schedule = timetable.schedule as Record<string, any[]>
        const todaySlots = schedule[today]
        if (todaySlots?.length) {
            lines.push(`## Today's Schedule (${today})`)
            for (const slot of todaySlots) {
                const subName = subjects.find(s => String(s._id) === String(slot.subject_id))?.name || slot.label || 'Unknown'
                lines.push(`  ${slot.start_time} - ${slot.end_time}: ${subName} (${slot.type || 'Class'})${slot.classroom ? ` @ ${slot.classroom}` : ''}`)
            }
            lines.push('')
        }
    }

    // ── Holidays ─────────────────────────
    const upcomingHolidays = holidays.filter(h => h.date >= new Date().toISOString().slice(0, 10))
    if (upcomingHolidays.length) {
        lines.push('## Upcoming Holidays')
        for (const h of upcomingHolidays.slice(0, 5)) {
            lines.push(`  ${h.date}: ${h.name}`)
        }
        lines.push('')
    }

    // ── Courses & Certifications ─────────────────────────
    if (courses.length) {
        lines.push('## Online Courses & Certifications')
        for (const c of courses) {
            const courseData = c as any
            lines.push(`  - ${courseData.title || courseData.name || 'Untitled'} (${courseData.platform || 'Unknown'}) — ${courseData.progress ?? 0}% complete`)
        }
        lines.push('')
    }

    // ── Skills ─────────────────────────
    if (skills.length) {
        lines.push('## Skill Inventory')
        lines.push(`  ${skills.map((s: any) => `${s.name} (${s.level || 'Beginner'})`).join(', ')}`)
        lines.push('')
    }

    // ── Preferences ─────────────────────────
    if (prefs?.preferences) {
        const p = prefs.preferences as any
        if (p.theme || p.notifications_enabled !== undefined) {
            lines.push('## App Configuration')
            if (p.theme) lines.push(`  Active Theme: ${p.theme}`)
            if (p.notifications_enabled !== undefined) lines.push(`  Notifications: ${p.notifications_enabled ? 'Active' : 'Muted'}`)
            lines.push('')
        }
    }

    return lines.join('\n') || 'No data available for this user yet.'
}

// ── POST /chat ──────────────────────────────────────────────────────────────

router.post('/chat', async (req: AuthRequest, res) => {
    try {
        const body = ChatSchema.parse(req.body)

        if (!ENV.GROQ_API_KEY) {
            fail(res, 'AI assistant is not configured. Please set GROQ_API_KEY in your environment.', 'AI_NOT_CONFIGURED', 503)
            return
        }

        const context = await buildFullContext(req)

        const systemPrompt = `You are AcadHub Assistant — a sophisticated, high-performance AI academic strategist built into the AcadHub platform.

You have DIRECT, REAL-TIME ACCESS to the student's unified academic database. Your mission is to provide surgical precision in reporting and strategic advice.

## Unified Intelligence Context
Here is the EXACT current snapshot from the student's database:

${context}

## OPERATIONAL DIRECTIVES
1. **TRUTH ANCHOR**: NEVER estimate, calculate, or hallucinate academic metrics. Quote the EXACT numbers from the "Subjects & Attendance" and "Overall Attendance" sections.
2. **PRECISION REPORTING**: If the data shows "Math: 10/12 = 83.3%", then the attendance is EXACTLY 83.3%.
3. **STRATEGIC CALCULATIONS**: Use the pre-computed "→ Need X more" or "→ Can safely skip Y" values ONLY. DO NOT perform these calculations yourself.
4. **HOLISTIC AWARENESS**: Discuss online courses, certifications, and skills as core components of their profile. Acknowledge their progress and skill levels.
5. **TIMETABLE PRECISION**: When asked about the schedule, use the "Today's Schedule" data provided for the specific day.
6. **AT-RISK IDENTIFICATION**: Proactively mention subjects marked with ⚠️ (At Risk) or 🔴 (Critical) if attendance is discussed.

## DESIGN & TONE
- **TONE**: Professional, encouraging, and highly competent. Like a top-tier academic mentor.
- **FORMATTING**: Use clean bullet points and bold text for key metrics.
- **CONCISION**: Keep responses under 4 sentences unless deep analysis is requested.
- **DATA DEFICIT**: If a specific data point is missing from the context above, state: "I don't have that specific data in your academic profile yet."

## MISSION CAPABILITIES
- Report exact attendance/total per subject.
- Summarize overall semester performance.
- Advise on skip/attend requirements based on target thresholds.
- Detail upcoming schedule, holidays, and assignment status.
- Analyze skill inventory and course progress.`

        const messages = [
            { role: 'system' as const, content: systemPrompt },
            ...body.history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
            { role: 'user' as const, content: body.message },
        ]

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ENV.GROQ_API_KEY}`,
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

        const aiResponse = data.choices?.[0]?.message?.content ?? 'Sorry, I couldn\'t process that. Could you try again?'

        ok(res, { response: aiResponse, tokens: data.usage?.total_tokens })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, 'Invalid message', 'VALIDATION_ERROR', 400); return }
        console.error('[ai/chat]', err)
        fail(res, 'Failed to process message', 'SERVER_ERROR', 500)
    }
})

export default router
