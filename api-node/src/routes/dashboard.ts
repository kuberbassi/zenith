import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { Subject } from '../models/Subject.js'
import { AttendanceLog } from '../models/AttendanceLog.js'
import { AttendanceCalculator } from '../lib/calculations.js'
import { ok, fail } from '../utils/response.js'
import { uf } from '../utils/userFilter.js'

const router = Router()
router.use(requireAuth)

// ─── Dashboard Data ──────────────────────────────────────────────────────────

router.get('/data', async (req: AuthRequest, res) => {
  try {
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1

    const [subjects, recentLogs] = await Promise.all([
      Subject.find({ ...uf(req), semester })
        .select('name code attended total target semester type professor categories practicals assignments')
        .sort({ name: 1 })
        .lean(),
      AttendanceLog.find({ ...uf(req), semester })
        .sort({ date: -1, timestamp: -1 })
        .limit(30)
        .lean(),
    ])
    const summary = AttendanceCalculator.getAttendanceSummary(subjects, req.user?.attendance_threshold, req.user?.warning_threshold)

    const enriched = subjects.map((sub) => {
      const pct = AttendanceCalculator.calculatePercentage(sub.attended, sub.total)
      const guard = AttendanceCalculator.calculateBunkGuard(sub.attended, sub.total, sub.target ?? 75)
      return {
        ...sub,
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

// ─── Reports Data ────────────────────────────────────────────────────────────

router.get('/reports_data', async (req: AuthRequest, res) => {
  try {
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1
    const user = req.user
    const userTarget = user?.attendance_threshold ?? 75
    const userWarning = user?.warning_threshold ?? 60

    const [subjects, logs] = await Promise.all([
      Subject.find({ ...uf(req), semester })
        .select('name attended total target semester')
        .lean(),
      AttendanceLog.find({ ...uf(req), semester })
        .select('date status subject_name')
        .sort({ date: -1 })
        .lean(),
    ])

    let totalAbsences = 0
    let totalAttended = 0
    let totalClasses = 0
    let atRiskCount = 0

    const processedSubjects = subjects.map((sub) => {
      const attended = sub.attended ?? 0
      const total = sub.total ?? 0
      const target = sub.target ?? userTarget
      const pct = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0
      const missed = total - attended
      totalAbsences += missed
      totalAttended += attended
      totalClasses += total
      if (total > 0 && pct < target) atRiskCount++
      return { ...sub, _id: String(sub._id), percentage: pct, target }
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

    // Calculate attendance streak (consecutive days present)
    let streak = 0
    const dateSet = new Set<string>()
    for (const log of logs) {
      if (['present', 'late', 'approved_medical', 'substituted'].includes(log.status ?? '')) {
        dateSet.add(log.date)
      }
    }
    const sortedDates = [...dateSet].sort().reverse()
    const today = new Date()
    for (let i = 0; i < sortedDates.length; i++) {
      const d = new Date(sortedDates[i] + 'T00:00:00')
      const expected = new Date(today)
      expected.setDate(expected.getDate() - i)
      // Skip weekends
      while (expected.getDay() === 0 || expected.getDay() === 6) {
        expected.setDate(expected.getDate() - 1)
      }
      if (d.toISOString().slice(0, 10) === expected.toISOString().slice(0, 10)) {
        streak++
      } else {
        break
      }
    }

    const heatmapData: Record<string, string[]> = {}
    for (const log of logs) {
      const date = log.date
      if (date) {
        if (!heatmapData[date]) heatmapData[date] = []
        heatmapData[date].push(log.status ?? 'unknown')
      }
    }

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
      },
      subject_breakdown: processedSubjects,
      heatmap_data: heatmapData,
    }, 200, 15)
  } catch (err) {
    console.error('[dashboard/reports_data]', err)
    fail(res, 'Failed to fetch reports data', 'FETCH_FAILED', 500)
  }
})

// ─── Day-of-Week Analytics ───────────────────────────────────────────────────

router.get('/analytics/day-of-week', async (req: AuthRequest, res) => {
  try {
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : 1

    const semSubjects = await Subject.find({ ...uf(req), semester }, { _id: 1 }).lean()
    const subjectIds = semSubjects.map((s) => s._id)

    if (!subjectIds.length) { ok(res, { days: [] }); return }

    const logs = await AttendanceLog.find(
      { ...uf(req), subject_id: { $in: subjectIds } },
      { date: 1, status: 1 },
    ).lean()

    const dayCounts: Record<number, { present: number; absent: number }> = {}

    for (const log of logs) {
      const dateStr = log.date
      const status = log.status
      if (!dateStr || !status) continue

      const dt = new Date(dateStr + 'T00:00:00')
      const wIdx = dt.getDay() // 0=Sun, 6=Sat
      const mongoDay = wIdx + 1

      if (!dayCounts[mongoDay]) dayCounts[mongoDay] = { present: 0, absent: 0 }
      if (['present', 'late', 'approved_medical', 'substituted'].includes(status)) {
        dayCounts[mongoDay].present++
      } else if (status === 'absent') {
        dayCounts[mongoDay].absent++
      }
    }

    const dayMapping: Record<number, string> = {
      2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri', 7: 'Sat', 1: 'Sun',
    }
    const daysData = [2, 3, 4, 5, 6, 7, 1].map((d) => {
      const counts = dayCounts[d] ?? {}
      const present = counts.present ?? 0
      const absent = counts.absent ?? 0
      const total = present + absent
      return {
        day: dayMapping[d],
        present,
        total,
        percentage: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
      }
    })

    ok(res, { days: daysData }, 200, 120) // 2 min cache
  } catch (err) {
    console.error('[dashboard/analytics/day-of-week]', err)
    fail(res, 'Failed to fetch analytics', 'ANALYTICS_FAILED', 500)
  }
})

// ─── Notifications ───────────────────────────────────────────────────────────

router.get('/notifications', async (req: AuthRequest, res) => {
  try {
    const semester = req.query.semester ? parseInt(String(req.query.semester)) : undefined
    const filter = semester ? { ...uf(req), semester } : uf(req)
    const subjects = await Subject.find(filter)
      .select('name attended total target')
      .lean()
    const notifications: Array<Record<string, unknown>> = []

    // Use user's warning_threshold from profile, not hardcoded value
    const userWarningThreshold = (req as AuthRequest).user?.warning_threshold ?? 76

    for (const sub of subjects) {
      const target = sub.target ?? 75
      const guard = AttendanceCalculator.calculateBunkGuard(sub.attended, sub.total, target)
      const pct = sub.total > 0 ? Math.round((sub.attended / sub.total) * 1000) / 10 : 100

      // Trigger warning if percentage is at or below warning threshold, or can't bunk
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
