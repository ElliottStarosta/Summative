import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWTPayload } from '@/types'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      user?: {
        userId: string
        email: string
      }
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'some_key') as JWTPayload
    req.userId = decoded.userId
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    }
    next()
  } catch (error) {
    console.error('Token verification failed:', error)
    res.status(401).json({ error: 'Invalid token' })
  }
}
