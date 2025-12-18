import { db } from '@/config/firebase'
import admin from '@/config/firebase'
import { recommendationService } from './recommendation.service'
import { Group, GroupMember, RecommendedPlace } from '@/types'

export class GroupService {
  private groupsCol = db.collection('groups')
  private usersCol = db.collection('users')

  /**
   * Create a new group
   */
  async createGroup(
    createdBy: string,
    memberIds: string[],
    searchLocation: { lat: number; lng: number },
    city: string,
    communityId?: string,
    communityName?: string
  ): Promise<Group> {
    // Ensure creator is in the group
    if (!memberIds.includes(createdBy)) {
      memberIds = [createdBy, ...memberIds]
    }

    // Get all member profiles
    const memberProfiles: { [key: string]: GroupMember } = {}
    for (const memberId of memberIds) {
      const userDoc = await this.usersCol.doc(memberId).get()

      if (!userDoc.exists) {
        throw new Error(`User ${memberId} not found`)
      }

      const user = userDoc.data()
      memberProfiles[memberId] = {
        userId: memberId,
        displayName: user.displayName,
        adjustmentFactor: user.adjustmentFactor || 0,
        personalityType: user.personalityType || 'Unknown',
      }
    }

    const groupData = {
      createdBy,
      createdAt: new Date().toISOString(),
      members: memberIds,
      memberProfiles,
      searchLocation,
      searchRadius: 15,
      city,
      communityId: communityId || null,
      communityName: communityName || null,
      recommendedPlaces: [],
      votes: {},
      status: 'active' as const,
    }

    const groupRef = await this.groupsCol.add(groupData)

    // Update user stats
    for (const memberId of memberIds) {
      await this.updateUserGroupStats(memberId, 1)
    }

    return { id: groupRef.id, ...groupData } as Group
  }

  /**
   * Get group by ID
   */
  async getGroup(groupId: string): Promise<Group | null> {
    const groupDoc = await this.groupsCol.doc(groupId).get()

    if (!groupDoc.exists) {
      return null
    }

    return { id: groupDoc.id, ...groupDoc.data() } as Group
  }

  /**
   * Get all active groups for a user
   */
  async getUserActiveGroups(userId: string): Promise<Group[]> {
    const snapshot = await this.groupsCol
      .where('members', 'array-contains', userId)
      .where('status', '==', 'active')
      .get()

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group))
  }

  /**
   * Add member to group
   */
  async addMember(groupId: string, userId: string): Promise<void> {
    const groupDoc = await this.groupsCol.doc(groupId).get()

    if (!groupDoc.exists) {
      throw new Error('Group not found')
    }

    const group = groupDoc.data() as Group
    if (group.members.includes(userId)) {
      throw new Error('User already in group')
    }

    // Get user profile
    const userDoc = await this.usersCol.doc(userId).get()

    if (!userDoc.exists) {
      throw new Error('User not found')
    }

    const user = userDoc.data()
    const memberProfile: GroupMember = {
      userId,
      displayName: user.displayName,
      adjustmentFactor: user.adjustmentFactor || 0,
      personalityType: user.personalityType || 'Unknown',
    }

    const groupRef = this.groupsCol.doc(groupId)
    await groupRef.update({
      members: admin.firestore.FieldValue.arrayUnion(userId),
      [`memberProfiles.${userId}`]: memberProfile,
    })

    await this.updateUserGroupStats(userId, 1)
  }

  /**
   * Remove member from group
   */
  async removeMember(groupId: string, userId: string): Promise<void> {
    const groupDoc = await this.groupsCol.doc(groupId).get()

    if (!groupDoc.exists) {
      throw new Error('Group not found')
    }

    const group = groupDoc.data() as Group

    // Don't allow creator to leave (must disband group)
    if (group.createdBy === userId && group.members.length > 1) {
      throw new Error('Creator cannot leave group. Disband the group instead.')
    }

    const groupRef = this.groupsCol.doc(groupId)
    await groupRef.update({
      members: admin.firestore.FieldValue.arrayRemove(userId),
    })

    // Remove from votes
    const updatedVotes = { ...group.votes }
    delete updatedVotes[userId]
    await groupRef.update({ votes: updatedVotes })
  }

  /**
   * Generate recommendations for a group
   */
  async generateRecommendations(groupId: string, searchRadius?: number): Promise<RecommendedPlace[]> {
    const groupDoc = await this.groupsCol.doc(groupId).get()

    if (!groupDoc.exists) {
      throw new Error('Group not found')
    }

    const group = groupDoc.data() as Group
    const recommendations = await recommendationService.generateGroupRecommendations(
      group,
      searchRadius || group.searchRadius
    )

    // Store recommendations in group
    await this.groupsCol.doc(groupId).update({
      recommendedPlaces: recommendations,
    })

    return recommendations
  }

  /**
   * Cast ranked choice votes
   */
  async castVotes(groupId: string, userId: string, rankedPlaceIds: string[]): Promise<void> {
    if (rankedPlaceIds.length === 0 || rankedPlaceIds.length > 3) {
      throw new Error('Must vote for 1-3 places')
    }

    const groupDoc = await this.groupsCol.doc(groupId).get()

    if (!groupDoc.exists) {
      throw new Error('Group not found')
    }

    const group = groupDoc.data() as Group
    if (!group.members.includes(userId)) {
      throw new Error('User not in group')
    }

    await this.groupsCol.doc(groupId).update({
      [`votes.${userId}`]: rankedPlaceIds,
    })
  }

  /**
   * Get voting results (ranked choice counting)
   */
  async getVotingResults(groupId: string): Promise<{
    [placeId: string]: { score: number; votes: Array<{ userId: string; rank: number }> }
  }> {
    const groupDoc = await this.groupsCol.doc(groupId).get()

    if (!groupDoc.exists) {
      throw new Error('Group not found')
    }

    const group = groupDoc.data() as Group
    const results: { [placeId: string]: { score: number; votes: Array<any> } } = {}

    // Ranked choice voting: 1st choice = 3pts, 2nd = 2pts, 3rd = 1pt
    Object.entries(group.votes).forEach(([userId, rankedPlaces]) => {
      ;(rankedPlaces as string[]).forEach((placeId, index) => {
        if (!results[placeId]) {
          results[placeId] = { score: 0, votes: [] }
        }

        const points = [3, 2, 1][index] || 0
        results[placeId].score += points
        results[placeId].votes.push({ userId, rank: index + 1 })
      })
    })

    return results
  }

  /**
   * Finalize group selection
   */
  async finalizeSelection(groupId: string, placeId: string, placeName: string): Promise<void> {
    const groupDoc = await this.groupsCol.doc(groupId).get()

    if (!groupDoc.exists) {
      throw new Error('Group not found')
    }

    await this.groupsCol.doc(groupId).update({
      'finalPlace.placeId': placeId,
      'finalPlace.placeName': placeName,
      'finalPlace.selectedAt': new Date().toISOString(),
      status: 'place_selected',
    })
  }

  /**
   * Archive group
   */
  async archiveGroup(groupId: string): Promise<void> {
    await this.groupsCol.doc(groupId).update({ status: 'archived' })
  }

  /**
   * Disband group
   */
  async disbandGroup(groupId: string, userId: string): Promise<void> {
    const groupDoc = await this.groupsCol.doc(groupId).get()

    if (!groupDoc.exists) {
      throw new Error('Group not found')
    }

    const group = groupDoc.data() as Group
    if (group.createdBy !== userId) {
      throw new Error('Only creator can disband group')
    }

    await this.groupsCol.doc(groupId).delete()
  }

  /**
   * Get groups in a community
   */
  async getCommunityGroups(communityId: string): Promise<Group[]> {
    const snapshot = await this.groupsCol.where('communityId', '==', communityId).get()

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group))
  }

  /**
   * Private: Update user group stats
   */
  private async updateUserGroupStats(userId: string, increment: number): Promise<void> {
    const userDoc = await this.usersCol.doc(userId).get()

    if (userDoc.exists) {
      const user = userDoc.data()
      await this.usersCol.doc(userId).update({
        totalGroupsJoined: (user.totalGroupsJoined || 0) + increment,
      })
    }
  }
}

export const groupService = new GroupService()