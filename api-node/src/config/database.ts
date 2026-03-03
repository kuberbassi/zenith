import mongoose from 'mongoose'
import { ENV } from './env.js'

let connected = false

export async function connectDB() {
  if (connected) return
  try {
    await mongoose.connect(ENV.MONGODB_URI)
    connected = true
    console.log('[DB] Connected to MongoDB')
  } catch (err) {
    console.error('[DB] Connection failed:', err)
    process.exit(1)
  }
}
