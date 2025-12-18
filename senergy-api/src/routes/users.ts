import { Router, Request, Response } from 'express'
import { authMiddleware } from '@/middleware/auth'
import { recommendationService } from '@/services/recommendation.service'
import { db } from '@/config/firebase'

const router = Router()

/**
 * GET /api/users/matches
 * Find similar users by personality and location
 */
router.get('/matches', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const personalityRange = parseFloat(req.query.personalityRange as string) || 0.3
    const maxDistance = parseInt(req.query.maxDistance as string) || 50

    // Validate parameters
    if (personalityRange < 0 || personalityRange > 1) {
      return res.status(400).json({
        success: false,
        error: 'personalityRange must be between 0 and 1',
      })
    }

    if (maxDistance < 1 || maxDistance > 200) {
      return res.status(400).json({
        success: false,
        error: 'maxDistance must be between 1 and 200 km',
      })
    }

    const matches = await recommendationService.findSimilarUsers(
      userId,
      maxDistance,
      personalityRange
    )

    res.json({
      success: true,
      data: matches,
      count: matches.length,
      meta: {
        personalityRange,
        maxDistanceKm: maxDistance,
      },
    })
  } catch (error: any) {
    console.error('Find matches error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to find matches',
    })
  }
})

/**
 * GET /api/users/:userId/profile
 * Get public user profile (for matching)
 */
router.get('/:userId/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params

    const userRef = db.collection('users').doc(userId)
    const userDoc = await userRef.get()

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const userData = userDoc.data()

    if (!userData) {
      return res.status(404).json({
        success: false,
        error: 'User data not found',
      })
    }

    // Return only public fields
    const publicProfile = {
      id: userId,
      displayName: userData.displayName,
      avatar: userData.avatar || null,
      personalityType: userData.personalityType || null,
      adjustmentFactor: userData.adjustmentFactor || 0,
      totalRatingsCount: userData.totalRatingsCount || 0,
      totalGroupsJoined: userData.totalGroupsJoined || 0,
      city: userData.city || null,
      createdAt: userData.createdAt,
    }

    res.json({
      success: true,
      data: publicProfile,
    })
  } catch (error: any) {
    console.error('Get profile error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch profile',
    })
  }
})

/**
 * GET /api/users/similarity/:userId1/:userId2
 * Calculate similarity between two users
 */
router.get('/similarity/:userId1/:userId2', async (req: Request, res: Response) => {
  try {
    const { userId1, userId2 } = req.params

    const similarity = await recommendationService.calculateUserSimilarity(userId1, userId2)

    res.json({
      success: true,
      data: {
        user1: userId1,
        user2: userId2,
        similarity: Math.round(similarity * 100) / 100, // 0-1 scale
        similarityPercent: Math.round(similarity * 100), // 0-100%
      },
    })
  } catch (error: any) {
    console.error('Calculate similarity error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate similarity',
    })
  }
})

export default router