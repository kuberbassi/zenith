import { Router } from 'express'
import { z } from 'zod'
import * as cheerio from 'cheerio'
import { randomUUID } from 'crypto'
import { prisma } from '../config/prisma.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { ok, created, fail } from '../utils/response.js'
import { getClientIp } from '../utils/ip.js'
import { ENV } from '../config/env.js'
import { callLLM, ChatMessage } from '../utils/llm.js'

const router = Router()
router.use(requireAuth)

async function sysLog(req: AuthRequest, userId: string, action: string, description: string) {
  const ip = getClientIp(req)
  const user_agent = (req.headers['user-agent'] as string) || null
  await prisma.systemLog.create({ data: { user_id: userId, action, description, ip, user_agent } }).catch(() => null)
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedBookmark {
  url: string
  title: string
  category: string
}

/**
 * Clean URL string
 */
function cleanUrl(url: string): string {
  try {
    const u = new URL(url.trim())
    return u.origin + u.pathname + u.search
  } catch {
    return url.trim()
  }
}

/**
 * Get simple name guess for title
 */
function cleanTitleFallback(title: string): string {
  let cleaned = title.trim()
  // Strip common suffixes
  cleaned = cleaned.split(' - ')[0]
  cleaned = cleaned.split(' | ')[0]
  cleaned = cleaned.split(' – ')[0]
  cleaned = cleaned.split(' : ')[0]
  cleaned = cleaned.replace(/^(Bookmark for|Welcome to|Home of)\s+/i, '')
  return cleaned || 'Website'
}

/**
 * Netscape HTML bookmarks parser
 */
function parseHtmlBookmarks(htmlContent: string): ParsedBookmark[] {
  const $ = cheerio.load(htmlContent)
  const bookmarks: ParsedBookmark[] = []

  $('a').each((_, el) => {
    const $el = $(el)
    const url = $el.attr('href') || ''
    if (!url || !url.startsWith('http')) return

    const title = $el.text().trim() || 'Untitled'

    // Walk up the tree to find closest parent folder name
    let folder = 'General'
    let current = $el.closest('dl')
    while (current.length) {
      const prev = current.prev()
      const folderHeader = prev.is('h3') ? prev : prev.find('h3')
      if (folderHeader.length) {
        folder = folderHeader.text().trim()
        break
      }
      current = current.parent().closest('dl')
    }

    bookmarks.push({
      url: cleanUrl(url),
      title,
      category: folder,
    })
  })

  return bookmarks
}

/**
 * JSON bookmarks parser (Chrome and Firefox structure)
 */
function parseJsonBookmarks(jsonStr: string): ParsedBookmark[] {
  const bookmarks: ParsedBookmark[] = []
  try {
    const data = JSON.parse(jsonStr)

    function traverse(node: any, currentFolder: string = 'General') {
      if (!node) return

      const type = node.type || (node.uri ? 'url' : node.children ? 'folder' : '')
      const name = node.name || node.title || 'Untitled'
      const url = node.url || node.uri

      if (type === 'url' || url) {
        if (url && typeof url === 'string' && url.startsWith('http')) {
          bookmarks.push({
            url: cleanUrl(url),
            title: name,
            category: currentFolder,
          })
        }
      } else if (node.children && Array.isArray(node.children)) {
        const nextFolder = name && !['root', 'menu', 'toolbar', 'unfiled', 'mobile'].includes(name.toLowerCase()) ? name : currentFolder
        for (const child of node.children) {
          traverse(child, nextFolder)
        }
      } else if (Array.isArray(node)) {
        for (const child of node) {
          traverse(child, currentFolder)
        }
      }
    }

    traverse(data)
  } catch (e) {
    console.error('[JSON Bookmark Parse Error]', e)
  }
  return bookmarks
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

/* GET /api/bookmarks */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { category, is_duplicate, search, sort, order } = req.query

    const whereClause: any = { user_id: userId }

    if (category && typeof category === 'string') {
      whereClause.category = category
    }

    if (is_duplicate !== undefined) {
      whereClause.is_duplicate = is_duplicate === 'true'
    }

    if (search && typeof search === 'string') {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { cleaned_title: { contains: search, mode: 'insensitive' } },
        { url: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ]
    }

    // Sorting
    const orderByClause: any = {}
    const sortBy = typeof sort === 'string' ? sort : 'created_at'
    const sortOrder = order === 'asc' ? 'asc' : 'desc'
    orderByClause[sortBy] = sortOrder

    const bookmarks = await prisma.bookmark.findMany({
      where: whereClause,
      orderBy: orderByClause,
    })

    ok(res, bookmarks)
  } catch (err) {
    console.error('[bookmarks GET]', err)
    fail(res, 'Failed to fetch bookmarks', 'FETCH_FAILED', 500)
  }
})

/* POST /api/bookmarks/import */
const ImportSchema = z.object({
  content: z.string(),
  type: z.enum(['html', 'json']),
})

router.post('/import', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const body = ImportSchema.parse(req.body)

    let parsed: ParsedBookmark[] = []
    if (body.type === 'html') {
      parsed = parseHtmlBookmarks(body.content)
    } else {
      parsed = parseJsonBookmarks(body.content)
    }

    if (parsed.length === 0) {
      fail(res, 'No valid bookmarks found in file', 'NO_BOOKMARKS_FOUND', 400)
      return
    }

    // Fetch existing bookmarks for duplicate detection
    const existing = await prisma.bookmark.findMany({
      where: { user_id: userId },
      select: { url: true },
    })
    const existingUrls = new Set(existing.map((b) => b.url.toLowerCase()))
    const uniqueUrlsInPayload = new Set<string>()

    const toInsert = parsed.map((item) => {
      const normalizedUrl = item.url.toLowerCase()
      const isDuplicate = existingUrls.has(normalizedUrl) || uniqueUrlsInPayload.has(normalizedUrl)
      
      uniqueUrlsInPayload.add(normalizedUrl)

      // Clean generic browser folder names to General, but retain custom folders (like "Speed Dial" or "AI")
      let cat = item.category.trim()
      const lowerCat = cat.toLowerCase()
      if (cat === '' || ['bookmarks', 'bookmarks bar', 'bookmarks menu', 'other bookmarks', 'imported', 'mobile bookmarks', 'unfiled bookmarks'].includes(lowerCat)) {
        cat = 'General'
      }

      return {
        id: randomUUID(),
        user_id: userId,
        url: item.url,
        title: item.title,
        cleaned_title: cleanTitleFallback(item.title),
        category: cat,
        is_duplicate: isDuplicate,
        tags: [],
        priority: 0,
        ai_processed: false,
      }
    })

    // Batch insert using chunked Promise.all to bypass Neon HTTP transactional limitations
    const chunkSize = 40
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize)
      await Promise.all(chunk.map((item) => prisma.bookmark.create({ data: item })))
    }

    sysLog(req, userId, 'Bookmarks Imported', `Imported ${toInsert.length} bookmarks`).catch(() => {})

    ok(res, {
      message: 'Bookmarks imported successfully',
      importedCount: toInsert.length,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      fail(res, 'Invalid input parameters', 'INVALID_PARAMS', 400)
      return
    }
    console.error('[bookmarks IMPORT]', err)
    fail(res, 'Failed to import bookmarks', 'IMPORT_FAILED', 500)
  }
})

const STANDARD_CATEGORIES = [
  'Learning',
  'Career',
  'Developer Tools',
  'Design Assets',
  'Productivity & Utilities',
  'Social & Community',
  'News & Blogs',
  'Entertainment & Media',
  'General'
]

/**
 * Ensures category strictly matches one of the 9 standard categories.
 */
function sanitizeCategory(cat: string | undefined | null): string {
  if (!cat) return 'General'
  const trimmed = cat.trim()
  
  // Direct match check
  if (STANDARD_CATEGORIES.includes(trimmed)) {
    return trimmed
  }
  
  // Case-insensitive check
  const lower = trimmed.toLowerCase()
  for (const std of STANDARD_CATEGORIES) {
    if (std.toLowerCase() === lower) {
      return std
    }
  }
  
  // Common alias mapping
  if (lower === 'productivity' || lower === 'utility' || lower === 'productivity & utility' || lower === 'productivity and utilities' || lower === 'productivity & utilities') {
    return 'Productivity & Utilities'
  }
  if (lower === 'dev tools' || lower === 'developer tool' || lower === 'dev' || lower === 'coding' || lower === 'programming' || lower === 'developer tools') {
    return 'Developer Tools'
  }
  if (lower === 'design' || lower === 'design asset' || lower === 'design assets') {
    return 'Design Assets'
  }
  if (lower === 'social' || lower === 'community' || lower === 'social media' || lower === 'social & community') {
    return 'Social & Community'
  }
  if (lower === 'news' || lower === 'blog' || lower === 'articles' || lower === 'article' || lower === 'docs' || lower === 'documentation' || lower === 'news & blogs') {
    return 'News & Blogs'
  }
  if (lower === 'entertainment' || lower === 'media' || lower === 'videos' || lower === 'youtube' || lower === 'video' || lower === 'entertainment & media') {
    return 'Entertainment & Media'
  }
  if (lower === 'learning' || lower === 'education' || lower === 'study' || lower === 'tutorials' || lower === 'tutorial') {
    return 'Learning'
  }
  if (lower === 'jobs' || lower === 'job' || lower === 'career') {
    return 'Career'
  }
  
  return 'General'
}

/* POST /api/bookmarks/ai-enrich */
const AiEnrichSchema = z.object({
  ids: z.array(z.string()),
})

router.post('/ai-enrich', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const body = AiEnrichSchema.parse(req.body)

    const bookmarks = await prisma.bookmark.findMany({
      where: {
        id: { in: body.ids },
        user_id: userId,
      },
      select: {
        id: true,
        title: true,
        url: true,
        category: true,
      },
    })

    if (bookmarks.length === 0) {
      ok(res, { updated: 0, bookmarks: [] })
      return
    }

    // Build batch payload for AI
    const listPayload = bookmarks.map((b) => ({
      id: b.id,
      title: b.title,
      url: b.url,
      current_folder: b.category,
    }))

    const systemPrompt = `You are a high-performance, automated bookmark organizer.
Your task is to organize a batch of browser bookmarks with extreme precision (95%+ accuracy). 

For each bookmark, you must resolve:
1. "cleaned_title": The REAL name of the website/service/article (e.g., "GitHub", "MDN Web Docs", "Stack Overflow", "Vite", "Google Scholar") by removing noise, generic page suffixes (like "Login", "Welcome", "Home", "Index of", or site slogans). Keep it short and readable.
2. "category": Classify the link into one of the 9 STRICT, MANDATORY categories listed below.
   - You MUST choose exactly one of these 9 category names. No variations, no subcategories, and no custom names.
   - Standard categories:
     * "Learning": Official software/framework docs (e.g., react.dev, tailwindcss.com, MDN, nextjs.org), programming tutorials, courses, research papers, study guides, textbooks, educational blogs, or interactive training sites.
     * "Career": Job boards (LinkedIn jobs, Indeed, Glassdoor), portfolios, resumes, job application trackers, interview preparation sites (e.g., LeetCode, HackerRank), or company career portals.
     * "Developer Tools": Cloud consoles (AWS, GCP, Supabase), hosting platforms (Vercel, Netlify), code hosting registries (GitHub, GitLab, npm registry), database consoles, API clients, testing suites, or programming utilities/IDE configs.
     * "Design Assets": Figma files, icons libraries, CSS styling templates, color palettes, web fonts, web design showcases, stock graphic files.
     * "Productivity & Utilities": Task planners, note-taking boards, converters, JSON formatters, text editors, online calculators, timers, regex helpers.
     * "Social & Community": Online communities (Reddit threads, Discord servers, Slack teams), tech question boards (Stack Overflow, Stack Exchange), community forums (Dev.to).
     * "News & Blogs": Technological newsletters, news feeds, Medium articles, Substack publications, individual tech developer journals.
     * "Entertainment & Media": Leisure videos (YouTube links), music, games, streaming assets, recreational social media.
     * "General": Default category. Use this only if the link cannot be mapped to any of the 8 categories above.
   - Do NOT create other category names. Map every bookmark's input 'current_folder' and content into one of these 9 categories.
3. "tags": An array of 1 to 4 lowercase keywords describing the domain/topic (e.g., ["react", "frontend", "docs"], ["internships", "jobs"], ["database", "backend"]).
4. "priority": A priority score from 1 to 5 based on absolute utility:
   - 5 (Critical Asset): Primary official documentations (e.g., React, NextJS, TypeScript, Tailwind), major active job boards (LinkedIn, LeetCode), core repositories (e.g., active team GitHub repos), or main day-to-day apps (e.g., Figma).
   - 4 (High Importance): Secondary libraries docs, useful reference cheat sheets, common developer tools (e.g., npm package, hosting panel), highly relevant tutorials.
   - 3 (Active Reference / Standard Tool): Stack Overflow pages, helpful Reddit threads, widely-read tech newsletters, note-taking apps, task boards.
   - 2 (Casual Read / Reference): Secondary tools, general articles, YouTube video tutorials, blogs, design inspirations.
   - 1 (Low Interest / Archive): Leisure links, games, old news, casual forums, or miscellaneous landing pages.

CRITICAL DATA INTEGRITY & ANTI-HALLUCINATION RULES:
1. NEVER hallucinate or invent new bookmarks. Only output results for the exact 'id' values provided in the input.
2. NEVER drop, skip, or filter out any bookmarks from the input list. Every input item must have a corresponding output item in the array.
3. NEVER modify the ID. The 'id' field in the output MUST exactly match the 'id' field from the input.
4. If a bookmark's title/URL is too obscure or cannot be classified confidently, assign it to the 'General' category with an empty tags array, but DO NOT skip it or invent details.
5. Work with 99% precision: Do not include any extra JSON fields, markdown formatting, or explanatory text. Return only the raw JSON array.

Input JSON format:
An array of objects containing { id, title, url, current_folder }

Output format:
Return ONLY a valid JSON array of objects. Do NOT wrap it in markdown code blocks. No conversational text.
Example Output:
[
  {
    "id": "cuid-1",
    "cleaned_title": "Clean Name",
    "category": "Learning",
    "tags": ["css", "frontend"],
    "priority": 4
  }
]
`

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(listPayload) },
    ]

    let contentStr = await callLLM(messages, {
      temperature: 0.1,
      jsonMode: true,
    })

    // Cleanup potential code blocks
    if (contentStr.includes('```')) {
      contentStr = contentStr.replace(/```json/g, '').replace(/```/g, '').trim()
    }

    let parsedResults: any[] = []
    try {
      const parsedData = JSON.parse(contentStr)
      parsedResults = Array.isArray(parsedData) ? parsedData : (parsedData.bookmarks || parsedData.results || [])
    } catch (parseErr) {
      console.error('[bookmarks AI ENRICH] JSON Parse error of content:', contentStr)
      fail(res, 'Failed to parse AI output', 'AI_PARSE_ERROR', 500)
      return
    }

    const updatedBookmarks: any[] = []

    // Update in database sequentially (Neon handles sequential simple writes cleanly)
    for (const result of parsedResults) {
      if (!result.id) continue
      try {
        const up = await prisma.bookmark.update({
          where: { id: result.id, user_id: userId },
          data: {
            cleaned_title: result.cleaned_title || undefined,
            category: sanitizeCategory(result.category),
            tags: Array.isArray(result.tags) ? result.tags : undefined,
            priority: typeof result.priority === 'number' ? result.priority : undefined,
            ai_processed: true,
          },
        })
        updatedBookmarks.push(up)
      } catch (upErr) {
        console.error(`Failed to update bookmark ${result.id}:`, upErr)
      }
    }

    sysLog(req, userId, 'Bookmarks AI Processed', `Processed ${updatedBookmarks.length} bookmarks with AI`).catch(() => {})

    ok(res, {
      message: `Enriched ${updatedBookmarks.length} bookmarks`,
      bookmarks: updatedBookmarks,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      fail(res, 'Invalid input parameters', 'INVALID_PARAMS', 400)
      return
    }
    console.error('[bookmarks AI ENRICH]', err)
    fail(res, 'Failed to process bookmarks with AI', 'SERVER_ERROR', 500)
  }
})

/* PUT /api/bookmarks/:id */
const UpdateBookmarkSchema = z.object({
  title: z.string().optional(),
  cleaned_title: z.string().optional(),
  url: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.number().min(0).max(5).optional(),
  is_duplicate: z.boolean().optional(),
})

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const bookmarkId = String(req.params.id)
    const body = UpdateBookmarkSchema.parse(req.body)

    const existing = await prisma.bookmark.findFirst({
      where: { id: bookmarkId, user_id: userId },
    })

    if (!existing) {
      fail(res, 'Bookmark not found', 'NOT_FOUND', 404)
      return
    }

    const updated = await prisma.bookmark.update({
      where: { id: bookmarkId },
      data: body,
    })

    ok(res, updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      fail(res, 'Invalid inputs', 'INVALID_PARAMS', 400)
      return
    }
    console.error('[bookmarks PUT]', err)
    fail(res, 'Failed to update bookmark', 'SERVER_ERROR', 500)
  }
})

/**
 * Automatically calculate priority score (1-5) based on usage count and recency patterns
 */
function calculateAutomaticPriority(clickCount: number, clickedAt: Date): number {
  if (clickCount === 0) return 0
  
  // Base points from frequency of access
  let score = clickCount
  
  // Recency bonus: reward immediate active items
  const hoursSinceClick = (Date.now() - clickedAt.getTime()) / (1000 * 60 * 60)
  if (hoursSinceClick < 12) {
    score += 4   // High hot factor
  } else if (hoursSinceClick < 48) {
    score += 2   // Active/warm factor
  } else if (hoursSinceClick < 168) {
    score += 1   // Weekly check-in factor
  }

  if (score >= 12) return 5
  if (score >= 8) return 4
  if (score >= 4) return 3
  if (score >= 2) return 2
  return 1
}

/* POST /api/bookmarks/:id/click */
router.post('/:id/click', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const bookmarkId = String(req.params.id)

    const existing = await prisma.bookmark.findFirst({
      where: { id: bookmarkId, user_id: userId },
    })

    if (!existing) {
      fail(res, 'Bookmark not found', 'NOT_FOUND', 404)
      return
    }

    const nextClickCount = existing.click_count + 1
    const nextClickedAt = new Date()
    const computedPriority = calculateAutomaticPriority(nextClickCount, nextClickedAt)

    const updated = await prisma.bookmark.update({
      where: { id: bookmarkId },
      data: {
        click_count: nextClickCount,
        clicked_at: nextClickedAt,
        priority: computedPriority,
      },
    })

    ok(res, updated)
  } catch (err) {
    console.error('[bookmarks CLICK]', err)
    fail(res, 'Failed to record click', 'SERVER_ERROR', 500)
  }
})

/* DELETE /api/bookmarks/batch-delete */
const BatchDeleteSchema = z.object({
  ids: z.array(z.string()),
})

router.post('/batch-delete', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const body = BatchDeleteSchema.parse(req.body)

    const result = await prisma.bookmark.deleteMany({
      where: {
        id: { in: body.ids },
        user_id: userId,
      },
    })

    sysLog(req, userId, 'Bookmarks Batch Deleted', `Deleted ${result.count} bookmarks`).catch(() => {})

    ok(res, { message: 'Bookmarks deleted successfully', count: result.count })
  } catch (err) {
    if (err instanceof z.ZodError) {
      fail(res, 'Invalid ids', 'INVALID_PARAMS', 400)
      return
    }
    console.error('[bookmarks BATCH DELETE]', err)
    fail(res, 'Failed to delete bookmarks', 'SERVER_ERROR', 500)
  }
})

/* DELETE /api/bookmarks/:id */
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const bookmarkId = String(req.params.id)

    const existing = await prisma.bookmark.findFirst({
      where: { id: bookmarkId, user_id: userId },
    })

    if (!existing) {
      fail(res, 'Bookmark not found', 'NOT_FOUND', 404)
      return
    }

    await prisma.bookmark.delete({
      where: { id: bookmarkId },
    })

    sysLog(req, userId, 'Bookmark Deleted', `Deleted bookmark: ${existing.title}`).catch(() => {})

    ok(res, { message: 'Bookmark deleted successfully' })
  } catch (err) {
    console.error('[bookmarks DELETE]', err)
    fail(res, 'Failed to delete bookmark', 'SERVER_ERROR', 500)
  }
})

/* POST /api/bookmarks/rename-category */
const RenameCategorySchema = z.object({
  oldCategoryName: z.string(),
  newCategoryName: z.string(),
})

router.post('/rename-category', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { oldCategoryName, newCategoryName } = RenameCategorySchema.parse(req.body)

    const result = await prisma.bookmark.updateMany({
      where: {
        user_id: userId,
        category: oldCategoryName,
      },
      data: {
        category: newCategoryName,
      },
    })

    sysLog(req, userId, 'Bookmark Category Renamed', `Renamed category from "${oldCategoryName}" to "${newCategoryName}" for ${result.count} bookmarks`).catch(() => {})

    ok(res, { message: 'Category renamed successfully', count: result.count })
  } catch (err) {
    if (err instanceof z.ZodError) {
      fail(res, 'Invalid parameters', 'INVALID_PARAMS', 400)
      return
    }
    console.error('[bookmarks RENAME CATEGORY]', err)
    fail(res, 'Failed to rename category', 'SERVER_ERROR', 500)
  }
})

export default router
