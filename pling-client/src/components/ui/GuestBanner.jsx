import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { UserPlus, X } from 'lucide-react'
import { useState } from 'react'

export default function GuestBanner() {
  const { isGuest } = useAuthStore()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  if (!isGuest || dismissed) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-5xl mx-auto rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-lg"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--accent-border)',
        }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{background:'var(--accent-dim)'}}>
            <UserPlus size={16} style={{color:'var(--accent)'}} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{color:'var(--text-primary)'}}>
              You're browsing as a guest
            </p>
            <p className="text-xs" style={{color:'var(--text-secondary)'}}>
              Create a free account to track your progress
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => navigate('/register')}
            className="text-sm font-medium px-4 py-2 rounded-lg transition"
            style={{background:'var(--accent)', color:'#fff'}}
          >
            Sign up free
          </button>
          <button
            onClick={() => navigate('/login')}
            className="text-sm px-3 py-2 rounded-lg transition border"
            style={{
              color:'var(--text-secondary)',
              borderColor:'var(--border-subtle)',
            }}
          >
            Log in
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg transition"
            style={{color:'var(--text-muted)'}}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}