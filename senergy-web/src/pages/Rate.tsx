import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/context/AuthContext'

type PlaceResult = {
  id?: string
  name: string
  address?: string
  vicinity?: string
  locationText?: string
  lat?: number
  lng?: number
}

type RatingCategory = {
  key: keyof RatingCategoriesState
  label: string
}

type RatingCategoriesState = {
  crowdSize: number
  noiseLevel: number
  socialEnergy: number
  service: number
  cleanliness: number
}

const categoryFields: RatingCategory[] = [
  { key: 'crowdSize', label: 'Crowd size' },
  { key: 'noiseLevel', label: 'Noise level' },
  { key: 'socialEnergy', label: 'Social energy' },
  { key: 'service', label: 'Service' },
  { key: 'cleanliness', label: 'Cleanliness' },
]

export const Rate: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const containerRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<PlaceResult[]>([])
  const [selected, setSelected] = useState<PlaceResult | null>(null)
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [categories, setCategories] = useState<RatingCategoriesState>({
    crowdSize: 5,
    noiseLevel: 5,
    socialEnergy: 5,
    service: 7,
    cleanliness: 7,
  })

  const personalityHint = useMemo(() => {
    if (!user?.personalityType) return 'Complete the quiz to supercharge recommendations.'
    return `Your ${user.personalityType} energy helps us weigh this rating.`
  }, [user?.personalityType])

  useEffect(() => {
    if (!containerRef.current) return
    const tl = gsap.timeline()
    tl.fromTo(
      containerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.4, ease: 'power2.out' }
    )
    if (formRef.current) {
      tl.fromTo(
        formRef.current,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' },
        0.1
      )
    }
    if (resultsRef.current) {
      tl.fromTo(
        resultsRef.current,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' },
        0.2
      )
    }
  }, [])

  // Get user location (best-effort) to bias search and store with rating
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setCoords(null)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsSearching(true)
    setStatus(null)
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY
      if (!apiKey) {
        throw new Error('Missing Google Places API key (VITE_GOOGLE_PLACES_API_KEY)')
      }

      const params = new URLSearchParams({
        query,
        key: apiKey,
        type: 'point_of_interest|establishment',
      })

      if (coords) {
        params.append('location', `${coords.lat},${coords.lng}`)
        params.append('radius', '10000') // 10km bias
      }

      const resp = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`)
      const data = await resp.json()

      if (data.status !== 'OK') {
        throw new Error(data.error_message || data.status || 'Places search failed')
      }

      const places = (data.results || []).map((p: any) => ({
        id: p.place_id,
        name: p.name,
        address: p.formatted_address || p.vicinity,
        vicinity: p.vicinity,
        locationText: p.formatted_address || p.vicinity,
        lat: p.geometry?.location?.lat,
        lng: p.geometry?.location?.lng,
      }))

      setResults(places)
    } catch (error: any) {
      console.error('Place search failed:', error?.message || error)
      setResults([])
      setStatus({
        type: 'error',
        message: error?.message || 'Search failed. Check your Places API key or try again.',
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleSubmit = async () => {
    if (!selected) {
      setStatus({ type: 'error', message: 'Pick a place to rate first.' })
      return
    }

    setIsSubmitting(true)
    setStatus(null)
    try {
      await addDoc(collection(db, 'ratings'), {
        userId: user?.id,
        userEmail: user?.email,
        displayName: user?.displayName,
        userAdjustmentFactor: user?.adjustmentFactor ?? null,
        userPersonalityType: user?.personalityType ?? null,
        placeId: selected.id || null,
        placeName: selected.name,
        placeAddress: selected.address || selected.vicinity || selected.locationText || 'Unknown location',
        comment: comment.trim(),
        categories,
        overall: Math.round(
          Object.values(categories).reduce((sum, v) => sum + v, 0) / Object.values(categories).length
        ),
        lat: selected.lat ?? coords?.lat ?? null,
        lng: selected.lng ?? coords?.lng ?? null,
        createdAt: serverTimestamp(),
      })
      setStatus({ type: 'success', message: 'Thanks! Your rating was saved.' })
      setComment('')
      setCategories({
        crowdSize: 5,
        noiseLevel: 5,
        socialEnergy: 5,
        service: 7,
        cleanliness: 7,
      })
    } catch (error: any) {
      const msg = error?.message || 'Failed to submit rating. Please try again.'
      setStatus({ type: 'error', message: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-neutral-50 via-slate-50 to-blue-50 flex flex-col"
    >
      <header className="w-full border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
              <i className="fas fa-star text-white text-lg" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.18em]">
                Rate a spot
              </p>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Share how it felt for the crew
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <section
            ref={formRef}
            className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-4 flex-col md:flex-row md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Find a place
                </p>
                <h2 className="text-xl font-bold text-slate-900">Search, then pick to rate</h2>
              </div>
              <p className="text-xs text-slate-500">{personalityHint}</p>
            </div>

            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-200 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition">
                <i className="fas fa-magnifying-glass text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a cafe, bar, park..."
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
                className={`px-4 py-3 rounded-xl text-sm font-semibold ${
                  status.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {status.message}
              </div>
            )}
          </section>

          <section ref={resultsRef} className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Pick a place</h3>
                <span className="text-xs text-slate-500">
                  {results.length > 0 ? `${results.length} options` : 'No results yet'}
                </span>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {results.length === 0 && (
                  <p className="text-xs text-slate-500 px-1">
                    No results yet. Try another search term or allow location to improve relevance.
                  </p>
                )}
                {results.map((place) => {
                  const isActive = selected?.name === place.name
                  return (
                    <button
                      key={place.name + (place.address || '')}
                      onClick={() => setSelected(place)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition flex flex-col gap-1 ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{place.name}</p>
                        {isActive && (
                          <span className="text-[11px] font-semibold text-indigo-600 flex items-center gap-1">
                            <i className="fas fa-check" />
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {place.address || place.vicinity || place.locationText || 'No address available'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Your rating</h3>
                {selected ? (
                  <span className="text-xs font-semibold text-indigo-600">{selected.name}</span>
                ) : (
                  <span className="text-xs text-slate-400">Pick a place to start</span>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-600">
                  Aspects (1-10) — lower = less intense / poorer, higher = more intense / better
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {categoryFields.map((cat) => (
                    <div key={cat.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="font-semibold">{cat.label}</span>
                        <span className="text-[11px] text-slate-500">{categories[cat.key]}/10</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={categories[cat.key]}
                        onChange={(e) =>
                          setCategories((prev) => ({ ...prev, [cat.key]: Number(e.target.value) }))
                        }
                        className="w-full accent-indigo-600"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Optional notes</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="Share what made it great (or not): music, crowd, service, quiet corners..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!selected || isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-md hover:shadow-lg transition disabled:opacity-60"
              >
                {isSubmitting ? 'Saving...' : 'Submit rating'}
              </button>

              {!user?.personalityType && (
                <div className="mt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <i className="fas fa-circle-info mt-0.5" />
                  <span>
                    Take the vibe quiz to make your ratings fuel better recommendations for your crew.
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

