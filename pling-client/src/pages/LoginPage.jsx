import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { login } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { usePageTitle } from '../hooks/usePageTitle'

export default function LoginPage() {
  usePageTitle('Sign In')
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
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

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

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

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-5">
              {error}
            </div>
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
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-violet-400 hover:text-violet-300 transition">
            Create one
          </Link>
          <div className="text-center mt-4">
            <button
              onClick={handleGuest}
              className="text-sm transition"
              style={{color:'var(--text-muted)'}}
            >
              Browse as guest →
            </button>
          </div>
        </p>
      </div>
    </div>
  )
}