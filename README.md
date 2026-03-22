# AcadHub

AcadHub is a full-stack student productivity app with a React web client and a Node + Express + Prisma backend on Neon PostgreSQL.

## Current Stack
- Frontend: React, TypeScript, Vite, Tailwind
- Backend: Express, TypeScript, Prisma, Zod
- Database: Neon Postgres
- Client delivery: Installable PWA (web app)

## Client Support Status
- Native app support has ended.
- The supported client is the web app (PWA), which you can install on mobile and desktop from your browser.

## Monorepo Layout
- frontend: web app
- api-node: Node API (Primary Backend) - Express + Prisma + Neon DB
- api: Vercel serverless entry point
- archive/legacy: archived Flask, Next.js, and React Native legacy code
- archive/scripts: archived MongoDB-era maintenance scripts
- archive/root-legacy-configs: archived root-level legacy mobile/Python config files

## Performance & Optimization
- **Near-Instant API**: Average response time ~150ms via composite indexing and query optimization.
- **Data Integrity**: Critical bulk writes (courses, attendance, imports) safely mapped and processed sequentially to support Neon HTTP Serverless connections.
- **Caching**: 30s-120s caching layers for dashboard, reports, and analytics.
- **Search Optimization**: Partial indexing on course titles and subject codes.
- **Bulk Operations**: Optimized imports/exports with `createMany`.

## Environment Variables
Create `api-node/.env` with:

```env
DATABASE_URL=postgres://... (Neon PostgreSQL)
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
ALLOWED_ORIGINS=http://localhost:3000
PORT=5001
NODE_ENV=development
```

## Quick Start
1.  **Database**: Push schema with `npx prisma db push`.
2.  **API**: `cd api-node && npm run dev`.
3.  **Frontend**: `cd frontend && npm run dev`.

## Deployment
Deployed via Vercel with automatic serverless routing to the Node.js backend.

## Repository Hygiene
- Root contains only active app/runtime files plus repository metadata.
- Legacy mobile and Python-era root files were moved under `archive/`.
