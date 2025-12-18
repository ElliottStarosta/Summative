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

export const Rate: React.FC = () => {
  const { token } = useAuth()
  const navigate = useNavigate()

  const containerRef = useRef<HTMLDivElement>(null)
  const segmentRef = useRef<HTMLDivElement>(null)
  const questionTextRef = useRef<HTMLDivElement>(null)
  const sliderFillRef = useRef<HTMLDivElement>(null)
  const prevRatingIndexRef = useRef<number>(0)

  // State
  const [segment, setSegment] = useState(0)
  const [places, setPlaces] = useState<PlaceResult[]>([])
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
  const [isAnimating, setIsAnimating] = useState(false)

  // Rating questions in order
  const ratingQuestions = [
    { key: 'atmosphere' as const, label: 'Atmosphere', hint: 'Overall vibe & feel', description: 'How was the overall atmosphere of this place?' },
    { key: 'socialEnergy' as const, label: 'Social Energy', hint: 'Social intensity', description: 'How socially engaging was the environment?' },
    { key: 'crowdSize' as const, label: 'Crowd Size', hint: 'Empty to packed', description: 'How crowded was it?' },
    { key: 'noiseLevel' as const, label: 'Noise Level', hint: 'Quiet to loud', description: 'How noisy was the environment?' },
    { key: 'service' as const, label: 'Service Quality', hint: 'Service quality', description: 'How was the service?' },
  ]

  // Search for nearby places with expanding radius (4 second timeout)
  const searchNearbyPlaces = async (coords: { lat: number; lng: number }, timeoutMs: number = 4000) => {
    console.log('[Rate] Starting nearby places search at:', coords)
    const startTime = Date.now()
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Search timeout')), timeoutMs)
    })
    
    // Optimized: Start with most common queries and larger radii first
    const searchQueries = [
      'restaurant cafe bar',  // Most common
      'shop store business',  // Second most common
    ]
    
    // Start with larger radii first (more likely to find results)
    const radii = [2000, 5000, 1000, 10000] // Reduced to speed up
    
    let attemptCount = 0
    const maxAttempts = 6 // Reduced to speed up
    
    // Try each query with radius (optimized order)
    const searchPromise = (async () => {
      for (const query of searchQueries) {
        for (const radius of radii) {
          // Check timeout
          if (Date.now() - startTime > timeoutMs) {
            console.log('[Rate] ⏱️ Timeout reached, stopping search')
            return []
          }
          
          attemptCount++
          if (attemptCount > maxAttempts) {
            console.log('[Rate] Reached max attempts, stopping search')
            return []
          }
          
          const attemptStart = Date.now()
          console.log(`[Rate] Attempt ${attemptCount}: Searching "${query}" within ${radius}m radius...`)
          
          try {
            const params = new URLSearchParams({
              query,
              location: `${coords.lat},${coords.lng}`,
              radius: radius.toString(),
            })

            const fetchStart = Date.now()
            const resp = await fetch(`/api/places/search?${params.toString()}`)
            const fetchTime = Date.now() - fetchStart
            console.log(`[Rate] API call took ${fetchTime}ms`)
            
            const parseStart = Date.now()
            const data = await resp.json()
            const parseTime = Date.now() - parseStart
            console.log(`[Rate] JSON parse took ${parseTime}ms`)

            if (data.success && data.data && data.data.length > 0) {
              const totalTime = Date.now() - startTime
              console.log(`[Rate] ✅ Found ${data.data.length} places in ${totalTime}ms (query: "${query}", radius: ${radius}m)`)
              
              const searchResults = data.data.map((p: any) => ({
                id: p.id,
                name: p.name,
                address: p.address,
                lat: p.location?.lat,
                lng: p.location?.lng,
              }))
              return searchResults
            } else {
              const attemptTime = Date.now() - attemptStart
              console.log(`[Rate] No results (${attemptTime}ms) - trying next...`)
            }
          } catch (error) {
            const attemptTime = Date.now() - attemptStart
            console.error(`[Rate] ❌ Search failed for "${query}" at ${radius}m (${attemptTime}ms):`, error)
          }
        }
        if (attemptCount > maxAttempts) break
      }
      
      const totalTime = Date.now() - startTime
      console.log(`[Rate] ⚠️ No places found after ${totalTime}ms and ${attemptCount} attempts`)
      return []
    })()
    
    try {
      return await Promise.race([searchPromise, timeoutPromise])
    } catch (error) {
      const totalTime = Date.now() - startTime
      console.log(`[Rate] ⏱️ Search timed out after ${totalTime}ms`)
      return []
    }
  }

  // Reverse geocode coordinates to get address
  const reverseGeocode = async (coords: { lat: number; lng: number }): Promise<PlaceResult | null> => {
    console.log('[Rate] Starting reverse geocoding for:', coords)
    const startTime = Date.now()
    
    try {
      const params = new URLSearchParams({
        lat: coords.lat.toString(),
        lng: coords.lng.toString(),
      })

      const fetchStart = Date.now()
      const resp = await fetch(`/api/places/reverse?${params.toString()}`)
      const fetchTime = Date.now() - fetchStart
      console.log(`[Rate] Reverse geocode API call took ${fetchTime}ms`)
      
      const parseStart = Date.now()
      const data = await resp.json()
      const parseTime = Date.now() - parseStart
      console.log(`[Rate] Reverse geocode JSON parse took ${parseTime}ms`)

      if (data.success && data.data) {
        const totalTime = Date.now() - startTime
        console.log(`[Rate] ✅ Reverse geocoded successfully in ${totalTime}ms:`, data.data.name)
        
        return {
          id: data.data.id,
          name: data.data.name || 'Current Location',
          address: data.data.address || 'Current Location',
          lat: data.data.location?.lat,
          lng: data.data.location?.lng,
        }
      } else {
        console.log('[Rate] ⚠️ Reverse geocode returned no data')
      }
    } catch (error) {
      const totalTime = Date.now() - startTime
      console.error(`[Rate] ❌ Reverse geocoding failed after ${totalTime}ms:`, error)
    }
    
    return null
  }

  // Get user location and search for nearby places on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus({ type: 'error', message: 'Geolocation is not supported by your browser' })
      return
    }

    let retryAttempted = false

    const attemptGeolocation = () => {
      setIsLoading(true)
      const geoStartTime = Date.now()
      const attemptNumber = retryAttempted ? 2 : 1
      console.log(`[Rate] Requesting geolocation (attempt ${attemptNumber})...`)
      
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const geoTime = Date.now() - geoStartTime
          console.log(`[Rate] ✅ Got geolocation in ${geoTime}ms:`, pos.coords)
          
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCoordinates(coords)
          
          const searchStartTime = Date.now()
          try {
            console.log('[Rate] Starting place search process...')
            
            // First, try to find nearby places with expanding radius (4 second timeout)
            const searchResults = await searchNearbyPlaces(coords, 4000)
            
            if (searchResults.length > 0) {
              const totalSearchTime = Date.now() - searchStartTime
              console.log(`[Rate] ✅ Search complete in ${totalSearchTime}ms, found ${searchResults.length} places`)
              setPlaces(searchResults)
              setSegment(1) // Move to place selection
            } else {
              console.log('[Rate] No places found, trying reverse geocoding...')
              const reverseStartTime = Date.now()
              
              // If no places found, use reverse geocoding to create a "Current Location" option
              const currentLocation = await reverseGeocode(coords)
              
              if (currentLocation) {
                const reverseTime = Date.now() - reverseStartTime
                const totalTime = Date.now() - searchStartTime
                console.log(`[Rate] ✅ Using reverse geocoded location (${reverseTime}ms, total: ${totalTime}ms)`)
                setPlaces([currentLocation])
                setSegment(1) // Move to place selection
              } else {
                // Final fallback: use reverse geocoding one more time with a simpler name
                const finalLocation = await reverseGeocode(coords)
                if (finalLocation && finalLocation.address && !finalLocation.address.match(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/)) {
                  // If address doesn't look like coordinates, use it
                  setPlaces([finalLocation])
                  setSegment(1)
                } else {
                  // Last resort: use a generic location name (never show coordinates)
                  setPlaces([{
                    id: `location_${coords.lat}_${coords.lng}`,
                    name: 'Current Location',
                    address: finalLocation?.address || 'Your current location',
                    lat: coords.lat,
                    lng: coords.lng,
                  }])
                  setSegment(1)
                }
              }
            }
          } catch (error: any) {
            const totalTime = Date.now() - searchStartTime
            console.error(`[Rate] ❌ Error after ${totalTime}ms:`, error)
            setStatus({ type: 'error', message: error.message || 'Failed to find nearby places' })
          } finally {
            const totalTime = Date.now() - geoStartTime
            console.log(`[Rate] ⏱️ Total time from geolocation request: ${totalTime}ms`)
            setIsLoading(false)
          }
        },
        (error) => {
          console.log(`[Rate] ❌ Geolocation failed (attempt ${attemptNumber}):`, error)
          
          // Retry once after 1 second
          if (!retryAttempted) {
            console.log('[Rate] ⏳ Retrying geolocation in 1 second...')
            retryAttempted = true
            setTimeout(() => {
              attemptGeolocation()
            }, 1000)
          } else {
            // After retry failed, show error
            setStatus({ type: 'error', message: 'Unable to get your location. Please enable location permissions.' })
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

  // Rating question transition animation - only animate question text and reset slider
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
      const sliderFill = sliderFillRef.current

      setIsAnimating(true)

      // Get next question's value for slider
      const nextQuestion = ratingQuestions[currentRatingIndex]
      const nextValue = categories[nextQuestion.key]
      const nextWidth = `${((nextValue - 1) / 9) * 100}%`

      // Create timeline for smooth transition
      const tl = gsap.timeline({
        onComplete: () => {
          setIsAnimating(false)
        },
      })

      // Animate slider back to midpoint (5) with clearing animation, then to next value
      if (sliderFill) {
        tl.to(sliderFill, {
          width: '44.44%', // (5-1)/9 * 100 = 44.44%
          duration: 0.2,
          ease: 'power2.inOut',
        })
        // Then animate to next question's value
        .to(sliderFill, {
          width: nextWidth,
          duration: 0.3,
          ease: 'power2.out',
        }, '-=0.1') // Start slightly before previous animation ends
      }

      // Slide out current question text (parallel with slider reset)
      tl.to(questionText, {
        x: isMovingForward ? '-100%' : '100%',
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
      }, '-=0.2') // Start with slider animation
        // Reset position for new question (off-screen opposite side)
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

  // Keyboard shortcuts - Enter to go to next
  useEffect(() => {
    if (segment !== 2 || currentRatingIndex >= ratingQuestions.length) return

    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle if not typing in an input/textarea
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return
      }

      // Enter key to go to next question
      if (event.key === 'Enter' && !isAnimating) {
        if (currentRatingIndex < ratingQuestions.length - 1) {
          setCurrentRatingIndex(currentRatingIndex + 1)
        } else {
          // If last question, move to comment section
          setCurrentRatingIndex(ratingQuestions.length)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [segment, currentRatingIndex, ratingQuestions.length, isAnimating])

  const handlePlaceSelect = (place: PlaceResult) => {
    setSelectedPlace(place)
    setSegment(2) // Move to rating
  }

  const handleCategoryChange = (key: keyof typeof categories, value: number) => {
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
      return sum + (categories[key as keyof typeof categories] * weight)
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

      setTimeout(async () => {
        setSegment(0)
        setPlaces([])
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
        setIsLoading(true)
        
        // Reload nearby places using the same search logic
        if (coordinates) {
          try {
            const searchResults = await searchNearbyPlaces(coordinates, 4000)
            
            if (searchResults.length > 0) {
              setPlaces(searchResults)
              setSegment(1)
            } else {
              // If no places found, use reverse geocoding
              const currentLocation = await reverseGeocode(coordinates)
              
              if (currentLocation && currentLocation.address && !currentLocation.address.match(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/)) {
                setPlaces([currentLocation])
                setSegment(1)
              } else {
                // Fallback: never show coordinates
                setPlaces([{
                  id: `location_${coordinates.lat}_${coordinates.lng}`,
                  name: 'Current Location',
                  address: currentLocation?.address || 'Your current location',
                  lat: coordinates.lat,
                  lng: coordinates.lng,
                }])
                setSegment(1)
              }
            }
          } catch (error) {
            console.error('Failed to reload places:', error)
          } finally {
            setIsLoading(false)
          }
        }
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
                  Step {segment + 1} of 3
                </p>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">
                  {segment === 0 && 'Finding nearby places'}
                  {segment === 1 && 'Pick your place'}
                  {segment === 2 && 'Rate the experience'}
                  {segment === 3 && 'Thanks for rating!'}
                </h2>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-indigo-600">{Math.round(((segment + 1) / 3) * 100)}%</div>
                <p className="text-xs text-slate-500">Complete</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-500"
                style={{ width: `${((segment + 1) / 3) * 100}%` }}
              />
            </div>
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
                        className={`px-4 py-3 rounded-xl text-sm font-semibold ${
                          status.type === 'error'
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

              {status && (
                <div
                  className={`px-4 py-3 rounded-xl text-sm font-semibold ${
                    status.type === 'error'
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
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-600">
                        Question {currentRatingIndex + 1} of {ratingQuestions.length}
                      </p>
                      <h2 className="text-3xl font-bold text-slate-900 mt-1">Rate Your Experience</h2>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-indigo-600">
                        {Math.round(((currentRatingIndex + 1) / ratingQuestions.length) * 100)}%
                      </div>
                      <p className="text-xs text-slate-500">Complete</p>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 transition-all duration-500"
                      style={{ width: `${((currentRatingIndex + 1) / ratingQuestions.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Single Rating Question - only question text animates */}
              {currentRatingIndex < ratingQuestions.length && (() => {
                const question = ratingQuestions[currentRatingIndex]
                const value = categories[question.key]
                
                return (
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 mb-6">
                    {/* Question Text - with overflow hidden wrapper for animations */}
                    <div className="w-full mb-8" style={{ overflow: 'hidden' }}>
                      <h3
                        ref={questionTextRef}
                        className="text-2xl font-bold leading-tight"
                        style={{ color: '#1a0a2e', willChange: 'transform' }}
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
                            ref={sliderFillRef}
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-full"
                            style={{ width: `${((value - 1) / 9) * 100}%` }}
                          />
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={value}
                            onChange={e => handleCategoryChange(question.key, Number(e.target.value))}
                            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                        </div>
                        <div className="flex justify-between mt-4 text-sm text-slate-600">
                          <span className="font-semibold">1</span>
                          <span className="font-semibold text-slate-700">{question.hint}</span>
                          <span className="font-semibold">10</span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-500 text-center mb-6">
                      {currentRatingIndex === ratingQuestions.length - 1
                        ? 'Press Enter or use the Finish button below to complete your rating'
                        : 'Press Enter or use the Next button below to move to the next question'}
                    </p>
                  </div>
                )
              })()}

              {/* Navigation - Fixed outside card */}
              {currentRatingIndex < ratingQuestions.length && (
                <div className="flex gap-4">
                  {currentRatingIndex === 0 ? (
                    <button
                      onClick={() => {
                        if (!isAnimating) setSegment(1)
                      }}
                      disabled={isAnimating}
                      className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-chevron-left" />
                      Back to Places
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (!isAnimating) setCurrentRatingIndex(currentRatingIndex - 1)
                      }}
                      disabled={isAnimating}
                      className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-chevron-left" />
                      Previous
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!isAnimating) {
                        if (currentRatingIndex < ratingQuestions.length - 1) {
                          setCurrentRatingIndex(currentRatingIndex + 1)
                        } else {
                          setCurrentRatingIndex(ratingQuestions.length)
                        }
                      }
                    }}
                    disabled={isAnimating}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-indigo-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

              {/* Comment Section (after all questions) */}
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
                  className={`px-4 py-3 rounded-xl text-sm font-semibold ${
                    status.type === 'error'
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
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white font-semibold"
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