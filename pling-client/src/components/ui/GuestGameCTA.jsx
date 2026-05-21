import { useNavigate } from 'react-router-dom'
import { X, Trophy } from 'lucide-react'

/**
 * Shown when a guest tries to tick an achievement in a game they haven't claimed.
 * They're already tracking `claimedGameTitle` — nudge them to sign up for unlimited.
 */
export default function GuestGameCTA({ claimedGameTitle, onClose }) {
  const navigate = useNavigate()

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div
        className="w-full max-w-md rounded-2xl p-6 border"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-dim)', border: '0.5px solid var(--accent-border)' }}
          >
            <Trophy size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          You're already tracking {claimedGameTitle}
        </h2>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Create a free account to track unlimited games and sync your progress across PSN, Xbox, and Steam.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
            style={{
              background: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            Keep browsing
          </button>
          <button
            onClick={() => { onClose(); navigate('/register') }}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Create free account
          </button>
        </div>
      </div>
    </div>
  )
}
