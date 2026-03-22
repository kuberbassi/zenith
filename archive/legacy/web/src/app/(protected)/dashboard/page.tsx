'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, Tooltip as RadarTooltip,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useDashboard, useMarkAttendance } from '@/hooks/useDashboard'
import { AttendanceCalculator } from '@/lib/calculations'
import type { Subject, AttendanceLog } from '@/types'

/* ================================================================
   HELPERS
   ================================================================ */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pct(attended: number, total: number) {
  if (total === 0) return 0
  return Math.round((attended / total) * 1000) / 10
}

function riskColor(p: number, target = 75) {
  if (p >= target) return 'var(--green)'
  if (p >= target - 10) return 'var(--amber)'
  return 'var(--red)'
}

function riskBg(p: number, target = 75) {
  if (p >= target) return 'var(--green-dim)'
  if (p >= target - 10) return 'var(--amber-dim)'
  return 'var(--red-dim)'
}

function computeWeeklyData(logs: AttendanceLog[]) {
  const now = new Date()
  const dayMap: Record<string, { present: number; absent: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dayMap[key] = { present: 0, absent: 0 }
  }
  logs.forEach((log) => {
    const key = log.date?.slice(0, 10)
    if (key && dayMap[key] !== undefined) {
      if (log.status === 'present') dayMap[key].present++
      else if (log.status === 'absent') dayMap[key].absent++
    }
  })
  return Object.entries(dayMap).map(([date, v]) => ({
    day: DAYS[new Date(date).getDay()],
    date,
    present: v.present,
    absent: v.absent,
    total: v.present + v.absent,
  }))
}

/* ================================================================
   SECTION WRAPPER (last.fm style)
   ================================================================ */
function Section({
  label,
  right,
  children,
}: {
  label: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="section-label">{label}</span>
        {right}
      </div>
      {children}
    </section>
  )
}

/* ================================================================
   QUICK FACT CARD (last.fm style big number + label)
   ================================================================ */
function QuickFact({
  label,
  value,
  sub,
  trend,
  color,
  delay = 0,
}: {
  label: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down' | 'flat'
  color?: string
  delay?: number
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendClass = trend === 'up' ? 'trend-up' : trend === 'down' ? 'trend-down' : 'trend-flat'
  return (
    <motion.div
      className="rounded-xl border p-5 space-y-1"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="section-label">{label}</p>
      <p
        className="text-3xl font-bold mono leading-none mt-2"
        style={{ color: color ?? 'var(--text)' }}
      >
        {value}
      </p>
      {sub && (
        <div className="flex items-center gap-1.5 pt-1">
          {trend && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${trendClass}`}
            >
              <TrendIcon size={9} />
            </span>
          )}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {sub}
          </p>
        </div>
      )}
    </motion.div>
  )
}

/* ================================================================
   TOP SUBJECT (last.fm "TOP TRACK" style)
   ================================================================ */
function TopSubjectCard({ subject }: { subject: Subject }) {
  const p = pct(subject.attended, subject.total)
  const guard = AttendanceCalculator.calculateBunkGuard(
    subject.attended,
    subject.total,
    subject.target ?? 75,
  )
  return (
    <div
      className="rounded-xl border p-5 flex items-center gap-5"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {/* Rank thumb */}
      <div
        className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 text-xl font-bold mono"
        style={{
          background: `${riskBg(p)}`,
          color: riskColor(p),
          border: `1px solid ${riskColor(p)}22`,
        }}
      >
        {p.toFixed(0)}%
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-white truncate">{subject.name}</p>
          <span className="badge-peak">BEST</span>
        </div>
        {subject.code && (
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            {subject.code}
          </p>
        )}
        <p className="text-xs" style={{ color: 'var(--lf-green)' }}>
          {guard.status_message}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {subject.attended}/{subject.total}
        </p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          classes
        </p>
      </div>
    </div>
  )
}

/* ================================================================
   SUBJECT RANKINGS (last.fm artist/track list style)
   ================================================================ */
function SubjectRankings({
  subjects,
  onMark,
  marking,
}: {
  subjects: Subject[]
  onMark: (id: string, status: 'present' | 'absent') => void
  marking: string | null
}) {
  const sorted = [...subjects].sort(
    (a, b) =>
      pct(b.attended, b.total) - pct(a.attended, a.total),
  )
  const max = sorted[0] ? pct(sorted[0].attended, sorted[0].total) : 100

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {sorted.map((subject, i) => {
        const p = pct(subject.attended, subject.total)
        const target = subject.target ?? 75
        const color = riskColor(p, target)
        const barWidth = max > 0 ? (p / max) * 100 : 0
        const isPending = marking === subject._id

        return (
          <div
            key={subject._id}
            className="flex items-center gap-4 px-5 py-3 border-b last:border-b-0 group relative overflow-hidden"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Background bar (last.fm style) */}
            <div
              className="absolute left-0 top-0 bottom-0 transition-all duration-700"
              style={{
                width: `${barWidth}%`,
                background: `${color}08`,
                borderRight: `1px solid ${color}15`,
              }}
            />
            {/* Rank */}
            <span className="rank-num relative z-10">#{i + 1}</span>
            {/* Name */}
            <div className="flex-1 min-w-0 relative z-10">
              <p className="text-sm text-white truncate font-medium leading-tight">
                {subject.name}
              </p>
              {subject.code && (
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {subject.code}
                </p>
              )}
            </div>
            {/* Quick mark (appears on hover) */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 relative z-10">
              <button
                onClick={() => onMark(subject._id, 'present')}
                disabled={isPending}
                title="Present"
                className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                style={{
                  background: 'rgba(34,197,94,0.08)',
                  color: 'var(--green)',
                  opacity: isPending ? 0.5 : 1,
                }}
              >
                <CheckCircle2 size={12} />
              </button>
              <button
                onClick={() => onMark(subject._id, 'absent')}
                disabled={isPending}
                title="Absent"
                className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  color: 'var(--red)',
                  opacity: isPending ? 0.5 : 1,
                }}
              >
                <XCircle size={12} />
              </button>
            </div>
            {/* % */}
            <span
              className="text-sm font-bold mono relative z-10 flex-shrink-0"
              style={{ color }}
            >
              {p.toFixed(1)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ================================================================
   WEEK BAR CHART (last.fm scrobble-by-day style)
   ================================================================ */
function WeekChart({ logs }: { logs: AttendanceLog[] }) {
  const data = useMemo(() => computeWeeklyData(logs), [logs])
  const hasData = data.some((d) => d.total > 0)

  if (!hasData) return null

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barSize={12} barGap={2}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#555', fontSize: 10, fontWeight: 600 }}
          />
          <YAxis hide />
          <RTooltip
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            contentStyle={{
              background: '#0e0e0e',
              border: '1px solid #1a1a1a',
              borderRadius: 6,
              fontSize: 11,
              color: '#f2f2f2',
            }}
            formatter={(value: number, name: string) => [
              value,
              name === 'present' ? 'Present' : 'Absent',
            ]}
          />
          <Bar dataKey="present" stackId="a" fill="var(--green)" radius={[0, 0, 0, 0]} opacity={0.8} />
          <Bar dataKey="absent" stackId="a" fill="var(--red)" radius={[3, 3, 0, 0]} opacity={0.7} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 justify-end">
        <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: 'var(--green)' }} />
          Present
        </span>
        <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: 'var(--red)' }} />
          Absent
        </span>
      </div>
    </div>
  )
}

/* ================================================================
   FINGERPRINT RADAR (last.fm "Listening Fingerprint" style)
   ================================================================ */
function FingerprintRadar({ subjects }: { subjects: Subject[] }) {
  if (subjects.length < 3) return null
  const data = subjects.map((s) => ({
    subject: s.name.length > 10 ? s.name.slice(0, 10) + '' : s.name,
    pct: pct(s.attended, s.total),
    fullMark: 100,
  }))
  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <ResponsiveContainer width="100%" height={230}>
        <RadarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
          <PolarGrid stroke="rgba(255,255,255,0.05)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#555', fontSize: 9, fontWeight: 600 }}
          />
          <Radar
            name="Attendance"
            dataKey="pct"
            stroke="#51FFC5"
            fill="#51FFC5"
            fillOpacity={0.08}
            strokeWidth={1.5}
          />
          <RadarTooltip
            contentStyle={{
              background: '#0e0e0e',
              border: '1px solid #1a1a1a',
              borderRadius: 6,
              fontSize: 11,
              color: '#f2f2f2',
            }}
            formatter={(v: number) => [`${v.toFixed(1)}%`, 'Attendance']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ================================================================
   SKELETON
   ================================================================ */
function Sk({ h = 'h-10', w = 'w-full' }: { h?: string; w?: string }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${h} ${w}`}
      style={{ background: 'var(--border)' }}
    />
  )
}

/* ================================================================
   DASHBOARD PAGE
   ================================================================ */
export default function DashboardPage() {
  const { user } = useAuth()
  const { data, isLoading, error } = useDashboard()
  const { mutate: mark } = useMarkAttendance()
  const [marking, setMarking] = useState<string | null>(null)

  const handleMark = (subjectId: string, status: 'present' | 'absent') => {
    setMarking(subjectId)
    mark({ subjectId, status }, { onSettled: () => setMarking(null) })
  }

  if (isLoading) {
    return (
      <div className="space-y-10">
        <Sk h="h-6" w="w-40" />
        <Sk h="h-20" w="w-52" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Sk key={i} h="h-24" />)}
        </div>
        <Sk h="h-40" />
        <Sk h="h-48" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-sm" style={{ color: 'var(--red)' }}>Failed to load</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Check that the API server is running
        </p>
      </div>
    )
  }

  const subjects = data?.subjects ?? []
  const logs = (data?.recent_logs ?? []) as AttendanceLog[]
  const overall = data?.overall_attendance ?? 0
  const totalAttended = subjects.reduce((s, x) => s + x.attended, 0)
  const totalClasses = subjects.reduce((s, x) => s + x.total, 0)
  const totalAbsent = totalClasses - totalAttended
  const safe = subjects.filter(s => pct(s.attended, s.total) >= (s.target ?? 75)).length
  const danger = subjects.length - safe
  const bestSubject = [...subjects].sort(
    (a, b) => pct(b.attended, b.total) - pct(a.attended, a.total),
  )[0]
  const worstSubject = [...subjects].sort(
    (a, b) => pct(a.attended, a.total) - pct(b.attended, b.total),
  )[0]
  const overallTrend = overall >= 75 ? 'up' : overall >= 65 ? 'flat' : 'down'
  const firstName = user?.name?.split(' ')[0] ?? 'Student'

  return (
    <div className="space-y-12">

      {/*  HERO  */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="section-label mb-3">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-8xl font-black mono leading-none tracking-tighter"
                style={{
                  color:
                    overall >= 75
                      ? 'var(--lf-green)'
                      : overall >= 65
                      ? 'var(--amber)'
                      : 'var(--red)',
                }}
              >
                {overall.toFixed(0)}
              </span>
              <span className="text-3xl font-bold" style={{ color: 'var(--text-muted)' }}>
                %
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded ${overallTrend === 'up' ? 'trend-up' : overallTrend === 'down' ? 'trend-down' : 'trend-flat'}`}
              >
                {overallTrend === 'up' ? (
                  <><TrendingUp size={9} /> ON TRACK</>
                ) : overallTrend === 'flat' ? (
                  <><Minus size={9} /> BORDERLINE</>
                ) : (
                  <><TrendingDown size={9} /> AT RISK</>
                )}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                overall attendance
              </span>
            </div>
          </div>
        </div>
        <p className="text-xl font-semibold text-white mt-5">
          {firstName}&apos;s Report
        </p>
      </motion.div>

      {/*  QUICK FACTS  */}
      <Section label="Quick Facts">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickFact
            label="Total Attended"
            value={totalAttended}
            sub={`out of ${totalClasses} classes`}
            color="var(--lf-green)"
            delay={0.05}
          />
          <QuickFact
            label="Total Missed"
            value={totalAbsent}
            sub="absences"
            trend={totalAbsent > 10 ? 'down' : 'flat'}
            color={totalAbsent > 20 ? 'var(--red)' : 'var(--text)'}
            delay={0.1}
          />
          <QuickFact
            label="Subjects Safe"
            value={safe}
            sub={`${danger > 0 ? `${danger} at risk` : 'all on track'}`}
            trend={danger === 0 ? 'up' : 'flat'}
            color="var(--green)"
            delay={0.15}
          />
          <QuickFact
            label="Subjects"
            value={subjects.length}
            sub="tracked this semester"
            delay={0.2}
          />
        </div>
      </Section>

      {/*  TOP SUBJECT  */}
      {bestSubject && (
        <Section label="Top Subject">
          <TopSubjectCard subject={bestSubject} />
        </Section>
      )}

      {/*  WEEKLY CHART  */}
      {logs.length > 0 && (
        <Section label="This Week">
          <WeekChart logs={logs} />
        </Section>
      )}

      {/*  CHARTS + RANKINGS (2-col on large)  */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* Rankings */}
        <div className="lg:col-span-3 space-y-4">
          <Section label={`Subject Rankings — ${subjects.length}`}>
            {subjects.length === 0 ? (
              <div
                className="rounded-xl border p-10 text-center"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <p className="text-sm text-white mb-1">No subjects yet</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Add subjects from the Subjects page to start tracking
                </p>
              </div>
            ) : (
              <SubjectRankings
                subjects={subjects}
                onMark={handleMark}
                marking={marking}
              />
            )}
          </Section>
        </div>

        {/* Radar fingerprint */}
        <div className="lg:col-span-2 space-y-4">
          {subjects.length >= 3 && (
            <Section label="Attendance Fingerprint">
              <FingerprintRadar subjects={subjects} />
            </Section>
          )}
          {/* Worst subject warning */}
          {worstSubject && pct(worstSubject.attended, worstSubject.total) < 75 && (
            <div
              className="rounded-xl border p-4"
              style={{
                background: 'var(--red-dim)',
                borderColor: 'rgba(239,68,68,0.2)',
              }}
            >
              <p className="section-label mb-2" style={{ color: 'var(--red)' }}>
                Needs Attention
              </p>
              <p className="text-sm font-semibold text-white truncate">
                {worstSubject.name}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--red)' }}>
                {pct(worstSubject.attended, worstSubject.total).toFixed(1)}% —{' '}
                {
                  AttendanceCalculator.calculateBunkGuard(
                    worstSubject.attended,
                    worstSubject.total,
                    worstSubject.target ?? 75,
                  ).status_message
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
