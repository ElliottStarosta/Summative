import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import axios from 'axios'

interface PlaceDetails {
  id: string
  name: string
  address: string
  location: { lat: number; lng: number }
  stats: {
    totalRatings: number
    avgOverallScore: number
    byPersonality: {
      introvert: { avgScore: number; count: number }
      ambivert: { avgScore: number; count: number }
      extrovert: { avgScore: number; count: number }
    }
    avgCategories: {
      crowdSize: number
      noiseLevel: number
      socialEnergy: number
      service: number
      cleanliness: number
      atmosphere: number
      accessibility: number
    }
    lastRatedAt: string
  }
  ratings: Array<{
    id: string
    userId: string
    userDisplayName?: string
    userPersonalityType: string
    overallScore: number
    categories: any
    comment?: string
    createdAt: string
  }>
}

export const PlaceDetails: React.FC = () => {
  const { placeId } = useParams<{ placeId: string }>()
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [place, setPlace] = useState<PlaceDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!placeId) {
      setError('Place ID required')
      setLoading(false)
      return
    }

    const fetchPlaceDetails = async () => {
      try {
        const response = await axios.get(`/api/ratings/place/${placeId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        // Get place info from places collection or use first rating
        const placeData = response.data.data
        if (!placeData.ratings || placeData.ratings.length === 0) {
          setError('Place not found')
          setLoading(false)
          return
        }

        // Construct place details from stats and first rating
        const firstRating = placeData.ratings[0]
        setPlace({
          id: placeId,
          name: firstRating.placeName,
          address: firstRating.placeAddress || '',
          location: firstRating.location,
          stats: placeData.stats || {
            totalRatings: placeData.ratings.length,
            avgOverallScore: 0,
            byPersonality: {
              introvert: { avgScore: 0, count: 0 },
              ambivert: { avgScore: 0, count: 0 },
              extrovert: { avgScore: 0, count: 0 },
            },
            avgCategories: {
              crowdSize: 0,
              noiseLevel: 0,
              socialEnergy: 0,
              service: 0,
              cleanliness: 0,
              atmosphere: 0,
              accessibility: 0,
            },
            lastRatedAt: '',
          },
          ratings: placeData.ratings.map((r: any) => ({
            id: r.id,
            userId: r.userId,
            userDisplayName: r.userEmail?.split('@')[0] || 'Anonymous',
            userPersonalityType: r.userPersonalityType || 'Unknown',
            overallScore: r.overallScore,
            categories: r.categories,
            comment: r.comment,
            createdAt: r.createdAt,
          })),
        })
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load place details')
      } finally {
        setLoading(false)
      }
    }

    fetchPlaceDetails()
  }, [placeId, token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-primary-50">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-primary-600 mb-4" />
          <p className="text-neutral-600">Loading place details...</p>
        </div>
      </div>
    )
  }

  if (error || !place) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-primary-50">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4" />
          <p className="text-neutral-600">{error || 'Place not found'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const mapUrl = `https://www.google.com/maps?q=${place.location.lat},${place.location.lng}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-slate-50 to-blue-50">
      {/* Header */}
      <header className="w-full border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-3 hover:opacity-75 transition"
          >
            <i className="fas fa-arrow-left text-indigo-600" />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Place Details</p>
              <h1 className="text-lg font-bold text-slate-900">{place.name}</h1>
            </div>
          </button>
          {user && (
            <Link
              to={`/rate?placeId=${placeId}&placeName=${encodeURIComponent(place.name)}`}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-md hover:shadow-lg transition"
            >
              <i className="fas fa-star mr-2" />
              Rate This Place
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        {/* Place Info Card */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{place.name}</h2>
          <p className="text-slate-600 mb-4">{place.address}</p>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            <i className="fas fa-map-marker-alt" />
            View on Google Maps
          </a>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Overall Score */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Overall Rating</h3>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold text-indigo-600">{place.stats.avgOverallScore.toFixed(1)}</div>
              <div className="flex-1">
                <div className="text-sm text-slate-500 mb-1">Out of 10</div>
                <div className="text-sm text-slate-600">
                  Based on {place.stats.totalRatings} {place.stats.totalRatings === 1 ? 'rating' : 'ratings'}
                </div>
              </div>
            </div>
          </div>

          {/* Personality Breakdown */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">By Personality Type</h3>
            <div className="space-y-3">
              {Object.entries(place.stats.byPersonality).map(([type, data]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700 capitalize">{type}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600">{data.count} ratings</span>
                    <span className="text-lg font-bold text-indigo-600">{data.avgScore.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Category Averages</h3>
          <div className="space-y-4">
            {Object.entries(place.stats.avgCategories).map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className="text-sm font-bold text-indigo-600">{value.toFixed(1)}/10</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                    style={{ width: `${(value / 10) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ratings List */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">
            All Ratings ({place.ratings.length})
          </h3>
          <div className="space-y-4">
            {place.ratings.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No ratings yet</p>
            ) : (
              place.ratings.map(rating => (
                <div key={rating.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{rating.userDisplayName}</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                          {rating.userPersonalityType}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {new Date(rating.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-indigo-600">{rating.overallScore.toFixed(1)}</div>
                  </div>
                  {rating.comment && (
                    <p className="text-slate-700 mt-3 text-sm">{rating.comment}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

