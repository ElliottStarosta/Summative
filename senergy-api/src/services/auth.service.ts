import bcrypt from 'bcryptjs'
import jwt, { SignOptions } from 'jsonwebtoken'
import { db, auth } from '@/config/firebase'
import { User } from '@/types'

interface CreateUserData {
  email: string
  password: string
  displayName: string
}

export class AuthService {
  private jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret'

  async registerUser(data: CreateUserData): Promise<{ user: User; token: string }> {
    const { email, password, displayName } = data

    // Check if user exists
    const existingUser = await db.collection('users').where('email', '==', email).get()
    if (!existingUser.empty) {
      throw new Error('User already exists')
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user document
    const userRef = db.collection('users').doc()
    const user: User = {
      id: userRef.id,
      email,
      displayName,
      createdAt: new Date().toISOString(),
    }

    await userRef.set({
      ...user,
      passwordHash: hashedPassword,
    })

    // Generate token
    const token = this.generateToken(user)

    return { user, token }
  }

  async loginUser(email: string, password: string): Promise<{ user: User; token: string }> {
    // Find user
    const snapshot = await db.collection('users').where('email', '==', email).get()

    if (snapshot.empty) {
      throw new Error('Invalid credentials')
    }

    const userDoc = snapshot.docs[0]
    const userData = userDoc.data() as User & { passwordHash: string }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, userData.passwordHash)
    if (!isPasswordValid) {
      throw new Error('Invalid credentials')
    }

    const user: User = {
      id: userDoc.id,
      email: userData.email,
      displayName: userData.displayName,
      createdAt: userData.createdAt,
      personalityType: userData.personalityType,
      adjustmentFactor: userData.adjustmentFactor,
    }

    const token = this.generateToken(user)

    return { user, token }
  }

  async getUserById(userId: string): Promise<User | null> {
    const doc = await db.collection('users').doc(userId).get()

    if (!doc.exists) {
      return null
    }

    const data = doc.data() as User
    return {
      id: doc.id,
      email: data.email,
      displayName: data.displayName,
      createdAt: data.createdAt,
      personalityType: data.personalityType,
      adjustmentFactor: data.adjustmentFactor,
    }
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret)
    } catch (error) {
      throw new Error('Invalid token')
    }
  }

  private generateToken(user: User): string {
    const options: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRE || '7d') as any,
    }

    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      this.jwtSecret,
      options
    )
  }

  async handleGoogleAuth(googleToken: string): Promise<{ user: User; token: string }> {
    try {
      // Verify Google token with Firebase
      const decodedToken = await auth.verifyIdToken(googleToken)
      const { uid, email, name, picture } = decodedToken

      // Check if user exists
      let userDoc = await db.collection('users').doc(uid).get()

      if (!userDoc.exists) {
        // Create new user
        const newUser: User = {
          id: uid,
          email: email || '',
          displayName: name || email || 'User',
          avatar: picture,
          createdAt: new Date().toISOString(),
        }

        await db.collection('users').doc(uid).set(newUser)
        const token = this.generateToken(newUser)
        return { user: newUser, token }
      }

      // Existing user
      const userData = userDoc.data() as User
      const user: User = {
        id: userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        avatar: userData.avatar,
        createdAt: userData.createdAt,
        personalityType: userData.personalityType,
        adjustmentFactor: userData.adjustmentFactor,
      }

      const token = this.generateToken(user)
      return { user, token }
    } catch (error) {
      throw new Error('Google authentication failed')
    }
  }

  async handleGithubAuth(githubCode: string): Promise<{ user: User; token: string }> {
    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code: githubCode,
        }),
      })

      const tokenData = await tokenResponse.json() as any
      const accessToken = tokenData.access_token

      if (!accessToken) {
        throw new Error('Failed to get access token')
      }

      // Get user info from GitHub
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })

      const githubUser = await userResponse.json() as any

      // Use GitHub ID as uid
      const uid = `github_${githubUser.id}`
      const email = githubUser.email || `${githubUser.login}@github.com`

      // Check if user exists
      const snapshot = await db.collection('users').where('email', '==', email).get()
      let userDoc: any = null

      if (!snapshot.empty) {
        userDoc = snapshot.docs[0]
      }

      if (!userDoc) {
        // Create new user
        const newUser: User = {
          id: uid,
          email,
          displayName: githubUser.name || githubUser.login,
          avatar: githubUser.avatar_url,
          createdAt: new Date().toISOString(),
        }

        await db.collection('users').doc(uid).set(newUser)
        const token = this.generateToken(newUser)
        return { user: newUser, token }
      }

      // Existing user
      const userData = userDoc.data() as User
      const user: User = {
        id: userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        avatar: userData.avatar,
        createdAt: userData.createdAt,
        personalityType: userData.personalityType,
        adjustmentFactor: userData.adjustmentFactor,
      }

      const token = this.generateToken(user)
      return { user, token }
    } catch (error: any) {
      console.error('GitHub auth error:', error)
      throw new Error('GitHub authentication failed')
    }
  }

  async handleDiscordAuth(discordId: string, verificationCode?: string): Promise<{ user: User; token: string }> {
    try {
      // Find user by Discord ID
      const snapshot = await db.collection('users').where('discordId', '==', discordId).get()

      if (snapshot.empty) {
        throw new Error('Discord account not linked. Please register and verify your Discord account first.')
      }

      const userDoc = snapshot.docs[0]
      const userData = userDoc.data() as User & { discordVerified?: boolean }

      // If verification code provided, verify it
      if (verificationCode) {
        // Check verification codes collection
        const codeDoc = await db.collection('verificationCodes').doc(verificationCode).get()
        
        if (!codeDoc.exists) {
          throw new Error('Invalid verification code')
        }

        const codeData = codeDoc.data()
        const now = Date.now()
        const expiresAt = codeData?.expiresAt || 0

        // Check if code is expired (24 hours)
        if (now > expiresAt) {
          await db.collection('verificationCodes').doc(verificationCode).delete()
          throw new Error('Verification code has expired. Please request a new one.')
        }

        // Check if code belongs to this user
        if (codeData?.userId !== userDoc.id) {
          throw new Error('Verification code does not match this account')
        }

        // Mark user as verified and link Discord ID if not already linked
        await db.collection('users').doc(userDoc.id).update({
          discordVerified: true,
          discordId: discordId,
        })

        // Delete used verification code
        await db.collection('verificationCodes').doc(verificationCode).delete()
      } else {
        // No code provided - check if already verified
        if (!userData.discordVerified) {
          throw new Error('Discord account not verified. Please provide a verification code.')
        }
      }

      const user: User = {
        id: userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        avatar: userData.avatar,
        createdAt: userData.createdAt,
        personalityType: userData.personalityType,
        adjustmentFactor: userData.adjustmentFactor,
        discordId: userData.discordId || discordId,
        discordVerified: true,
      }

      const token = this.generateToken(user)
      return { user, token }
    } catch (error: any) {
      console.error('Discord auth error:', error)
      throw new Error(error.message || 'Discord authentication failed')
    }
  }

  async generateVerificationCode(userId: string, discordId: string): Promise<string> {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000 // 24 hours

    // Store code in Firestore
    await db.collection('verificationCodes').doc(code).set({
      userId,
      discordId,
      expiresAt,
      createdAt: new Date().toISOString(),
    })

    return code
  }
}

export const authService = new AuthService()
export default new AuthService();