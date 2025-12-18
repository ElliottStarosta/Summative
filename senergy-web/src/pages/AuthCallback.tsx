import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export const AuthCallback = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const error = params.get('error')

    if (error) {
      navigate('/login?error=' + error)
      return
    }

    if (token) {
      localStorage.setItem('auth_token', token)
      // After completing OAuth sign-in, send user to quiz so new accounts
      // are onboarded through the personality flow before seeing dashboard
      navigate('/quiz')
    } else {
      navigate('/login')
    }
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <i className="fas fa-spinner fa-spin text-4xl text-purple-600 mb-4" />
        <p className="text-slate-600">Completing sign in...</p>
      </div>
    </div>
  )
}