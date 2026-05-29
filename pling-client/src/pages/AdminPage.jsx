import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMe } from '../api/auth'
import { useNavigate } from 'react-router-dom'
import { Shield, Download, Loader2, CheckCircle2, AlertCircle, Search, Trophy, ChevronRight, Sparkles, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import client from '../api/client'
import { usePageTitle } from '../hooks/usePageTitle'

const searchPSN = (query) => client.get(`/admin/psn/search?query=${encodeURIComponent(query)}`)
const importGame = (data) => client.post('/admin/import/psn', data)
const listAllGames = () => client.get('/games')
const getXboxAuthUrl = () => client.get('/admin/xbox/auth-url')
const submitXboxCode = (code) => client.post('/admin/xbox/auth-callback', { code })
const searchXbox = (query) => client.get(`/admin/xbox/search?query=${encodeURIComponent(query)}`)
const importXboxGame = (data) => client.post('/admin/import/xbox', data)
const searchSteam = (query) => client.get(`/admin/steam/search?query=${encodeURIComponent(query)}`)
const importSteamGame = (data) => client.post('/admin/import/steam', data)
const getSeedCatalogue = () => client.get('/admin/seed/catalogue')
const seedGame = (slug) => client.post('/admin/seed/game', { slug })
const getGameTrophySets = (gameId) => client.get(`/admin/games/${gameId}/trophy-sets`)
const deleteGame = (gameId) => client.delete(`/admin/games/${gameId}`)
const deleteTrophySet = (trophySetId) => client.delete(`/admin/trophy-sets/${trophySetId}`)

// ── Shared sub-components ──────────────────────────────────────────────────

function SuccessBanner({ message, sub }) {
  return (
    <div className="flex items-start gap-2 rounded-lg px-4 py-3 mb-4 text-sm"
      style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
      <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-medium">{message}</p>
        {sub && <p className="mt-0.5 text-xs" style={{ color: 'rgba(52,211,153,0.6)' }}>{sub}</p>}
      </div>
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-2 rounded-lg px-4 py-3 mb-4 text-sm"
      style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
      <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
      <p>{message}</p>
    </div>
  )
}

function WarnBanner({ children }) {
  return (
    <div className="rounded-lg px-4 py-3 mb-4 text-sm"
      style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
      {children}
    </div>
  )
}

function SectionCard({ children }) {
  return (
    <div className="rounded-2xl p-5 sm:p-6 mb-5"
      style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border-default)' }}>
      {children}
    </div>
  )
}

function SectionHeader({ icon, label }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      {icon}
      <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</h2>
    </div>
  )
}

function GameCover({ url, alt, size = 'md' }) {
  const dim = size === 'sm' ? 'w-10 h-10' : 'w-12 h-12'
  return url ? (
    <img src={url} alt={alt} className={`${dim} rounded-lg object-cover flex-shrink-0`} />
  ) : (
    <div className={`${dim} rounded-lg flex-shrink-0 flex items-center justify-center`}
      style={{ background: 'var(--bg-elevated)' }}>
      <Trophy size={size === 'sm' ? 14 : 18} style={{ color: 'var(--text-muted)' }} />
    </div>
  )
}

function FormInput({ label, sub, ...props }) {
  return (
    <div>
      <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
        {label}{sub && <span className="ml-1" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
      </label>
      <input
        className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none"
        style={{
          background: 'var(--bg-elevated)',
          border: '0.5px solid var(--border-default)',
          color: 'var(--text-primary)',
        }}
        {...props}
      />
    </div>
  )
}

function FormSelect({ label, sub, children, ...props }) {
  return (
    <div>
      <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
        {label}{sub && <span className="ml-1" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
      </label>
      <select
        className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none"
        style={{
          background: 'var(--bg-elevated)',
          border: '0.5px solid var(--border-default)',
          color: 'var(--text-primary)',
        }}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

function SearchInput({ value, onChange, placeholder, icon }) {
  return (
    <div className="relative flex-1">
      <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
        {icon || <Search size={15} />}
      </span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none"
        style={{
          background: 'var(--bg-elevated)',
          border: '0.5px solid var(--border-default)',
          color: 'var(--text-primary)',
        }}
      />
    </div>
  )
}

function SearchResult({ game, coverUrl, title, sub, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 transition text-left"
      style={{
        padding: '10px 0',
        borderBottom: '0.5px solid var(--border-deep)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <GameCover url={coverUrl} alt={title} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
      </div>
      {!disabled && <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
      {disabled && (
        <span className="text-xs px-2 py-0.5 rounded flex-shrink-0"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
          Not owned
        </span>
      )}
    </button>
  )
}

function SelectedGameBar({ coverUrl, title, sub, onClear }) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-4 mb-4"
      style={{ background: 'var(--bg-card-purple)', border: '0.5px solid var(--accent-border)' }}>
      <GameCover url={coverUrl} alt={title} />
      <div className="flex-1 min-w-0">
        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
      <button onClick={onClear} className="text-xs transition" style={{ color: 'var(--text-muted)' }}>
        Change
      </button>
    </div>
  )
}

function ActionButtons({ onBack, onSubmit, submitLabel, isPending }) {
  return (
    <div className="flex gap-3 mt-2">
      <button
        type="button"
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
        type="submit"
        disabled={isPending}
        className="flex-1 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {isPending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        {isPending ? 'Importing…' : (submitLabel || 'Import')}
      </button>
    </div>
  )
}

// ── Status dot ─────────────────────────────────────────────────────────────

function StatusDot({ status, healthy, warning, danger }) {
  const color =
    status === healthy ? '#34d399' :
    status === warning ? '#fbbf24' :
    '#f87171'
  return <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
}

// ── Seed Section ───────────────────────────────────────────────────────────

const PLATFORM_COLORS = {
  steam: '#4a90d9',
  xbox: '#107c10',
  psn: '#003791',
  manual: 'var(--text-muted)',
}

function SeedSection({ queryClient }) {
  const [seedingSlug, setSeedingSlug] = useState(null)
  const [seedResults, setSeedResults] = useState({}) // slug → result
  const [seedErrors, setSeedErrors] = useState({})   // slug → error string

  const { data: catalogue, isLoading } = useQuery({
    queryKey: ['seed-catalogue'],
    queryFn: () => getSeedCatalogue().then(r => r.data),
  })

  const handleSeed = async (slug) => {
    setSeedingSlug(slug)
    setSeedErrors(prev => ({ ...prev, [slug]: null }))
    try {
      const res = await seedGame(slug)
      setSeedResults(prev => ({ ...prev, [slug]: res.data }))
      queryClient.invalidateQueries({ queryKey: ['seed-catalogue'] })
      queryClient.invalidateQueries({ queryKey: ['all-games'] })
      queryClient.invalidateQueries({ queryKey: ['games'] })
    } catch (err) {
      setSeedErrors(prev => ({
        ...prev,
        [slug]: err.response?.data?.detail || 'Seed failed',
      }))
    } finally {
      setSeedingSlug(null)
    }
  }

  const pending = catalogue?.filter(g => !g.already_imported && !seedResults[g.slug]?.status === 'imported')
  const allDone = catalogue?.every(g => g.already_imported || seedResults[g.slug]?.status === 'imported')

  return (
    <SectionCard>
      <SectionHeader
        icon={<Sparkles size={16} style={{ color: 'var(--accent)' }} />}
        label="Seed Catalogue"
      />

      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        Import iconic games directly — no platform account needed. Achievements are pulled from Steam's public API.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={15} className="animate-spin" />
          <span className="text-sm">Loading catalogue…</span>
        </div>
      ) : (
        <div>
          {catalogue?.map((game) => {
            const result = seedResults[game.slug]
            const error = seedErrors[game.slug]
            const isImported = game.already_imported || result?.status === 'imported'
            const isSeeding = seedingSlug === game.slug

            return (
              <div
                key={game.slug}
                className="flex items-center gap-3"
                style={{ padding: '10px 0', borderBottom: '0.5px solid var(--border-deep)' }}
              >
                {/* Platform dot */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: PLATFORM_COLORS[game.platform] || 'var(--text-muted)' }}
                />

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{game.title}</p>
                  {result?.status === 'imported' && (
                    <p className="text-xs mt-0.5" style={{ color: '#34d399' }}>
                      {result.achievements_imported} achievements imported
                    </p>
                  )}
                  {result?.status === 'skipped' && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Already in catalogue</p>
                  )}
                  {error && (
                    <p className="text-xs mt-0.5" style={{ color: '#f87171' }}>{error}</p>
                  )}
                </div>

                {/* Action */}
                {isImported ? (
                  <div className="flex items-center gap-1.5 text-xs flex-shrink-0" style={{ color: '#34d399' }}>
                    <CheckCircle2 size={13} />
                    <span>Imported</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSeed(game.slug)}
                    disabled={!!seedingSlug}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-40 flex-shrink-0"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {isSeeding
                      ? <><Loader2 size={12} className="animate-spin" />Seeding…</>
                      : <><Download size={12} />Seed</>
                    }
                  </button>
                )}
              </div>
            )
          })}

          {allDone && catalogue?.length > 0 && (
            <p className="text-sm text-center pt-4" style={{ color: '#34d399' }}>
              All games in the seed catalogue have been imported ✓
            </p>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ── Catalogue section with management controls ───────────────────────────────

function GameManagementPanel({ game, queryClient, navigate, onClose }) {
  const [confirm, setConfirm] = useState(null) // { type: 'game' | 'set', id, name }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const { data: trophySets, isLoading } = useQuery({
    queryKey: ['admin-trophy-sets', game.id],
    queryFn: () => getGameTrophySets(game.id).then(r => r.data),
  })

  const platformLabel = (p) => p ?? 'manual'
  const platformColor = (p) => {
    if (p === 'steam') return '#4a90d9'
    if (p === 'psn') return '#003791'
    if (p === 'xbox') return '#107c10'
    return 'var(--text-muted)'
  }

  const handleDeleteSet = async (setId) => {
    setBusy(true)
    setError(null)
    try {
      await deleteTrophySet(setId)
      queryClient.invalidateQueries({ queryKey: ['admin-trophy-sets', game.id] })
      queryClient.invalidateQueries({ queryKey: ['all-games'] })
      setConfirm(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteGame = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteGame(game.id)
      queryClient.invalidateQueries({ queryKey: ['all-games'] })
      queryClient.invalidateQueries({ queryKey: ['games'] })
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="rounded-lg mt-1 mb-2"
      style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)', padding: '12px 14px' }}
    >
      {/* View game link */}
      <button
        onClick={() => navigate(`/games/${game.id}`)}
        className="text-xs mb-3 flex items-center gap-1"
        style={{ color: 'var(--accent)' }}
      >
        View game page <ChevronRight size={12} />
      </button>

      {/* Trophy sets */}
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Trophy Sets</p>
      {isLoading && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
      {trophySets?.map(ts => (
        <div
          key={ts.id}
          className="flex items-center justify-between gap-2 py-1.5"
          style={{ borderBottom: '0.5px solid var(--border-deep)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: platformColor(ts.platform) + '22', color: platformColor(ts.platform) }}
            >
              {platformLabel(ts.platform)}
            </span>
            <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{ts.name}</span>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{ts.achievement_count} achievements</span>
          </div>
          {confirm?.type === 'set' && confirm.id === ts.id ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Delete?</span>
              <button
                onClick={() => handleDeleteSet(ts.id)}
                disabled={busy}
                className="text-xs px-2 py-1 rounded"
                style={{ background: '#e53e3e', color: '#fff' }}
              >
                {busy ? <Loader2 size={11} className="animate-spin" /> : 'Confirm'}
              </button>
              <button onClick={() => setConfirm(null)} className="text-xs" style={{ color: 'var(--text-muted)' }}>Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirm({ type: 'set', id: ts.id, name: ts.name })}
              className="flex-shrink-0 p-1 rounded transition"
              style={{ color: 'var(--text-muted)' }}
              title="Delete this trophy set"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}

      {/* Error */}
      {error && <p className="text-xs mt-2" style={{ color: '#e53e3e' }}>{error}</p>}

      {/* Delete whole game */}
      <div className="mt-3 pt-2" style={{ borderTop: '0.5px solid var(--border-default)' }}>
        {confirm?.type === 'game' ? (
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Delete <strong>{game.title}</strong> and all data?
            </span>
            <button
              onClick={handleDeleteGame}
              disabled={busy}
              className="text-xs px-2.5 py-1 rounded flex items-center gap-1"
              style={{ background: '#e53e3e', color: '#fff' }}
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <><Trash2 size={11} /> Delete game</>}
            </button>
            <button onClick={() => setConfirm(null)} className="text-xs" style={{ color: 'var(--text-muted)' }}>Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm({ type: 'game' })}
            className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded transition"
            style={{ color: '#e53e3e', border: '0.5px solid #e53e3e33' }}
          >
            <Trash2 size={12} /> Delete entire game
          </button>
        )}
      </div>
    </div>
  )
}

function CatalogueSection({ gamesData, queryClient, navigate }) {
  const [expandedId, setExpandedId] = useState(null)

  return (
    <SectionCard>
      <div className="flex items-baseline gap-2 mb-4">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Catalogue</h2>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{gamesData?.length ?? 0} games</span>
      </div>

      {gamesData?.map((g) => (
        <div key={g.id} style={{ borderBottom: '0.5px solid var(--border-deep)' }}>
          <button
            onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
            className="w-full flex items-center gap-3 transition text-left"
            style={{ padding: '10px 0' }}
          >
            <GameCover url={g.cover_image_url} alt={g.title} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{g.title}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {g.platform ?? 'manual'}{g.genre ? ` · ${g.genre}` : ''}
              </p>
            </div>
            {expandedId === g.id
              ? <ChevronUp size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              : <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            }
          </button>

          {expandedId === g.id && (
            <GameManagementPanel
              game={g}
              queryClient={queryClient}
              navigate={navigate}
              onClose={() => setExpandedId(null)}
            />
          )}
        </div>
      ))}

      {!gamesData?.length && (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>No games imported yet</p>
      )}
    </SectionCard>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  usePageTitle('Admin')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then((r) => r.data),
  })

  const { data: gamesData } = useQuery({
    queryKey: ['all-games'],
    queryFn: () => listAllGames().then((r) => r.data),
  })

  const { data: psnStatus } = useQuery({
    queryKey: ['psn-status'],
    queryFn: () => client.get('/admin/psn/status').then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: xboxStatus, refetch: refetchXboxStatus } = useQuery({
    queryKey: ['xbox-status'],
    queryFn: () => client.get('/admin/xbox/status').then(r => r.data),
    refetchInterval: 60000,
  })

  // ── Helpers ──
  const findMatchingGame = (title, games) => {
    if (!title || !games?.length) return null
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    const normalized = normalize(title)
    return games.find((g) => normalize(g.title) === normalized) || null
  }

  // ── PSN state ──
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedGame, setSelectedGame] = useState(null)
  const [importForm, setImportForm] = useState({ genre: '', trophy_set_name: 'Base Game', existing_game_id: '' })
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState(null)

  useEffect(() => {
    if (!selectedGame || !gamesData) return
    const match = findMatchingGame(selectedGame.title, gamesData)
    setImportForm((f) => ({ ...f, existing_game_id: match ? match.id : '' }))
  }, [selectedGame, gamesData])

  // ── Xbox state ──
  const [xboxAuthUrl, setXboxAuthUrl] = useState(null)
  const [xboxCode, setXboxCode] = useState('')
  const [xboxAuthError, setXboxAuthError] = useState(null)
  const [xboxSearch, setXboxSearch] = useState('')
  const [xboxResults, setXboxResults] = useState([])
  const [xboxSearching, setXboxSearching] = useState(false)
  const [xboxSearchError, setXboxSearchError] = useState(null)
  const [selectedXboxGame, setSelectedXboxGame] = useState(null)
  const [xboxImportForm, setXboxImportForm] = useState({
    genre: '', trophy_set_name: 'Base Game', existing_game_id: '', cover_image_url: '',
  })
  const [xboxImportResult, setXboxImportResult] = useState(null)
  const [xboxImportError, setXboxImportError] = useState(null)
  const [xboxImporting, setXboxImporting] = useState(false)

  useEffect(() => {
    if (!selectedXboxGame || !gamesData) return
    const match = findMatchingGame(selectedXboxGame.title, gamesData)
    setXboxImportForm((f) => ({ ...f, existing_game_id: match ? match.id : '' }))
  }, [selectedXboxGame, gamesData])

  // ── Steam state ──
  const [steamSearch, setSteamSearch] = useState('')
  const [steamResults, setSteamResults] = useState([])
  const [steamSearching, setSteamSearching] = useState(false)
  const [selectedSteamGame, setSelectedSteamGame] = useState(null)
  const [steamImportForm, setSteamImportForm] = useState({ genre: '', trophy_set_name: 'Base Game', existing_game_id: '' })
  const [steamImportResult, setSteamImportResult] = useState(null)
  const [steamImportError, setSteamImportError] = useState(null)
  const [steamImporting, setSteamImporting] = useState(false)

  useEffect(() => {
    if (!selectedSteamGame || !gamesData) return
    const match = findMatchingGame(selectedSteamGame.title, gamesData)
    setSteamImportForm((f) => ({ ...f, existing_game_id: match ? match.id : '' }))
  }, [selectedSteamGame, gamesData])

  // ── PSN handlers ──

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!search.trim()) return
    setSearching(true)
    setSearchResults([])
    setSelectedGame(null)
    setImportError(null)
    try {
      const res = await searchPSN(search)
      setSearchResults(res.data)
    } catch (err) {
      setImportError('Search failed — make sure your PSN account is connected')
    } finally {
      setSearching(false)
    }
  }

  const importMutation = useMutation({
    mutationFn: (data) => importGame(data),
    onSuccess: (res) => {
      setImportResult(res.data)
      setImportError(null)
      setSelectedGame(null)
      setSearch('')
      setSearchResults([])
      setImportForm({ genre: '', trophy_set_name: 'Base Game', existing_game_id: '' })
      queryClient.invalidateQueries({ queryKey: ['all-games'] })
      queryClient.invalidateQueries({ queryKey: ['games'] })
    },
    onError: (err) => {
      setImportError(err.response?.data?.detail || 'Import failed')
      setImportResult(null)
    },
  })

  const handleImport = (e) => {
    e.preventDefault()
    if (!selectedGame) return
    const payload = {
      np_communication_id: selectedGame.np_communication_id,
      game_title: selectedGame.title,
      platform: selectedGame.platform[0] || 'PS5',
      trophy_set_name: importForm.trophy_set_name,
    }
    if (importForm.genre) payload.genre = importForm.genre
    if (importForm.existing_game_id) payload.existing_game_id = importForm.existing_game_id
    importMutation.mutate(payload)
  }

  // ── Access guard ──

  if (!meLoading && me?.role !== 'admin') {
    return (
      <div className="text-center py-24">
        <Shield size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
        <h2 className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Access denied</h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>You need admin access to view this page.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-2.5 mb-6">
        <Shield size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="font-bold" style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Admin Panel</h1>
      </div>

      {/* ── Stats row ── */}
      <div className="rounded-2xl p-5 sm:p-6 mb-5 flex flex-wrap gap-6"
        style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border-default)' }}>

        {/* Games count */}
        <div className="flex-1 min-w-[120px]">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {gamesData?.length ?? '—'}
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Games in catalogue</p>
        </div>

        <div className="hidden sm:block w-px self-stretch" style={{ background: 'var(--border-subtle)' }} />

        {/* PSN token status */}
        <div className="flex-1 min-w-[140px]">
          <div className="flex items-center gap-2 mb-1">
            <StatusDot status={psnStatus?.status} healthy="healthy" warning="needs_refresh" />
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {psnStatus?.status === 'healthy' ? 'PSN healthy' :
               psnStatus?.status === 'needs_refresh' ? 'PSN refreshing…' :
               psnStatus?.status === 'expired' ? 'PSN token expired' :
               'Checking PSN…'}
            </p>
          </div>
          {psnStatus?.refresh_token_expires_at && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Expires {new Date(psnStatus.refresh_token_expires_at).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="hidden sm:block w-px self-stretch" style={{ background: 'var(--border-subtle)' }} />

        {/* Xbox token status */}
        <div className="flex-1 min-w-[140px]">
          <div className="flex items-center gap-2 mb-1">
            <StatusDot status={xboxStatus?.status} healthy="healthy" warning="needs_refresh" />
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {xboxStatus?.status === 'healthy' ? 'Xbox healthy' :
               xboxStatus?.status === 'needs_refresh' ? 'Xbox refreshing…' :
               xboxStatus?.status === 'no_tokens' ? 'Xbox not connected' :
               'Xbox token expired'}
            </p>
          </div>
          {me?.psn_id && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>PSN: {me.psn_id}</p>
          )}
        </div>
      </div>

      {/* ── PSN Import ── */}
      <SectionCard>
        <SectionHeader
          icon={<Download size={16} style={{ color: 'var(--accent)' }} />}
          label="Import from PSN"
        />

        {!me?.psn_id && (
          <WarnBanner>
            Connect your PSN account in your{' '}
            <button onClick={() => navigate('/profile')} className="underline">profile</button>{' '}
            before importing games.
          </WarnBanner>
        )}

        {importResult && (
          <SuccessBanner
            message={importResult.message}
            sub={`${importResult.trophies_imported} trophies imported`}
          />
        )}
        {importError && <ErrorBanner message={importError} />}

        {!selectedGame ? (
          <div>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              Search your PSN library to find a game to import:
            </p>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your PSN library…"
              />
              <button
                type="submit"
                disabled={searching || !me?.psn_id}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-50 flex-shrink-0"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Search
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="max-h-72 overflow-y-auto">
                {searchResults.map((game) => (
                  <SearchResult
                    key={game.np_communication_id}
                    coverUrl={game.cover_image_url}
                    title={game.title}
                    sub={`${game.platform.join(', ')} · ${game.total_trophies} trophies${game.defined_trophies?.platinum > 0 ? ' · Platinum' : ''}`}
                    onClick={() => setSelectedGame(game)}
                  />
                ))}
              </div>
            )}
            {searchResults.length === 0 && search && !searching && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                No games found matching "{search}" in your PSN library
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleImport}>
            <SelectedGameBar
              coverUrl={selectedGame.cover_image_url}
              title={selectedGame.title}
              sub={`${selectedGame.platform.join(', ')} · ${selectedGame.total_trophies} trophies`}
              onClear={() => setSelectedGame(null)}
            />

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput
                  label="Genre" sub="(optional)"
                  type="text"
                  value={importForm.genre}
                  onChange={(e) => setImportForm({ ...importForm, genre: e.target.value })}
                  placeholder="e.g. Action RPG"
                />
                <FormInput
                  label="Trophy set name"
                  type="text"
                  required
                  value={importForm.trophy_set_name}
                  onChange={(e) => setImportForm({ ...importForm, trophy_set_name: e.target.value })}
                  placeholder="Base Game"
                />
              </div>
              <FormSelect
                label="Attach to existing game" sub="(for DLC or platform sync)"
                value={importForm.existing_game_id}
                onChange={(e) => setImportForm({ ...importForm, existing_game_id: e.target.value })}
              >
                <option value="">Create new game entry</option>
                {gamesData?.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}{g.platform ? ` (${g.platform})` : ' (manual)'}</option>
                ))}
              </FormSelect>
            </div>

            <ActionButtons
              onBack={() => setSelectedGame(null)}
              isPending={importMutation.isPending}
            />
          </form>
        )}
      </SectionCard>

      {/* ── Xbox Import ── */}
      <SectionCard>
        <SectionHeader
          icon={<div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: '#107c10' }} />}
          label="Import from Xbox"
        />

        {/* Auth flow — no tokens */}
        {(xboxStatus?.status === 'no_tokens' || xboxStatus?.status === 'expired') ? (
          <div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Connect your Xbox account to enable game imports.
            </p>

            {xboxAuthError && <ErrorBanner message={xboxAuthError} />}

            {!xboxAuthUrl ? (
              <button
                onClick={async () => {
                  try {
                    const res = await getXboxAuthUrl()
                    setXboxAuthUrl(res.data.url)
                    window.open(res.data.url, '_blank')
                  } catch (err) {
                    setXboxAuthError('Could not get auth URL: ' + (err.response?.data?.detail || err.message))
                  }
                }}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition"
                style={{ background: '#107c10', color: '#fff' }}
              >
                Connect Xbox Account
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  After authorizing in the browser, paste the full redirect URL below:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={xboxCode}
                    onChange={(e) => setXboxCode(e.target.value)}
                    placeholder="Paste the redirect URL here…"
                    className="flex-1 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '0.5px solid var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    onClick={async () => {
                      setXboxAuthError(null)
                      try {
                        let code = xboxCode
                        if (xboxCode.includes('code=')) {
                          code = new URL(xboxCode).searchParams.get('code') || xboxCode
                        }
                        await submitXboxCode(code)
                        setXboxAuthUrl(null)
                        setXboxCode('')
                        refetchXboxStatus()
                      } catch (err) {
                        setXboxAuthError('Auth failed: ' + (err.response?.data?.detail || err.message))
                      }
                    }}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium flex-shrink-0"
                    style={{ background: '#107c10', color: '#fff' }}
                  >
                    Connect
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Authenticated — search / configure */
          <div>
            {xboxImportResult && (
              <SuccessBanner
                message={xboxImportResult.message}
                sub={`${xboxImportResult.achievements_imported} achievements imported`}
              />
            )}
            {xboxImportError && <ErrorBanner message={xboxImportError} />}

            {!selectedXboxGame ? (
              <div>
                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Search the Xbox catalog to find a game to import:
                </p>
                {xboxSearchError && <ErrorBanner message={xboxSearchError} />}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setXboxSearching(true)
                    setXboxResults([])
                    setXboxSearchError(null)
                    try {
                      const res = await searchXbox(xboxSearch)
                      setXboxResults(res.data)
                    } catch (err) {
                      setXboxSearchError('Search failed: ' + (err.response?.data?.detail || err.message))
                    } finally {
                      setXboxSearching(false)
                    }
                  }}
                  className="flex gap-2 mb-4"
                >
                  <SearchInput
                    value={xboxSearch}
                    onChange={(e) => setXboxSearch(e.target.value)}
                    placeholder="Search Xbox catalog…"
                  />
                  <button
                    type="submit"
                    disabled={xboxSearching}
                    className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-50 flex-shrink-0"
                    style={{ background: '#107c10', color: '#fff' }}
                  >
                    {xboxSearching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    Search
                  </button>
                </form>

                {xboxResults.length > 0 && (
                  <div className="max-h-72 overflow-y-auto">
                    {xboxResults.map((game) => (
                      <SearchResult
                        key={game.store_id}
                        coverUrl={game.cover_url}
                        title={game.title}
                        sub={game.can_import
                          ? `${game.platform} · ${game.max_gamerscore}G`
                          : 'Not in your Xbox library — play it first to import'}
                        disabled={!game.can_import}
                        onClick={() => game.can_import && setSelectedXboxGame(game)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <SelectedGameBar
                  coverUrl={selectedXboxGame.cover_url}
                  title={selectedXboxGame.title}
                  onClear={() => setSelectedXboxGame(null)}
                />

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormInput
                      label="Genre" sub="(optional)"
                      type="text"
                      value={xboxImportForm.genre}
                      onChange={(e) => setXboxImportForm({ ...xboxImportForm, genre: e.target.value })}
                      placeholder="e.g. Action RPG"
                    />
                    <FormInput
                      label="Achievement set name"
                      type="text"
                      value={xboxImportForm.trophy_set_name}
                      onChange={(e) => setXboxImportForm({ ...xboxImportForm, trophy_set_name: e.target.value })}
                    />
                  </div>
                  <FormInput
                    label="Cover image URL" sub="(optional)"
                    type="url"
                    value={xboxImportForm.cover_image_url}
                    onChange={(e) => setXboxImportForm({ ...xboxImportForm, cover_image_url: e.target.value })}
                    placeholder="https://…"
                  />
                  <FormSelect
                    label="Attach to existing game" sub="(for DLC or platform sync)"
                    value={xboxImportForm.existing_game_id}
                    onChange={(e) => setXboxImportForm({ ...xboxImportForm, existing_game_id: e.target.value })}
                  >
                    <option value="">Create new game entry</option>
                    {gamesData?.map((g) => (
                      <option key={g.id} value={g.id}>{g.title}{g.platform ? ` (${g.platform})` : ' (manual)'}</option>
                    ))}
                  </FormSelect>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setSelectedXboxGame(null)}
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
                    disabled={xboxImporting}
                    onClick={async () => {
                      setXboxImportError(null)
                      setXboxImportResult(null)
                      setXboxImporting(true)
                      try {
                        const payload = {
                          title_id: selectedXboxGame.title_id,
                          game_title: selectedXboxGame.title,
                          trophy_set_name: xboxImportForm.trophy_set_name,
                          cover_image_url: xboxImportForm.cover_image_url || selectedXboxGame.cover_url || undefined,
                        }
                        if (xboxImportForm.genre) payload.genre = xboxImportForm.genre
                        if (xboxImportForm.existing_game_id) payload.existing_game_id = xboxImportForm.existing_game_id
                        const res = await importXboxGame(payload)
                        setXboxImportResult(res.data)
                        setSelectedXboxGame(null)
                        setXboxSearch('')
                        setXboxResults([])
                        queryClient.invalidateQueries({ queryKey: ['all-games'] })
                        queryClient.invalidateQueries({ queryKey: ['games'] })
                      } catch (err) {
                        setXboxImportError('Import failed: ' + (err.response?.data?.detail || err.message))
                      } finally {
                        setXboxImporting(false)
                      }
                    }}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: '#107c10', color: '#fff' }}
                  >
                    {xboxImporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    {xboxImporting ? 'Importing…' : 'Import'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Steam Import ── */}
      <SectionCard>
        <SectionHeader
          icon={<div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: '#4a90d9' }} />}
          label="Import from Steam"
        />

        {!me?.steam_id ? (
          <WarnBanner>
            Add your Steam ID in your{' '}
            <button onClick={() => navigate('/profile')} className="underline">profile</button>{' '}
            to enable Steam imports.
          </WarnBanner>
        ) : (
          <div>
            {steamImportResult && (
              <SuccessBanner
                message={steamImportResult.message}
                sub={`${steamImportResult.achievements_imported} achievements imported`}
              />
            )}
            {steamImportError && <ErrorBanner message={steamImportError} />}

            {!selectedSteamGame ? (
              <div>
                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Search your Steam library to find a game to import:
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setSteamSearching(true)
                    setSteamResults([])
                    setSteamImportResult(null)
                    setSteamImportError(null)
                    try {
                      const res = await searchSteam(steamSearch)
                      setSteamResults(res.data)
                    } catch (err) {
                      setSteamImportError('Search failed: ' + (err.response?.data?.detail || err.message))
                    } finally {
                      setSteamSearching(false)
                    }
                  }}
                  className="flex gap-2 mb-4"
                >
                  <SearchInput
                    value={steamSearch}
                    onChange={(e) => setSteamSearch(e.target.value)}
                    placeholder="Search your Steam library…"
                  />
                  <button
                    type="submit"
                    disabled={steamSearching}
                    className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-50 flex-shrink-0"
                    style={{ background: '#4a90d9', color: '#fff' }}
                  >
                    {steamSearching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    Search
                  </button>
                </form>

                {steamResults.length > 0 && (
                  <div className="max-h-72 overflow-y-auto">
                    {steamResults.map((game) => (
                      <SearchResult
                        key={game.app_id}
                        coverUrl={game.cover_url}
                        title={game.title}
                        sub={`${game.playtime_hours}h played`}
                        onClick={() => setSelectedSteamGame(game)}
                      />
                    ))}
                  </div>
                )}
                {steamResults.length === 0 && steamSearch && !steamSearching && (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                    No games found matching "{steamSearch}"
                  </p>
                )}
              </div>
            ) : (
              <div>
                <SelectedGameBar
                  coverUrl={selectedSteamGame.cover_url}
                  title={selectedSteamGame.title}
                  sub={`App ID: ${selectedSteamGame.app_id}`}
                  onClear={() => setSelectedSteamGame(null)}
                />

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormInput
                      label="Genre" sub="(optional)"
                      type="text"
                      value={steamImportForm.genre}
                      onChange={(e) => setSteamImportForm({ ...steamImportForm, genre: e.target.value })}
                      placeholder="e.g. Action RPG"
                    />
                    <FormInput
                      label="Achievement set name"
                      type="text"
                      value={steamImportForm.trophy_set_name}
                      onChange={(e) => setSteamImportForm({ ...steamImportForm, trophy_set_name: e.target.value })}
                    />
                  </div>
                  <FormSelect
                    label="Attach to existing game" sub="(for DLC or platform sync)"
                    value={steamImportForm.existing_game_id}
                    onChange={(e) => setSteamImportForm({ ...steamImportForm, existing_game_id: e.target.value })}
                  >
                    <option value="">Create new game entry</option>
                    {gamesData?.map((g) => (
                      <option key={g.id} value={g.id}>{g.title}{g.platform ? ` (${g.platform})` : ' (manual)'}</option>
                    ))}
                  </FormSelect>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setSelectedSteamGame(null)}
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
                    disabled={steamImporting}
                    onClick={async () => {
                      setSteamImportError(null)
                      setSteamImportResult(null)
                      setSteamImporting(true)
                      try {
                        const payload = {
                          app_id: selectedSteamGame.app_id,
                          game_title: selectedSteamGame.title,
                          trophy_set_name: steamImportForm.trophy_set_name,
                        }
                        if (steamImportForm.genre) payload.genre = steamImportForm.genre
                        if (steamImportForm.existing_game_id) payload.existing_game_id = steamImportForm.existing_game_id
                        const res = await importSteamGame(payload)
                        setSteamImportResult(res.data)
                        setSelectedSteamGame(null)
                        setSteamSearch('')
                        setSteamResults([])
                        queryClient.invalidateQueries({ queryKey: ['all-games'] })
                        queryClient.invalidateQueries({ queryKey: ['games'] })
                      } catch (err) {
                        setSteamImportError('Import failed: ' + (err.response?.data?.detail || err.message))
                      } finally {
                        setSteamImporting(false)
                      }
                    }}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: '#4a90d9', color: '#fff' }}
                  >
                    {steamImporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    {steamImporting ? 'Importing…' : 'Import'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Seed Catalogue ── */}
      <SeedSection queryClient={queryClient} />

      {/* ── Catalogue ── */}
      <CatalogueSection gamesData={gamesData} queryClient={queryClient} navigate={navigate} />
    </div>
  )
}
