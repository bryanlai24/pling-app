import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createGame, addToLibrary, listGames } from '../../api/games'
import { X, Search, Trophy, ChevronRight } from 'lucide-react'

const PLATFORMS = [
  { value: 'psn', label: 'PlayStation (PSN)' },
  { value: 'xbox', label: 'Xbox' },
  { value: 'steam', label: 'Steam' },
  { value: 'manual', label: 'Manual' },
]

const PLATFORM_BADGES = {
  psn:    { label: 'PSN',    style: { background: 'rgba(96,165,250,0.08)',  color: '#60a5fa', border: '0.5px solid rgba(96,165,250,0.2)'  } },
  xbox:   { label: 'Xbox',   style: { background: 'rgba(52,211,153,0.08)',  color: '#34d399', border: '0.5px solid rgba(52,211,153,0.2)'  } },
  steam:  { label: 'Steam',  style: { background: 'rgba(156,163,175,0.08)', color: '#9ca3af', border: '0.5px solid rgba(156,163,175,0.2)' } },
  manual: { label: 'Manual', style: { background: 'rgba(167,139,250,0.08)', color: '#a78bfa', border: '0.5px solid rgba(167,139,250,0.2)' } },
}

const inputCls = 'w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none'
const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '0.5px solid var(--border-default)',
  color: 'var(--text-primary)',
}

export default function AddGameModal({ onClose, onSuccess }) {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('search') // search | manual
  const [form, setForm] = useState({ title: '', platform: 'psn', cover_image_url: '' })
  const [error, setError] = useState(null)

  const { data: catalogue = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => listGames().then((r) => r.data),
  })

  const results = search.length > 1
    ? catalogue.filter((g) => g.title.toLowerCase().includes(search.toLowerCase()))
    : catalogue

  const addMutation = useMutation({
    mutationFn: (gameId) => addToLibrary(gameId),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to add game'),
  })

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const game = await createGame(data)
      await addToLibrary(game.data.id)
    },
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to add game'),
  })

  const handleCreate = (e) => {
    e.preventDefault()
    setError(null)
    const payload = { ...form }
    if (!payload.cover_image_url) delete payload.cover_image_url
    createMutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md rounded-2xl"
        style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border-default)' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Add a game</h2>
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
          <div className="mx-6 flex items-start gap-2 rounded-lg px-4 py-3 mb-4 text-sm"
            style={{ background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex mx-6 mb-4 rounded-lg p-0.5"
          style={{ background: 'var(--bg-elevated)' }}>
          {['search', 'manual'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 text-sm py-1.5 rounded-md transition capitalize"
              style={{
                background: mode === m ? 'var(--bg-surface)' : 'transparent',
                color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {m === 'search' ? 'Search catalogue' : 'Add manually'}
            </button>
          ))}
        </div>

        {/* Search mode */}
        {mode === 'search' && (
          <div className="px-6 pb-6">
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search for a game…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className={inputCls}
                style={{ ...inputStyle, paddingLeft: '2.25rem' }}
              />
            </div>

            <div className="max-h-72 overflow-y-auto">
              {results.length === 0 && (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {search.length > 1
                    ? 'No games found — try adding it manually'
                    : 'No games in catalogue yet'}
                </div>
              )}
              {results.map((game) => {
                const badge = PLATFORM_BADGES[game.platform]
                return (
                  <button
                    key={game.id}
                    onClick={() => addMutation.mutate(game.id)}
                    disabled={addMutation.isPending}
                    className="w-full flex items-center gap-3 transition text-left"
                    style={{ padding: '10px 0', borderBottom: '0.5px solid var(--border-deep)' }}
                  >
                    {game.cover_image_url ? (
                      <img src={game.cover_image_url} alt={game.title}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
                        style={{ background: 'var(--bg-elevated)' }}>
                        <Trophy size={14} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {game.title}
                      </p>
                      {(game.genres || []).length > 0 && (
                        <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-muted)' }}>
                          {game.genres.map((g) => g.genre).join(', ')}
                        </p>
                      )}
                    </div>
                    {badge && (
                      <span className="text-xs px-2 py-0.5 rounded flex-shrink-0" style={badge.style}>
                        {badge.label}
                      </span>
                    )}
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </button>
                )
              })}
            </div>

            {results.length > 0 && (
              <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
                Can't find your game?{' '}
                <button
                  onClick={() => setMode('manual')}
                  className="transition"
                  style={{ color: 'var(--accent)' }}
                >
                  Add it manually
                </button>
              </p>
            )}
          </div>
        )}

        {/* Manual mode */}
        {mode === 'manual' && (
          <form onSubmit={handleCreate} className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Game title
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputCls}
                style={inputStyle}
                placeholder="e.g. Elden Ring"
              />
            </div>

            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Platform
              </label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className={inputCls}
                style={inputStyle}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Cover image URL{' '}
                <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <input
                type="url"
                value={form.cover_image_url}
                onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
                className={inputCls}
                style={inputStyle}
                placeholder="https://…"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMode('search')}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '0.5px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {createMutation.isPending ? 'Adding…' : 'Add game'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
