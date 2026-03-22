export const COUNTED_ATTENDANCE_STATUSES = [
  'present',
  'absent',
  'late',
  'approved_medical',
  'medical',
  'duty',
  'substituted',
] as const

export const ATTENDED_ATTENDANCE_STATUSES = [
  'present',
  'late',
  'approved_medical',
  'medical',
  'duty',
  'substituted',
] as const

export function normalizeAttendanceStatus(status: unknown): typeof COUNTED_ATTENDANCE_STATUSES[number] | 'cancelled' {
  const s = String(status ?? 'present').toLowerCase().trim()
  if (s.includes('present')) return 'present'
  if (s.includes('absent')) return 'absent'
  if (s.includes('late')) return 'late'
  if (s.includes('medical')) return s.includes('approved') ? 'approved_medical' : 'medical'
  if (s.includes('duty')) return 'duty'
  if (s.includes('substituted')) return 'substituted'
  if (s.includes('cancelled')) return 'cancelled'
  return 'present'
}

export function isCountedAttendanceStatus(status: string | null | undefined): boolean {
  return !!status && COUNTED_ATTENDANCE_STATUSES.includes(status as (typeof COUNTED_ATTENDANCE_STATUSES)[number])
}

export function isAttendedAttendanceStatus(status: string | null | undefined): boolean {
  return !!status && ATTENDED_ATTENDANCE_STATUSES.includes(status as (typeof ATTENDED_ATTENDANCE_STATUSES)[number])
}
