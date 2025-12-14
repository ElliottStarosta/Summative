export interface User {
  id: string
  email: string
  displayName: string
  avatar?: string
  createdAt: string
  personalityType?: string
  adjustmentFactor?: number
  passwordHash?: string
}

export interface JWTPayload {
  userId: string
  email: string
  iat: number
  exp: number
}

export interface QuizSubmission {
  userId: string
  responses: number[]
  adjustmentFactor: number
  personalityType: string
  description: string
  timestamp: string
}