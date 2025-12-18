import { db } from '@/config/firebase'
import { Group, RecommendedPlace, RatingCategory } from '@/types'
import { ratingService } from './rating.service'

export class RecommendationService {
  /**
   * Find similar users by personality and location
   */
  async findSimilarUsers(
    userId: string,
    maxDistance: number,
    personalityRange: number
  ): Promise<Array<{
    userId: string
    displayName: string
    personalityType: string
    adjustmentFactor: number
    similarity: number
    distance: number
  }>> {
    // Get current user
    const userDoc = await db.collection('users').doc(userId).get()

    if (!userDoc.exists) {
      throw new Error('User not found')
    }

    const userData = userDoc.data()
    if (!userData) {
      throw new Error('User data not found')
    }
    
    const userAF = userData.adjustmentFactor || 0
    const userLocation = userData.lastRatedPlaceLocation

    if (!userLocation) {
      // Return empty array instead of throwing error
      return []
    }

    // Get all users with personality data
    // Note: Firestore doesn't support != null queries well, so we'll filter client-side
    const usersSnapshot = await db.collection('users').get()

    const matches: Array<{
      userId: string
      displayName: string
      personalityType: string
      adjustmentFactor: number
      similarity: number
      distance: number
    }> = []

    for (const userDocSnap of usersSnapshot.docs) {
      if (userDocSnap.id === userId) continue // Skip self

      const otherUserData = userDocSnap.data()
      if (!otherUserData) continue
      
      // Skip users without personality data
      if (!otherUserData.personalityType) continue
      
      const otherAF = otherUserData.adjustmentFactor || 0
      const otherLocation = otherUserData.lastRatedPlaceLocation

      // Calculate personality similarity
      const personalityDistance = Math.abs(userAF - otherAF)
      if (personalityDistance > personalityRange) continue

      const similarity = 1 - (personalityDistance / personalityRange)

      // Calculate distance if both have locations
      let distance = 0
      if (otherLocation && userLocation) {
        distance = this.haversineDistance(
          userLocation.lat,
          userLocation.lng,
          otherLocation.lat,
          otherLocation.lng
        )
        if (distance > maxDistance) continue
      } else if (!otherLocation) {
        continue // Skip users without location
      }

      matches.push({
        userId: userDocSnap.id,
        displayName: otherUserData.displayName || 'Unknown',
        personalityType: otherUserData.personalityType || 'Unknown',
        adjustmentFactor: otherAF,
        similarity,
        distance,
      })
    }

    // Sort by similarity (descending), then by distance (ascending)
    matches.sort((a, b) => {
      if (Math.abs(a.similarity - b.similarity) < 0.01) {
        return a.distance - b.distance
      }
      return b.similarity - a.similarity
    })

    return matches
  }

  /**
   * Calculate similarity between two users
   */
  async calculateUserSimilarity(userId1: string, userId2: string): Promise<number> {
    const [user1Doc, user2Doc] = await Promise.all([
      db.collection('users').doc(userId1).get(),
      db.collection('users').doc(userId2).get(),
    ])

    if (!user1Doc.exists || !user2Doc.exists) {
      throw new Error('One or both users not found')
    }

    const user1Data = user1Doc.data()
    const user2Data = user2Doc.data()
    
    if (!user1Data || !user2Data) {
      throw new Error('User data not found')
    }

    const af1 = user1Data.adjustmentFactor || 0
    const af2 = user2Data.adjustmentFactor || 0

    // Similarity based on adjustment factor distance
    // Range is -1 to 1, so max distance is 2
    const distance = Math.abs(af1 - af2)
    const similarity = 1 - (distance / 2)

    return Math.max(0, Math.min(1, similarity))
  }

  /**
   * Generate recommendations for a group
   */
  async generateGroupRecommendations(
    group: Group,
    searchRadius: number
  ): Promise<RecommendedPlace[]> {
    const { memberProfiles, searchLocation } = group

    // Get nearby places from rating service
    const nearbyPlaces = await ratingService.getNearbyPlaces(
      searchLocation.lat,
      searchLocation.lng,
      searchRadius
    )

    // Calculate average adjustment factor for the group
    const memberAFs = Object.values(memberProfiles).map(m => m.adjustmentFactor)
    const avgAF = memberAFs.reduce((sum, af) => sum + af, 0) / memberAFs.length

    // Score each place for the group
    const recommendations: RecommendedPlace[] = []

    for (const place of nearbyPlaces) {
      const score = await this.scorePlaceForGroup(place, group, avgAF)
      if (score) {
        recommendations.push(score)
      }
    }

    // Sort by predicted score * confidence
    recommendations.sort(
      (a, b) => b.predictedScore * b.confidenceScore - a.predictedScore * a.confidenceScore
    )

    // Return top 10
    return recommendations.slice(0, 10)
  }

  /**
   * Score a place for a group
   */
  private async scorePlaceForGroup(
    place: any,
    group: Group,
    avgAF: number
  ): Promise<RecommendedPlace | null> {
    // Get ratings for this place
    const ratings = await ratingService.getPlaceRatings(place.id)

    if (ratings.length === 0) {
      return null // Can't recommend without data
    }

    // Filter ratings from users with similar personality to group average
    const similarRatings = ratings.filter(rating => {
      const distance = Math.abs(rating.userAdjustmentFactor - avgAF)
      return distance <= 0.3
    })

    if (similarRatings.length === 0) {
      // Use all ratings if no similar users
      const avgScore = ratings.reduce((sum, r) => sum + r.overallScore, 0) / ratings.length
      return {
        placeId: place.id,
        placeName: place.name || 'Unknown Place',
        address: place.address || '',
        location: place.location,
        predictedScore: Math.round(avgScore * 10) / 10,
        confidenceScore: Math.min(ratings.length / 20, 1.0),
        reasoning: `Based on ${ratings.length} ratings from all users`,
        categories: this.calculateAverageCategories(ratings),
      }
    }

    // Calculate average from similar users
    const avgScore =
      similarRatings.reduce((sum, r) => sum + r.overallScore, 0) / similarRatings.length

    // Calculate confidence based on number of similar ratings
    const confidence = Math.min(similarRatings.length / 10, 1.0)

    return {
      placeId: place.id,
      placeName: place.name || 'Unknown Place',
      address: place.address || '',
      location: place.location,
      predictedScore: Math.round(avgScore * 10) / 10,
      confidenceScore: Math.round(confidence * 100) / 100,
      reasoning: `Based on ${similarRatings.length} ratings from users with similar personality`,
      categories: this.calculateAverageCategories(similarRatings),
    }
  }

  /**
   * Calculate average categories from ratings
   */
  private calculateAverageCategories(ratings: any[]): RatingCategory {
    if (ratings.length === 0) {
      return {
        crowdSize: 5,
        noiseLevel: 5,
        socialEnergy: 5,
        service: 5,
        cleanliness: 5,
        atmosphere: 5,
        accessibility: 5,
      }
    }

    const totals = ratings.reduce(
      (acc, r) => {
        acc.crowdSize += r.categories.crowdSize || 5
        acc.noiseLevel += r.categories.noiseLevel || 5
        acc.socialEnergy += r.categories.socialEnergy || 5
        acc.service += r.categories.service || 5
        acc.cleanliness += r.categories.cleanliness || 5
        acc.atmosphere += r.categories.atmosphere || 5
        acc.accessibility += r.categories.accessibility || 5
        return acc
      },
      {
        crowdSize: 0,
        noiseLevel: 0,
        socialEnergy: 0,
        service: 0,
        cleanliness: 0,
        atmosphere: 0,
        accessibility: 0,
      }
    )

    const count = ratings.length
    return {
      crowdSize: Math.round((totals.crowdSize / count) * 10) / 10,
      noiseLevel: Math.round((totals.noiseLevel / count) * 10) / 10,
      socialEnergy: Math.round((totals.socialEnergy / count) * 10) / 10,
      service: Math.round((totals.service / count) * 10) / 10,
      cleanliness: Math.round((totals.cleanliness / count) * 10) / 10,
      atmosphere: Math.round((totals.atmosphere / count) * 10) / 10,
      accessibility: Math.round((totals.accessibility / count) * 10) / 10,
    }
  }

  /**
   * Haversine formula for distance calculation
   */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371 // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }
}

export const recommendationService = new RecommendationService()

