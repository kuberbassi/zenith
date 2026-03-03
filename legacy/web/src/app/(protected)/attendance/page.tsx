'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, MinusCircle, Filter } from 'lucide-react'
import { attendanceApi } from '@/lib/api'
import type { AttendanceLog } from '@/types'

const STATUS_ICON = {
  present: <CheckCircle2 size={13} style={{ color: 'var(--green)' }} />,
  absent: <XCircle size={13} style={{ color: 'var(--red)' }} />,
  cancelled: <MinusCircle size={13} style={{ color: 'var(--text-muted)' }} />,
}

const STATUS_COLOR = {
  present: 'var(--green)',
  absent: 'var(--red)',
  cancelled: 'var(--text-muted)',
}

const STATUS_BG = {
  present: 'rgba(34,197,94,0.08)',
  absent: 'rgba(239,68,68,0.08)',
  cancelled: 'rgba(255,255,255,0.04)',
}

export default function AttendancePage() {
  const [filter, setFilter] = useState<'all' | 'present' | 'absent' | 'cancelled'>('all')

  const { data: logs = [], isLoading } = useQuery<AttendanceLog[]>({
    queryKey: ['attendance-logs'],
    queryFn: async () => {
      const res = await attendanceApi.getLogs({ limit: 100 })
      return res.data?.logs ?? res.data ?? []
    },
  })

  const filtered =
    filter === 'all' ? logs : logs.filter((l) => l.status === filter)

  const counts = {
    all: logs.length,
    present: logs.filter((l) => l.status === 'present').length,
    absent: logs.filter((l) => l.status === 'absent').length,
    cancelled: logs.filter((l) => l.status === 'cancelled').length,
  }

  // Group by date
  const grouped = filtered.reduce<Record<string, AttendanceLog[]>>((acc, log) => {
    const date = log.date?.slice(0, 10) ?? 'Unknown'
    if (!acc[date]) acc[date] = []
    acc[date].push(log)
    return acc
  }, {})

  const groupedEntries = Object.entries(grouped).sort(
    ([a], [b]) => new Date(b).getTime() - new Date(a).getTime(),
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="section-label mb-1">History</p>
        <h1 className="text-xl font-semibold text-white">Attendance Logs</h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {(
          [
            { key: 'all', label: 'Total', color: 'var(--text)' },
            { key: 'present', label: 'Present', color: 'var(--green)' },
            { key: 'absent', label: 'Absent', color: 'var(--red)' },
            { key: 'cancelled', label: 'Cancelled', color: 'var(--text-muted)' },
          ] as const
        ).map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="rounded-xl border p-4 text-left transition-all"
            style={{
              background: filter === key ? 'var(--card-hover)' : 'var(--card)',
              borderColor: filter === key ? 'var(--border-bright)' : 'var(--border)',
            }}
          >
            <p className="section-label mb-1">{label}</p>
            <p className="text-2xl font-bold mono" style={{ color }}>
              {counts[key]}
            </p>
          </button>
        ))}
      </div>

      {/* Grouped logs */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--card)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-xl border p-16 text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <p className="text-sm font-medium text-white mb-1">No logs found</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Mark attendance from the Dashboard or Subjects page
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedEntries.map(([date, dayLogs]) => (
            <div key={date}>
              <p className="section-label mb-3">
                {new Date(date).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              <div
                className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                {dayLogs.map((log, i) => (
                  <motion.div
                    key={log._id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 px-5 py-3 border-b last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: STATUS_BG[log.status] }}
                    >
                      {STATUS_ICON[log.status]}
                    </span>
                    <p className="text-sm text-white flex-1 truncate font-medium">
                      {log.subject_name}
                    </p>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded"
                      style={{
                        color: STATUS_COLOR[log.status],
                        background: STATUS_BG[log.status],
                      }}
                    >
                      {log.status.toUpperCase()}
                    </span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {log.marked_at
                        ? new Date(log.marked_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
