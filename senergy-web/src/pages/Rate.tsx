// senergy-web/src/pages/Rate.tsx
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase'
import gsap from 'gsap'
import { useAuth } from '@/context/AuthContext'
import axios from 'axios'
import Snowfall from 'react-snowfall'

interface PlaceResult {
  id?: string
  name: string
  address?: string
  vicinity?: string
  lat?: number
  lng?: number
}

export const Rate: React.FC = () => {
  const { user, token } = useAuth()
  const navigate = useNavigate()

  const containerRef = useRef<HTMLDivElement>(null)
  const segmentRef = useRef<HTMLDivElement>(null)
  const questionTextRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLInputElement>(null)
  const prevRatingIndexRef = useRef<number>(0)

  // State
  const [segment, setSegment] = useState(0)
  const [places, setPlaces] = useState<PlaceResult[]>([])
  const [categorizedPlaces, setCategorizedPlaces] = useState<{ [category: string]: PlaceResult[] }>({})
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState({
    atmosphere: 5,
    service: 5,
    crowdSize: 5,
    noiseLevel: 5,
    socialEnergy: 5,
  })
  const [currentRatingIndex, setCurrentRatingIndex] = useState(0)
  const [comment, setComment] = useState('')
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Rating questions in order
  const ratingQuestions = [
    { key: 'atmosphere' as const, label: 'Atmosphere', hint: 'Overall vibe & feel', description: 'How was the overall atmosphere of this place?' },
    { key: 'socialEnergy' as const, label: 'Social Energy', hint: 'Social intensity', description: 'How socially engaging was the environment?' },
    { key: 'crowdSize' as const, label: 'Crowd Size', hint: 'Empty to packed', description: 'How crowded was it?' },
    { key: 'noiseLevel' as const, label: 'Noise Level', hint: 'Quiet to loud', description: 'How noisy was the environment?' },
    { key: 'service' as const, label: 'Service Quality', hint: 'Service quality', description: 'How was the service?' },
  ]

  // Reverse geocode coordinates to get address
  const reverseGeocode = async (coords: { lat: number; lng: number }): Promise<PlaceResult | null> => {
    try {
      const params = new URLSearchParams({
        lat: coords.lat.toString(),
        lng: coords.lng.toString(),
      })

      const resp = await fetch(`/api/places/reverse?${params.toString()}`)
      const data = await resp.json()

      if (data.success && data.data) {
        return {
          id: data.data.id,
          name: data.data.name || 'Current Location',
          address: data.data.address || 'Your current location',
          lat: data.data.location?.lat,
          lng: data.data.location?.lng,
        }
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error)
    }

    return null
  }

  // Search for nearby places with 5 second timeout
  const searchNearbyPlaces = async (coords: { lat: number; lng: number }, timeoutMs: number = 10000) => {
    const startTime = Date.now()

    // All queries upfront
    const allQueries = [
      { query: 'restaurant', category: '🍽️ Restaurants' },
      { query: 'cafe', category: '☕ Cafes & Coffee' },
      { query: 'bar', category: '🍺 Bars & Pubs' },
    ]

    const categorizedResults: { [category: string]: PlaceResult[] } = {}

    // Search all queries in parallel
    const allPromises = allQueries.map(({ query, category }) =>
      (async () => {
        try {
          const params = new URLSearchParams({
            query,
            location: `${coords.lat},${coords.lng}`,
            radius: '2000',
          })

          const resp = await fetch(`/api/places/search?${params.toString()}`)
          const data = await resp.json()

          if (data.success && data.data && data.data.length > 0) {
            if (!categorizedResults[category]) {
              categorizedResults[category] = []
            }

            const existingIds = new Set(categorizedResults[category].map(p => p.id))
            const newPlaces = data.data
              .map((p: any) => ({
                id: p.id,
                name: p.name,
                address: p.address,
                lat: p.location?.lat,
                lng: p.location?.lng,
              }))
              .filter((p: PlaceResult) => !existingIds.has(p.id))
              .slice(0, 6)

            categorizedResults[category].push(...newPlaces)
            console.log(`✅ Found ${newPlaces.length} ${query} results`)
          }
        } catch (error) {
          console.error(`Search error for "${query}":`, error)
        }
      })()
    )

    try {
      await Promise.race([
        Promise.all(allPromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
      ])
    } catch (error) {
      console.log('Search timeout, returning results')
    }

    return categorizedResults
  }



  // Get user location and search for nearby places on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus({ type: 'error', message: 'Geolocation is not supported' })
      return
    }

    let retryAttempted = false

    const attemptGeolocation = () => {
      setIsLoading(true)
      console.log('Requesting geolocation...')

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCoordinates(coords)
          console.log('Got location:', coords)

          try {
            const locationPromise = reverseGeocode(coords)
            const placesPromise = searchNearbyPlaces(coords, 5000)

            const [locationResult, categorizedResults] = await Promise.all([
              locationPromise,
              placesPromise,
            ])

            // Create a special "Current Location" category
            const finalCategorized: { [category: string]: PlaceResult[] } = {}

            // Add current location category FIRST
            if (locationResult) {
              finalCategorized['📍 Your Location'] = [locationResult]
            }

            // Add other categorized results
            Object.assign(finalCategorized, categorizedResults)

            // Fallback if no results
            if (Object.keys(finalCategorized).length === 0) {
              finalCategorized['📍 Your Location'] = [{
                id: `location_${coords.lat}_${coords.lng}`,
                name: 'Current Location',
                address: 'Your current location',
                lat: coords.lat,
                lng: coords.lng,
              }]
            }

            setCategorizedPlaces(finalCategorized)
            setSegment(1)
          } catch (error) {
            console.error('Error:', error)
            setStatus({ type: 'error', message: 'Failed to find places' })
          } finally {
            setIsLoading(false)
          }
        },
        (error) => {
          console.log('Geolocation failed:', error)

          if (!retryAttempted) {
            retryAttempted = true
            setTimeout(() => {
              attemptGeolocation()
            }, 1000)
          } else {
            setStatus({ type: 'error', message: 'Unable to get your location' })
            setIsLoading(false)
          }
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    }

    attemptGeolocation()
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

  // Add animation for category selection
  useEffect(() => {
    if (selectedCategory && categoryRefs.current[selectedCategory]) {
      gsap.fromTo(
        categoryRefs.current[selectedCategory],
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }
      )
    }
  }, [selectedCategory])

  // Rating question text transition animation ONLY
  useEffect(() => {
    if (segment !== 2) return

    // Skip animation on initial load
    if (prevRatingIndexRef.current === 0 && currentRatingIndex === 0) {
      prevRatingIndexRef.current = currentRatingIndex
      return
    }

    if (questionTextRef.current && prevRatingIndexRef.current !== currentRatingIndex) {
      const isMovingForward = currentRatingIndex > prevRatingIndexRef.current
      const questionText = questionTextRef.current

      const tl = gsap.timeline()

      // Slide out current question text
      tl.to(questionText, {
        x: isMovingForward ? '-100%' : '100%',
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
      })
        // Reset position for new question
        .set(questionText, {
          x: isMovingForward ? '100%' : '-100%',
          opacity: 0,
        })
        // Slide in new question text
        .to(questionText, {
          x: 0,
          opacity: 1,
          duration: 0.4,
          ease: 'power2.out',
        })

      prevRatingIndexRef.current = currentRatingIndex
    }
  }, [currentRatingIndex, segment])

  // Smooth slider animation when changing questions (GSAP)
  useEffect(() => {
    if (segment !== 2 || !sliderRef.current) return

    const question = ratingQuestions[currentRatingIndex]
    const currentValue = categories[question.key]
    const sliderElement = sliderRef.current

    // Animate slider to new value with smooth easing
    gsap.to(
      { value: parseFloat(sliderElement.value) },
      {
        value: currentValue,
        duration: 0.8,
        ease: 'power2.inOut',
        onUpdate: function () {
          sliderElement.value = this.targets()[0].value.toString()
          sliderElement.dispatchEvent(new Event('input', { bubbles: true }))
        },
      }
    )
  }, [currentRatingIndex, segment])

  const handlePlaceSelect = (place: PlaceResult) => {
    setSelectedPlace(place)
    setSegment(2) // Move to rating
  }

  const handleCategoryChange = (key: keyof typeof categories, value: number) => {
    setCategories(prev => ({ ...prev, [key]: value }))
  }

  // Keyboard shortcuts - Number keys and Enter
  useEffect(() => {
    if (segment !== 2 || currentRatingIndex >= ratingQuestions.length) return

    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle if not typing in an input/textarea
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return
      }

      // Number keys: 1-9 for values 1-9, 0 for 10
      if (event.key >= '0' && event.key <= '9') {
        let value = parseInt(event.key, 10)
        if (value === 0) value = 10

        const question = ratingQuestions[currentRatingIndex]
        handleCategoryChange(question.key, value)
        event.preventDefault()
      }

      // Enter key to go to next question
      if (event.key === 'Enter') {
        if (currentRatingIndex < ratingQuestions.length - 1) {
          setCurrentRatingIndex(currentRatingIndex + 1)
        } else {
          setCurrentRatingIndex(ratingQuestions.length)
        }
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [segment, currentRatingIndex, ratingQuestions])

  const calculateOverallScore = (): number => {
    const weights = {
      atmosphere: 0.25,
      socialEnergy: 0.25,
      crowdSize: 0.15,
      noiseLevel: 0.15,
      service: 0.2,
    }

    const weighted = Object.entries(weights).reduce((sum, [key, weight]) => {
      return sum + (categories[key as keyof typeof categories] * weight)
    }, 0)

    return Math.round(weighted * 10) / 10
  }

  const handleSubmit = async () => {
    if (!selectedPlace || !user) return

    setIsSubmitting(true)
    setStatus(null)

    try {
      const overallScore = calculateOverallScore()

      // Save to Firebase Firestore
      const ratingData = {
        userId: user.id,
        userAdjustmentFactor: user.adjustmentFactor || 0,
        userPersonalityType: user.personalityType || 'Unknown',
        placeId: selectedPlace.id,
        placeName: selectedPlace.name,
        placeAddress: selectedPlace.address || '',
        location: {
          lat: selectedPlace.lat || 0,
          lng: selectedPlace.lng || 0,
        },
        categories,
        overallScore,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      // Add to Firestore ratings collection
      await addDoc(collection(db, 'ratings'), ratingData)
      console.log('Rating saved to Firestore')

      // Also sync to backend API
      try {
        await axios.post(
          '/api/ratings',
          ratingData,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        console.log('Rating synced to backend')
      } catch (apiError) {
        console.warn('Backend sync failed, but local save succeeded:', apiError)
      }

      setStatus({ type: 'success', message: 'Rating saved! Thanks for sharing.' })
      setSegment(3) // Show success

      setTimeout(async () => {
        // Reset form
        setSegment(0)
        setPlaces([])
        setCategorizedPlaces({})
        setSelectedCategory(null)
        setSelectedPlace(null)
        setCategories({
          atmosphere: 5,
          service: 5,
          crowdSize: 5,
          noiseLevel: 5,
          socialEnergy: 5,
        })
        setCurrentRatingIndex(0)
        setComment('')
        setIsLoading(false)
        // DON'T reload places - just go back to segment 1
        setSegment(1)
      }, 2000)
    } catch (error: any) {
      console.error('Submit error:', error)
      setStatus({
        type: 'error',
        message: error.message || 'Failed to save rating',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-neutral-50 via-slate-50 to-blue-50 flex flex-col"
    >
      <Snowfall
        color="#a44ef2"
        snowflakeCount={10}
        style={{ position: 'fixed', width: '100vw', height: '100vh', opacity: 0.2 }}
      />
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
          {/* Title */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-slate-900">
              {segment === 0 && 'Finding nearby places'}
              {segment === 1 && 'Pick your place'}
              {segment === 2 && 'Rate the experience'}
              {segment === 3 && 'Thanks for rating!'}
            </h2>
          </div>

          {/* Segment 0: Loading */}
          {segment === 0 && (
            <div ref={segmentRef} className="space-y-6">
              <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-8 text-center">
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin text-4xl text-indigo-600 mb-4" />
                    <p className="text-slate-600">Finding places near you...</p>
                  </>
                ) : (
                  <>
                    {status && (
                      <div
                        className={`px-4 py-3 rounded-xl text-sm font-semibold ${status.type === 'error'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                      >
                        {status.message}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Segment 1: Place Selection */}
          {segment === 1 && (
            <div ref={segmentRef} className="space-y-6">
              {/* Category Selection or Place List */}
              {!selectedCategory ? (
                <div className="grid grid-cols-4 gap-4 w-full">
                  {Object.keys(categorizedPlaces).map((category, idx) => {
                    const isCurrentLocation = category === '📍 Your Location'
                    const placeCount = categorizedPlaces[category].length

                    return (
                      <button
                        key={category}
                        onClick={() => {
                          if (isCurrentLocation) {
                            handlePlaceSelect(categorizedPlaces[category][0])
                          } else {
                            setSelectedCategory(category)
                          }
                        }}
                        className={`p-6 rounded-2xl border-2 transition-all group flex flex-col items-center justify-center min-h-64 ${isCurrentLocation
                            ? 'border-purple-300 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 hover:shadow-xl hover:border-purple-400 hover:scale-105'
                            : 'border-slate-200 bg-white hover:border-indigo-400 hover:shadow-lg hover:scale-105'
                          }`}
                        style={{
                          animation: `fadeInUp 0.5s ease-out ${idx * 0.1}s both`,
                        }}
                      >
                        <div className="text-center flex flex-col items-center">
                          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl flex-shrink-0 ${isCurrentLocation
                              ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                              : 'bg-gradient-to-br from-indigo-500 to-purple-500'
                            }`}>
                            {isCurrentLocation ? '📍' : category.split(' ')[0]}
                          </div>
                          <p className="font-bold text-slate-900 mb-2 text-base line-clamp-2">
                            {category.replace(/^[^\s]+\s/, '')}
                          </p>
                          <p className="text-xs text-slate-500">
                            {isCurrentLocation ? 'Rate here' : `${placeCount} places`}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (

                /* Selected Category - Place List */
                <div
                  ref={el => {
                    if (el) categoryRefs.current[selectedCategory] = el
                  }}
                  className="space-y-4"
                >
                  {/* Back Button */}
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold transition mb-4"
                  >
                    <i className="fas fa-arrow-left" />
                    Back to Categories
                  </button>

                  {/* Category Title */}
                  <h3 className="text-2xl font-bold text-slate-900 mb-6">
                    {selectedCategory}
                  </h3>

                  {/* Places Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categorizedPlaces[selectedCategory]?.map((place, idx) => (
                      <button
                        key={place.id || idx}
                        onClick={() => handlePlaceSelect(place)}
                        className="p-5 rounded-xl bg-white border-2 border-slate-200 hover:border-indigo-400 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 transition-all group text-left shadow-sm hover:shadow-lg hover:scale-105"
                        style={{
                          animation: `fadeInUp 0.4s ease-out ${idx * 0.08}s both`,
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition mb-2">
                              {place.name}
                            </p>
                            <p className="text-xs text-slate-500 line-clamp-2">
                              {place.address}
                            </p>
                          </div>
                          <i className="fas fa-chevron-right text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all ml-3" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {status && (
                <div
                  className={`px-4 py-3 rounded-xl text-sm font-semibold ${status.type === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                >
                  {status.message}
                </div>
              )}
            </div>
          )}

          {/* Segment 2: Rating Quiz */}
          {segment === 2 && selectedPlace && (
            <div ref={segmentRef} className="space-y-6">
              {/* Place Card */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{selectedPlace.name}</h3>
                <p className="text-sm text-slate-600">{selectedPlace.address}</p>
              </div>

              {/* Progress Indicator */}
              {currentRatingIndex < ratingQuestions.length && (
                <div className="mb-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-600">
                        Question {currentRatingIndex + 1} of {ratingQuestions.length}
                      </p>
                      <h2 className="text-3xl font-bold text-slate-900 mt-1">Rate Your Experience</h2>
                    </div>
                  </div>
                </div>
              )}

              {/* Single Rating Question */}
              {currentRatingIndex < ratingQuestions.length && (() => {
                const question = ratingQuestions[currentRatingIndex]
                const value = categories[question.key]

                return (
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 mb-6">
                    {/* Question Text */}
                    <div className="w-full mb-8" style={{ overflow: 'hidden' }}>
                      <h3
                        ref={questionTextRef}
                        className="text-2xl font-bold leading-tight text-slate-900"
                      >
                        {question.description}
                      </h3>
                    </div>

                    {/* Large Slider */}
                    <div className="mb-8">
                      <div className="flex items-center justify-center mb-6">
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-2xl font-bold text-indigo-600 inline-block">
                            {value}
                          </span>
                          <span className="text-2xl font-semibold text-slate-500 inline-block">/ 10</span>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="relative h-6 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 rounded-full overflow-hidden">
                          <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-full transition-all duration-150"
                            style={{ width: `${((value - 1) / 9) * 100}%` }}
                          />
                          <input
                            ref={sliderRef}
                            type="range"
                            min={1}
                            max={10}
                            value={value}
                            onChange={e => handleCategoryChange(question.key, Number(e.target.value))}
                            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10 slider-input"
                            style={{
                              WebkitAppearance: 'slider-horizontal',
                            } as React.CSSProperties}
                          />

                        </div>
                        <p className="text-xs text-slate-500 mt-3 text-center">Use number keys (1-0) or drag. Press Enter to continue.</p>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Navigation */}
              {currentRatingIndex < ratingQuestions.length && (
                <div className="flex gap-4">
                  {currentRatingIndex === 0 ? (
                    <button
                      onClick={() => setSegment(1)}
                      className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-chevron-left" />
                      Back to Places
                    </button>
                  ) : (
                    <button
                      onClick={() => setCurrentRatingIndex(currentRatingIndex - 1)}
                      className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-chevron-left" />
                      Previous
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (currentRatingIndex < ratingQuestions.length - 1) {
                        setCurrentRatingIndex(currentRatingIndex + 1)
                      } else {
                        setCurrentRatingIndex(ratingQuestions.length)
                      }
                    }}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-indigo-500/30 transition flex items-center justify-center gap-2"
                  >
                    {currentRatingIndex === ratingQuestions.length - 1 ? (
                      <>
                        Finish
                        <i className="fas fa-chevron-right" />
                      </>
                    ) : (
                      <>
                        Next
                        <i className="fas fa-chevron-right" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Comment Section */}
              {currentRatingIndex >= ratingQuestions.length && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
                    <div className="mb-4">
                      <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent mb-2">
                        {calculateOverallScore()}
                      </div>
                      <p className="text-slate-600">Your Overall Rating</p>
                    </div>
                    <p className="text-sm text-slate-500">You've completed all ratings!</p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                    <label className="text-sm font-semibold text-slate-700 mb-3 block">
                      Add a comment (optional)
                    </label>
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="What made this place special? Great service, cool vibes, perfect for...?"
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition text-slate-800 placeholder:text-slate-400"
                    />
                  </div>

                  {/* Final Actions */}
                  <div className="flex gap-4">
                    <button
                      onClick={() => setCurrentRatingIndex(ratingQuestions.length - 1)}
                      className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-chevron-left" />
                      Edit Ratings
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-indigo-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <i className="fas fa-spinner fa-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Submit Rating
                          <i className="fas fa-check" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {status && (
                <div
                  className={`px-4 py-3 rounded-xl text-sm font-semibold ${status.type === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                >
                  {status.message}
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
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white font-semibold hover:shadow-lg hover:shadow-indigo-500/30 transition"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </main>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}