import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import gsap from 'gsap'
import Snowfall from 'react-snowfall'

export const DiscordVerify: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  const containerRef = useRef<HTMLDivElement>(null)
  const codeBoxRef = useRef<HTMLDivElement>(null)
  const discordIconRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)
  const pulseRingRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(24 * 60 * 60) // 24 hours in seconds

  useEffect(() => {
    // Get verification code from location state
    const code = location.state?.verificationCode
    if (!code) {
      // If no code, redirect back to quiz
      navigate('/quiz')
      return
    }
    setVerificationCode(code)
  }, [location.state, navigate])

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Format time remaining
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  // Main entrance animation
  useEffect(() => {
    if (!containerRef.current || !verificationCode) return

    const tl = gsap.timeline()

    // Fade in container
    tl.fromTo(
      containerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.5, ease: 'power2.out' }
    )

    // Animate discord icon with bounce
    if (discordIconRef.current) {
      tl.fromTo(
        discordIconRef.current,
        { scale: 0, rotation: -180 },
        { 
          scale: 1, 
          rotation: 0, 
          duration: 1, 
          ease: 'elastic.out(1, 0.5)',
          onComplete: () => {
            // Start floating animation
            gsap.to(discordIconRef.current, {
              y: -12,
              duration: 2.5,
              repeat: -1,
              yoyo: true,
              ease: 'sine.inOut'
            })
          }
        },
        0.2
      )
    }

    // Pulse ring animation
    if (pulseRingRef.current) {
      tl.fromTo(
        pulseRingRef.current,
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.8, ease: 'power2.out' },
        0.3
      )

      // Continuous pulse
      gsap.to(pulseRingRef.current, {
        scale: 1.2,
        opacity: 0,
        duration: 2,
        repeat: -1,
        ease: 'power2.out'
      })
    }

    // Animate code box with stagger effect
    if (codeBoxRef.current) {
      tl.fromTo(
        codeBoxRef.current,
        { y: 40, opacity: 0, scale: 0.9 },
        { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.4)' },
        0.5
      )

      // Animate individual digits
      const digits = codeBoxRef.current.querySelectorAll('[data-digit]')
      tl.fromTo(
        digits,
        { y: 20, opacity: 0, scale: 0.8 },
        { y: 0, opacity: 1, scale: 1, duration: 0.4, stagger: 0.08, ease: 'back.out(2)' },
        0.7
      )
    }

    // Animate title
    if (titleRef.current) {
      tl.fromTo(
        titleRef.current,
        { y: -30, opacity: 0, scale: 0.9 },
        { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.7)' },
        0.4
      )
    }

    // Animate subtitle
    if (subtitleRef.current) {
      tl.fromTo(
        subtitleRef.current,
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' },
        0.6
      )
    }

    // Animate steps
    if (stepsRef.current) {
      const steps = stepsRef.current.querySelectorAll('[data-step]')
      tl.fromTo(
        steps,
        { x: -30, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.6, stagger: 0.12, ease: 'power3.out' },
        0.8
      )
    }
  }, [verificationCode])

  const handleCopy = () => {
    if (!verificationCode) return
    
    navigator.clipboard.writeText(verificationCode)
    setCopied(true)

    // Animate copy button
    if (codeBoxRef.current) {
      const copyBtn = codeBoxRef.current.querySelector('[data-copy-btn]')
      if (copyBtn) {
        gsap.timeline()
          .to(copyBtn, { scale: 0.9, duration: 0.1 })
          .to(copyBtn, { scale: 1.1, duration: 0.2, ease: 'back.out(3)' })
          .to(copyBtn, { scale: 1, duration: 0.1 })
      }

      // Color change is handled by the 'copied' state and CSS transition
      // No additional animation needed - the transition class handles it
    }

    setTimeout(() => setCopied(false), 2000)
  }

  const handleSkip = () => {
    navigate('/dashboard')
  }

  if (!verificationCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-primary-50 to-secondary-50">
        <i className="fas fa-spinner fa-spin text-4xl text-primary-600" />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50 to-secondary-50 relative overflow-hidden"
    >
      <Snowfall
        color="#8b5cf6"
        snowflakeCount={30}
        style={{ position: 'fixed', width: '100vw', height: '100vh', opacity: 0.3 }}
      />

      <div className="relative min-h-screen flex items-center justify-center px-4 py-12 z-10">
        <div className="w-full max-w-2xl">
          {/* Discord Icon with Pulse Ring */}
          <div className="flex justify-center mb-8 relative">
            <div ref={pulseRingRef} className="absolute w-32 h-32 rounded-full bg-primary-400/30 blur-xl" />
            <div
              ref={discordIconRef}
              className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary-600 via-purple-600 to-accent-500 flex items-center justify-center shadow-2xl shadow-primary-500/50"
            >
              <i className="fab fa-discord text-white text-5xl" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 ref={titleRef} className="text-5xl font-black text-slate-900 mb-3 leading-tight">
              Link Discord
            </h1>
            <p ref={subtitleRef} className="text-lg text-slate-600">
              Use this code to verify your account in Discord
            </p>
          </div>

          {/* Verification Code Card */}
          <div
            ref={codeBoxRef}
            className="bg-white rounded-3xl shadow-2xl border-2 border-primary-200 p-8 mb-6 relative overflow-hidden"
          >
            {/* Decorative background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-purple-50 to-accent-50 opacity-50" />

            <div className="relative z-10">
              <div className="text-center mb-6">
                <p className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4">
                  Your Verification Code
                </p>
                
                {/* Code Display - Individual Digits */}
                <div className="flex justify-center gap-3 mb-6">
                  {verificationCode.split('').map((digit, idx) => (
                    <div
                      key={idx}
                      data-digit
                      className={`w-14 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 transform hover:scale-110 transition-all duration-300 ${
                        copied 
                          ? 'bg-gradient-to-br from-primary-700 to-blue-600' 
                          : 'bg-gradient-to-br from-primary-500 to-primary-600'
                      }`}
                    >
                      <span className="text-3xl font-black text-white tracking-wider">
                        {digit}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Copy Button */}
                <button
                  data-copy-btn
                  onClick={handleCopy}
                  className="w-full px-6 py-4 bg-gradient-to-r from-primary-600 to-accent-500 hover:from-primary-700 hover:to-accent-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 transition-all duration-300 flex items-center justify-center gap-3 group"
                >
                  {copied ? (
                    <>
                      <i className="fas fa-check text-xl" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-copy text-xl group-hover:scale-110 transition-transform" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              {/* Timer */}
              <div className="text-center pt-4 border-t border-slate-200">
                <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                  <i className="fas fa-clock text-primary-600" />
                  <span>Expires in <strong className="text-slate-900">{formatTime(timeRemaining)}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div
            ref={stepsRef}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 mb-6"
          >
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="fas fa-list-check text-primary-600" />
              How to Verify
            </h3>
            <div className="space-y-4">
              <div
                data-step
                className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-100"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-white font-bold">1</span>
                </div>
                <div>
                  <p className="font-bold text-slate-900">Open Discord</p>
                  <p className="text-sm text-slate-600">Open Discord in a DM with the Senergy bot</p>
                </div>
              </div>

              <div
                data-step
                className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-white font-bold">2</span>
                </div>
                <div>
                  <p className="font-bold text-slate-900">Send the command</p>
                  <p className="text-sm text-slate-600 mb-2">Type this command in your DM:</p>
                  <code className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-mono inline-block">
                    /verify {verificationCode}
                  </code>
                </div>
              </div>

              <div
                data-step
                className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50 border border-pink-100"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-600 via-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-white font-bold">3</span>
                </div>
                <div>
                  <p className="font-bold text-slate-900">Done!</p>
                  <p className="text-sm text-slate-600">Your account will be linked automatically</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleSkip}
              className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 group"
            >
              <span>Skip for now</span>
              <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Help Text */}
          <div className="text-center mt-6">
            <p className="text-sm text-slate-500">
              Need help?{' '}
              <button
                onClick={() => navigate('/discord-bot-docs')}
                className="text-primary-600 font-semibold hover:underline"
              >
                View Discord Bot Docs
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}