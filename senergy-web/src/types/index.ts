export interface User {
  id: string
  email: string
  displayName: string
  avatar?: string
  createdAt: string
  personalityType?: string
  adjustmentFactor?: number
}

export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  displayName: string
}

export interface OAuthResponse {
  user: User
  token: string
}

export interface QuizResponse {
  responses: number[]
  adjustmentFactor: number
  personalityType: string
  description: string
}

export interface QuizQuestion {
  id: number
  text: string
  weight: number
  reverse?: boolean
}
