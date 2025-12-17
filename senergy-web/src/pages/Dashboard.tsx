import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import gsap from 'gsap'

const suggestedSpots = [
  {
    name: 'Neon Roast Cafe',
    vibe: 'Cozy • Latte art • Chill playlists',
    distance: '12 min away',
    badge: 'Chill',
    colors: 'from-indigo-500 to-sky-500',
  },
  {
    name: 'Echo Loft Bar',
    vibe: 'Rooftop • Live DJ • City lights',
    distance: '18 min away',
    badge: 'Night out',
    colors: 'from-purple-500 to-pink-500',
  },
  {
    name: 'Aurora Arcade',
    vibe: 'Retro games • Snacks • Late hours',
    distance: '9 min away',
    badge: 'Play',
    colors: 'from-emerald-500 to-teal-500',
  },
]

const hangouts = [
  { title: 'Board game night', time: 'Tonight · 7:30 PM', venue: 'Tabletop Loft', people: 'You, Sam, Ava' },
  { title: 'Coffee & co-work', time: 'Tomorrow · 10:00 AM', venue: 'Neon Roast Cafe', people: 'Mia, Leo' },
  { title: 'Karaoke run', time: 'Friday · 8:00 PM', venue: 'Echo Loft Bar', people: 'Crew of 6' },
]

const friendActivity = [
  { user: 'Ava', action: 'rated', target: 'Echo Loft Bar', detail: '9/10 • “vibes were immaculate”' },
  { user: 'Mia', action: 'bookmarked', target: 'Neon Roast Cafe', detail: 'Quiet corners + fast Wi‑Fi' },
  { user: 'Jay', action: 'is planning', target: 'Arcade night', detail: 'Looking for 2 more' },
]

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const containerRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const listsRef = useRef<HTMLDivElement>(null)

  const hasProfile = !!user?.personalityType
  const personalityLabel = user?.personalityType || 'Discover your vibe'

  useEffect(() => {
    if (!containerRef.current) return

    const tl = gsap.timeline()

    tl.fromTo(
      containerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.5, ease: 'power2.out' }
    )

    if (heroRef.current) {
      tl.fromTo(
        heroRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
        0.1
      )
    }

    if (cardsRef.current) {
      const cards = cardsRef.current.querySelectorAll('[data-spot-card]')
      tl.fromTo(
        cards,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 },
        0.25
      )
    }

    if (listsRef.current) {
      const blocks = listsRef.current.querySelectorAll('[data-block]')
      tl.fromTo(
        blocks,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 },
        0.35
      )
    }
  }, [])

  const handlePrimaryCta = () => {
    navigate('/quiz')
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-neutral-50 via-slate-50 to-blue-50 flex flex-col"
    >
      {/* Top bar */}
      <header className="w-full border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
              <i className="fas fa-sparkles text-white text-lg" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.18em]">
                Senergy
              </p>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Plan with your crew
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500">Logged in</p>
              <p className="text-sm font-semibold text-slate-800 truncate max-w-[180px]">
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center gap-1.5"
            >
              <i className="fas fa-sign-out-alt text-xs" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
          {/* Hero */}
          <section
            ref={heroRef}
            className="bg-gradient-to-br from-indigo-600 via-purple-600 to-rose-500 text-white rounded-3xl shadow-xl shadow-indigo-300/50 p-8 md:p-10 relative overflow-hidden"
          >
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,#fff,transparent_45%),radial-gradient(circle_at_80%_10%,#fde68a,transparent_40%)]" />
            <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3 max-w-2xl">
                <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  {hasProfile ? 'Ready to explore' : 'First step: 2-min vibe check'}
                </p>
                <h2 className="text-3xl md:text-4xl font-black leading-tight">
                  {hasProfile
                    ? 'Find places your friends will love tonight'
                    : 'Tell us your vibe — we’ll tailor the spots for you'}
                </h2>
                <p className="text-sm md:text-base text-indigo-100/90 max-w-xl">
                  Senergy is for real-life plans with people you care about. Discover cafes, bars, and
                  hangouts that match your energy — then rally your crew.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handlePrimaryCta}
                    className="px-5 py-3 rounded-xl bg-white text-slate-900 font-semibold shadow-lg shadow-indigo-500/30 hover:translate-y-[-1px] transition"
                  >
                    {hasProfile ? 'Find a spot' : 'Take the vibe quiz'}
                  </button>
                  <button
                    onClick={() => navigate('/quiz')}
                    className="px-5 py-3 rounded-xl border border-white/40 text-white font-semibold hover:bg-white/10 transition"
                  >
                    Invite friends (soon)
                  </button>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-2xl p-4 md:p-5 border border-white/20 shadow-lg w-full max-w-sm">
                <p className="text-xs font-semibold text-indigo-100 uppercase tracking-[0.18em] mb-2">
                  Your vibe
                </p>
                <h3 className="text-xl font-bold mb-2">
                  {hasProfile ? personalityLabel : 'Not set yet'}
                </h3>
                <p className="text-sm text-indigo-100/90">
                  {hasProfile
                    ? 'Your vibe steers recommendations for both chill meetups and big nights out.'
                    : 'Take the quick quiz so we can match spots to how you like to recharge or socialize.'}
                </p>
                {!hasProfile && (
                  <button
                    onClick={() => navigate('/quiz')}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-indigo-700 font-semibold shadow-sm hover:translate-y-[-1px] transition"
                  >
                    Start quiz
                    <i className="fas fa-arrow-right text-xs" />
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Suggestion cards */}
          <section ref={cardsRef} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Suggested for your vibe
                </p>
                <h3 className="text-xl font-bold text-slate-900">Places to check out with friends</h3>
              </div>
              <button
                onClick={() => navigate('/quiz')}
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Refresh suggestions
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {suggestedSpots.map((spot) => (
                <div
                  key={spot.name}
                  data-spot-card
                  className="relative overflow-hidden rounded-2xl bg-white shadow-md border border-slate-100 p-5 flex flex-col gap-3"
                >
                  <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${spot.colors}`} />
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                      {spot.badge}
                    </div>
                    <span className="text-xs text-slate-500">{spot.distance}</span>
                  </div>
                  <h4 className="relative z-10 text-lg font-bold text-slate-900">{spot.name}</h4>
                  <p className="relative z-10 text-sm text-slate-600 flex-1">{spot.vibe}</p>
                  <div className="relative z-10 flex items-center gap-2 text-sm text-indigo-600 font-semibold">
                    <i className="fas fa-users" />
                    Good for 2-6 people
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Plans & activity */}
          <section
            ref={listsRef}
            className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]"
          >
            <div
              data-block
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3"
            >
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Plans
                  </p>
                  <h3 className="text-lg font-bold text-slate-900">Upcoming hangouts</h3>
                </div>
                <button
                  onClick={() => navigate('/quiz')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Create plan (soon)
                </button>
              </div>

              <div className="space-y-3">
                {hangouts.map((item) => (
                  <div
                    key={item.title}
                    className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-900">{item.title}</p>
                      <span className="text-xs font-semibold text-indigo-600">{item.time}</span>
                    </div>
                    <p className="text-xs text-slate-600">{item.venue}</p>
                    <p className="text-xs text-slate-500">With {item.people}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div
                data-block
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Friends
                    </p>
                    <h3 className="text-lg font-bold text-slate-900">What your crew is doing</h3>
                  </div>
                </div>

                <div className="space-y-3">
                  {friendActivity.map((item) => (
                    <div
                      key={item.user + item.target}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start gap-3"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold">
                        {item.user.slice(0, 1)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.user}{' '}
                          <span className="font-normal text-slate-600">{item.action}</span>{' '}
                          <span className="font-semibold text-indigo-600">{item.target}</span>
                        </p>
                        <p className="text-xs text-slate-500">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!hasProfile && (
                <div
                  data-block
                  className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center">
                      <i className="fas fa-star" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-900">Unlock tailored picks</p>
                      <p className="text-xs text-amber-800">
                        Take the quick vibe quiz so we can tune suggestions to how you and your friends like to hang.
                      </p>
                      <button
                        onClick={() => navigate('/quiz')}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition"
                      >
                        Take the quiz
                        <i className="fas fa-arrow-right text-[10px]" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}


