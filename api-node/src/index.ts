import './config/env.js'  // load ENV first
import { ENV } from './config/env.js'
import { connectDB } from './config/database.js'
import app from './app.js'

/* ── Start ────────────────────────────────────────────────── */
async function start() {
  await connectDB()
  app.listen(ENV.PORT, () => {
    console.log(`[Server] Running on http://localhost:${ENV.PORT}`)
    console.log(`[Server] Env: ${ENV.NODE_ENV}`)
  })
}

start()

export default app
