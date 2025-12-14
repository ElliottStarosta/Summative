import express, { Express } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { errorHandler } from '@/middleware/errorHandler'
import { requestLogger } from './middleware/requestlogger'
import authRoutes from '@/routes/auth'
import quizRoutes from '@/routes/quiz'

dotenv.config()

export function createServer(): Express {
  const app = express()

  // Middleware
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ limit: '10mb', extended: true }))

  // CORS
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  )

  // Logging
  app.use(requestLogger)

  // Health Check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // Routes
  app.use('/auth', authRoutes)
  app.use('/quiz', quizRoutes)

  // API prefix for development
  app.use('/api/auth', authRoutes)
  app.use('/api/quiz', quizRoutes)

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' })
  })

  // Error Handler
  app.use(errorHandler)

  return app
}

