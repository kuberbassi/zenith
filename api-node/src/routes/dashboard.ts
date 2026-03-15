import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { AttendanceCalculator, GradeCalculator } from '../lib/calculations.js'
import { ok, fail } from '../utils/response.js'

const router = Router()
router.use(requireAuth)

// â”€â”€â”€ Dashboard Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/data', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1

    const [subjects, recentLogs] = await Promise.all([
      prisma.subject.findMany({
        where: { user_id: userId, semester },
        orderBy: { name: 'asc' },
      }),
      prisma.attendanceLog.findMany({
        where: { user_id: userId, semester },
        orderBy: [{ date: 'desc' }, { timestamp: 'desc' }],
        take: 30,
      }),
    ])
    const summary = AttendanceCalculator.getAttendanceSummary(subjects, req.user?.attendance_threshold, req.user?.warning_threshold)

    const enriched = subjects.map((sub) => {
      const pct = AttendanceCalculator.calculatePercentage(sub.attended, sub.total)
      const guard = AttendanceCalculator.calculateBunkGuard(sub.attended, sub.total, sub.target ?? 75)
      return {
        ...sub,
        _id: sub.id,
        attendance_percentage: pct,
        status_message: guard.status_message,
      }
    })

    ok(res, {
      overall_attendance: summary.overall_percentage,
      total_subjects: subjects.length,
      subjects: enriched,
      recent_logs: recentLogs,
      summary,
      last_updated: new Date().toISOString(),
    }, 200, 30) // 30s cache
  } catch (err) {
    console.error('[dashboard/data]', err)
    fail(res, 'Failed to fetch dashboard data', 'FETCH_FAILED', 500)
  }
})

// â”€â”€â”€ Reports Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/reports_data', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1
    const userTarget = req.user?.attendance_threshold ?? 75

    const [subjects, logs] = await Promise.all([
      prisma.subject.findMany({
        where: { user_id: userId, semester },
        select: { id: true, name: true, attended: true, total: true, target: true, semester: true },
      }),
      prisma.attendanceLog.findMany({
        where: { user_id: userId, semester },
        select: { date: true, status: true, subject_name: true },
        orderBy: { date: 'desc' },
      }),
    ])

    let totalAbsences = 0
    let totalAttended = 0
    let totalClasses = 0
    let atRiskCount = 0
    let safeBunksRemaining = 0

    const processedSubjects = subjects.map((sub) => {
      const attended = sub.attended ?? 0
      const total = sub.total ?? 0
      const target = sub.target ?? userTarget
      const pct = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0
      const missed = total - attended
      const guard = AttendanceCalculator.calculateBunkGuard(attended, total, target)
      totalAbsences += missed
      totalAttended += attended
      totalClasses += total
      safeBunksRemaining += Math.max(0, guard.count ?? 0)
      if (total > 0 && pct < target) atRiskCount++
      return { ...sub, _id: sub.id, percentage: pct, target, safe_bunks_remaining: Math.max(0, guard.count ?? 0) }
    })

    const overallPct = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 1000) / 10 : 0

    const bestSubject = processedSubjects.length
      ? processedSubjects.reduce((a, b) => (a.percentage > b.percentage ? a : b))
      : null
    const worstSubject = processedSubjects.length
      ? processedSubjects.reduce((a, b) => {
        if (a.total === 0) return b
        if (b.total === 0) return a
        return a.percentage < b.percentage ? a : b
      })
      : null

    // Calculate attendance streak — only counts consecutive weekdays (Mon-Fri)
    let streak = 0
    const dateSet = new Set<string>()
    const recentDailyPct = new Map<string, { attended: number; total: number }>()
    for (const log of logs) {
      if (['present', 'late', 'approved_medical', 'substituted'].includes(log.status)) {
        // Only count weekday attendance dates for streak
        const day = new Date(log.date + 'T00:00:00').getDay()
        if (day !== 0 && day !== 6) dateSet.add(log.date)
      }
      const bucket = recentDailyPct.get(log.date) ?? { attended: 0, total: 0 }
      bucket.total += 1
      if (['present', 'late', 'approved_medical', 'substituted'].includes(log.status)) bucket.attended += 1
      recentDailyPct.set(log.date, bucket)
    }
    // Sort descending (most recent first)
    const weekdayDates = [...dateSet].sort().reverse()
    if (weekdayDates.length > 0) {
      streak = 1
      for (let i = 1; i < weekdayDates.length; i++) {
        // Move back exactly one weekday from the previous date
        const prev = new Date(weekdayDates[i - 1] + 'T00:00:00')
        prev.setDate(prev.getDate() - 1)
        while (prev.getDay() === 0 || prev.getDay() === 6) prev.setDate(prev.getDate() - 1)
        if (weekdayDates[i] === prev.toISOString().slice(0, 10)) {
          streak++
        } else {
          break
        }
      }
    }

    const heatmapData: Record<string, string[]> = {}
    for (const log of logs) {
      if (!heatmapData[log.date]) heatmapData[log.date] = []
      heatmapData[log.date].push(log.status)
    }

    const recentDates = [...recentDailyPct.entries()]
      .sort((a, b) => a[0] < b[0] ? 1 : -1)
      .slice(0, 10)
      .reverse()
    const recentPercentages = recentDates.map(([, value]) => value.total > 0 ? (value.attended / value.total) * 100 : 0)
    const recentAverage = recentPercentages.length
      ? recentPercentages.reduce((sum, value) => sum + value, 0) / recentPercentages.length
      : overallPct
    const earlierAverage = recentPercentages.length > 4
      ? recentPercentages.slice(0, Math.floor(recentPercentages.length / 2)).reduce((sum, value) => sum + value, 0) / Math.floor(recentPercentages.length / 2)
      : recentAverage
    const attendanceMomentum = Math.round((recentAverage - earlierAverage) * 10) / 10
    const consistencyScore = Math.max(0, Math.min(100, Math.round((overallPct * 0.65) + (Math.min(streak, 10) * 3.5))))
    const achievementLevel =
      overallPct >= 90 ? 'legend' :
      overallPct >= 82 ? 'elite' :
      overallPct >= 75 ? 'steady' :
      overallPct >= 65 ? 'recovery' : 'danger'
    const focusLabel =
      atRiskCount === 0 ? 'All subjects above target' :
      worstSubject?.name ? `Recover ${worstSubject.name}` : 'Recover weak subjects'

    const resultRows = await prisma.semesterResult.findMany({
      where: { user_id: userId },
      orderBy: { semester: 'asc' },
      select: { semester: true, sgpa: true, subjects: true },
    })
    const resultSubjects = resultRows.flatMap(row => Array.isArray(row.subjects) ? row.subjects as Array<Record<string, unknown>> : [])
    const cgpaCalc = resultRows.length ? GradeCalculator.calculateCGPA(resultRows.map(row => row.subjects as Array<Record<string, unknown>>)) : { cgpa: 0 }
    const completedResultSubjects = resultSubjects.filter(subject => !subject.is_pending && subject.grade !== '-')
    const academicScore = completedResultSubjects.length
      ? Math.round(completedResultSubjects.reduce((sum, subject) => sum + Number(subject.grade_point ?? 0), 0) / completedResultSubjects.length * 10)
      : 0

    ok(res, {
      kpis: {
        best_subject_name: bestSubject?.name ?? 'N/A',
        best_subject_percent: bestSubject ? `${bestSubject.percentage}%` : '0%',
        worst_subject_name: worstSubject?.name ?? 'N/A',
        worst_subject_percent: worstSubject ? `${worstSubject.percentage}%` : '0%',
        total_absences: totalAbsences,
        overall_percentage: overallPct,
        attendance_streak: streak,
        at_risk_count: atRiskCount,
        total_subjects: subjects.length,
        target_threshold: userTarget,
        safe_bunks_remaining: safeBunksRemaining,
        consistency_score: consistencyScore,
        attendance_momentum: attendanceMomentum,
        achievement_level: achievementLevel,
        focus_label: focusLabel,
        cgpa: cgpaCalc.cgpa,
        academic_score: academicScore,
      },
      subject_breakdown: processedSubjects,
      heatmap_data: heatmapData,
    }, 200, 15)
  } catch (err) {
    console.error('[dashboard/reports_data]', err)
    fail(res, 'Failed to fetch reports data', 'FETCH_FAILED', 500)
  }
})

// â”€â”€â”€ Day-of-Week Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/analytics/day-of-week', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1

    const semSubjectIds = await prisma.subject.findMany({
      where: { user_id: userId, semester },
      select: { id: true },
    })
    const subjectIds = semSubjectIds.map((s) => s.id)

    if (!subjectIds.length) { ok(res, { days: [] }); return }

    const logs = await prisma.attendanceLog.findMany({
      where: { user_id: userId, subject_id: { in: subjectIds } },
      select: { date: true, status: true },
    })

    const dayCounts: Record<number, { present: number; absent: number }> = {}

    for (const log of logs) {
      const dt = new Date(log.date + 'T00:00:00')
      const dayIdx = dt.getDay() + 1 // 1=Sun, 2=Mon, ..., 7=Sat

      if (!dayCounts[dayIdx]) dayCounts[dayIdx] = { present: 0, absent: 0 }
      if (['present', 'late', 'approved_medical', 'substituted'].includes(log.status)) {
        dayCounts[dayIdx].present++
      } else if (log.status === 'absent') {
        dayCounts[dayIdx].absent++
      }
    }

    const dayMapping: Record<number, string> = {
      2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri',
    }
    // Only Mon-Fri (indices 2-6), Saturday and Sunday excluded
    const daysData = [2, 3, 4, 5, 6].map((d) => {
      const counts = dayCounts[d] ?? { present: 0, absent: 0 }
      const total = counts.present + counts.absent
      return {
        day: dayMapping[d],
        present: counts.present,
        total,
        percentage: total > 0 ? Math.round((counts.present / total) * 1000) / 10 : 0,
      }
    })

    ok(res, { days: daysData }, 200, 120) // 2 min cache
  } catch (err) {
    console.error('[dashboard/analytics/day-of-week]', err)
    fail(res, 'Failed to fetch analytics', 'ANALYTICS_FAILED', 500)
  }
})

// â”€â”€â”€ Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/notifications', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : undefined
    const subjects = await prisma.subject.findMany({
      where: { user_id: userId, ...(semester ? { semester } : {}) },
      select: { name: true, attended: true, total: true, target: true },
    })
    const notifications: Array<Record<string, unknown>> = []

    const userWarningThreshold = req.user?.warning_threshold ?? 76

    for (const sub of subjects) {
      const target = sub.target ?? 75
      const guard = AttendanceCalculator.calculateBunkGuard(sub.attended, sub.total, target)
      const pct = sub.total > 0 ? Math.round((sub.attended / sub.total) * 1000) / 10 : 100

      if (pct <= userWarningThreshold || (!guard.can_bunk && guard.count > 0)) {
        notifications.push({
          type: 'warning',
          title: 'Attendance Warning',
          message: `Critical: ${sub.name} is at ${pct}%. ${guard.status_message}`,
          priority: pct < target ? 'high' : 'medium',
        })
      }
    }

    ok(res, notifications)
  } catch (err) {
    console.error('[dashboard/notifications]', err)
    fail(res, 'Failed to fetch notifications', 'FETCH_FAILED', 500)
  }
})

export default router
