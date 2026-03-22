'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit3, CheckCircle2, XCircle } from 'lucide-react'
import { subjectsApi, attendanceApi } from '@/lib/api'
import { AttendanceCalculator } from '@/lib/calculations'
import type { Subject } from '@/types'

function pct(a: number, t: number) {
  if (t === 0) return 0
  return Math.round((a / t) * 1000) / 10
}
function riskColor(p: number, target = 75) {
  if (p >= target) return 'var(--green)'
  if (p >= target - 10) return 'var(--amber)'
  return 'var(--red)'
}

function AddSubjectModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [professor, setProfessor] = useState('')
  const [target, setTarget] = useState('75')
  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      subjectsApi.create({ name, code: code || undefined, professor: professor || undefined, target: parseInt(target) || 75 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="relative w-full max-w-sm rounded-xl border p-6 space-y-4"
        style={{ background: '#0e0e0e', borderColor: 'var(--border-bright)' }}
      >
        <p className="section-label">Add Subject</p>
        <h2 className="text-lg font-semibold text-white -mt-2">New Subject</h2>

        {[
          { label: 'Subject Name *', value: name, set: setName, placeholder: 'e.g. Mathematics' },
          { label: 'Subject Code', value: code, set: setCode, placeholder: 'e.g. MATH101' },
          { label: 'Professor', value: professor, set: setProfessor, placeholder: 'Optional' },
          { label: 'Target %', value: target, set: setTarget, placeholder: '75', type: 'number' },
        ].map(({ label, value, set, placeholder, type }) => (
          <div key={label}>
            <label className="block text-[11px] mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
              {label}
            </label>
            <input
              type={type ?? 'text'}
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none transition-colors focus:border-[var(--accent)]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            />
          </div>
        ))}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm transition-colors"
            style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && mutate()}
            disabled={!name.trim() || isPending}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              opacity: !name.trim() || isPending ? 0.5 : 1,
            }}
          >
            {isPending ? 'Adding…' : 'Add Subject'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function SubjectRow({ subject, onDelete }: { subject: Subject; onDelete: (id: string) => void }) {
  const qc = useQueryClient()
  const [marking, setMarking] = useState<'present' | 'absent' | null>(null)
  const { mutate: mark, isPending } = useMutation({
    mutationFn: (status: 'present' | 'absent') =>
      attendanceApi.mark(subject._id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onMutate: (status) => setMarking(status),
    onSettled: () => setMarking(null),
  })

  const p = pct(subject.attended, subject.total)
  const target = subject.target ?? 75
  const color = riskColor(p, target)
  const guard = AttendanceCalculator.calculateBunkGuard(subject.attended, subject.total, target)

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0 group"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Color indicator */}
      <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: color }} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white truncate">{subject.name}</p>
          {subject.code && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
              {subject.code}
            </span>
          )}
        </div>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {subject.attended}/{subject.total} attended · {guard.status_message}
        </p>
        {/* Progress bar */}
        <div className="mt-2 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(p, 100)}%`, background: color }}
          />
        </div>
      </div>

      {/* Pct */}
      <span className="text-base font-bold mono flex-shrink-0" style={{ color }}>
        {p.toFixed(1)}%
      </span>

      {/* Mark buttons */}
      <div className="flex gap-1.5 flex-shrink-0">
        <button
          onClick={() => mark('present')}
          disabled={isPending}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
          style={{
            background: marking === 'present' ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.07)',
            color: 'var(--green)',
            opacity: isPending ? 0.5 : 1,
          }}
        >
          <CheckCircle2 size={13} />
        </button>
        <button
          onClick={() => mark('absent')}
          disabled={isPending}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
          style={{
            background: marking === 'absent' ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.07)',
            color: 'var(--red)',
            opacity: isPending ? 0.5 : 1,
          }}
        >
          <XCircle size={13} />
        </button>
      </div>

      {/* Delete (hover) */}
      <button
        onClick={() => onDelete(subject._id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.07)', color: 'var(--red)' }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

export default function SubjectsPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)

  const { data: subjects = [], isLoading } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await subjectsApi.getAll()
      return res.data
    },
  })

  const { mutate: deleteSubject } = useMutation({
    mutationFn: (id: string) => subjectsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const sorted = [...subjects].sort(
    (a, b) => pct(b.attended, b.total) - pct(a.attended, a.total),
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="section-label mb-1">Manage</p>
          <h1 className="text-xl font-semibold text-white">Subjects</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Plus size={14} />
          Add Subject
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--card)' }} />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div
          className="rounded-xl border p-16 text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <p className="text-sm font-medium text-white mb-1">No subjects yet</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Add your subjects to start tracking attendance
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={14} />
            Add First Subject
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {sorted.map((subject) => (
            <SubjectRow
              key={subject._id}
              subject={subject}
              onDelete={deleteSubject}
            />
          ))}
        </motion.div>
      )}

      {/* Add modal */}
      <AnimatePresence>
        {showAdd && <AddSubjectModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}
