import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createAchievement } from '../../api/achievements'
import { X } from 'lucide-react'

const PSN_TROPHY_TYPES = [
  { value: '', label: 'None' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
]

const inputCls = 'w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none'
const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '0.5px solid var(--border-default)',
  color: 'var(--text-primary)',
}

export default function AddAchievementModal({ gameId, platform, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    trophy_type: platform === 'psn' ? 'bronze' : '',
    gamerscore: '',
    rarity: '',
  })
  const [error, setError] = useState(null)

  const mutation = useMutation({
    mutationFn: (data) => createAchievement(data),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to add trophy'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)
    const payload = { game_id: gameId, title: form.title }
    if (form.description) payload.description = form.description
    if (form.rarity) payload.rarity = form.rarity
    if (platform === 'psn' && form.trophy_type) payload.trophy_type = form.trophy_type
    if (platform === 'xbox' && form.gamerscore) payload.gamerscore = parseInt(form.gamerscore)
    mutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border-default)' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Add a trophy</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg px-4 py-3 mb-4 text-sm"
            style={{ background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Trophy name
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
              style={inputStyle}
              placeholder="e.g. Lie of P"
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Description{' '}
              <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className={`${inputCls} resize-none`}
              style={inputStyle}
              placeholder="What does this trophy require?"
            />
          </div>

          {platform === 'psn' && (
            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Trophy type
              </label>
              <select
                value={form.trophy_type}
                onChange={(e) => setForm({ ...form, trophy_type: e.target.value })}
                className={inputCls}
                style={inputStyle}
              >
                {PSN_TROPHY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}

          {platform === 'xbox' && (
            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Gamerscore
              </label>
              <input
                type="number"
                min={0}
                max={1000}
                value={form.gamerscore}
                onChange={(e) => setForm({ ...form, gamerscore: e.target.value })}
                className={inputCls}
                style={inputStyle}
                placeholder="e.g. 50"
              />
            </div>
          )}

          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Rarity{' '}
              <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={form.rarity}
              onChange={(e) => setForm({ ...form, rarity: e.target.value })}
              className={inputCls}
              style={inputStyle}
              placeholder="e.g. Ultra Rare"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition"
              style={{
                background: 'var(--bg-elevated)',
                border: '0.5px solid var(--border-default)',
                color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {mutation.isPending ? 'Adding…' : 'Add trophy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
