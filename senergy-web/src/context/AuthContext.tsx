import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { User, AuthState } from '@/types'
import axios from 'axios'

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  loginWithGoogle: (token: string) => Promise<void>
  loginWithGithub: (code: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  updateUserProfile: (partial: Partial<User>) => void
  user: User | null
  token: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('auth_token') || null,
    isLoading: true,
    error: null,
  })

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('auth_token')
      if (token) {
        try {
          const response = await axios.get('/api/auth/verify', {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 5000, // 5 second timeout
          })
          setState(prev => ({
            ...prev,
            user: response.data.user,
            token,
            isLoading: false,
          }))
        } catch (error: any) {
          console.error('Token verification failed:', error)
          localStorage.removeItem('auth_token')
          setState(prev => ({ ...prev, isLoading: false, token: null }))
        }
      } else {
        setState(prev => ({ ...prev, isLoading: false }))
      }
    }

    verifyToken().catch((error) => {
      console.error('Error in verifyToken:', error)
      setState(prev => ({ ...prev, isLoading: false }))
    })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await axios.post('/api/auth/login', { email, password })
      const { user, token } = response.data

      localStorage.setItem('auth_token', token)
      setState({
        user,
        token,
        isLoading: false,
        error: null,
      })
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Login failed'
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMsg,
      }))
      throw error
    }
  }, [])

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await axios.post('/api/auth/register', { email, password, displayName })
      const { user, token } = response.data

      localStorage.setItem('auth_token', token)
      setState({
        user,
        token,
        isLoading: false,
        error: null,
      })
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Registration failed'
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMsg,
      }))
      throw error
    }
  }, [])

  const loginWithGoogle = useCallback(async (token: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await axios.post('/api/auth/google', { token })
      const { user, token: authToken } = response.data

      localStorage.setItem('auth_token', authToken)
      setState({
        user,
        token: authToken,
        isLoading: false,
        error: null,
      })
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Google login failed'
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMsg,
      }))
      throw error
    }
  }, [])

  const loginWithGithub = useCallback(async (code: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await axios.post('/api/auth/github', { code })
      const { user, token } = response.data

      localStorage.setItem('auth_token', token)
      setState({
        user,
        token,
        isLoading: false,
        error: null,
      })
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'GitHub login failed'
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMsg,
      }))
      throw error
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    setState({
      user: null,
      token: null,
      isLoading: false,
      error: null,
    })
  }, [])

  const updateUserProfile = useCallback((partial: Partial<User>) => {
    setState(prev => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...partial } : prev.user,
    }))
  }, [])

  const value: AuthContextType = {
    ...state,
    user: state.user,
    login,
    register,
    loginWithGoogle,
    loginWithGithub,
    logout,
    isAuthenticated: !!state.user,
    updateUserProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}