import mongoose from 'mongoose'
import { ENV } from './env.js'

let connectionPromise: Promise<void> | null = null

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return
  // Clear stale promise if connection was lost
  if (mongoose.connection.readyState === 0) connectionPromise = null
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(ENV.MONGODB_URI, {
        maxPoolSize: 10,
        minPoolSize: 1,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      })
      .then(() => {
        console.log('[DB] Connected to MongoDB')
      })
      .catch((err) => {
        connectionPromise = null
        console.error('[DB] Connection failed:', err)
        throw err
      })
  }
  return connectionPromise
}
