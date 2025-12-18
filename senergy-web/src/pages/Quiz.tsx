import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import axios from 'axios'
import gsap from 'gsap'

interface QuizQuestion {
  id: number
  text: string
  weight: number
  reverse?: boolean
}

// Fallback questions if API is not yet wired or returns empty
const DEFAULT_QUESTIONS: QuizQuestion[] = [
  { id: 1, text: 'I feel energized after spending time in large groups.', weight: 2 },
  { id: 2, text: 'I prefer quiet, low-key hangouts over big events.', weight: 2, reverse: true },
  { id: 3, text: 'Spontaneous plans excite me more than they stress me out.', weight: 1 },
  { id: 4, text: 'I need alone time to recharge after social activities.', weight: 2, reverse: true },
  { id: 5, text: 'I enjoy meeting new people in unfamiliar places.', weight: 2 },
  { id: 6, text: 'I would rather have a deep 1:1 conversation than be in a loud crowd.', weight: 1, reverse: true },
  { id: 7, text: 'Busy, high-energy venues are my ideal kind of spot.', weight: 2 },
  { id: 8, text: 'I often leave events earlier than others because I feel drained.', weight: 1, reverse: true },
  { id: 9, text: 'I like being the one who suggests and organizes group plans.', weight: 1 },
  { id: 10, text: 'I feel uncomfortable when all attention is on me.', weight: 1, reverse: true },
]

export const Quiz: React.FC = () => {
  const navigate = useNavigate()
  const { token, updateUserProfile } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const questionCardRef = useRef<HTMLDivElement>(null)
  const prevQuestionRef = useRef<number>(0)

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [responses, setResponses] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  // Fetch questions from API
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await axios.get('/api/quiz/questions', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data: QuizQuestion[] =
          Array.isArray(response.data) && response.data.length > 0
            ? response.data
            : DEFAULT_QUESTIONS

        setQuestions(data)
        setResponses(new Array(data.length).fill(0))
        setLoading(false)
      } catch (error) {
        console.error('Failed to load questions, falling back to defaults:', error)
        // Use local defaults so the quiz always renders even if the API is not ready
        setQuestions(DEFAULT_QUESTIONS)
        setResponses(new Array(DEFAULT_QUESTIONS.length).fill(0))
        setLoading(false)
      }
    }

    if (token) {
      fetchQuestions()
    }
  }, [token])

  // Initial fade in
  useEffect(() => {
    if (containerRef.current && !loading) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: 'power2.out' }
      )
    }
  }, [loading])

  // Question transition animation
  useEffect(() => {
    // Skip animation on initial load
    if (prevQuestionRef.current === 0 && currentQuestion === 0) {
      prevQuestionRef.current = currentQuestion
      return
    }

    if (questionCardRef.current && !loading && prevQuestionRef.current !== currentQuestion) {
      const isMovingForward = currentQuestion > prevQuestionRef.current
      const card = questionCardRef.current

      setIsAnimating(true)

      // Create timeline for smooth transition
      const tl = gsap.timeline({
        onComplete: () => {
          setIsAnimating(false)
        },
      })

      // Slide out current question
      tl.to(card, {
        x: isMovingForward ? '-100%' : '100%',
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
      })
        // Reset position for new question (off-screen opposite side)
        .set(card, {
          x: isMovingForward ? '100%' : '-100%',
          opacity: 0,
        })
        // Slide in new question
        .to(card, {
          x: 0,
          opacity: 1,
          duration: 0.4,
          ease: 'power2.out',
        })

      prevQuestionRef.current = currentQuestion
    }
  }, [currentQuestion, loading])

  const handleResponse = (value: number) => {
    const newResponses = [...responses]
    newResponses[currentQuestion] = value
    setResponses(newResponses)
  }

  const handleSubmit = useCallback(async () => {
    if (responses.some((r) => r === 0)) {
      alert('Please answer all questions before submitting')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await axios.post(
        '/api/quiz/submit',
        { responses },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      setResults(response.data)
      // Update auth user profile so dashboard access is unlocked immediately
      if (response.data?.personalityType || response.data?.adjustmentFactor) {
        updateUserProfile({
          personalityType: response.data.personalityType,
          adjustmentFactor: response.data.adjustmentFactor,
        })
      }
      setShowResults(true)

      // Auto-redirect after showing results
      setTimeout(() => {
        navigate('/dashboard')
      }, 3000)
    } catch (error) {
      alert('Failed to submit quiz. Please try again.')
      setIsSubmitting(false)
    }
  }, [responses, token, updateUserProfile, navigate])

  // Keyboard shortcuts for 1-5 keys and Enter to go to next
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle if not in results view and not typing in an input
      if (showResults || document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return
      }

      const key = event.key
      // Check if key is 1-5
      if (key >= '1' && key <= '5') {
        const value = parseInt(key, 10)
        const newResponses = [...responses]
        newResponses[currentQuestion] = value
        setResponses(newResponses)
      }
      // Enter key to go to next question or submit
      else if (key === 'Enter') {
        // Only proceed if current question has been answered and not animating
        if (responses[currentQuestion] !== 0 && !isAnimating) {
          // If last question and all answered, submit
          if (currentQuestion === questions.length - 1 && responses.every((r) => r !== 0)) {
            handleSubmit()
          }
          // Otherwise go to next question
          else if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(Math.min(questions.length - 1, currentQuestion + 1))
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [showResults, currentQuestion, responses, questions.length, handleSubmit, isAnimating])

  // If we somehow finish loading but have no questions, show a friendly message
  if (!loading && questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-neutral-900 mb-3">Quiz not configured</h1>
          <p className="text-neutral-600 mb-4 text-sm">
            We couldn&apos;t find any quiz questions to show you yet. Please try again in a moment,
            or contact the admin if this keeps happening.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition"
          >
            <i className="fas fa-rotate-right mr-2" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-primary-600 mb-4" />
          <p className="text-neutral-600">Loading quiz...</p>
        </div>
      </div>
    )
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100
  const question = questions[currentQuestion]

  if (showResults && results) {
    return (
      <div
        ref={containerRef}
        className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50 to-secondary-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md text-center">
          {/* Success Icon */}
          <div className="mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-400 to-accent-500 flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-check text-white text-3xl" />
            </div>

            <h1 className="text-4xl font-bold text-neutral-900 mb-2">Great!</h1>
            <p className="text-neutral-500 mb-8">Your personality profile is ready</p>
          </div>

          {/* Results Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div className="text-5xl font-bold text-primary-600 mb-3">
              {results.adjustmentFactor.toFixed(2)}
            </div>
            <div className="text-2xl font-semibold text-neutral-900 mb-2">
              {results.personalityType}
            </div>
            <p className="text-neutral-600 text-sm leading-relaxed">
              {results.description}
            </p>

            {/* Adjustment Factor Scale */}
            <div className="mt-8 pt-8 border-t border-neutral-200">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                Energy Scale
              </p>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-neutral-600">Introvert</span>
                <span className="text-xs text-neutral-600">Extrovert</span>
              </div>
              <div className="h-2 bg-gradient-to-r from-primary-300 via-primary-500 to-accent-400 rounded-full relative">
                <div
                  className="w-3 h-3 bg-white border-2 border-primary-600 rounded-full absolute top-1/2 transform -translate-y-1/2 shadow-md"
                  style={{
                    left: `calc(${((results.adjustmentFactor + 1) / 2) * 100}% - 6px)`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Redirecting Message */}
          <p className="text-neutral-500 text-sm">
            <i className="fas fa-spinner fa-spin mr-2" />
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50 to-secondary-50 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-2xl" style={{ overflow: 'hidden' }}>
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-neutral-600">
                Question {currentQuestion + 1} of {questions.length}
              </p>
              <h2 className="text-3xl font-bold text-neutral-900 mt-1">Know Yourself</h2>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary-600">{Math.round(progress)}%</div>
              <p className="text-xs text-neutral-500">Complete</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-accent-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div
          ref={questionCardRef}
          className="bg-white rounded-2xl shadow-lg p-8 mb-6"
          style={{ willChange: 'transform' }}
        >
          {/* Question Text */}
          <h3 className="text-2xl font-bold mb-8 leading-tight" style={{ color: '#1a0a2e' }}>
            {question.text}
          </h3>

          {/* Response Options */}
          <div className="flex gap-3 mb-8">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => handleResponse(value)}
                className={`flex-1 py-4 px-2 rounded-lg font-semibold transition-all transform ${
                  responses[currentQuestion] === value
                    ? 'bg-gradient-to-br from-indigo-700 to-purple-700 text-white shadow-lg scale-105 hover:from-indigo-800 hover:to-purple-800'
                    : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200'
                }`}
                title={`Press ${value} on your keyboard`}
              >
                <div className="text-lg mb-1">{value}</div>
                <div className="text-xs">
                  {value === 1 && 'Strongly\nDisagree'}
                  {value === 2 && 'Disagree'}
                  {value === 3 && 'Neutral'}
                  {value === 4 && 'Agree'}
                  {value === 5 && 'Strongly\nAgree'}
                </div>
              </button>
            ))}
          </div>

          {/* Description */}
          <p className="text-sm text-neutral-500 text-center">
            {responses[currentQuestion] === 0
              ? 'Select your response (or press 1-5) to enable the Next button'
              : 'Press Enter or use the Next button below to move to the next question'}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex gap-4">
          <button
            onClick={() => {
              if (!isAnimating) {
                setCurrentQuestion(Math.max(0, currentQuestion - 1))
              }
            }}
            disabled={currentQuestion === 0 || isAnimating}
            className="flex-1 py-3 bg-neutral-100 text-neutral-700 font-semibold rounded-lg hover:bg-neutral-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <i className="fas fa-chevron-left" />
            Previous
          </button>

          {currentQuestion === questions.length - 1 && responses.every((r) => r !== 0) ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isAnimating}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting && <i className="fas fa-spinner fa-spin" />}
              {isSubmitting ? 'Submitting...' : 'Complete Quiz'}
            </button>
          ) : (
            <button
              onClick={() => {
                if (!isAnimating) {
                  setCurrentQuestion(Math.min(questions.length - 1, currentQuestion + 1))
                }
              }}
              disabled={responses[currentQuestion] === 0 || isAnimating}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Next
              <i className="fas fa-chevron-right" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}