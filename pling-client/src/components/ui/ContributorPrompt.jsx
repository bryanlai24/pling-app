import { X, Users } from 'lucide-react'

export default function ContributorPrompt({ onClose, discordUrl = "https://discord.gg/your-invite-link" }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md rounded-2xl p-6 border"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-dim)', border: '0.5px solid var(--accent-border)' }}>
            <Users size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Want to contribute to Pling?
        </h2>
        <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Objectives and methods are maintained by our contributor community.
          Contributors help build the guide layer that makes Pling unique —
          the step-by-step breakdowns no other app provides.
        </p>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          If you'd like to help, join our Discord and introduce yourself in
          <span className="font-mono text-xs mx-1 px-1.5 py-0.5 rounded"
            style={{ background: 'var(--bg-elevated)', color: 'var(--accent)' }}>
            #contributor-applications
          </span>
          — we'd love to have you.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition border"
            style={{
              background: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}
          >
            Maybe later
          </button>
          <a
            href={discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-center transition"
            style={{ background: '#5865F2', color: '#fff' }}
          >
            Join Discord
          </a>
        </div>
      </div>
    </div>
  )
}