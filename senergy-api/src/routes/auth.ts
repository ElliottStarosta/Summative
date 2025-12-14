import { Router, Request, Response } from 'express'
import { authService } from '@/services/auth.service'
import { authMiddleware } from '@/middleware/auth'

const router = Router()

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const result = await authService.registerUser({ email, password, displayName })
    res.status(201).json(result)
  } catch (error: any) {
    console.error('Register error:', error)
    res.status(400).json({ error: error.message || 'Registration failed' })
  }
})

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing credentials' })
    }

    const result = await authService.loginUser(email, password)
    res.json(result)
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Login failed' })
  }
})

// Google OAuth - Redirect to Google
router.get('/google/redirect', (req: Request, res: Response) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = `${process.env.BACKEND_URL}/api/auth/google/callback`
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${googleClientId}&` +
    `redirect_uri=${redirectUri}&` +
    `response_type=code&` +
    `scope=profile email&` +
    `access_type=offline&` +
    `prompt=consent`
  
  res.redirect(googleAuthUrl)
})

// Google OAuth - Callback
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`)
    }

    const result = await authService.handleGoogleAuth(code as string)
    
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${result.token}`)
  } catch (error: any) {
    console.error('Google callback error:', error)
    res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`)
  }
})

// Google OAuth - Direct token (for mobile/existing flow)
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({ error: 'Token required' })
    }

    const result = await authService.handleGoogleAuth(token)
    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Google auth failed' })
  }
})

// GitHub OAuth - Redirect to GitHub
router.get('/github/redirect', (req: Request, res: Response) => {
  const githubClientId = process.env.GITHUB_CLIENT_ID
  const redirectUri = `${process.env.BACKEND_URL}/api/auth/github/callback`
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${githubClientId}&` +
    `redirect_uri=${redirectUri}&` +
    `scope=user:email`
  
  res.redirect(githubAuthUrl)
})

// GitHub OAuth - Callback
router.get('/github/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`)
    }

    const result = await authService.handleGithubAuth(code as string)
    
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${result.token}`)
  } catch (error: any) {
    console.error('GitHub callback error:', error)
    res.redirect(`${process.env.FRONTEND_URL}/login?error=github_auth_failed`)
  }
})

// GitHub OAuth - Direct code (for existing flow)
router.post('/github', async (req: Request, res: Response) => {
  try {
    const { code } = req.body

    if (!code) {
      return res.status(400).json({ error: 'Code required' })
    }

    const result = await authService.handleGithubAuth(code)
    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'GitHub auth failed' })
  }
})

// Verify Token
router.get('/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await authService.getUserById(req.userId!)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

export default router