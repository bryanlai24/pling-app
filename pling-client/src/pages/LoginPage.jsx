import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useGoogleLogin } from '@react-oauth/google'
import { login, googleAuth, appleAuth, completeSocialSignup } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { usePageTitle } from '../hooks/usePageTitle'
import { useDiscordLogin } from '../hooks/useDiscordLogin'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID || ''
const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || ''
const showSocialAuth = !!(GOOGLE_CLIENT_ID || APPLE_CLIENT_ID || DISCORD_CLIENT_ID)

export default function LoginPage() {
  usePageTitle('Sign In')
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [mergePending, setMergePending] = useState(false)
  const [setupState, setSetupState] = useState(null) // { setup_token, suggested_username }
  const [chosenUsername, setChosenUsername] = useState('')
  const setGuest = useAuthStore((s) => s.setGuest)

  const handleGuest = () => {
    setGuest()
    navigate('/library')
  }

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (res) => {
      setAuth(res.data.user, res.data.access_token)
      navigate('/library')
    },
    onError: (err) => {
      setError(err.response?.data?.detail || 'Login failed')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)
    mutation.mutate(form)
  }

  const handleSocialSuccess = (res) => {
    if (res.data.merge_pending) {
      setMergePending(true)
    } else if (res.data.username_required) {
      setSetupState({ setup_token: res.data.setup_token, suggested_username: res.data.suggested_username })
      setChosenUsername(res.data.suggested_username)
    } else {
      setAuth(res.data.user, res.data.access_token)
      navigate('/library')
    }
  }

  const setupMutation = useMutation({
    mutationFn: ({ setup_token, username }) => completeSocialSignup(setup_token, username),
    onSuccess: (res) => {
      setAuth(res.data.user, res.data.access_token)
      navigate('/library')
    },
    onError: (err) => setError(err.response?.data?.detail || 'Could not create account'),
  })

  const { openDiscordLogin } = useDiscordLogin({
    onSuccess: (data) => {
      setError(null)
      if (data.merge_pending) {
        setMergePending(true)
      } else if (data.username_required) {
        setSetupState({ setup_token: data.setup_token, suggested_username: data.suggested_username })
        setChosenUsername(data.suggested_username)
      } else {
        setAuth(data.user, data.access_token)
        navigate('/library')
      }
    },
    onError: (msg) => setError(msg),
  })

  // useGoogleLogin must always be called (hooks rules), but we pass a no-op
  // config when the client ID isn't configured so the provider doesn't throw.
  const googleLogin = useGoogleLogin(GOOGLE_CLIENT_ID ? {
    onSuccess: async (tokenResponse) => {
      try {
        setError(null)
        const res = await googleAuth(tokenResponse.access_token)
        handleSocialSuccess(res)
      } catch (err) {
        setError(err.response?.data?.detail || 'Google sign-in failed')
      }
    },
    onError: () => setError('Google sign-in was cancelled or failed'),
  } : { onSuccess: () => {}, onError: () => {} })

  const handleAppleLogin = () => {
    if (!window.AppleID) {
      setError('Apple Sign In is not available')
      return
    }
    const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID
    if (!appleClientId) {
      setError('Apple Sign In is not configured')
      return
    }
    window.AppleID.auth.init({
      clientId: appleClientId,
      scope: 'name email',
      redirectURI: window.location.origin,
      usePopup: true,
    })
    window.AppleID.auth.signIn().then(async (response) => {
      try {
        setError(null)
        const res = await appleAuth({
          identity_token: response.authorization.id_token,
          given_name: response.user?.name?.firstName || null,
          family_name: response.user?.name?.lastName || null,
        })
        handleSocialSuccess(res)
      } catch (err) {
        setError(err.response?.data?.detail || 'Apple sign-in failed')
      }
    }).catch(() => setError('Apple sign-in was cancelled or failed'))
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Back to landing */}
        <div className="mb-6">
          <Link to="/" className="flex items-center gap-1.5 text-sm transition" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            ← Pling
          </Link>
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Pling<span className="text-violet-400">.</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm">Track every achievement. Miss nothing.</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-6">Sign in to your account</h2>

          {mergePending ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">📬</div>
              <p className="text-white font-medium mb-2">Check your email</p>
              <p className="text-gray-400 text-sm">
                We found an existing account with that email. We've sent you a link to confirm the connection — check your inbox to continue.
              </p>
            </div>
          ) : setupState ? (
            <div>
              <p className="text-gray-400 text-sm mb-5">
                One last thing — pick a username for your Pling account.
              </p>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
                  {error}
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1.5">Username</label>
                <input
                  type="text"
                  value={chosenUsername}
                  onChange={(e) => { setChosenUsername(e.target.value); setError(null) }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                  placeholder="yourhandle"
                  maxLength={30}
                  autoFocus
                />
                <p className="text-gray-600 text-xs mt-1.5">3–30 characters: letters, numbers, hyphens, underscores</p>
              </div>
              <button
                onClick={() => {
                  setError(null)
                  setupMutation.mutate({ setup_token: setupState.setup_token, username: chosenUsername })
                }}
                disabled={setupMutation.isPending || !chosenUsername.trim()}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition"
              >
                {setupMutation.isPending ? 'Creating account...' : 'Continue →'}
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-5">
                  {error}
                </div>
              )}

              {/* Social sign-in — only shown when credentials are configured */}
              {showSocialAuth && (
                <>
                  <div className="space-y-3 mb-6">
                    {GOOGLE_CLIENT_ID && (
                      <button
                        onClick={() => googleLogin()}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-lg py-2.5 text-sm transition"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                          <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
                          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                        </svg>
                        Continue with Google
                      </button>
                    )}

                    {APPLE_CLIENT_ID && (
                      <button
                        onClick={handleAppleLogin}
                        className="w-full flex items-center justify-center gap-3 bg-black hover:bg-gray-900 border border-gray-700 text-white font-medium rounded-lg py-2.5 text-sm transition"
                      >
                        <svg width="17" height="18" viewBox="0 0 814 1000" fill="currentColor">
                          <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46 376.7 0 261.1 0 162.5c0-131 85.5-200.8 169.4-200.8 45 0 82.3 30 109.5 30 26.1 0 67.3-31.9 117.8-31.9 19.7 0 108.2 1.9 164 93.7zm-62.1-79.5c-40.5-47.6-98.3-80.6-155.5-80.6s-106.7 34.6-138 57.5c-27.8 21.2-59.8 57.7-59.8 111.1 0 51.1 28.2 82.5 56.4 103.8 25.1 19.4 69.8 41.4 131.6 41.4 52.7 0 101.3-25.5 129.4-49.4 4.2-3.6 37.5-33.6 37.5-83.4-.4-40.5-14.7-68.9-1.6-100.4z"/>
                        </svg>
                        Continue with Apple
                      </button>
                    )}

                    {DISCORD_CLIENT_ID && (
                      <button
                        onClick={openDiscordLogin}
                        className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-lg py-2.5 text-sm transition"
                      >
                        <svg width="20" height="15" viewBox="0 0 20 15" fill="currentColor">
                          <path d="M16.93 1.33A16.47 16.47 0 0 0 12.86.02a.06.06 0 0 0-.07.03c-.18.32-.38.73-.52 1.06a15.22 15.22 0 0 0-4.54 0A10.7 10.7 0 0 0 7.2.05a.06.06 0 0 0-.07-.03 16.44 16.44 0 0 0-4.07 1.31.06.06 0 0 0-.03.02C.44 5.53-.27 9.6.08 13.62c0 .02.01.04.03.05a16.57 16.57 0 0 0 4.96 2.49.06.06 0 0 0 .07-.02c.38-.52.72-1.07 1.01-1.65a.06.06 0 0 0-.03-.08 10.9 10.9 0 0 1-1.55-.74.06.06 0 0 1-.01-.1c.1-.08.21-.16.31-.24a.06.06 0 0 1 .06-.01c3.26 1.48 6.79 1.48 10.01 0a.06.06 0 0 1 .06.01c.1.08.2.16.31.24a.06.06 0 0 1-.01.1c-.5.29-1.01.54-1.55.73a.06.06 0 0 0-.03.09c.3.58.64 1.13 1.01 1.65.02.02.04.03.07.02a16.52 16.52 0 0 0 4.97-2.49.06.06 0 0 0 .03-.05c.41-4.24-.69-8.28-2.92-11.69a.05.05 0 0 0-.03-.03ZM6.68 11.18c-.98 0-1.79-.9-1.79-2 0-1.12.79-2.01 1.79-2.01 1.01 0 1.81.9 1.79 2 0 1.11-.79 2.01-1.79 2.01Zm6.62 0c-.98 0-1.79-.9-1.79-2 0-1.12.79-2.01 1.79-2.01 1.01 0 1.81.9 1.79 2 0 1.11-.78 2.01-1.79 2.01Z"/>
                        </svg>
                        Continue with Discord
                      </button>
                    )}
                  </div>

                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-700" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-gray-900 px-3 text-gray-500">or sign in with email</span>
                    </div>
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition mt-2"
                >
                  {mutation.isPending ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-violet-400 hover:text-violet-300 transition">
            Create one
          </Link>
        </p>
        <div className="text-center mt-4">
          <button
            onClick={handleGuest}
            className="text-sm transition"
            style={{color:'var(--text-muted)'}}
          >
            Browse as guest →
          </button>
        </div>
      </div>
    </div>
  )
}