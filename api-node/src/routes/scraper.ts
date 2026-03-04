import { Router } from 'express'
import axios from 'axios'
import * as cheerio from 'cheerio'
import mongoose from 'mongoose'
import { ok, fail } from '../utils/response.js'

const router = Router()

/* ── Category map (mirror of Flask scraper.py) ────────────────────────── */

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

/* ── In-memory cache + MongoDB persistence ────────────────────────────── */

const CACHE_TIMEOUT = 600_000 // 10 minutes in ms
const CACHE_COLLECTION = 'notice_cache'
const CACHE_DOC_ID = 'ipu_notices'

interface Notice {
  title: string
  link: string
  date: string
  category: string
}

let _cache: Notice[] = []
let _lastUpdated: number | null = null
let _refreshing = false

function getCollection() {
  const db = mongoose.connection.db
  if (!db) throw new Error('Database not connected')
  return db.collection(CACHE_COLLECTION)
}

async function loadFromMongo(): Promise<boolean> {
  try {
    const doc = await getCollection().findOne({ _id: CACHE_DOC_ID as any })
    if (doc?.notices?.length) {
      _cache = doc.notices
      _lastUpdated = doc.updated_at ? new Date(doc.updated_at).getTime() : Date.now()
      console.log(`[notices] Loaded ${_cache.length} notices from MongoDB cache`)
      return true
    }
  } catch (e) {
    console.warn('[notices] MongoDB cache load failed:', e)
  }
  return false
}

async function saveToMongo(notices: Notice[]) {
  try {
    await getCollection().updateOne(
      { _id: CACHE_DOC_ID as any },
      { $set: { notices, updated_at: new Date(), count: notices.length } },
      { upsert: true },
    )
  } catch (e) {
    console.warn('[notices] MongoDB cache save failed:', e)
  }
}

/* ── Scraper ─────────────────────────────────────────────────────────── */

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
    // Use regex to find <tr> blocks (fast on 4MB page)
    const rowRe = /<tr[^>]*>(.*?)<\/tr>/gis
    const notices: Notice[] = []
    let count = 0

    let match: RegExpExecArray | null
    while ((match = rowRe.exec(html)) !== null && count < 150) {
      count++
      try {
        const rowHtml = match[1]
        const $row = cheerio.load(rowHtml)

        const link = $row('a[href]').first()
        if (!link.length) continue

        const title = link.text().trim()
        let href = (link.attr('href') || '').trim()

        if (!title || title.length < 5) continue

        const hrefLower = href.toLowerCase()
        if (!['.pdf', 'notice', 'upload', 'circular', 'download', 'order', 'datesheet'].some((kw) => hrefLower.includes(kw))) continue

        if (!href.startsWith('http')) href = `http://www.ipu.ac.in/${href.replace(/^\/+/, '')}`

        // Extract date
        let dateStr: string | null = null
        const normalizeDate = (dm: RegExpMatchArray) => {
          let y = dm[3];
          if (y.length === 2) y = '20' + y;
          return `${dm[1].padStart(2, '0')}-${dm[2].padStart(2, '0')}-${y}`;
        };

        $row('td').each((_i, td) => {
          if (dateStr) return
          const txt = $row(td).text().trim()
          const dm = txt.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
          if (dm) dateStr = normalizeDate(dm)
        })

        if (!dateStr) {
          const dm = title.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
          if (dm) dateStr = normalizeDate(dm)
          else {
            const fm = href.match(/(\d{2})(\d{2})(\d{2})/)
            if (fm) {
              const [, d, m, y] = fm
              dateStr = parseInt(d, 10) > 31 ? `${d.padStart(2, '0')}-${m.padStart(2, '0')}-20${y}` : `${d.padStart(2, '0')}-${m.padStart(2, '0')}-20${y}` // Note: The previous logic flipped d and y weirdly, simplifying to assume DDMMYY if 6 digits. Wait, standard is DDMMYY or YYMMDD? usually DDMMYY for IPU URLs
              // Actually, if d > 31, it was YYMMDD:
              if (parseInt(d, 10) > 31) dateStr = `${y.padStart(2, '0')}-${m.padStart(2, '0')}-20${d}`;
              else dateStr = `${d.padStart(2, '0')}-${m.padStart(2, '0')}-20${y}`;
            }
          }
        }

        notices.push({
          title: title.slice(0, 250),
          link: href,
          date: dateStr || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
          category: categorizeNotice(title),
        })
      } catch {
        continue
      }
    }

    // Sort notices by date descending (latest on top)
    notices.sort((a, b) => {
      const pA = a.date.split('-');
      const pB = b.date.split('-');
      if (pA.length === 3 && pB.length === 3) {
        const dA = new Date(`${pA[2]}-${pA[1]}-${pA[0]}`).getTime();
        const dB = new Date(`${pB[2]}-${pB[1]}-${pB[0]}`).getTime();
        return dB - dA;
      }
      return 0;
    });

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
      _cache = notices
      _lastUpdated = Date.now()
      await saveToMongo(notices)
      console.log(`[notices] Background refresh: ${notices.length} notices`)
    }
  } catch (e) {
    console.error('[notices] Background refresh failed:', e)
  } finally {
    _refreshing = false
  }
}

/* ── Routes ──────────────────────────────────────────────────────────── */

/* GET /api/scraper/notices */
router.get('/notices', async (req, res) => {
  const categoryFilter = req.query.category as string | undefined
  const forceRefresh = req.query.force === 'true'

  // Cold start — try MongoDB
  if (!_cache.length) await loadFromMongo()

  const expired = !_lastUpdated || Date.now() - _lastUpdated > CACHE_TIMEOUT

  if (forceRefresh || expired) {
    if (!_refreshing) {
      _refreshing = true
      backgroundRefresh() // fire-and-forget
    }
    // If still no data, do inline fetch
    if (!_cache.length) {
      try {
        const fresh = await scrapeIPUNotices()
        if (fresh.length) {
          _cache = fresh
          _lastUpdated = Date.now()
          saveToMongo(fresh) // fire-and-forget
        }
      } catch { /* ignore */ }
    }
  }

  let notices = _cache
  if (categoryFilter) notices = notices.filter((n) => n.category === categoryFilter)

  ok(res, notices)
})

/* GET /api/scraper/stats */
router.get('/stats', async (_req, res) => {
  if (!_cache.length) await loadFromMongo()
  const stats: Record<string, number> = {}
  for (const n of _cache) {
    stats[n.category] = (stats[n.category] || 0) + 1
  }
  ok(res, stats)
})

export default router
