import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { ENV } from '../config/env.js'
import { User, type IUser } from '../models/User.js'

export type ClientPlatform = 'web' | 'ios' | 'android' | 'unknown'

export interface AuthRequest extends Request {
  user?: IUser
  userId?: string
  /** Detected client platform (set by detectPlatform middleware) */
  platform?: ClientPlatform
  /** API version being called (e.g. 'v1') */
  apiVersion?: string
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: no token' })
    return
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET) as { sub: string }
    const user = await User.findById(payload.sub).lean()
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: user not found' })
      return
    }
    req.user = user as unknown as IUser
    req.userId = user._id.toString()
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized: invalid token' })
  }
}
