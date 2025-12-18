// senergy-web/src/pages/Rate.tsx
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { useAuth } from '@/context/AuthContext'
import axios from 'axios'

interface PlaceResult {
  id?: string
  name: string
  address?: string
  vicinity?: string
  lat?: number
  lng?: number
}

interface RatingCategoriesState {
  atmosphere: number
  service: number
  crowdSize: number
  noiseLevel: number
  socialEnergy: number
}

// Simplified to 5 categories, grouped into sections
const categorySections = [
  {
    title: 'Vibe & Atmosphere',
    categories: [
      { key: 'atmosphere', label: 'Atmosphere', hint: '1 = Bad vibe, 10 = Great vibe' },
      { key: 'socialEnergy', label: 'Social Energy', hint: '1 = Chill, 10 = High energy' },
    ],
  },
  {
    title: 'Environment',
    categories: [
      { key: 'crowdSize', label: 'Crowd Size', hint: '1 = Empty, 10 = Packed' },
      { key: 'noiseLevel', label: 'Noise Level', hint: '1 = Silent, 10 = Loud' },
    ],
  },
  {
    title: 'Service',
    categories: [
      { key: 'service', label: 'Service Quality', hint: '1 = Poor, 10 = Excellent' },
    ],
  },
]

export const Rate: React.FC = () => {
  const { user, token } = useAuth()
  const navigate = useNavigate()

  const containerRef = useRef<HTMLDivElement>(null)
  const segmentRef = useRef<HTMLDivElement>(null)

  // State
  const [segment, setSegment] = useState(0)
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<PlaceResult[]>([])
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<RatingCategoriesState>({
    atmosphere: 5,
    service: 5,
    crowdSize: 5,
    noiseLevel: 5,
    socialEnergy: 5,
  })
  const [currentSection, setCurrentSection] = useState(0)
  const [comment, setComment] = useState('')

  // Get user location on mount
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setCoordinates({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoordinates(null),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  // Segment animation
  useEffect(() => {
    if (segmentRef.current) {
      gsap.fromTo(
        segmentRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
      )
    }
  }, [segment])

  // Animate sliders when section changes
  useEffect(() => {
    const sliderItems = document.querySelectorAll('.slider-item')
    sliderItems.forEach((item, idx) => {
      gsap.fromTo(
        item,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.4, delay: idx * 0.1, ease: 'power2.out' }
      )
    })
  }, [currentSection])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsSearching(true)
    setStatus(null)
    try {
      // Use backend API which uses OpenStreetMap Nominatim (free, no API key)
      const params = new URLSearchParams({
        query,
      })

      if (coordinates) {
        params.append('location', `${coordinates.lat},${coordinates.lng}`)
        params.append('radius', '5000') // Reduced to 5km for more local results
      }

      const resp = await fetch(`/api/places/search?${params.toString()}`)
      const data = await resp.json()

      if (!data.success) {
        throw new Error(data.error || 'Places search failed')
      }

      const searchResults = (data.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        lat: p.location?.lat,
        lng: p.location?.lng,
      }))

      setPlaces(searchResults)
      setSegment(1) // Move to place selection
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'Search failed' })
    } finally {
      setIsSearching(false)
    }
  }

  const handlePlaceSelect = (place: PlaceResult) => {
    setSelectedPlace(place)
    setSegment(2) // Move to rating
  }

  const handleCategoryChange = (key: keyof RatingCategoriesState, value: number) => {
    setCategories(prev => ({ ...prev, [key]: value }))
  }

  const calculateOverallScore = (): number => {
    const weights = {
      atmosphere: 0.25,
      socialEnergy: 0.25,
      crowdSize: 0.15,
      noiseLevel: 0.15,
      service: 0.2,
    }

    const weighted = Object.entries(weights).reduce((sum, [key, weight]) => {
      return sum + (categories[key as keyof RatingCategoriesState] * weight)
    }, 0)

    return Math.round(weighted * 10) / 10
  }

  const handleSubmit = async () => {
    if (!selectedPlace) return

    setIsSubmitting(true)
    setStatus(null)

    try {
      const overallScore = calculateOverallScore()

      await axios.post(
        '/api/ratings',
        {
          placeId: selectedPlace.id,
          placeName: selectedPlace.name,
          placeAddress: selectedPlace.address || selectedPlace.vicinity,
          location: { lat: selectedPlace.lat, lng: selectedPlace.lng },
          categories,
          overallScore,
          comment: comment.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      setStatus({ type: 'success', message: 'Rating saved! Thanks for sharing.' })
      setSegment(3) // Show success

      setTimeout(() => {
        setSegment(0)
        setQuery('')
        setPlaces([])
        setSelectedPlace(null)
        setCategories({
          atmosphere: 5,
          service: 5,
          crowdSize: 5,
          noiseLevel: 5,
          socialEnergy: 5,
        })
        setCurrentSection(0)
        setComment('')
      }, 2000)
    } catch (error: any) {
      console.error('Submit error:', error)
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || error.message || 'Failed to save rating' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const overallScore = calculateOverallScore()

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-neutral-50 via-slate-50 to-blue-50 flex flex-col"
    >
      {/* Header */}
      <header className="w-full border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <i className="fas fa-star text-white text-lg" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rate a spot</p>
              <h1 className="text-lg font-bold text-slate-900">Share your experience</h1>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
          >
            <i className="fas fa-arrow-left mr-2" />
            Back
          </button>
        </div>
      </header>

      <main className="flex-1 w-full">
        <div className="max-w-2xl mx-auto px-4 py-10">
          {/* Progress Indicator */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Step {segment + 1} of 4
                </p>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">
                  {segment === 0 && 'Find a place'}
                  {segment === 1 && 'Pick your place'}
                  {segment === 2 && 'Rate the experience'}
                  {segment === 3 && 'Thanks for rating!'}
                </h2>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-indigo-600">{(segment + 1) * 25}%</div>
                <p className="text-xs text-slate-500">Complete</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-500"
                style={{ width: `${(segment + 1) * 25}%` }}
              />
            </div>
          </div>

          {/* Segment 0: Search */}
          {segment === 0 && (
            <div ref={segmentRef} className="space-y-6">
              <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-8">
                <p className="text-slate-600 mb-6 text-sm">
                  Search for a restaurant, cafe, bar, park, or any place you'd like to rate and share with your crew.
                </p>

                <form onSubmit={handleSearch} className="flex gap-3">
                  <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-slate-200 bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 transition">
                    <i className="fas fa-magnifying-glass text-slate-400" />
                    <input
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Cafe, restaurant, park..."
                      className="w-full text-slate-800 placeholder:text-slate-400 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-md hover:shadow-lg transition disabled:opacity-60"
                  >
                    {isSearching ? 'Searching...' : 'Search'}
                  </button>
                </form>

                {status && (
                  <div
                    className={`mt-4 px-4 py-3 rounded-xl text-sm font-semibold ${
                      status.type === 'error'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {status.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Segment 1: Place Selection */}
          {segment === 1 && (
            <div ref={segmentRef} className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 space-y-4">
              <div className="max-h-96 overflow-y-auto space-y-2">
                {places.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No places found</p>
                ) : (
                  places.map((place, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePlaceSelect(place)}
                      className="w-full text-left px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition"
                    >
                      <p className="font-semibold text-slate-900">{place.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{place.address}</p>
                    </button>
                  ))
                )}
              </div>

              <button
                onClick={() => setSegment(0)}
                className="w-full py-3 border-2 border-slate-200 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition"
              >
                ← Back to search
              </button>
            </div>
          )}

          {/* Segment 2: Rating */}
          {segment === 2 && selectedPlace && (
            <div ref={segmentRef} className="space-y-6">
              {/* Place Card */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{selectedPlace.name}</h3>
                <p className="text-sm text-slate-600">{selectedPlace.address}</p>
              </div>

              {/* Sectioned Rating Cards */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
                <h3 className="text-2xl font-bold mb-8" style={{ color: '#1a0a2e' }}>
                  {categorySections[currentSection].title}
                </h3>

                <div className="space-y-8">
                  {categorySections[currentSection].categories.map((cat, idx) => {
                    const value = categories[cat.key as keyof RatingCategoriesState]

                    return (
                      <div key={cat.key} className="slider-item">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-lg font-semibold text-slate-800">{cat.label}</label>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                              {value}
                            </span>
                            <span className="text-sm text-slate-500">/10</span>
                          </div>
                        </div>
                        
                        {/* Enhanced Slider */}
                        <div className="relative">
                          <div className="relative h-3 bg-gradient-to-r from-purple-100 via-pink-100 to-purple-100 rounded-full overflow-hidden">
                            <div
                              className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-300"
                              style={{ width: `${((value - 1) / 9) * 100}%` }}
                            />
                            <input
                              type="range"
                              min={1}
                              max={10}
                              value={value}
                              onChange={e => {
                                const newValue = Number(e.target.value)
                                handleCategoryChange(cat.key as keyof RatingCategoriesState, newValue)
                              }}
                              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                          </div>
                          <div className="flex justify-between mt-2 text-xs text-slate-400">
                            <span>1</span>
                            <span className="text-slate-600 font-semibold">{cat.hint}</span>
                            <span>10</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Section Navigation */}
                <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
                    disabled={currentSection === 0}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Previous
                  </button>
                  
                  <div className="flex gap-2">
                    {categorySections.map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === currentSection
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 w-8'
                            : 'bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>

                  {currentSection < categorySections.length - 1 ? (
                    <button
                      onClick={() => setCurrentSection(currentSection + 1)}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:shadow-lg transition"
                    >
                      Next →
                    </button>
                  ) : (
                    <div className="text-sm text-slate-600 font-semibold">
                      Overall: <span className="text-2xl font-bold text-purple-600">{overallScore}</span>/10
                    </div>
                  )}
                </div>
              </div>

              {/* Comment */}
              {currentSection === categorySections.length - 1 && (
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                  <label className="text-sm font-semibold text-slate-700 mb-3 block">
                    Add a comment (optional)
                  </label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="What made this place special? Great service, cool vibes, perfect for...?"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              )}

              {/* Actions */}
              {currentSection === categorySections.length - 1 && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setSegment(1)}
                    className="flex-1 py-3 border-2 border-slate-200 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold shadow-md hover:shadow-lg hover:shadow-purple-500/30 transition disabled:opacity-60"
                  >
                    {isSubmitting ? 'Saving...' : 'Submit Rating'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Segment 3: Success */}
          {segment === 3 && (
            <div ref={segmentRef} className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-check text-white text-3xl" />
              </div>
              <h3 className="text-3xl font-bold text-slate-900 mb-2">Rating Saved!</h3>
              <p className="text-slate-600 mb-6">Your feedback helps the whole crew find better spots.</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}