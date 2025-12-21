import { db } from '@/config/firebase'
import { User, QuizSubmission } from '@/types'
import { authService } from './auth.service'

interface QuizQuestionDef {
  id: number
  text: string
  weight: number
  reverse?: boolean
}

const QUIZ_QUESTIONS: QuizQuestionDef[] = [
  { id: 1, text: 'Large parties energize me', weight: 3, reverse: false },
  { id: 2, text: 'I prefer quiet, intimate gatherings', weight: 3, reverse: true },
  { id: 3, text: 'I need alone time after social events', weight: 2, reverse: true },
  { id: 4, text: 'I am comfortable being the center of attention', weight: 2, reverse: false },
  { id: 5, text: 'I prefer deep conversations over small talk', weight: 2, reverse: true },
  { id: 6, text: 'I enjoy spontaneous social activities', weight: 1, reverse: false },
  { id: 7, text: 'I recharge by being around people', weight: 3, reverse: false },
  { id: 8, text: 'I think out loud when making decisions', weight: 1, reverse: false },
  { id: 9, text: 'I am energized by new social environments', weight: 2, reverse: false },
  { id: 10, text: 'I prefer working in teams vs alone', weight: 1, reverse: false },
]

export class QuizService {
  getQuestions() {
    return QUIZ_QUESTIONS
  }

  calculatePersonality(responses: number[]): {
    adjustmentFactor: number
    personalityType: string
    description: string
  } {
    if (responses.length !== QUIZ_QUESTIONS.length) {
      throw new Error('Invalid number of responses')
    }

    // Calculate weighted score
    let weightedSum = 0
    let totalWeight = 0

    for (let i = 0; i < responses.length; i++) {
      let response = responses[i]
      const question = QUIZ_QUESTIONS[i]

      // Apply reverse scoring if needed
      if (question.reverse) {
        response = 6 - response // Scale 1-5: becomes 5-1
      }

      weightedSum += response * question.weight
      totalWeight += question.weight
    }

    // Calculate average (1-5 scale)
    const average = weightedSum / totalWeight

    // Normalize to -1 to 1 scale
    // If average is 3 (neutral), AF should be 0
    // If average is 5 (max extrovert), AF should be +1
    // If average is 1 (max introvert), AF should be -1
    const adjustmentFactor = (average - 3) / 2

    // Determine personality type
    let personalityType: string
    let description: string

    if (adjustmentFactor <= -0.6) {
      personalityType = 'Strong Introvert'
      description =
        'You recharge through solitude and prefer quieter, more intimate social settings. Large gatherings may feel overwhelming, but you thrive in meaningful one-on-one conversations.'
    } else if (adjustmentFactor <= -0.2) {
      personalityType = 'Moderate Introvert'
      description =
        'You enjoy social interaction but need quiet time to recharge. You prefer smaller groups and deeper conversations over large parties.'
    } else if (adjustmentFactor <= 0.2) {
      personalityType = 'Ambivert'
      description =
        'You have a balanced approach to social energy. You can adapt to various situations and enjoy both social gatherings and quiet time.'
    } else if (adjustmentFactor <= 0.6) {
      personalityType = 'Moderate Extrovert'
      description =
        "You're energized by social interaction and enjoy group activities. You're comfortable in the spotlight but also appreciate quieter moments."
    } else {
      personalityType = 'Strong Extrovert'
      description =
        'You thrive in social situations and gain energy from being around others. Large gatherings and spontaneous activities energize you.'
    }

    return {
      adjustmentFactor: Math.max(-1, Math.min(1, adjustmentFactor)),
      personalityType,
      description,
    }
  }

  async submitQuiz(
    userId: string,
    responses: number[]
  ): Promise<QuizSubmission & { user: User; verificationCode?: string }> {
    // Validate responses
    if (responses.length !== QUIZ_QUESTIONS.length) {
      throw new Error('Invalid number of responses')
    }
  
    if (!responses.every((r) => r >= 1 && r <= 5)) {
      throw new Error('Invalid response values')
    }
  
    // Calculate personality
    const { adjustmentFactor, personalityType, description } =
      this.calculatePersonality(responses)
  
    // Get current user
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      throw new Error('User not found')
    }
  
    const userData = userDoc.data() as User
  
    // Create quiz submission record
    const quizSubmission: QuizSubmission = {
      userId,
      responses,
      adjustmentFactor,
      personalityType,
      description,
      timestamp: new Date().toISOString(),
    }
  
    // Save to Firestore
    await db.collection('quizzes').doc(userId).set(quizSubmission, { merge: true })
  
    // Update user profile with personality info
    await db.collection('users').doc(userId).update({
      personalityType,
      adjustmentFactor,
      quizCompletedAt: new Date().toISOString(),
    })
  
    const updatedUser: User = {
      ...userData,
      personalityType,
      adjustmentFactor,
    }
  
    // Generate verification code if user has Discord ID
    let verificationCode: string | undefined
    if (userData.discordId) {
      verificationCode = await authService.generateVerificationCode(userId, userData.discordId)
    }
  
    return {
      ...quizSubmission,
      user: updatedUser,
      verificationCode,
    }
  }

  async getQuizResult(userId: string): Promise<QuizSubmission | null> {
    const doc = await db.collection('quizzes').doc(userId).get()

    if (!doc.exists) {
      return null
    }

    return doc.data() as QuizSubmission
  }
}

export const quizService = new QuizService()