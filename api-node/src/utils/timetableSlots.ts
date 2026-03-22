export function getSlotType(slot: Record<string, unknown>): string {
  const explicit = String(slot.type ?? '').trim().toLowerCase()
  if (explicit) return explicit

  const hasSubjectRef = String(slot.subject_id ?? slot.subjectId ?? '').trim().length > 0
  const hasLabel = String(slot.label ?? slot.name ?? '').trim().length > 0
  if (!hasSubjectRef && hasLabel) return 'custom'

  return 'class'
}

export function scoreScheduleBySubjects(schedule: unknown, subjectIds: Set<string>): number {
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
