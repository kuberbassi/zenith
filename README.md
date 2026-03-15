# AcadHub

AcadHub is a full-stack student productivity app with React frontend, React Native mobile app, and a Node + Express + Prisma backend on Neon PostgreSQL.

## Current Stack
- Frontend: React, TypeScript, Vite, Tailwind
- Backend: Express, TypeScript, Prisma, Zod
- Database: Neon Postgres
- Mobile: Expo React Native

## Monorepo Layout
- frontend: web app
- api-node: Node API (primary backend)
- mobile: React Native app
- api: Vercel serverless entry that proxies to api-node build output
- legacy: old Python backend (not primary runtime)

## Quick Start (Web + API)

```bash
# Terminal 1 - backend
cd api-node
npm install
npm run dev

# Terminal 2 - frontend
cd frontend
npm install
npm run dev
```

Default local URLs:
- Frontend: http://localhost:3000 or Vite port shown in terminal
- API: http://localhost:5001

## Environment Variables
Create `api-node/.env` with:

```env
DATABASE_URL=postgres://...
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
ALLOWED_ORIGINS=http://localhost:3000
PORT=5001
```

Create `frontend/.env` with:

```env
VITE_API_BASE_URL=http://localhost:5001
VITE_GOOGLE_CLIENT_ID=...
```

## Useful Commands

```bash
# backend
cd api-node
npm run build
npm run lint
npm run smoke:api

# frontend
cd frontend
npm run build
```

## Docker

```bash
docker-compose up --build
```

Services:
- frontend: http://localhost:3000
- backend: http://localhost:5001

## Notes
- Holiday system has been removed from API/schema.
- Attendance substitution flow is Neon-safe (no transaction/upsert dependency).
- Backup/restore includes resume entities (projects, experiences, certifications).
