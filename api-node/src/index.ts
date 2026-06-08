import './config/env.js'  // load ENV first
import { ENV } from './config/env.js'
import app from './app.js'

import { prisma } from './config/prisma.js'

async function migrateStudentInfo() {
  try {
    const results = await prisma.semesterResult.findMany({
      select: { id: true, student_info: true },
    })
    let cleanedCount = 0
    for (const r of results) {
      if (r.student_info && typeof r.student_info === 'object') {
        const info = { ...(r.student_info as Record<string, any>) }
        let changed = false
        const keysToRemove = ['phone', 'gender', 'father', 'mother', 'email']
        for (const k of keysToRemove) {
          if (info[k] !== undefined) {
            delete info[k]
            changed = true
          }
        }
        if (changed) {
          await prisma.semesterResult.update({
            where: { id: r.id },
            data: { student_info: info },
          })
          cleanedCount++
        }
      }
    }
    if (cleanedCount > 0) {
      console.log(`[Migration] Cleaned up personal data from ${cleanedCount} legacy semester results in DB.`)
    }
  } catch (err) {
    console.error('[Migration] Legacy student info cleanup failed:', err)
  }
}

/* ── Start ────────────────────────────────────────────────── */
app.listen(ENV.PORT, () => {
  console.log(`[Server] Running on http://localhost:${ENV.PORT}`)
  console.log(`[Server] Env: ${ENV.NODE_ENV}`)
  void migrateStudentInfo()
})

export default app
