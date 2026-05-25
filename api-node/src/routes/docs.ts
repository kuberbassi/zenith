import { Router } from 'express'

const router = Router()

const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Zenith API',
    version: '1.0.0',
    description: 'Versioned API for Zenith web and mobile clients.',
  },
  servers: [
    { url: '/api/v1', description: 'Canonical versioned API' },
    { url: '/api', description: 'Backward-compatible alias' },
  ],
  tags: [
    { name: 'auth' },
    { name: 'profile' },
    { name: 'attendance' },
    { name: 'academic' },
    { name: 'dashboard' },
    { name: 'data' },
    { name: 'ipu' },
  ],
  paths: {
    '/auth/google': {
      post: {
        tags: ['auth'],
        summary: 'Authenticate with Google OAuth credential',
      },
    },
    '/auth/me': {
      get: {
        tags: ['auth'],
        summary: 'Get current authenticated user',
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['auth'],
        summary: 'Rotate refresh token and issue a fresh access token',
      },
    },
    '/profile': {
      get: {
        tags: ['profile'],
        summary: 'Get profile',
      },
      put: {
        tags: ['profile'],
        summary: 'Update profile',
      },
    },
    '/profile/account': {
      delete: {
        tags: ['profile'],
        summary: 'Delete the authenticated account permanently',
      },
    },
    '/attendance/mark': {
      post: {
        tags: ['attendance'],
        summary: 'Mark attendance for a subject and date',
      },
    },
    '/academic/subjects': {
      get: {
        tags: ['academic'],
        summary: 'List subjects for a semester',
      },
    },
    '/dashboard/data': {
      get: {
        tags: ['dashboard'],
        summary: 'Get dashboard summary payload',
      },
    },
    '/data/export_data': {
      get: {
        tags: ['data'],
        summary: 'Export all user data',
      },
    },
    '/data/import_data': {
      post: {
        tags: ['data'],
        summary: 'Import a user data snapshot',
      },
    },
    '/ipu/fetch-results': {
      post: {
        tags: ['ipu'],
        summary: 'Login to IPU portal and fetch result payloads',
      },
    },
  },
}

router.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec)
})

router.get('/', (_req, res) => {
  res.type('text/plain').send('Zenith API docs: GET /api/docs/openapi.json')
})

export default router
