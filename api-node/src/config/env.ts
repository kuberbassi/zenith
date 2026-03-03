import dotenv from 'dotenv'
dotenv.config()

function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

export const ENV = {
  MONGODB_URI: required('MONGODB_URI'),
  JWT_SECRET: required('JWT_SECRET'),
  GOOGLE_CLIENT_ID: required('GOOGLE_CLIENT_ID'),
  PORT: parseInt(process.env.PORT ?? '5001', 10),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3002').split(','),
}
