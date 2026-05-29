import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createGame, addToLibrary, listGames, getGameTrophySets, syncPsnGame, syncSteamGame, syncXboxGame } from '../../api/games'
import { getMe } from '../../api/auth'
import { X, Search, Trophy, ChevronRight, Loader2, Monitor } from 'lucide-react'

// Platform display config
const PLATFORM_CONFIG = {
  psn:    { label: 'PlayStation (PSN)', color: '#003791', bg: 'rgba(0,55,145,0.12)',    border: 'rgba(0,55,145,0.3)'    },
  xbox:   { label: 'Xbox',              color: '#107c10', bg: 'rgba(16,124,16,0.12)',   border: 'rgba(16,124,16,0.3)'   },
  steam:  { label: 'Steam',             color: '#4a90d9', bg: 'rgba(74,144,217,0.12)',  border: 'rgba(74,144,217,0.3)'  },
  manual: { label: 'No platform',       color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
}

// Map platform → field on the /me response that indicates it's connected
const PLATFORM_CONNECTED_FIELD = {
  psn:   (u) => !!u?.psn_account_id,
  xbox:  (u) => !!u?.xbox_gamertag,
  steam: (u) => !!u?.steam_id,
}

// Map platform → sync function
const SYNC_FN = {
  psn:   syncPsnGame,
  xbox:  syncXboxGame,
  steam: syncSteamGame,
}

const MANUAL_PLATFORMS = [
  { value: 'psn',    label: 'PlayStation (PSN)' },
  { value: 'xbox',   label: 'Xbox'              },
  { value: 'steam',  label: 'Steam'             },
  { value: 'manual', label: 'Manual'            },
]

const inputCls = 'w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none'
const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '0.5px solid var(--border-default)',
  color: 'var(--text-primary)',
}

// ── Platform picker step ──────────────────────────────────────────────────────

function PlatformPicker({ game, user, onConfirm, onBack, isPending }) {
  const [selected, setSelected] = useState(null)

  const { data: trophySets = [], isLoading } = useQuery({
    queryKey: ['game-trophy-sets', game.id],
    queryFn: () => getGameTrophySets(game.id).then(r => r.data),
  })

  // Build platform options from available trophy sets + always include manual
  const platformOptions = [
    ...trophySets
      .filter(ts => ts.platform && ts.platform !== 'manual')
      .map(ts => ({ platform: ts.platform, achievementCount: ts.achievement_count })),
    { platform: 'manual', achievementCount: null },
  ]

  const isConnected = (platform) => {
    if (platform === 'manual') return true
    return PLATFORM_CONNECTED_FIELD[platform]?.(user) ?? false
  }

  return (
    <div className="px-6 pb-6">
      {/* Selected game summary */}
      <div
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 mb-5"
        style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)' }}
      >
        {game.cover_image_url ? (
          <img src={game.cover_image_url} alt={game.title}
            className="w-9 h-9 rounded-md object-cover flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center"
            style={{ background: 'var(--bg-surface)' }}>
            <Trophy size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
        )}
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {game.title}
        </p>
      </div>

      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
        How do you play this?
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : (
        <div className="space-y-2 mb-5">
          {platformOptions.map(({ platform, achievementCount }) => {
            const cfg = PLATFORM_CONFIG[platform]
            const connected = isConnected(platform)
            const isSelected = selected === platform

            return (
              <button
                key={platform}
                onClick={() => connected && setSelected(platform)}
                disabled={!connected}
                className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition"
                style={{
                  background: isSelected ? cfg.bg : 'var(--bg-elevated)',
                  border: `0.5px solid ${isSelected ? cfg.border : 'var(--border-default)'}`,
                  opacity: connected ? 1 : 0.45,
                  cursor: connected ? 'pointer' : 'not-allowed',
                }}
              >
                {/* Platform dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: cfg.color }}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: isSelected ? cfg.color : 'var(--text-primary)' }}>
                    {cfg.label}
                  </p>
                  {platform !== 'manual' && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {!connected
                        ? 'Not connected — link in Profile settings'
                        : achievementCount != null
                          ? `${achievementCount} achievements · syncs automatically`
                          : 'Syncs automatically'}
                    </p>
                  )}
                  {platform === 'manual' && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Track progress manually, no sync
                    </p>
                  )}
                </div>

                {/* Selection indicator */}
                <div
                  className="w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center"
                  style={{
                    borderColor: isSelected ? cfg.color : 'var(--border-default)',
                    background: isSelected ? cfg.color : 'transparent',
                  }}
                >
                  {isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#fff' }} />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
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
          onClick={() => onConfirm(selected)}
          disabled={!selected || isPending}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {isPending
            ? <><Loader2 size={14} className="animate-spin" /> Adding…</>
            : 'Add to library'
          }
        </button>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function AddGameModal({ onClose, onSuccess }) {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('search') // search | manual
  const [selectedGame, setSelectedGame] = useState(null) // catalogue game awaiting platform pick
  const [form, setForm] = useState({ title: '', platform: 'psn', cover_image_url: '' })
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)

  const { data: catalogue = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => listGames().then((r) => r.data),
  })

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then(r => r.data),
  })

  const results = search.length > 1
    ? catalogue.filter((g) => g.title.toLowerCase().includes(search.toLowerCase()))
    : catalogue

  // Add from catalogue with optional platform sync
  const handleConfirmPlatform = async (platform) => {
    setAdding(true)
    setError(null)
    try {
      await addToLibrary(selectedGame.id)
      // Kick off sync if a real platform was chosen and user has it connected
      if (platform && platform !== 'manual' && SYNC_FN[platform]) {
        try {
          await SYNC_FN[platform](selectedGame.id)
        } catch {
          // Sync failure is non-fatal — game is already added
        }
      }
      onSuccess?.()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add game')
      setAdding(false)
    }
  }

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
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {selectedGame ? 'Choose platform' : 'Add a game'}
          </h2>
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

        {/* Platform picker step */}
        {selectedGame && (
          <PlatformPicker
            game={selectedGame}
            user={user}
            isPending={adding}
            onConfirm={handleConfirmPlatform}
            onBack={() => { setSelectedGame(null); setError(null) }}
          />
        )}

        {/* Search / manual tabs — hidden during platform pick */}
        {!selectedGame && (
          <>
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
                  {results.map((game) => (
                    <button
                      key={game.id}
                      onClick={() => { setError(null); setSelectedGame(game) }}
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
                      <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    </button>
                  ))}
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
                    {MANUAL_PLATFORMS.map((p) => (
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
          </>
        )}
      </div>
    </div>
  )
}
