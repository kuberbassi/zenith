import { Router } from 'express'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { ok } from '../utils/response.js'

const router = Router()

const CATEGORY_MAP: Record<string, string[]> = {
  Exam: ['exam', 'datesheet', 'examination', 'viva', 'theory', 'practical'],
  Admission: ['admission', 'counseling', 'seat', 'cet', 'cutoff'],
  Result: ['result', 'grade', 'marks', 'declared'],
  Holiday: ['holiday', 'closed', 'break', 'vacation'],
  Placement: ['placement', 'job', 'recruitment', 'drive', 'interview', 'career'],
  Fee: ['fee', 'payment', 'challan', 'dues', 'scholarship'],
  Hostel: ['hostel', 'mess', 'accommodation'],
  'Campus Event': ['event', 'seminar', 'workshop', 'festival', 'cult', 'competition'],
  COVID: ['covid', 'vaccination', 'mask', 'pandemic'],
}

function categorizeNotice(title: string): string {
  const lower = title.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some((kw) => lower.includes(kw))) return cat
  }
  return 'General'
}

const CACHE_TIMEOUT = 600_000

interface Notice {
  title: string
  link: string
  date: string
  category: string
}

function normalizeNoticeDate(dm: RegExpMatchArray): string | null {
  const day = Number(dm[1])
  const month = Number(dm[2])
  let year = Number(dm[3])
  if (year < 100) year += 2000
  if (!day || !month || month > 12 || day > 31) return null

  const parsed = new Date(year, month - 1, day)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getDate() !== day ||
    parsed.getMonth() !== month - 1 ||
    parsed.getFullYear() !== year
  ) {
    return null
  }

  const now = new Date()
  const maxFuture = new Date(now)
  maxFuture.setDate(maxFuture.getDate() + 2)
  if (parsed.getTime() > maxFuture.getTime()) return null

  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`
}

function extractNoticeDate(raw: string): string | null {
  if (!raw) return null
  const dm = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (!dm) return null
  return normalizeNoticeDate(dm)
}

let cache: Notice[] = []
let lastUpdated: number | null = null
let refreshing = false

async function scrapeIPUNotices(): Promise<Notice[]> {
  const url = 'http://www.ipu.ac.in/notices.php'
  try {
    const resp = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10_000,
      responseType: 'text',
    })

    const html: string = resp.data
    const rowRe = /<tr[^>]*>(.*?)<\/tr>/gis
    const notices: Notice[] = []
    let count = 0

    let match: RegExpExecArray | null
    while ((match = rowRe.exec(html)) !== null && count < 150) {
      count++
      try {
        const rowHtml = match[1]
        const $row = cheerio.load(rowHtml, null, false)
        const link = $row('a[href]').first()
        if (!link.length) continue

        const title = link.text().trim()
        let href = (link.attr('href') || '').trim()
        if (!title || title.length < 5) continue

        const hrefLower = href.toLowerCase()
        if (!['.pdf', 'notice', 'upload', 'circular', 'download', 'order', 'datesheet'].some((kw) => hrefLower.includes(kw))) continue
        if (!href.startsWith('http')) href = `http://www.ipu.ac.in/${href.replace(/^\/+/, '')}`

        let dateStr: string | null = null

        $row('td').each((_i, td) => {
          if (dateStr) return
          const txt = $row(td).text().trim()
          dateStr = extractNoticeDate(txt) ?? dateStr
        })

        if (!dateStr) dateStr = extractNoticeDate(title)
        if (!dateStr) dateStr = extractNoticeDate(href)

        notices.push({
          title: title.slice(0, 250),
          link: href,
          date: dateStr || '',
          category: categorizeNotice(title),
        })
      } catch {
        continue
      }
    }

    notices.sort((a, b) => {
      const pA = a.date.split('-')
      const pB = b.date.split('-')
      if (pA.length === 3 && pB.length === 3) {
        const dA = new Date(`${pA[2]}-${pA[1]}-${pA[0]}`).getTime()
        const dB = new Date(`${pB[2]}-${pB[1]}-${pB[0]}`).getTime()
        return dB - dA
      }
      return 0
    })

    return notices
  } catch (e) {
    console.error('[notices] Scraper error:', e)
    return []
  }
}

async function backgroundRefresh() {
  try {
    const notices = await scrapeIPUNotices()
    if (notices.length) {
      cache = notices
      lastUpdated = Date.now()
      console.log(`[notices] Background refresh: ${notices.length} notices`)
    }
  } catch (e) {
    console.error('[notices] Background refresh failed:', e)
  } finally {
    refreshing = false
  }
}

router.get('/notices', async (req, res) => {
  const categoryFilter = req.query.category as string | undefined
  const forceRefresh = req.query.force === 'true'
  const expired = !lastUpdated || Date.now() - lastUpdated > CACHE_TIMEOUT

  if (forceRefresh || expired) {
    if (!refreshing) {
      refreshing = true
      void backgroundRefresh()
    }
    if (!cache.length) {
      try {
        const fresh = await scrapeIPUNotices()
        if (fresh.length) {
          cache = fresh
          lastUpdated = Date.now()
        }
      } catch {
      }
    }
  }

  let notices = cache
  if (categoryFilter) notices = notices.filter((n) => n.category === categoryFilter)
  ok(res, notices)
})

router.get('/stats', async (_req, res) => {
  if (!cache.length) {
    const fresh = await scrapeIPUNotices()
    if (fresh.length) {
      cache = fresh
      lastUpdated = Date.now()
    }
  }
  const stats: Record<string, number> = {}
  for (const notice of cache) {
    stats[notice.category] = (stats[notice.category] || 0) + 1
  }
  ok(res, stats)
})

export default router
