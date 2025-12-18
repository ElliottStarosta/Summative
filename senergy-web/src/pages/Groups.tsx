import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import axios from 'axios'
import gsap from 'gsap'

interface Group {
  id: string
  createdBy: string
  members: string[]
  memberProfiles: { [key: string]: { displayName: string; personalityType: string; adjustmentFactor: number } }
  searchLocation: { lat: number; lng: number }
  searchRadius: number
  city: string
  recommendedPlaces?: Array<{
    placeId: string
    placeName: string
    predictedScore: number
    confidenceScore: number
    reasoning: string
  }>
  votes: { [userId: string]: string[] }
  finalPlace?: { placeId: string; placeName: string }
  status: 'active' | 'place_selected' | 'archived'
  createdAt: string
}

interface User {
  id: string
  displayName: string
  personalityType: string
}

const STAGE = {
  LIST: 'list',
  CREATE: 'create',
  DETAIL: 'detail',
  RECOMMEND: 'recommend',
  VOTE: 'vote',
  RESULT: 'result',
}

export const Groups: React.FC = () => {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const { groupId } = useParams()
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // State
  const [stage, setStage] = useState(groupId ? STAGE.DETAIL : STAGE.LIST)
  const [groups, setGroups] = useState<Group[]>([])
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)

  // Create form
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [searchLocation, setSearchLocation] = useState('')
  const [searchRadius, setSearchRadius] = useState(15)
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [memberSearch, setMemberSearch] = useState('')

  // Voting
  const [votes, setVotes] = useState<{ [placeId: string]: number }>({}) // placeId → rank (1, 2, 3)
  const [votingResults, setVotingResults] = useState<any>(null)

  // Load groups on mount
  useEffect(() => {
    if (!user?.id || !token) return

    const loadGroups = async () => {
      try {
        const response = await axios.get('/api/groups/user/active', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setGroups(response.data.data || [])

        // Load specific group if URL param
        if (groupId) {
          const group = response.data.data.find((g: Group) => g.id === groupId)
          if (group) setCurrentGroup(group)
        }
      } catch (error) {
        console.error('Failed to load groups:', error)
      } finally {
        setLoading(false)
      }
    }

    loadGroups()
  }, [user?.id, token, groupId])

  // Animations
  useEffect(() => {
    if (contentRef.current) {
      gsap.fromTo(contentRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' })
    }
  }, [stage])

  // Load available users for creation
  useEffect(() => {
    if (stage === STAGE.CREATE && availableUsers.length === 0) {
      // In real app, fetch from /api/users/matches
      setAvailableUsers([
        { id: 'user1', displayName: 'Alex', personalityType: 'Moderate Extrovert' },
        { id: 'user2', displayName: 'Jordan', personalityType: 'Ambivert' },
        { id: 'user3', displayName: 'Sam', personalityType: 'Introvert' },
      ])
    }
  }, [stage])

  const handleCreateGroup = async () => {
    if (!user?.id || selectedMembers.length === 0 || !searchLocation) {
      alert('Please select members and location')
      return
    }

    try {
      const response = await axios.post(
        '/api/groups',
        {
          memberIds: selectedMembers,
          searchLocation: { lat: 47.6062, lng: -122.3321 }, // Mock coords for Seattle
          city: searchLocation,
          searchRadius,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const newGroup = response.data.data
      setCurrentGroup(newGroup)
      setStage(STAGE.DETAIL)
    } catch (error) {
      alert('Failed to create group')
    }
  }

  const handleGenerateRecommendations = async () => {
    if (!currentGroup?.id || !token) return

    try {
      const response = await axios.post(
        `/api/groups/${currentGroup.id}/recommend`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setCurrentGroup(prev => prev ? { ...prev, recommendedPlaces: response.data.data } : null)
      setStage(STAGE.RECOMMEND)
    } catch (error) {
      alert('Failed to generate recommendations')
    }
  }

  const handleVote = async () => {
    if (!currentGroup?.id || Object.keys(votes).length === 0) {
      alert('Please vote for at least one place')
      return
    }

    try {
      // Convert votes object to ranked array
      const rankedPlaces = Object.entries(votes)
        .sort((a, b) => a[1] - b[1]) // Sort by rank
        .map(([placeId]) => placeId)

      await axios.post(
        `/api/groups/${currentGroup.id}/vote`,
        { rankedPlaceIds: rankedPlaces },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Get voting results
      const resultsResponse = await axios.get(`/api/groups/${currentGroup.id}/votes`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setVotingResults(resultsResponse.data.data)
      setStage(STAGE.RESULT)
    } catch (error) {
      alert('Failed to submit vote')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-blue-50">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-indigo-600 mb-4" />
          <p className="text-slate-600">Loading groups...</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-neutral-50 via-slate-50 to-blue-50">
      {/* Header */}
      <header className="w-full border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-3 hover:opacity-75">
            <i className="fas fa-arrow-left text-indigo-600" />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Groups</p>
              <h1 className="text-lg font-bold text-slate-900">Plan with your crew</h1>
            </div>
          </button>
          <button
            onClick={() => {
              setStage(STAGE.CREATE)
              setSelectedMembers([])
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold"
          >
            <i className="fas fa-plus mr-2" />
            New Group
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* STAGE: List Groups */}
        {stage === STAGE.LIST && (
          <div ref={contentRef} className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Your Groups</h2>
            {groups.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-12 text-center">
                <i className="fas fa-users text-4xl text-slate-300 mb-4" />
                <p className="text-slate-600 mb-4">No groups yet</p>
                <button
                  onClick={() => setStage(STAGE.CREATE)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold"
                >
                  Create your first group
                </button>
              </div>
            ) : (
              groups.map(group => (
                <div
                  key={group.id}
                  onClick={() => {
                    setCurrentGroup(group)
                    setStage(STAGE.DETAIL)
                  }}
                  className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 hover:shadow-lg cursor-pointer transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {group.finalPlace?.placeName || `${group.members.length} people`}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">{group.city}</p>
                      <div className="flex gap-2 mt-3">
                        {group.members.slice(0, 3).map(memberId => {
                          const profile = group.memberProfiles[memberId]
                          return (
                            <div
                              key={memberId}
                              className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-xs flex items-center justify-center font-semibold"
                              title={profile?.displayName}
                            >
                              {profile?.displayName[0]}
                            </div>
                          )
                        })}
                        {group.members.length > 3 && (
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 text-xs flex items-center justify-center font-semibold">
                            +{group.members.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        group.status === 'place_selected'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {group.status === 'place_selected' ? 'Planned' : 'Planning'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* STAGE: Create Group */}
        {stage === STAGE.CREATE && (
          <div ref={contentRef} className="bg-white rounded-2xl shadow-md border border-slate-100 p-8 max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Create a Group</h2>

            {/* Members Selection */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-slate-700 block mb-3">Select Members</label>
              <input
                type="text"
                placeholder="Search people..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-500 outline-none mb-3"
              />
              <div className="space-y-2">
                {availableUsers
                  .filter(u => u.displayName.toLowerCase().includes(memberSearch.toLowerCase()))
                  .map(user => (
                    <button
                      key={user.id}
                      onClick={() => {
                        if (selectedMembers.includes(user.id)) {
                          setSelectedMembers(selectedMembers.filter(id => id !== user.id))
                        } else {
                          setSelectedMembers([...selectedMembers, user.id])
                        }
                      }}
                      className={`w-full p-3 rounded-xl border-2 text-left transition ${
                        selectedMembers.includes(user.id)
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-slate-900">{user.displayName}</div>
                      <div className="text-xs text-slate-500">{user.personalityType}</div>
                    </button>
                  ))}
              </div>
              <p className="text-sm text-slate-500 mt-2">{selectedMembers.length} selected</p>
            </div>

            {/* Location */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-slate-700 block mb-3">Where are you planning?</label>
              <input
                type="text"
                placeholder="City or neighborhood"
                value={searchLocation}
                onChange={e => setSearchLocation(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 outline-none"
              />
            </div>

            {/* Search Radius */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-slate-700 block mb-3">
                Search Radius: {searchRadius}km
              </label>
              <input
                type="range"
                min={5}
                max={50}
                value={searchRadius}
                onChange={e => setSearchRadius(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setStage(STAGE.LIST)}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={selectedMembers.length === 0 || !searchLocation}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold disabled:opacity-50"
              >
                Create Group
              </button>
            </div>
          </div>
        )}

        {/* STAGE: Group Detail */}
        {stage === STAGE.DETAIL && currentGroup && (
          <div ref={contentRef} className="space-y-6">
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-slate-900">Group Details</h2>
                <button
                  onClick={() => setStage(STAGE.LIST)}
                  className="text-slate-500 hover:text-slate-700"
                >
                  ← Back
                </button>
              </div>

              {/* Members */}
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-600 uppercase mb-3">Members</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {currentGroup.members.map(memberId => {
                    const profile = currentGroup.memberProfiles[memberId]
                    return (
                      <div key={memberId} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="font-semibold text-slate-900">{profile?.displayName}</p>
                        <p className="text-xs text-slate-500">{profile?.personalityType}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Location */}
              <div className="mb-6 p-3 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-sm font-semibold text-blue-900">{currentGroup.city}</p>
                <p className="text-xs text-blue-700">Search radius: {currentGroup.searchRadius}km</p>
              </div>

              {/* Actions */}
              {currentGroup.status === 'active' && !currentGroup.recommendedPlaces && (
                <button
                  onClick={handleGenerateRecommendations}
                  className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold"
                >
                  Get Recommendations
                </button>
              )}
            </div>
          </div>
        )}

        {/* STAGE: Recommendations */}
        {stage === STAGE.RECOMMEND && currentGroup?.recommendedPlaces && (
          <div ref={contentRef} className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900">Top Recommendations</h2>
            <div className="space-y-4">
              {currentGroup.recommendedPlaces.map((place, idx) => (
                <div key={place.placeId} className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-indigo-600">{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][idx]}</span>
                        <h3 className="text-lg font-bold text-slate-900">{place.placeName}</h3>
                      </div>
                      <p className="text-sm text-slate-500 mb-3">{place.reasoning}</p>
                      <div className="flex gap-4">
                        <div>
                          <p className="text-xs text-slate-500">Score</p>
                          <p className="text-xl font-bold text-indigo-600">{place.predictedScore}/10</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Confidence</p>
                          <p className="text-xl font-bold text-purple-600">{Math.round(place.confidenceScore * 100)}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStage(STAGE.VOTE)}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold"
            >
              Vote for Your Favorite
            </button>
          </div>
        )}

        {/* STAGE: Voting */}
        {stage === STAGE.VOTE && currentGroup?.recommendedPlaces && (
          <div ref={contentRef} className="bg-white rounded-2xl shadow-md border border-slate-100 p-8 max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Ranked Choice Voting</h2>
            <p className="text-slate-600 mb-6">Select your top 3 places in order (1st, 2nd, 3rd choice)</p>

            <div className="space-y-3 mb-6">
              {[1, 2, 3].map(rank => {
                const selectedPlace = Object.entries(votes).find(([_, r]) => r === rank)?.[0]
                return (
                  <div key={rank} className="border-2 border-slate-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-slate-600 mb-3">
                      #{rank} Choice {selectedPlace && '✓'}
                    </p>
                    {selectedPlace ? (
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-900">
                          {currentGroup.recommendedPlaces?.find(p => p.placeId === selectedPlace)?.placeName}
                        </p>
                        <button
                          onClick={() => {
                            const newVotes = { ...votes }
                            delete newVotes[selectedPlace]
                            setVotes(newVotes)
                          }}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {currentGroup.recommendedPlaces
                          ?.filter(p => !Object.keys(votes).includes(p.placeId) || votes[p.placeId] === rank)
                          .map(place => (
                            <button
                              key={place.placeId}
                              onClick={() => setVotes({ ...votes, [place.placeId]: rank })}
                              className="w-full text-left p-2 rounded-lg hover:bg-slate-100 text-slate-900"
                            >
                              {place.placeName}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={handleVote}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold"
            >
              Submit Votes
            </button>
          </div>
        )}

        {/* STAGE: Result */}
        {stage === STAGE.RESULT && votingResults && (
          <div ref={contentRef} className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-check text-white text-3xl" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Votes Submitted!</h2>
            <p className="text-slate-600">The group will decide on the final place soon.</p>
            <button
              onClick={() => {
                setStage(STAGE.LIST)
                navigate('/groups')
              }}
              className="mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold"
            >
              Back to Groups
            </button>
          </div>
        )}
      </main>
    </div>
  )
}