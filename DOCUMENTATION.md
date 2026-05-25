# Zenith — Ultra-Extensive Project Documentation

> **Generated**: 2026-03-22 | **Version**: 3.0.0 | **Status**: Production (Public)
> **Live URL**: https://zenith.kuberbassi.com | **Deployment**: Vercel (bom1 region)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Folder Structure Analysis](#3-folder-structure-analysis)
4. [Database Schema (Prisma)](#4-database-schema-prisma)
5. [Backend API — File-by-File Analysis](#5-backend-api--file-by-file-analysis)
6. [Frontend — File-by-File Analysis](#6-frontend--file-by-file-analysis)
7. [Legacy Code Analysis](#7-legacy-code-analysis)
8. [Scripts & Utilities Analysis](#8-scripts--utilities-analysis)
9. [Configuration Files Analysis](#9-configuration-files-analysis)
10. [Build Logs Analysis](#10-build-logs-analysis)
11. [🔴 Security Audit](#11--security-audit)
12. [🟡 SEO Analysis & Improvements](#12--seo-analysis--improvements)
13. [🟠 Performance & Speed Issues](#13--performance--speed-issues)
14. [🔵 Logic Errors & Broken Functionality](#14--logic-errors--broken-functionality)
15. [🟣 Folder Structure Issues](#15--folder-structure-issues)
16. [🟢 Feature Recommendations](#16--feature-recommendations)
17. [📋 Priority Action Items](#17--priority-action-items)

---

## 1. Project Overview

**Zenith** is a full-stack academic management platform built for IPU (Indraprastha University) students. It provides:

- **Attendance Tracking** — Mark, edit, delete attendance with substitution support, calendar view, bunk-guard calculations
- **IPU Results Scraping** — Automated login to IPU exam portal with CAPTCHA handling, result fetching, SGPA/CGPA calculations
- **AI Academic Assistant** — Groq LLM-powered chatbot with full academic context (attendance, results, schedule, skills)
- **Timetable Management** — Weekly schedule with slot CRUD, subject linking, legacy ID repair
- **Dashboard & Analytics** — KPIs, streak tracking, day-of-week analysis, heatmaps, momentum scores
- **Course & Skill Tracking** — Manual online courses, skill inventory
- **Data Management** — Full export/import with backup/restore system
- **Profile Management** — Google OAuth, profile picture upload with Sharp compression, biometric registration
- **Notice Scraper** — IPU notice board scraping with categorization and caching
- **PWA Support** — Service worker, auto-update, push notifications, offline capability

---

## 2. Architecture & Tech Stack

### Current Architecture (v3)
```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   api-node (Express)  │────▶│  Neon PostgreSQL│
│   Vite + React  │     │   TypeScript + Prisma │     │  (Serverless)   │
│   TailwindCSS   │     │   Vercel Serverless   │     │                 │
│   PWA           │     │                       │     │                 │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                              │         │
                              ▼         ▼
                        ┌─────────┐ ┌─────────┐
                        │ Groq AI │ │ IPU     │
                        │ LLM API │ │ Portal  │
                        └─────────┘ └─────────┘
```

### Tech Stack Detail

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend Framework** | React | 19.2.0 |
| **Build Tool** | Vite | 7.2.4 |
| **Styling** | TailwindCSS | 3.4.17 |
| **State Management** | React Context + TanStack Query | 5.x |
| **Charts** | Chart.js + Recharts | 4.5 / 3.6 |
| **Animations** | Framer Motion | 12.x |
| **3D** | Three.js + R3F | 0.183 |
| **PDF Generation** | jsPDF + jspdf-autotable | 4.2 / 5.0 |
| **Backend Runtime** | Node.js + Express | 4.21 |
| **Language** | TypeScript | 5.8-5.9 |
| **ORM** | Prisma (Neon HTTP adapter) | 7.4 |
| **Database** | PostgreSQL (Neon Serverless) | — |
| **Auth** | Google OAuth 2.0 + JWT | — |
| **AI** | Groq API (llama-3.3-70b) | — |
| **Scraping** | Cheerio + Axios | 1.2 / 1.13 |
| **Image Processing** | Sharp | 0.34 |
| **Validation** | Zod | 3.24 |
| **Security** | Helmet + CORS + Rate Limiting | — |
| **Deployment** | Vercel (Serverless Functions) | — |
| **PWA** | VitePWA + Workbox | 1.2 |
| **Analytics** | Vercel Analytics | 1.6 |

---

## 3. Folder Structure Analysis

```
zenith/                          # Monorepo root
├── api/                          # Vercel serverless catch-all proxy
│   └── [[...path]].js           # 173B — Routes all /api/* to api-node
├── api-node/                     # ⭐ Node.js/Express API (PRIMARY BACKEND)
│   ├── prisma/
│   │   └── schema.prisma        # 6.5KB — 10 models, 2 enums
│   ├── prisma.config.ts         # 374B — Prisma config
│   ├── scripts/
│   │   ├── inspect-db.ts        # 2KB — DB inspection utility
│   │   ├── smoke-backend.mjs    # 6.5KB — API smoke test suite
│   │   ├── test-ipu-connectivity.ts  # 2.7KB
│   │   └── test-ipu-parallel.ts # 2.5KB
│   ├── src/
│   │   ├── app.ts               # 5.7KB — Express app setup (142 lines)
│   │   ├── index.ts             # 456B — Server entry point
│   │   ├── vercel.ts            # 505B — Vercel serverless handler
│   │   ├── config/
│   │   │   ├── env.ts           # 605B — Environment validation
│   │   │   └── prisma.ts        # 607B — Prisma client singleton
│   │   ├── generated/prisma/    # Auto-generated Prisma client
│   │   ├── lib/
│   │   │   └── calculations.ts  # 6.5KB — Attendance & grade calculators
│   │   ├── middleware/
│   │   │   ├── auth.ts          # 2.4KB — JWT auth with LRU cache
│   │   │   └── platform.ts     # 1.2KB — Client platform detection
│   │   ├── routes/              # ⭐ 14 route files (~5000 lines total)
│   │   │   ├── academic.ts     # 33KB (670 lines) — Subjects, results, courses
│   │   │   ├── ai.ts           # 19KB (409 lines) — AI chat with context
│   │   │   ├── attendance.ts   # 28KB (647 lines) — Marking, logs, calendar
│   │   │   ├── auth.ts         # 4KB (126 lines) — Google OAuth + JWT
│   │   │   ├── compat.ts       # 6.4KB (169 lines) — Flask backward compat
│   │   │   ├── dashboard.ts    # 13.5KB (327 lines) — KPIs, analytics
│   │   │   ├── data.ts         # 29KB (621 lines) — Export/import/backup
│   │   │   ├── ipu.ts          # 56KB (1384 lines) — IPU portal scraper
│   │   │   ├── profile.ts      # 17KB (335 lines) — User profile, prefs
│   │   │   ├── scraper.ts      # 6.4KB (213 lines) — Notice scraper
│   │   │   ├── skills.ts       # 3.8KB (95 lines) — Skill CRUD
│   │   │   ├── subjects.ts     # 2.9KB (90 lines) — Subject CRUD
│   │   │   ├── timetable.ts    # 15.5KB (371 lines) — Schedule management
│   │   │   └── v1.ts           # 2KB (51 lines) — API version router
│   │   ├── services/
│   │   │   ├── ipuClient.ts    # 2.7KB — IPU HTTP client
│   │   │   └── ipuResultsFetcher.service.ts # 10KB — Result parser
│   │   ├── types/
│   │   │   └── index.ts        # 1.5KB — Shared types
│   │   └── utils/
│   │       ├── response.ts     # 2.2KB — API envelope helpers
│   │       ├── userFilter.ts   # 541B
│   │       └── viewCache.ts    # 2.4KB — Per-user view caching
│   ├── Dockerfile              # 383B
│   ├── package.json            # 1.5KB — 20 deps, 12 devDeps
│   └── tsconfig.json           # 381B
├── frontend/                    # ⭐ Vite + React SPA (PRIMARY FRONTEND)
│   ├── public/
│   │   ├── robots.txt          # 80B
│   │   ├── sitemap.xml         # 1.6KB
│   │   ├── sw.js               # 3.2KB — Custom service worker
│   │   ├── version.json        # 117B
│   │   └── manifest.json.bak   # 394B — Backup manifest
│   ├── src/
│   │   ├── App.tsx             # 7.9KB (257 lines) — App router + providers
│   │   ├── main.tsx            # 245B — Entry point
│   │   ├── index.css           # 6.5KB — Global styles
│   │   ├── App.css             # 606B
│   │   ├── queryClient.ts      # 338B — TanStack Query config
│   │   ├── serviceWorker.ts    # 1.2KB — SW registration
│   │   ├── components/
│   │   │   ├── ParticleCanvas.tsx    # 4.1KB — 3D particle background
│   │   │   ├── ScheduleGrid.tsx     # 9.6KB — Timetable grid
│   │   │   ├── dashboard/           # Dashboard sub-components
│   │   │   ├── layout/              # AppLayout, navigation
│   │   │   ├── modals/              # Modal components
│   │   │   ├── profile/             # Profile UI components
│   │   │   └── ui/                  # Reusable UI components
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx      # 5KB — Auth state + Google login
│   │   │   ├── SemesterContext.tsx  # 2.3KB — Semester selection
│   │   │   └── ThemeContext.tsx     # 2.3KB — Dark/light theme
│   │   ├── hooks/
│   │   │   ├── useAnalytics.ts      # 1.2KB
│   │   │   ├── useAutoUpdate.ts     # 2.2KB — Auto-reload on new version
│   │   │   ├── useCalculations.ts   # 2.5KB
│   │   │   ├── useDashboard.ts      # 4.2KB
│   │   │   ├── useKeyboardShortcuts.ts # 4.9KB
│   │   │   ├── useNotices.ts        # 948B
│   │   │   ├── usePageMeta.ts       # 1.7KB
│   │   │   └── useUnsavedChanges.ts # 1.2KB
│   │   ├── lib/
│   │   │   └── calculationEngine.ts # 3.3KB
│   │   ├── pages/
│   │   │   ├── Analytics.tsx        # 20.6KB
│   │   │   ├── AttendanceTrendChart.tsx # 2.8KB
│   │   │   ├── Calendar.tsx         # 12KB
│   │   │   ├── Courses.tsx          # 20.4KB
│   │   │   ├── Dashboard.tsx        # 29.9KB ⚠️ Very large
│   │   │   ├── DashboardRadarChart.tsx # 2.4KB
│   │   │   ├── Login.tsx            # 6.7KB
│   │   │   ├── Notifications.tsx    # 10.3KB
│   │   │   ├── Practicals.tsx       # 14.6KB
│   │   │   ├── PrivacyPolicy.tsx    # 6.6KB
│   │   │   ├── Results.tsx          # 73.4KB ⚠️ Extremely large
│   │   │   ├── Settings.tsx         # 35.4KB ⚠️ Very large
│   │   │   ├── SkillTracker.tsx     # 14KB
│   │   │   ├── TermsOfService.tsx   # 5.9KB
│   │   │   └── TimeTable.tsx        # 21KB
│   │   ├── services/
│   │   │   ├── api.ts               # 3.3KB — Axios instance + interceptors
│   │   │   ├── attendance.service.ts # 23.3KB
│   │   │   ├── attendanceService.ts # 653B ⚠️ Duplicate?
│   │   │   ├── auth.service.ts      # 2.4KB
│   │   │   ├── dashboardService.ts  # 234B
│   │   │   ├── google-classroom.service.ts # 3.4KB
│   │   │   ├── resume.service.ts    # 2.9KB
│   │   │   └── skills.service.ts    # 796B
│   │   ├── types/
│   │   │   └── index.ts            # 5.4KB — TypeScript interfaces
│   │   └── utils/
│   │       ├── calculations.ts      # 1.9KB
│   │       ├── cn.ts                # 123B — className utility
│   │       ├── debounce.ts          # 338B
│   │       ├── downloadResultsPdf.ts # 14.3KB
│   │       ├── formatters.ts        # 903B
│   │       └── pushNotifications.ts # 4.1KB
│   ├── index.html              # 2.7KB — SEO meta tags
│   ├── vite.config.ts          # 3.5KB — PWA, proxy, code-splitting
│   ├── tailwind.config.js      # 3.8KB
│   ├── package.json            # 1.8KB — 24 deps, 16 devDeps
│   └── Dockerfile              # 1.4KB
├── legacy/                      # ⚠️ LEGACY CODE (Python + Next.js + Expo)
│   ├── api/                     # Python Flask API (DEPRECATED)
│   │   ├── api.py              # 140KB ⚠️ MASSIVE monolithic file
│   │   ├── __init__.py         # 14KB — Flask app factory
│   │   ├── auth.py             # 12KB
│   │   ├── calculations.py     # 7KB
│   │   ├── calculations_v2.py  # 13KB
│   │   ├── database.py         # 2.7KB
│   │   ├── decorators.py       # 1.8KB
│   │   ├── scraper.py          # 9.4KB
│   │   ├── security_middleware.py # 5.7KB
│   │   ├── rate_limiter.py     # 893B
│   │   ├── routes_attendance.py # 4.5KB
│   │   ├── routes_calculations.py # 5.5KB
│   │   ├── migrate_schedule.py # 3.9KB
│   │   └── requirements.txt    # 345B
│   ├── web/                     # Next.js web app (DEPRECATED)
│   │   ├── build*.log          # 6 log files totaling ~21KB ⚠️
│   │   ├── .env.local          # 403B ⚠️ Should not be in repo
│   │   ├── package.json        # 1KB
│   │   └── src/                # Next.js source
│   ├── mobile/                  # Expo/React Native app
│   │   ├── App.js              # 13.6KB
│   │   ├── google-services.json # 2.4KB ⚠️ Firebase config exposed
│   │   ├── app.json            # 2KB
│   │   └── src/                # Mobile source
│   ├── dev.py                  # 330B
│   ├── index.py                # 85B
│   └── run.py                  # 1.2KB
├── scripts/                     # Utility/maintenance scripts
│   ├── check_primary_tt.py     # 738B
│   ├── check_sem2_tt.py        # 1.2KB
│   ├── fix_regressions.py      # 12.8KB
│   ├── inspect_enums.py        # 1.3KB
│   ├── restore_s1_logs.py      # 5.8KB
│   ├── setup-mobile.sh         # 6.4KB
│   ├── test_db.py              # 1.2KB
│   ├── verify_data.py          # 2KB
│   └── verify_final.py         # 1.4KB
├── vercel.json                  # 2KB — Deployment config
├── docker-compose.yml           # 560B
├── Dockerfile                   # 400B (root)
├── package.json                 # 462B (root workspace)
├── requirements.txt             # 310B (root Python deps)
├── app.json                     # 190B
├── eas.json                     # 344B
├── .gitignore                   # 2.6KB
├── .dockerignore                # 134B
├── .easignore                   # 106B
├── .vercelignore                # 110B
├── LICENSE                      # 1KB (MIT)
└── README.md                    # 1.7KB
```

### File Count Summary
| Directory | Files | Total Size |
|-----------|-------|------------|
| `api-node/src/` | 24 source files | ~240KB |
| `frontend/src/` | 50+ source files | ~400KB |
| `legacy/api/` | 18 files | ~240KB |
| `legacy/web/` | 14 files | ~270KB |
| `legacy/mobile/` | 11+ files | ~360KB |
| `scripts/` | 9 files | ~33KB |
| Root configs | 15 files | ~10KB |

---

## 4. Database Schema (Prisma)

**File**: `api-node/prisma/schema.prisma` (245 lines)

### Models

| Model | Purpose | Key Fields | Indexes |
|-------|---------|------------|---------|
| `User` | User accounts | google_id, email, name, picture, enrollment, semester, thresholds, biometrics | @unique on google_id, email |
| `Subject` | Academic subjects | name, code, professor, semester, attended, total, target, practicals (JSON), assignments (JSON) | user_id, user_id+semester, user_id+name |
| `AttendanceLog` | Attendance records | subject_id, date, status (enum), type, substituted_by | @@unique on [user_id, subject_id, date, type] |
| `SemesterResult` | IPU exam results | semester, subjects (JSON), sgpa, student_info (JSON), source (enum) | user_id+semester |
| `ManualCourse` | Online courses | name, platform, progress, url, extra (JSON) | user_id |
| `Timetable` | Weekly schedule | semester, schedule (JSON), periods (JSON) | user_id+semester |
| `SystemLog` | Audit trail | action, description, ip, user_agent | user_id+timestamp |
| `UserBackup` | Data backups | backup_type, data (JSON), expires_at | user_id, expires_at |
| `UserPreference` | User settings | preferences (JSON) | @unique on user_id |
| `Skill` | Skill tracker | name, category, level, progress | user_id |

### Enums
- `AttendanceStatus`: present, absent, late, approved_medical, medical, duty, substituted, cancelled
- `ResultSource`: manual, ipu_scraper

### Schema Issues Found
1. ⚠️ `SemesterResult` changed from `@@unique` to `@@index` on [user_id, semester] — allows duplicate semester results per user (comment says "to preserve historical duplicates" but this can cause data integrity issues)
2. ⚠️ `Timetable` same issue — `@@index` instead of `@@unique` allows multiple timetables for same user+semester
3. ⚠️ `AttendanceLog.date` is `String` not `DateTime` — prevents proper date queries and sorting at the DB level
4. ⚠️ No index on `Subject.code` — code-based lookups are common in result merging
5. ⚠️ `User.biometrics` stored as JSON with no validation schema

---

## 5. Backend API — File-by-File Analysis

### `src/app.ts` (142 lines) — Express App Setup
- ✅ **Good**: Helmet security headers, CORS with configurable origins, compression, rate limiting
- ✅ **Good**: API versioning architecture (v1 canonical, unversioned alias, Flask compat)
- ✅ **Good**: Strict rate limiter (10 req/min) on IPU and auth routes
- ⚠️ **Issue**: Global rate limit is 100/min which may be too generous for a public API
- ⚠️ **Issue**: `trust proxy` set to `1` — correct for single-proxy but should be validated for the deployment environment
- ⚠️ **Issue**: Body parser limit is 10MB — very generous, could be exploited for memory exhaustion

### `src/config/env.ts` (19 lines) — Environment Variables
- ✅ **Good**: Validates required env vars at startup
- ⚠️ **Issue**: `GROQ_API_KEY` defaults to empty string instead of failing — silent degradation
- ⚠️ **Issue**: No validation on `PORT` being a valid number
- 🔴 **Missing**: No `ALLOWED_ORIGINS` validation — accepts any comma-separated string

### `src/config/prisma.ts` (21 lines) — Database Client
- ✅ **Good**: Global singleton pattern prevents connection leaks
- ✅ **Good**: Development-only caching to globalThis
- ⚠️ **Issue**: Uses `PrismaNeonHttp` adapter which doesn't support interactive transactions (documented in past conversations as causing bugs)

### `src/middleware/auth.ts` (72 lines) — JWT Authentication
- ✅ **Good**: LRU cache (500 entries, 60s TTL) for JWT verification — great for performance
- ✅ **Good**: Cache invalidation on logout
- ⚠️ **Issue**: JWT tokens have 30-day expiration with no refresh token mechanism
- 🔴 **Security**: Cached user object can contain stale permissions for up to 60 seconds after changes
- 🔴 **Security**: No JWT audience or issuer validation

### `src/middleware/platform.ts` (44 lines) — Client Detection
- ✅ **Good**: Explicit header priority over User-Agent sniffing
- ⚠️ **Issue**: X-Platform header is not validated/sanitized — trusts client input

### `src/routes/auth.ts` (126 lines) — Authentication
- ✅ **Good**: Google ID token verification with audience check
- ✅ **Good**: Dual lookup (email → google_id) for user resolution
- ⚠️ **Issue**: `/debug_db` route exists (dev-only guarded) — should be completely removed in production builds
- 🔴 **Security**: No CSRF protection on POST endpoints
- 🔴 **Security**: `email!` non-null assertion — if Google returns no email, this crashes

### `src/routes/ipu.ts` (1384 lines) — IPU Portal Scraper ⚠️ LARGEST FILE
- ✅ **Good**: Session management with LRU cache (100 sessions, 30min TTL)
- ✅ **Good**: CAPTCHA rate limiting (1 attempt per captcha, 2 failure lockout)
- ✅ **Good**: Session state persistence to DB
- ✅ **Good**: Robust result merging with completeness scoring
- ⚠️ **Issue**: `rejectUnauthorized: false` on HTTPS agent — disables SSL verification for IPU portal
- ⚠️ **Issue**: File is 1384 lines — should be split into service/helper modules
- ⚠️ **Issue**: `detectAccountLockout` uses regex on HTML — fragile if portal changes
- 🔴 **Security**: User credentials (enrollment/password) are processed server-side — ensure they're never logged
- 🔴 **Security**: Password is hashed client-side with `SHA256(password + captcha)` — if captcha is compromised, password is exposed

### `src/routes/ai.ts` (409 lines) — AI Chat
- ✅ **Good**: Full academic context builder with attendance, results, timetable, skills
- ✅ **Good**: Message history capped at 20, message length capped at 2000
- ✅ **Good**: Detailed system prompt with operational directives
- ⚠️ **Issue**: Context includes ALL user data in every request — could exceed token limits for heavy users
- ⚠️ **Issue**: No rate limiting specific to AI chat (expensive API calls)
- 🔴 **Security**: Full user data (attendance, results, personal info) sent to third-party API (Groq)

### `src/routes/attendance.ts` (647 lines) — Attendance Management
- ✅ **Good**: Compound unique key prevents duplicate attendance logs
- ✅ **Good**: Delta-based counter updates (atomic increment/decrement)
- ✅ **Good**: Complex substitution logic with companion log management
- ✅ **Good**: View caching with invalidation on mutations
- ⚠️ **Issue**: `getSlotType` and `scoreScheduleBySubjects` are duplicated across 3 files (attendance.ts, ai.ts, timetable.ts)
- ⚠️ **Issue**: `today()` uses server timezone, not user's timezone — attendance dates may be wrong for users in different timezones

### `src/routes/academic.ts` (670 lines) — Academic Management
- ✅ **Good**: Full CRUD for subjects with Zod validation
- ✅ **Good**: Results sync from IPU scraper + manual entry
- ✅ **Good**: CGPA/SGPA calculation with grade scale
- ⚠️ **Issue**: `isMeaningfulValue` and `mergePreferredRecord` duplicated from `ipu.ts`
- ⚠️ **Issue**: ManualCourse bulk POST deletes all courses then recreates — not atomic, data loss risk on failure

### `src/routes/dashboard.ts` (327 lines) — Dashboard & Analytics
- ✅ **Good**: Rich KPIs (streak, consistency, momentum, achievement level)
- ✅ **Good**: Day-of-week analytics with weekday filtering
- ✅ **Good**: Notification generation from attendance thresholds
- ⚠️ **Issue**: Streak calculation only works for consecutive weekdays — doesn't account for holidays/breaks

### `src/routes/data.ts` (621 lines) — Data Management
- ✅ **Good**: Auto-backup before import, 30-day backup retention
- ✅ **Good**: Rate limiting on delete operations (5-min cooldown)
- ✅ **Good**: Backup requirement before data wipe (backup_id validation)
- ✅ **Good**: ID remapping during import with subject reference repair
- ⚠️ **Issue**: Import is NOT transactional — partial imports can leave data in inconsistent state
- ⚠️ **Issue**: `createInBatches` runs 25 parallel creates — can overwhelm Neon serverless connection pool
- 🔴 **Security**: Export includes full user data — should be encrypted or require re-authentication

### `src/routes/profile.ts` (335 lines) — Profile Management
- ✅ **Good**: Profile picture compression to WebP, 256x256, under 50KB
- ✅ **Good**: Bidirectional sync between User model and UserPreference
- ⚠️ **Issue**: Profile picture stored as base64 in database — inefficient, bloats user records
- ⚠️ **Issue**: Biometric registration stores raw public key in JSON — no format validation

### `src/routes/timetable.ts` (371 lines) — Timetable Management
- ✅ **Good**: Legacy ID repair using attendance log subject names
- ✅ **Good**: Best-match timetable resolution when exact semester match fails
- ⚠️ **Issue**: Schedule stored as JSON blob — no schema validation on slot structure
- ⚠️ **Issue**: Auto-repair persisted on read — side effect in GET request

### `src/routes/scraper.ts` (213 lines) — Notice Scraper
- ✅ **Good**: In-memory cache with 10-minute TTL, background refresh
- ✅ **Good**: Category classification with keyword matching
- ⚠️ **Issue**: Cache is in-memory — lost on serverless cold starts (Vercel)
- ⚠️ **Issue**: No rate limiting on the scraper — could be used to DDoS the IPU website
- 🔴 **Issue**: Scrapes `http://` not `https://` — IPU portal URL is unencrypted

### `src/routes/compat.ts` (169 lines) — Flask Compatibility
- ✅ **Good**: Clean URL rewriting system for backward compatibility
- ⚠️ **Issue**: `pending_leaves`, `unresolved_substitutions` are stub endpoints returning empty arrays
- ⚠️ **Issue**: `mark_all_attendance` uses sequential DB queries in a loop — N+1 query pattern

### `src/utils/viewCache.ts` (estimated ~60 lines) — View Caching
- ✅ **Good**: Per-user caching keyed by endpoint + parameters
- ⚠️ **Issue**: Uses UserPreference table for caching — pollutes user preferences with cache data

### `src/utils/response.ts` (81 lines) — API Response Helpers
- ✅ **Good**: Consistent API envelope format across all endpoints
- ✅ **Good**: Cache-Control header support with configurable TTL
- ✅ **Good**: Pagination helper utilities

### `src/services/ipuResultsFetcher.service.ts` (estimated ~250 lines) — IPU Results Parser
- Parses HTML response from IPU exam portal
- Extracts subject-wise marks, grades, SGPA
- Handles pending results and multiple exam sessions

### `src/lib/calculations.ts` (211 lines) — Calculation Engine
- ✅ **Good**: Comprehensive bunk-guard calculator with edge cases (100% target, zero classes)
- ✅ **Good**: IPU grade scale (O to F) with grade point mapping
- ✅ **Good**: CGPA calculated as weighted average across semesters (credit-weighted)
- ⚠️ **Issue**: `maxMarks` hardcoded to 100 in `calculateSubjectResult` — doesn't account for variable max marks

---

## 6. Frontend — File-by-File Analysis

### `src/App.tsx` (257 lines) — Application Root
- ✅ **Good**: Lazy loading for heavy pages (Analytics, Calendar, Results, etc.)
- ✅ **Good**: Error boundary wrapping entire app
- ✅ **Good**: Keyboard shortcuts provider
- ✅ **Good**: Vercel Analytics only in production
- ⚠️ **Issue**: Google Client ID hardcoded as fallback — `86874505738-k1263riddtq0sctihj5divb550d93pg0.apps.googleusercontent.com`
- 🔴 **Security**: Client ID in source code (though this is semi-public for Google OAuth)

### `src/services/api.ts` (84 lines) — API Client
- ✅ **Good**: Auth token injection via interceptor
- ✅ **Good**: Exponential backoff retry (1s, 2s, 4s) for GET requests only
- ✅ **Good**: 429 rate limit handling with toast notification
- ✅ **Good**: Never retries mutations (POST, PUT, DELETE, PATCH)
- ⚠️ **Issue**: Token stored in `localStorage` — vulnerable to XSS

### `src/contexts/AuthContext.tsx` (138 lines) — Auth State
- ✅ **Good**: Session verification on app load
- ✅ **Good**: Cross-tab sync via visibility change + focus events
- ✅ **Good**: 5-minute cooldown on background re-fetch
- ⚠️ **Issue**: Optimistic user display before verification — shows stale user briefly

### `src/pages/Results.tsx` — 73.4KB ⚠️
- **CRITICAL**: This single file is 73KB — that's the size of a small library
- Should be broken into multiple components (ResultsTable, ResultChart, IPUSync, etc.)

### `src/pages/Settings.tsx` — 35.4KB ⚠️
- Same issue — contains AI chat, data management, profile editing, preferences all in one file

### `src/pages/Dashboard.tsx` — 29.9KB ⚠️
- Large but more reasonable — still should extract KPI cards, subject list, etc.

### `src/services/attendanceService.ts` vs `src/services/attendance.service.ts`
- ⚠️ **Issue**: Two attendance service files exist — `attendanceService.ts` (653B) appears to be a thin wrapper or duplicate of `attendance.service.ts` (23KB)

### `index.html` (51 lines) — Entry HTML
- ✅ **Good**: Comprehensive meta tags (OG, Twitter, description, keywords)
- ✅ **Good**: Google Site Verification tag
- ✅ **Good**: Preconnect to Google Fonts
- ⚠️ **Issue**: `oncontextmenu="return false"` on body — blocks right-click, poor UX and doesn't prevent code copying
- ⚠️ **Issue**: Canonical URL points to `/login` not `/` — should be the root URL
- ⚠️ **Issue**: No structured data (JSON-LD schema markup)

### `vite.config.ts` (131 lines) — Build Configuration
- ✅ **Good**: Manual chunk splitting (vendor, charts, animations)
- ✅ **Good**: PWA configuration with runtime caching strategies
- ✅ **Good**: Console/debugger stripping in production
- ⚠️ **Issue**: No CSP (Content-Security-Policy) header configured

---

## 7. Legacy Code Analysis

### `legacy/api/api.py` — 140KB ⚠️ CRITICAL
- **140KB single Python file** — this is the entire original Flask API
- Contains ALL routes, database logic, scraping, calculations in one file
- ⚠️ This file should be deleted or moved to an archive — it's obsolete and confusing

### `legacy/api/__init__.py` — 14KB
- Flask app factory with all route registrations
- MongoDB integration (original database)

### `legacy/web/` — Next.js Web App (DEPRECATED)
- Contains 6 build log files totaling ~21KB — **these should be deleted**
- ⚠️ `.env.local` file with credentials — **SECURITY RISK** if committed
- Old Next.js pages with `tsconfig.tsbuildinfo` (169KB) — should be gitignored

### `legacy/mobile/` — Expo React Native App
- `App.js` (13.6KB) — full mobile app in single file
- ⚠️ `google-services.json` — **Firebase credentials exposed in repo**
- Contains `android/` build directory — should be gitignored

### Recommendation for Legacy Code
**All legacy code should be archived or removed.** It serves no purpose in the current v3 architecture and creates confusion. At minimum:
1. Delete `legacy/web/build*.log` files
2. Remove `legacy/web/.env.local` and `legacy/mobile/google-services.json` from git history
3. Add `legacy/` to `.gitignore` or move to a separate branch

---

## 8. Scripts & Utilities Analysis

| Script | Purpose | Status |
|--------|---------|--------|
| `check_primary_tt.py` | Validate primary timetable data | ⚠️ Uses old MongoDB — outdated |
| `check_sem2_tt.py` | Check semester 2 timetable | ⚠️ Same — outdated |
| `fix_regressions.py` | Fix data regressions after migration | ✅ Useful for maintenance |
| `inspect_enums.py` | Inspect database enum values | ⚠️ Uses old MongoDB |
| `restore_s1_logs.py` | Restore semester 1 attendance logs | ⚠️ One-time migration script |
| `setup-mobile.sh` | Setup mobile development environment | ✅ Useful |
| `test_db.py` | Test database connectivity | ⚠️ Uses old MongoDB |
| `verify_data.py` | Verify data integrity | ⚠️ Uses old MongoDB |
| `verify_final.py` | Final verification after migration | ⚠️ One-time script |

**Recommendation**: Remove or update Python scripts that reference MongoDB. Keep `setup-mobile.sh` and `fix_regressions.py`.

---

## 9. Configuration Files Analysis

### `vercel.json` (93 lines)
- ✅ **Good**: Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy)
- ✅ **Good**: Immutable caching for assets, no-store for sw.js
- ✅ **Good**: Region set to `bom1` (Mumbai — optimal for Indian users)
- ⚠️ **Issue**: Function max duration is 30s — IPU scraping can take longer
- ⚠️ **Issue**: Missing `Content-Security-Policy` header
- ⚠️ **Issue**: Missing `Strict-Transport-Security` (HSTS) header
- ⚠️ **Issue**: Missing `Permissions-Policy` header

### `docker-compose.yml` (560B)
- Basic multi-container setup (API + Frontend)
- ⚠️ No database container — assumes external DB

### Root `package.json` (462B)
- Minimal workspace package with `concurrently` for dev
- ⚠️ No workspaces configuration — npm workspaces would improve dependency management

---

## 10. Build Logs Analysis

### `legacy/web/build*.log` — 6 files
- Contains Next.js build output from deprecated web app
- Shows TypeScript errors during migration period
- **Should be deleted** — no value in repository

### `frontend/build_output.log` — 2.6KB
- Vite build output — useful for debugging but shouldn't be committed
- **Should be gitignored**

---

## 11. 🔴 Security Audit

### Critical Issues

| # | Issue | Location | Severity | Recommendation |
|---|-------|----------|----------|----------------|
| 1 | **JWT stored in localStorage** | `frontend/src/services/api.ts` | 🔴 HIGH | Migrate to `httpOnly` secure cookies |
| 2 | **No CSRF protection** | All POST endpoints | 🔴 HIGH | Add CSRF tokens or use `SameSite=Strict` cookies |
| 3 | **30-day JWT with no refresh** | `api-node/src/routes/auth.ts:88` | 🔴 HIGH | Implement refresh token rotation (15min access + 7d refresh) |
| 4 | **Full user data sent to Groq** | `api-node/src/routes/ai.ts` | 🔴 HIGH | Anonymize or minimize data sent to 3rd party; add privacy disclosure |
| 5 | **Google Client ID hardcoded** | `frontend/src/App.tsx:224` | 🟡 MEDIUM | Remove fallback, require env var |
| 6 | **SSL verification disabled** | `api-node/src/routes/ipu.ts:148` | 🟡 MEDIUM | Use proper CA bundle for IPU portal |
| 7 | **IPU password handling** | `api-node/src/routes/ipu.ts` | 🟡 MEDIUM | Ensure passwords are never logged; add log sanitization |
| 8 | **Data export without re-auth** | `api-node/src/routes/data.ts:72` | 🟡 MEDIUM | Require password re-entry for data export |
| 9 | **No input sanitization on HTML scraping** | `scraper.ts`, `ipu.ts` | 🟡 MEDIUM | Sanitize scraped content before storing/returning |
| 10 | **Firebase config in repo** | `legacy/mobile/google-services.json` | 🔴 HIGH | Remove from git history using `git filter-branch` |
| 11 | **Env file committed** | `legacy/web/.env.local` | 🔴 HIGH | Remove from git history |
| 12 | **No audit logging for auth events** | Auth routes | 🟡 MEDIUM | Log login attempts, failures, IP addresses |
| 13 | **Profile picture as base64 in DB** | `profile.ts` | 🟡 MEDIUM | Use object storage (S3/Cloudinary) instead |
| 14 | **10MB body parser limit** | `app.ts:62` | 🟡 MEDIUM | Reduce to 1MB for most routes, 10MB only for import |
| 15 | **Missing HSTS header** | `vercel.json` | 🟡 MEDIUM | Add `Strict-Transport-Security: max-age=63072000` |
| 16 | **Missing CSP header** | `vercel.json` | 🟡 MEDIUM | Add Content-Security-Policy |
| 17 | **Right-click disabled** | `index.html:46` | 🟢 LOW | Remove `oncontextmenu="return false"` — doesn't improve security |

### Recommended Security Headers (add to `vercel.json`)
```json
{
  "key": "Strict-Transport-Security",
  "value": "max-age=63072000; includeSubDomains; preload"
},
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://accounts.google.com https://api.groq.com https://zenith.kuberbassi.com; frame-src https://accounts.google.com"
},
{
  "key": "Permissions-Policy",
  "value": "camera=(), microphone=(), geolocation=()"
}
```

---

## 12. 🟡 SEO Analysis & Improvements

### Current SEO Status ✅
- ✅ Title tags and meta description present
- ✅ Open Graph tags (Facebook) configured
- ✅ Twitter Card meta tags
- ✅ Google Site Verification
- ✅ `robots.txt` present
- ✅ `sitemap.xml` present
- ✅ Canonical URL specified

### SEO Issues & Improvements Needed

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 1 | **Canonical URL points to `/login`** | 🔴 Wrong canonical | Change to `https://zenith.kuberbassi.com/` |
| 2 | **SPA with no SSR/SSG** | 🔴 Search engines can't index authenticated pages | Add pre-rendering for public pages (login, privacy, terms) |
| 3 | **No JSON-LD structured data** | 🟡 Missing rich snippets | Add WebApplication, Organization, and FAQ schema |
| 4 | **OG image is just icon** | 🟡 Poor social previews | Create 1200x630 social sharing image with branding |
| 5 | **No dynamic page titles** | 🟡 All pages show "Zenith \| Student Center" | Use `usePageMeta` hook consistently on all pages |
| 6 | **Sitemap only has 7 URLs** | 🟡 Incomplete | Add all public routes (privacy, terms, login) |
| 7 | **No alt text on images** | 🟡 Accessibility + SEO | Add descriptive alt attributes to all images |
| 8 | **Missing `lang` attribute on dynamic content** | 🟢 Minor | Already has `lang="en"` on HTML tag |
| 9 | **No 404 page** | 🟡 Poor UX for search engines | Add custom 404 page instead of redirect to "/" |
| 10 | **Twitter @zenith handle** | 🟢 Minor | Verify handle exists or remove |

### Recommended JSON-LD Schema (add to `index.html`)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Zenith",
  "url": "https://zenith.kuberbassi.com",
  "description": "All-in-one student dashboard for IPU - attendance tracking, results, timetables, and AI assistant",
  "applicationCategory": "EducationalApplication",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
  "author": { "@type": "Person", "name": "Kuber Bassi" }
}
</script>
```

---

## 13. 🟠 Performance & Speed Issues

### Backend Performance

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 1 | **N+1 queries in `mark_all_attendance`** | `compat.ts:90` | 🔴 Sequential DB calls per subject | Batch with `Promise.all` or `createMany` |
| 2 | **AI context fetches ALL user data** | `ai.ts:51` | 🟡 9 parallel DB queries per chat message | Cache context for 30s, limit result rows |
| 3 | **Import creates records sequentially in batches** | `data.ts:62` | 🟡 25 parallel creates per batch | Use `createMany` for bulk inserts |
| 4 | **Notice scraper fetches on first request** | `scraper.ts:182` | 🟡 Cold start = user waits for scrape | Pre-populate cache on server start |
| 5 | **View cache stored in UserPreference** | `viewCache.ts` | 🟡 Extra DB reads/writes for caching | Use in-memory LRU cache instead |
| 6 | **Hardcoded semester loop 1-8** | `compat.ts:135` | 🟢 8 sequential DB queries | Single query with `groupBy` |
| 7 | **Timetable JSON parse/stringify on every read** | `timetable.ts:164` | 🟢 Unnecessary serialization | Work with objects directly |

### Frontend Performance

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 1 | **Results.tsx is 73KB** | `pages/Results.tsx` | 🔴 Huge bundle chunk even with lazy loading | Split into 5-6 smaller components |
| 2 | **Three.js imported** | `package.json` | 🟡 ~600KB added to bundle | Only load 3D content on login page |
| 3 | **Both Chart.js AND Recharts** | `package.json` | 🟡 Two charting libraries = duplicate code | Standardize on one (Recharts is more React-native) |
| 4 | **react-spring AND framer-motion** | `package.json` | 🟡 Two animation libraries | Standardize on framer-motion |
| 5 | **No image optimization** | Various | 🟡 PNG images not optimized | Convert to WebP, add lazy loading |
| 6 | **Service worker caches all images for 30 days** | `vite.config.ts:79` | 🟢 Could cache stale API images | Exclude API responses from image cache |

### Bundle Size Concerns
```
Production Dependencies That Add Significant Weight:
- three + @react-three/* → ~600KB (3D particle canvas on login only)
- framer-motion → ~120KB
- react-spring → ~60KB (likely unused if framer-motion handles all)
- chart.js + react-chartjs-2 → ~200KB
- recharts → ~300KB
- html2canvas → ~40KB
- jspdf + jspdf-autotable → ~300KB

ESTIMATED TOTAL: ~1.6MB of JS deps (before tree-shaking)
```

---

## 14. 🔵 Logic Errors & Broken Functionality

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | **`today()` uses server timezone** | `attendance.ts:47` | 🔴 Users in different timezones get wrong dates |
| 2 | **`medical` in ATTENDED_STATUSES in attendance.ts but NOT in compat.ts** | `attendance.ts:12` vs `compat.ts:6` | 🟡 Inconsistent counting |
| 3 | **Duplicate service files** | `attendanceService.ts` vs `attendance.service.ts` | 🟡 Confusion about which to use |
| 4 | **Duplicate type definitions** | `AuthRequest` defined in both `middleware/auth.ts` and `types/index.ts` | 🟡 Type mismatch risk |
| 5 | **Duplicate utility functions** | `isMeaningfulValue`, `mergePreferredRecord`, `getSlotType`, `scoreScheduleBySubjects` duplicated across 3+ files | 🟡 Bug risk if one copy is updated |
| 6 | **Stub endpoints return empty arrays** | `pending_leaves`, `unresolved_substitutions` | 🟡 Misleading — should return 501 Not Implemented |
| 7 | **Import deletes all data then fails** | `data.ts` import is not transactional | 🔴 Data loss if import fails mid-way |
| 8 | **maxMarks hardcoded to 100** | `calculations.ts:148` | 🟡 Wrong for subjects with different max marks |
| 9 | **SemesterResult allows duplicates** | Schema has @@index not @@unique | 🟡 Multiple results per semester possible |
| 10 | **In-memory caches lost on cold start** | `scraper.ts` notice cache, `data.ts` rate limit map | 🟡 Serverless deployment = frequent cold starts |

---

## 15. 🟣 Folder Structure Issues

| # | Issue | Recommendation |
|---|-------|---------------|
| 1 | **Legacy code in main tree** | Move `legacy/` to a git branch or archive repo |
| 2 | **Python scripts reference MongoDB** | Delete or update `scripts/` files that use old DB |
| 3 | **`api/` catch-all is confusing** | Rename to `api-vercel/` or document clearly |
| 4 | **Root has mixed-platform configs** | `requirements.txt`, `app.json`, `eas.json` belong to legacy/mobile |
| 5 | **No shared types between frontend and backend** | Create `shared/` or `packages/types/` for common interfaces |
| 6 | **Duplicate attendance service files** | Remove `attendanceService.ts`, keep `attendance.service.ts` |
| 7 | **`ipu.ts` is 1384 lines** | Split into `ipu/session.ts`, `ipu/scraper.ts`, `ipu/routes.ts`, `ipu/helpers.ts` |
| 8 | **Results.tsx is 73KB** | Split into component files under `components/results/` |
| 9 | **Settings.tsx is 35KB** | Split into `SettingsProfile.tsx`, `SettingsData.tsx`, `SettingsAI.tsx` |
| 10 | **Build logs committed** | Add `*.log` to `.gitignore`, remove existing logs |
| 11 | **No `tests/` directory** | No unit or integration tests anywhere in the project |
| 12 | **`manifest.json.bak` in public** | Remove backup file from production assets |

### Recommended Structure
```
zenith/
├── packages/
│   ├── shared/          # Shared types, enums, constants
│   └── calculations/    # Shared calculation logic
├── apps/
│   ├── api/             # Express API (current api-node)
│   └── web/             # Vite frontend (current frontend)
├── scripts/             # Only actively used scripts
├── docs/                # Documentation
└── archive/             # Old legacy code (for reference only)
```

---

## 16. 🟢 Feature Recommendations

### Must-Have Features (Security & Compliance)

| # | Feature | Reason | Priority |
|---|---------|--------|----------|
| 1 | **Account deletion** | GDPR/privacy compliance — users must be able to delete their account entirely | 🔴 P0 |
| 2 | **Rate limiting per user** | Current rate limiting is IP-based — shared IPs (college wifi) could lock out everyone | 🔴 P0 |
| 3 | **Input sanitization middleware** | XSS prevention on all user-submitted text | 🔴 P0 |
| 4 | **Audit log for sensitive ops** | Track login, export, delete, profile changes with IP | 🟡 P1 |
| 5 | **Email notifications** | Critical attendance alerts via email | 🟡 P1 |
| 6 | **Two-factor authentication (2FA)** | Additional security layer for public app | 🟡 P1 |
| 7 | **Terms of Service acceptance tracking** | Record when users accept ToS for compliance | 🟡 P1 |

### Should-Have Features (Quality of Life)

| # | Feature | Reason |
|---|---------|--------|
| 8 | **Offline mode** | PWA should work offline with cached data |
| 9 | **Undo/redo for attendance** | Prevent accidental marks |
| 10 | **Bulk attendance marking** | Mark multiple subjects for a day at once (from timetable) |
| 11 | **Shareable attendance reports** | PDF/image export of attendance summary |
| 12 | **Class schedule import** | Import timetable from CSV/image/third-party |
| 13 | **Push notifications** | Browser push for attendance reminders |
| 14 | **Dark/light theme** | Already exists but verify consistency |
| 15 | **Accessibility (a11y)** | Screen reader support, keyboard navigation, focus management |

### Nice-to-Have Features (Enhancement)

| # | Feature | Reason |
|---|---------|--------|
| 16 | **Collaborative features** | Share schedules with classmates |
| 17 | **Grade prediction** | AI-based grade prediction from attendance + past results |
| 18 | **Study planner** | AI-generated study schedules based on upcoming exams |
| 19 | **Professor rating/review** | Community feedback on professors |
| 20 | **Google Classroom integration** | Auto-import class schedule and assignments |
| 21 | **Widget for mobile** | Quick attendance marking widget |
| 22 | **Multi-language support** | Hindi, regional language options |
| 23 | **API documentation** | OpenAPI/Swagger docs for the API |
| 24 | **Automated testing** | Unit tests, integration tests, E2E tests |

### Trusted Resource References for Must-Have Features

1. **OWASP Top 10** (https://owasp.org/Top10/) — Security checklist:
   - A01: Broken Access Control → Add per-resource authorization
   - A02: Cryptographic Failures → Use httpOnly cookies for JWT
   - A03: Injection → Input sanitization middleware
   - A07: Identification & Authentication → Implement refresh tokens

2. **GDPR Compliance** (for any app with EU users):
   - Right to erasure (account deletion)
   - Data portability (export exists ✅)
   - Consent tracking (ToS acceptance)

3. **WCAG 2.1 Accessibility** (https://www.w3.org/WAI/WCAG21/):
   - Color contrast ratios
   - Keyboard navigation
   - Screen reader support
   - Focus management

---

## 17. Priority Action Items

### P0 - Critical

- [ ] Remove archived secret files from git history
  Note: removed from the active tree and archived tree, but full history rewrite still requires an explicit git-history cleanup operation.
- [x] Move JWT from localStorage to httpOnly secure cookies
- [x] Add CSRF protection to mutation endpoints
- [x] Implement JWT refresh token rotation (15 min access + 7 d refresh)
- [x] Make data import rollback-safe on failure
- [x] Fix today() to use the user's timezone
- [x] Add HSTS and CSP headers to vercel.json
- [x] Remove hardcoded Google Client ID fallback
- [x] Reduce body parser limit to 1 MB globally and keep 10 MB only for import
- [x] Add privacy disclosure about data sent to Groq AI

### P1 - High Priority

- [x] Split ipu.ts into service-backed modules
  Note: session/state management is extracted; more splitting is optional maintainability work.
- [x] Split Results.tsx into smaller components
- [x] Split Settings.tsx into sections
- [x] Remove duplicate utility functions
- [x] Remove duplicate attendanceService.ts
- [x] Fix canonical URL from /login to /
- [x] Add JSON-LD structured data
- [x] Create a proper 404 page
- [x] Delete legacy build log files from the active tree
- [ ] Add automated tests beyond build validation and smoke tooling
- [x] Fix attendance status inconsistency between files
- [x] Add rate limiting to the AI chat endpoint

### P2 - Medium Priority

- [x] Archive legacy/ out of the active app tree
- [x] Remove unused Mongo-era Python scripts from the active scripts folder
- [x] Standardize on one charting library in the active app code
- [x] Standardize on one animation library in the active app code
- [ ] Move profile pictures to object storage (requires infra credentials)
- [x] Add a 1200x630 OG image for social sharing
- [ ] Implement stronger offline mode beyond the current PWA caching
- [ ] Add broader accessibility improvements (WCAG 2.1 pass)
- [x] Create API documentation endpoint (/api/docs/openapi.json)
- [x] Add npm workspaces to the monorepo root
- [x] Implement account deletion endpoint and UI flow
- [ ] Add email notification system

### P3 - Backlog

- [ ] Migrate AttendanceLog.date from String to DateTime with a DB rollout plan
- [ ] Restore unique constraints for SemesterResult and Timetable with a data migration plan
- [ ] Implement Google Classroom integration
- [ ] Add multi-language support
- [ ] Create teacher/admin dashboard
- [ ] Build grade prediction AI feature
- [ ] Add collaborative features

### Remaining External / Infra Work

- Git history rewrite for archived secrets and committed env artifacts
- Object storage credentials and migration plan for profile pictures
- Email provider selection and delivery setup
- Data-model migration planning for DateTime and unique constraints
- A larger automated test strategy beyond build validation

---

> Document reconciled against the live codebase on 2026-03-22. Completed items above reflect the current repository state.
