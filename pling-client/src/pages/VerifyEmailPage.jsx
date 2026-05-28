import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { usePageTitle } from '../hooks/usePageTitle'
import client from '../api/client'

export default function VerifyEmailPage() {
  usePageTitle('Verify Email')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const setAuth = useAuthStore((s) => s.setAuth)
  const [status, setStatus] = useState('loading') // loading | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token found in this link.')
      return
    }
    client.get(`/users/verify-email?token=${token}`)
      .then((res) => {
        setAuth(res.data.user, res.data.access_token)
        setStatus('success')
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.response?.data?.detail || 'Verification failed. The link may have expired.')
      })
  }, [token])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Pling<span className="text-violet-400">.</span>
          </h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          {status === 'loading' && (
            <>
              <div className="text-4xl mb-4">⏳</div>
              <p className="text-white font-medium">Verifying your email...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="text-4xl mb-4">✅</div>
              <p className="text-white font-medium mb-2">Email verified!</p>
              <p className="text-gray-400 text-sm mb-6">Your account is now verified. Welcome to Pling.</p>
              <Link
                to="/library"
                className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg px-6 py-2.5 text-sm transition"
              >
                Go to library →
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-4xl mb-4">❌</div>
              <p className="text-white font-medium mb-2">Verification failed</p>
              <p className="text-gray-400 text-sm mb-6">{message}</p>
              <Link
                to="/login"
                className="inline-block bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg px-6 py-2.5 text-sm transition"
              >
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
