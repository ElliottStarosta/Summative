import { Router, Request, Response } from 'express'
import { authService } from '@/services/auth.service'
import { authMiddleware } from '@/middleware/auth'
import admin, { db } from '@/config/firebase'

const router = Router()

// ============================================
// EMAIL/PASSWORD AUTHENTICATION
// ============================================

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

// ============================================
// GOOGLE OAUTH
// ============================================

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
  
  console.log('[Auth] Redirecting to Google OAuth:', googleAuthUrl.substring(0, 50) + '...')
  res.redirect(googleAuthUrl)
})

// Google OAuth - Callback (from Google)
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, error } = req.query

    console.log('[Auth] Google callback received')

    if (error) {
      console.error('[Auth] Google OAuth error:', error)
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`)
    }

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`)
    }

    // Exchange authorization code for tokens
    console.log('[Auth] Exchanging authorization code for Google tokens...')
    const result = await authService.handleGoogleAuth(code as string)
    
    // Redirect to frontend with token
    console.log('[Auth] Google auth successful, redirecting with token')
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${result.token}`)
  } catch (error: any) {
    console.error('[Auth] Google callback error:', error.message)
    res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed&details=${encodeURIComponent(error.message)}`)
  }
})

// Google OAuth - Direct token endpoint (for mobile/SDK flows)
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { token } = req.body

    if (!token) {
      console.error('[Auth] Google auth: Token missing from request')
      return res.status(400).json({ error: 'Token required' })
    }

    console.log('[Auth] Received token via POST (length:', token.length, ')')
    
    // Check if it's a Firebase token (starts with "ey" for JWT) or auth code
    if (token.startsWith('ey') && token.includes('.')) {
      // It's a Firebase ID token - verify with Firebase
      console.log('[Auth] Detected Firebase ID token')
      const decodedToken = await admin.auth().verifyIdToken(token)
      console.log('[Auth] Firebase token verified for user:', decodedToken.email)
      
      // Get or create user from Firebase
      const result = await authService.handleGoogleAuth(token)
      
      console.log('[Auth] Firebase auth successful, returning user:', result.user.displayName)
      res.json(result)
    } else {
      // It's an authorization code - use existing flow
      console.log('[Auth] Detected authorization code')
      const result = await authService.handleGoogleAuth(token)
      
      console.log('[Auth] Google auth successful, returning user:', result.user.displayName)
      res.json(result)
    }
  } catch (error: any) {
    console.error('[Auth] Google auth error:', error)
    console.error('[Auth] Error stack:', error.stack)
    const statusCode = error.statusCode || 500
    const errorMessage = error.message || 'Google authentication failed'
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// ============================================
// GITHUB OAUTH
// ============================================

// GitHub OAuth - Redirect to GitHub
router.get('/github/redirect', (req: Request, res: Response) => {
  const githubClientId = process.env.GITHUB_CLIENT_ID
  const redirectUri = `${process.env.BACKEND_URL}/api/auth/github/callback`
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${githubClientId}&` +
    `redirect_uri=${redirectUri}&` +
    `scope=user:email`
  
  console.log('[Auth] Redirecting to GitHub OAuth')
  res.redirect(githubAuthUrl)
})

// GitHub OAuth - Callback (from GitHub)
router.get('/github/callback', async (req: Request, res: Response) => {
  try {
    const { code, error } = req.query

    console.log('[Auth] GitHub callback received')

    if (error) {
      console.error('[Auth] GitHub OAuth error:', error)
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=github_auth_failed`)
    }

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`)
    }

    // Exchange authorization code for tokens
    console.log('[Auth] Exchanging authorization code for GitHub tokens...')
    const result = await authService.handleGithubAuth(code as string)
    
    // Redirect to frontend with token
    console.log('[Auth] GitHub auth successful, redirecting with token')
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${result.token}`)
  } catch (error: any) {
    console.error('[Auth] GitHub callback error:', error.message)
    res.redirect(`${process.env.FRONTEND_URL}/login?error=github_auth_failed&details=${encodeURIComponent(error.message)}`)
  }
})

// GitHub OAuth - Direct code endpoint (for SDK flows)
router.post('/github', async (req: Request, res: Response) => {
  try {
    const { code } = req.body

    if (!code) {
      return res.status(400).json({ error: 'Code required' })
    }

    console.log('[Auth] Received GitHub code via POST')
    const result = await authService.handleGithubAuth(code)
    res.json(result)
  } catch (error: any) {
    console.error('[Auth] GitHub auth error:', error.message)
    res.status(400).json({ error: error.message || 'GitHub auth failed' })
  }
})

// ============================================
// DISCORD OAUTH
// ============================================

// Discord Auth - Get token from Discord ID
router.post('/discord', async (req: Request, res: Response) => {
  try {
    const { discordId, verificationCode } = req.body

    if (!discordId) {
      return res.status(400).json({ error: 'Discord ID required' })
    }

    const result = await authService.handleDiscordAuth(discordId, verificationCode)
    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Discord auth failed' })
  }
})

router.post('/discord/link', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { discordId } = req.body

    if (!discordId) {
      return res.status(400).json({ error: 'Discord ID required' })
    }

    // Update user with Discord ID (not verified yet)
    await db.collection('users').doc(userId).update({
      discordId: discordId,
      discordVerified: false,
    })

    res.json({ 
      success: true,
      message: 'Discord ID linked. Complete the quiz to get your verification code.'
    })
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to link Discord ID' })
  }
})


// Generate verification code for Discord linking
router.post('/discord/verify-code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { discordId } = req.body

    if (!discordId) {
      return res.status(400).json({ error: 'Discord ID required' })
    }

    const code = await authService.generateVerificationCode(userId, discordId)
    
    // Update user with Discord ID (not verified yet)
    await db.collection('users').doc(userId).update({
      discordId: discordId,
    })

    res.json({ 
      success: true,
      code,
      message: 'Verification code generated. Use this code with /verify command in Discord.'
    })
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to generate verification code' })
  }
})

// ============================================
// TOKEN VERIFICATION
// ============================================

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