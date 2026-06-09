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

    const [user, subjects, recentLogs, allTimetables, courses, prefs, skills, resultRows, systemLogs, notes] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.subject.findMany({ where: { user_id: userId } }),
        prisma.attendanceLog.findMany({ where: { user_id: userId }, orderBy: { date: 'desc' }, take: 20 }),
        prisma.timetable.findMany({ where: { user_id: userId } }),
        prisma.manualCourse.findMany({ where: { user_id: userId } }),
        prisma.userPreference.findUnique({ where: { user_id: userId } }),
        prisma.skill.findMany({ where: { user_id: userId } }),
        prisma.semesterResult.findMany({ where: { user_id: userId }, orderBy: { semester: 'asc' } }),
        prisma.systemLog.findMany({ where: { user_id: userId }, orderBy: { timestamp: 'desc' }, take: 10 }),
        prisma.note.findMany({ where: { user_id: userId } })
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

    // Google Drive backup preferences and status
    const preferences = (prefs?.preferences ?? {}) as Record<string, any>
    const isDriveActive = !!preferences.google_drive_linked
    const lastBackup = preferences.google_drive_last_backup || 'Never'
    const backupFreq = preferences.google_drive_backup_frequency || 'never'
    lines.push('## Google Drive Cloud Backup Settings')
    lines.push(`Backup Active (Linked): ${isDriveActive ? 'YES' : 'NO'}`)
    lines.push(`Backup Frequency: ${backupFreq}`)
    lines.push(`Last Backup Timestamp: ${lastBackup}`)
    lines.push('')

    if (subjects.length) {
        lines.push('## Subjects, Attendance & Trackers')
        let totalMarks = 0
        let totalMaxMarks = 0

        for (const sub of subjects) {
            const attended = sub.attended ?? 0
            const total = sub.total ?? 0
            const pct = AttendanceCalculator.calculatePercentage(attended, total)
            const categories = sub.categories || []
            const isPractical = categories.includes('Practical')
            const isAssignment = categories.includes('Assignment')
            
            let trackerInfo = ''
            if (isPractical) {
                const p = (sub.practicals as any) || { total: 10, completed: 0, hardcopy: false }
                trackerInfo += ` | Practicals: ${p.completed}/${p.total} (${p.hardcopy ? 'Submitted' : 'Not fully submitted'})`
            }
            if (isAssignment) {
                const a = (sub.assignments as any) || { total: 4, completed: 0, hardcopy: false }
                trackerInfo += ` | Assignments: ${a.completed}/${a.total} (${a.hardcopy ? 'Submitted' : 'Not fully submitted'})`
            }

            lines.push(`  - ${sub.name}: ${pct}% (${attended}/${total}) | Target: ${sub.target ?? 75}%${trackerInfo}`)
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

    if (resultRows.length) {
        lines.push('## Detailed Semester Results')
        for (const row of resultRows) {
            lines.push(`  ### Semester ${row.semester} (SGPA: ${row.sgpa}, Credits: ${row.total_credits}, Marks: ${row.total_marks || 'N/A'}/${row.max_marks || 'N/A'})`)
            const rowSubjects = Array.isArray(row.subjects) ? row.subjects as any[] : []
            for (const sub of rowSubjects) {
                const isPending = sub.is_pending || sub.grade === '-'
                const internal = sub.internal_theory ?? sub.internal_practical ?? 0
                const external = sub.external_theory ?? sub.external_practical ?? 0
                const total = sub.total_marks ?? (Number(internal) + Number(external))
                const max = sub.max_marks ?? 100
                lines.push(`    - ${sub.name || sub.subject_name || 'Subject'} (${sub.code || sub.paper_code || 'N/A'}): ${isPending ? 'Pending/Declared Late' : `Grade: ${sub.grade} | Marks: ${total}/${max} (Int: ${internal}, Ext: ${external}) | Credits: ${sub.credits ?? 3}`}`)
            }
        }
        lines.push('')
    }

    if (notes && notes.length > 0) {
        lines.push('## User Notes & Checklists (Todos)')
        const textNotes = notes.filter(n => !n.is_todo)
        const todoNotes = notes.filter(n => n.is_todo)

        if (textNotes.length > 0) {
            lines.push('  ### Notes')
            for (const note of textNotes) {
                // Strip HTML tags from note content to keep context compact and clean
                const plainContent = note.content
                    ? note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
                    : ''
                lines.push(`    - **${note.title || 'Untitled'}** (Category: ${note.category}): ${plainContent}`)
            }
        }

        if (todoNotes.length > 0) {
            lines.push('  ### Checklists (Todos)')
            for (const todoNote of todoNotes) {
                lines.push(`    - **${todoNote.title || 'Todo List'}** (Category: ${todoNote.category}):`)
                const items = Array.isArray(todoNote.todos) ? todoNote.todos as any[] : []
                if (items.length > 0) {
                    for (const item of items) {
                        const status = item.completed ? '[x]' : '[ ]'
                        lines.push(`      ${status} ${item.text || 'Item'}`)
                    }
                } else {
                    lines.push('      (No tasks in this list)')
                }
            }
        }
        lines.push('')
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

const systemPrompt = `You are Zenith Assistant, a high-performance AI academic strategist.

You have direct, real-time access to the student's unified database. Your mission is to provide precise reporting, strategic planning, and automated check-ins. Make your replies ultra-useful and concrete.

## Operational Directives
1. TRUTHFULNESS: Use ONLY the provided context. If context is missing, report it.
2. FULL WEEK AWARENESS: You have access to the "COMPLETE WEEKLY ACADEMIC SCHEDULE". When asked about ANY day, browse that specific day's schedule and report the slots precisely.
3. BUNK ESTIMATIONS & DEFICIT RISK: For any attendance queries, calculate exactly:
   - Which subjects are currently under the 75% target threshold (list them in a **DEFICIT WARNING** section).
   - Exactly how many classes they need to attend consecutively to restore safety, or how many they are safe to skip (bunk).
4. STUDY STRATEGY & TACTICS: If a student asks about performance or optimization:
   - Identify their weakest results or low-progress skills/online courses.
   - Suggest a concrete 3-step study or attendance strategy to optimize their semester.
5. METRIC UNIFICATION: Use CGPA (Weighted), Overall Attendance, and Academic Strength as the definitive performance metrics. Always quote exact percentages and numbers.
6. TODAY'S PENDING ACTION: Remind the student of any pending attendance logs that need to be marked today.

## Design, Tone and Length
- Persona: High-impact Academic Strategist. Tactical, professional, and extremely direct.
- Formatting: Give ultra-concise, short, crisp answers. Avoid wordy explanations, meta-commentary, or verbose transitions.
- Maximum Length: Keep responses under 150 words. Use 2-3 short, clean bullet points.
- Bolding: Use **bolding** for all metrics and numbers.`

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
                max_tokens: 512,
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

const ProcessNoteSchema = z.object({
    content: z.string(),
    action: z.enum(['reformat', 'improve', 'custom']),
    customPrompt: z.string().optional()
})

async function processNoteHandler(req: AuthRequest, res: any) {
    try {
        const body = ProcessNoteSchema.parse(req.body)
        const { content, action, customPrompt } = body

        if (!ENV.GROQ_API_KEY) {
            fail(res, 'AI API key is not configured.', 'CONFIG_ERROR', 500)
            return
        }

        let systemInstruction = ''
        if (action === 'reformat') {
            systemInstruction = `You are an AI writing assistant specializing in structural organization and clean, professional styling.
Your task is to take the user's note (which is provided in HTML format) and reformat it.
Follow these strict rules:
1. Preserve 100% of all original information, links, details, dates, lists, text, numbers, and core meaning. DO NOT discard, summarize, edit, or omit anything.
2. Structure the content logically. Use clear headings (H1, H2, H3), bullet points, and numbered lists where appropriate to make it highly readable.
3. Clean up spacing, bad indents, or messy paragraphs.
4. Output the result ONLY in clean, semantic HTML format. DO NOT wrap the output in markdown code blocks (such as \`\`\`html or \`\`\`). Do not include any conversational text outside of the HTML note content.`
        } else if (action === 'improve') {
            systemInstruction = `You are an AI writing assistant specializing in content enhancement, grammar check, and stylistic improvement.
Your task is to take the user's note (which is provided in HTML format) and improve it.
Follow these strict rules:
1. Preserve 100% of all original details, links, numbers, dates, and core meaning. DO NOT discard, summarize, edit, or omit anything.
2. Refine spelling, grammar, vocabulary, clarity, and overall writing quality.
3. Make the prose sound more polished, professional, and clear.
4. Maintain the structure (lists, headings, paragraphs) of the original note as much as possible, just refining the language within.
5. Output the result ONLY in clean, semantic HTML format. DO NOT wrap the output in markdown code blocks (such as \`\`\`html or \`\`\`). Do not include any conversational text outside of the HTML note content.`
        } else {
            const userInstructions = customPrompt || 'Improve this note.'
            systemInstruction = `You are an AI writing assistant. The user wants you to modify/improve their note based on this request: "${userInstructions}".
Follow these strict rules:
1. Preserve 100% of all original information, links, details, dates, lists, text, numbers, and meaning unless the user explicitly requested to remove something. DO NOT discard, summarize, edit, or omit anything due to hallucination or oversight.
2. Carefully apply the user's request: "${userInstructions}" to improve, edit, or format the text.
3. Output the result ONLY in clean, semantic HTML format. DO NOT wrap the output in markdown code blocks (such as \`\`\`html or \`\`\`). Do not include any conversational text outside of the HTML note content.`
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ENV.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: content }
                ],
                temperature: 0.1,
                max_tokens: 1536,
                top_p: 1,
                stream: false
            })
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('[ai/process_note] Groq API error:', response.status, error)
            fail(res, 'AI service temporarily unavailable. Please try again.', 'AI_ERROR', 502)
            return
        }

        const data = await response.json() as any
        let aiResponse = data.choices?.[0]?.message?.content ?? ''

        // Sanitize any wrapped markdown code block symbols if they were generated
        if (aiResponse.includes('```')) {
            aiResponse = aiResponse.replace(/```html/g, '').replace(/```/g, '').trim()
        }

        ok(res, { processedContent: aiResponse })
    } catch (err) {
        if (err instanceof z.ZodError) { fail(res, 'Invalid input parameters', 'VALIDATION_ERROR', 400); return }
        console.error('[ai/process_note]', err)
        fail(res, 'Failed to process note', 'SERVER_ERROR', 500)
    }
}

router.post('/chat', chatHandler)
router.post('/chat_v2', chatHandler)
router.post('/process_note', processNoteHandler)

export default router
