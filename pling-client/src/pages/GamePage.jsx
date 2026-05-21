import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getLibrary, updateLibraryEntry, removeFromLibrary, syncPsnGame, syncSteamGame, syncXboxGame } from '../api/games'
import { listAchievements, updateAchievementProgress } from '../api/achievements'
import { listGenres, updateGameGenres } from '../api/genres'
import { Trophy, Plus, ChevronRight, ChevronLeft, CheckCircle2, Circle, Loader2, Trash2, Pencil, X, Check, RefreshCw, Pin, PinOff } from 'lucide-react'
import AddAchievementModal from '../components/achievements/AddAchievementModal'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { usePageTitle } from '../hooks/usePageTitle'
import GuestTrackingPrompt from '../components/ui/GuestTrackingPrompt'
import client from '../api/client'

const TROPHY_COLORS = {
  bronze: '#d97706',
  silver: '#9ca3af',
  gold: '#facc15',
  platinum: '#a78bfa',
}

const TROPHY_LABELS = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
}

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'full_completion', label: '100%' },
]

function AchievementRow({ a, matchesFilter, onNavigate, onTick, onPin, tickPending, isPinned }) {
  return (
    <div
      onClick={onNavigate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate()}
      className="flex items-center gap-3 cursor-pointer transition"
      style={{
        padding: '12px 0',
        borderBottom: '0.5px solid var(--border-deep)',
        opacity: matchesFilter ? 1 : 0.35,
      }}
    >
      {/* Tick */}
      <button
        onClick={onTick}
        disabled={tickPending}
        className="flex-shrink-0 transition hover:scale-110"
        style={{ color: a.is_completed ? 'var(--accent)' : '#333' }}
      >
        {a.is_completed
          ? <CheckCircle2 size={20} style={{ color: 'var(--accent)' }} />
          : <Circle size={20} style={{ color: '#333' }} />
        }
      </button>

      {/* Icon — only shown when there's an actual image */}
      {a.icon_url && (
        <div className="relative flex-shrink-0">
          <img
            src={a.icon_url}
            alt={a.title}
            className="w-9 h-9 rounded-lg object-cover"
            style={{ opacity: a.is_completed ? 1 : 0.4, filter: a.is_completed ? 'none' : 'grayscale(1)' }}
          />
          {a.is_completed && (
            <CheckCircle2 size={13} className="absolute -bottom-1 -right-1 rounded-full"
              style={{ color: 'var(--accent)', background: 'var(--bg-base)' }} />
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            style={{
              fontSize: '1rem',
              color: a.is_completed ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: a.is_completed ? 'line-through' : 'none',
              lineHeight: 1.3,
            }}
          >
            {a.title}
          </span>
          {a.trophy_type && (
            <span className="flex-shrink-0" style={{ fontSize: '0.65rem', color: TROPHY_COLORS[a.trophy_type] }}>
              {TROPHY_LABELS[a.trophy_type]}
            </span>
          )}
          {a.gamerscore && (
            <span className="flex-shrink-0" style={{ fontSize: '0.65rem', color: '#34d399' }}>{a.gamerscore}G</span>
          )}
        </div>
        {a.description && (
          <p className="truncate mt-0.5" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {a.description}
          </p>
        )}
      </div>

      {/* Right side */}
      {a.rarity && (
        <span className="flex-shrink-0" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{a.rarity}</span>
      )}
      <button
        onClick={onPin}
        className="flex-shrink-0 p-1 rounded transition"
        title={isPinned ? 'Unpin' : 'Pin to top'}
        style={{ color: isPinned ? 'var(--accent)' : 'var(--text-muted)' }}
        onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = isPinned ? 'var(--text-muted)' : 'var(--accent)' }}
        onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.color = isPinned ? 'var(--accent)' : 'var(--text-muted)' }}
      >
        {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
      </button>
      <ChevronRight size={15} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
    </div>
  )
}

export default function GamePage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAddAchievement, setShowAddAchievement] = useState(false)
  const { achievementFilter: filter, setAchievementFilter: setFilter } = useUIStore()
  const { isGuest, token } = useAuthStore()
  const isPublicView = isGuest || !token  // guests AND unauthenticated visitors
  const [showGuestPrompt, setShowGuestPrompt] = useState(false)
  const [toast, setToast] = useState(null) // { message, type: 'earned' | 'unearned' }
  const toastTimer = useRef(null)


  const showToast = (message, type = 'earned') => {
    clearTimeout(toastTimer.current)
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }
  const [editingGenres, setEditingGenres] = useState(false)
  const [pendingGenreIds, setPendingGenreIds] = useState([])
  const { user } = useAuthStore()
  const isContributor = user?.role === 'contributor' || user?.role === 'admin'

  const { data: library = [] } = useQuery({
    queryKey: ['library'],
    queryFn: () => getLibrary().then((r) => r.data),
    enabled: !isPublicView,
  })

  const { data: catalogueGame } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => client.get(`/games/${gameId}`).then((r) => r.data),
    enabled: isPublicView && !!gameId,
  })

  const userGame = isPublicView ? null : library.find((ug) => ug.game.id === gameId)
  const game = isPublicView ? catalogueGame : userGame?.game
  usePageTitle(game?.title || null)

  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ['achievements', gameId],
    queryFn: () => listAchievements(gameId).then((r) => r.data),
    enabled: !!gameId,
  })

  const { data: allGenres = [] } = useQuery({
    queryKey: ['genres'],
    queryFn: () => listGenres().then((r) => r.data),
    enabled: isContributor,
  })

  const genresMutation = useMutation({
    mutationFn: (genreIds) => updateGameGenres(gameId, genreIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] })
      queryClient.invalidateQueries({ queryKey: ['library'] })
      setEditingGenres(false)
    },
  })

  const startEditingGenres = () => {
    setPendingGenreIds((game?.genres || []).map((g) => g.id))
    setEditingGenres(true)
  }

  const toggleGenre = (id) => {
    setPendingGenreIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const [syncResult, setSyncResult] = useState(null)

  const syncMutation = useMutation({
    mutationFn: () => syncPsnGame(gameId),
    onSuccess: (res) => {
      setSyncResult({ ...res.data, platform: 'psn' })
      queryClient.invalidateQueries({ queryKey: ['library'] })
      queryClient.invalidateQueries({ queryKey: ['achievements', gameId] })
    },
  })

  const steamSyncMutation = useMutation({
    mutationFn: () => syncSteamGame(gameId),
    onSuccess: (res) => {
      setSyncResult({ ...res.data, platform: 'steam' })
      queryClient.invalidateQueries({ queryKey: ['library'] })
      queryClient.invalidateQueries({ queryKey: ['achievements', gameId] })
    },
  })

  const xboxSyncMutation = useMutation({
    mutationFn: () => syncXboxGame(gameId),
    onSuccess: (res) => {
      setSyncResult({ ...res.data, platform: 'xbox' })
      queryClient.invalidateQueries({ queryKey: ['library'] })
      queryClient.invalidateQueries({ queryKey: ['achievements', gameId] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status) => updateLibraryEntry(gameId, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library'] }),
  })

  const removeMutation = useMutation({
    mutationFn: () => removeFromLibrary(gameId),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['library'] })
        navigate('/library')
    },
  })

  const tickMutation = useMutation({
    mutationFn: ({ achievementId, is_completed }) =>
      updateAchievementProgress(achievementId, { is_completed }),
    onSuccess: (_, { title, is_completed }) => {
      queryClient.invalidateQueries({ queryKey: ['achievements', gameId] })
      queryClient.invalidateQueries({ queryKey: ['library'] })
      showToast(
        is_completed ? `Earned: ${title}` : `Unearned: ${title}`,
        is_completed ? 'earned' : 'unearned'
      )
    },
  })

  const handleTick = (e, a) => {
    e.stopPropagation()
    if (isPublicView) { setShowGuestPrompt(true); return }
    tickMutation.mutate({ achievementId: a.id, is_completed: !a.is_completed, title: a.title })
  }

  const pinMutation = useMutation({
    mutationFn: ({ achievementId, is_pinned }) =>
      client.patch(`/achievements/${achievementId}/progress`, { is_pinned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['achievements', gameId] }),
  })

  const handlePin = (e, achievementId, currentlyPinned) => {
    e.stopPropagation()
    if (isPublicView) { setShowGuestPrompt(true); return }
    pinMutation.mutate({ achievementId, is_pinned: !currentlyPinned })
  }

  const pinned = achievements.filter((a) => a.is_pinned)

  const matchesFilter = (a) => {
    if (filter === 'complete') return a.is_completed
    if (filter === 'incomplete') return !a.is_completed
    return true
  }

  // Sort: matching achievements first, non-matching pushed to bottom
  const sorted = [...achievements]
    .filter((a) => !a.is_pinned)
    .sort((a, b) => {
      const aMatch = matchesFilter(a)
      const bMatch = matchesFilter(b)
      if (aMatch === bMatch) return 0
      return aMatch ? -1 : 1
    })

  const groupedAchievements = sorted.reduce((groups, a) => {
    const key = a.trophy_set_name || 'Base Game'
    if (!groups[key]) groups[key] = []
    groups[key].push(a)
    return groups
  }, {})

  const filtered = sorted // keep alias for length checks below

  const completed = achievements.filter((a) => a.is_completed).length
  const total = achievements.length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const hasMultipleSets = Object.keys(groupedAchievements).length > 1

  const trophyLabel = game?.platform === 'steam' 
  ? 'Achievements' 
  : game?.platform === 'xbox' 
  ? 'Achievements' 
  : 'Trophies'

  if (!game && !isLoading) {
    return (
      <div className="text-center py-24 text-gray-500">
        {isPublicView ? 'Game not found.' : 'Game not found in your library.'}
      </div>
    )
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/library')}
        className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition mb-6"
      >
        <ChevronLeft size={16} />
        Back to library
      </button>

      {/* Game header */}
      {game && (
        <div className="rounded-2xl p-4 sm:p-6 mb-6" style={{ background: 'var(--bg-hero)', border: '0.5px solid var(--border-default)' }}>
          <div className="flex items-start gap-4">
            {/* Cover */}
            <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: 'var(--bg-card-purple)', border: '0.5px solid var(--accent-border)' }}>
              {game.cover_image_url ? (
                <img
                  src={game.cover_image_url}
                  alt={game.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Trophy size={24} style={{ color: 'var(--text-muted)' }} />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-semibold" style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{game.title}</h1>

                  {/* Genre chips */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {!editingGenres && (game?.genres || []).map((g) => (
                      <span
                        key={g.id}
                        className="text-xs px-2 py-0.5 rounded-full border capitalize"
                        style={{
                          background: 'var(--accent-dim)',
                          borderColor: 'var(--accent-border)',
                          color: 'var(--accent)',
                        }}
                      >
                        {g.genre}
                      </span>
                    ))}
                    {!editingGenres && (game?.genres || []).length === 0 && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No genres set</span>
                    )}
                    {isContributor && !editingGenres && (
                      <button
                        onClick={startEditingGenres}
                        className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-full border transition"
                        style={{
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <Pencil size={10} /> Edit
                      </button>
                    )}

                    {/* Genre editor */}
                    {editingGenres && (
                      <div className="w-full mt-1">
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {allGenres.map((g) => {
                            const selected = pendingGenreIds.includes(g.id)
                            return (
                              <button
                                key={g.id}
                                onClick={() => toggleGenre(g.id)}
                                className="text-xs px-2.5 py-1 rounded-full border capitalize transition"
                                style={{
                                  background: selected ? 'var(--accent-dim)' : 'transparent',
                                  borderColor: selected ? 'var(--accent-border)' : 'var(--border-subtle)',
                                  color: selected ? 'var(--accent)' : 'var(--text-muted)',
                                }}
                              >
                                {g.genre}
                              </button>
                            )
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => genresMutation.mutate(pendingGenreIds)}
                            disabled={genresMutation.isPending}
                            className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg text-white transition"
                            style={{ background: 'var(--accent)' }}
                          >
                            <Check size={12} />
                            {genresMutation.isPending ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingGenres(false)}
                            className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg border transition"
                            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                          >
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status selector + remove */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isPublicView && (
                    <>
                      <select
                        value={userGame?.status || 'not_started'}
                        onChange={(e) => statusMutation.mutate(e.target.value)}
                        className="rounded-lg px-3 py-1.5 text-sm transition focus:outline-none"
                        style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)', color: 'var(--text-secondary)' }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${game?.title} from your library?`)) {
                            removeMutation.mutate()
                          }
                        }}
                        disabled={removeMutation.isPending}
                        className="p-1.5 rounded-lg transition"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                        title="Remove from library"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                  {isPublicView && (
                    <button
                      onClick={() => setShowGuestPrompt(true)}
                      className="text-sm px-4 py-1.5 rounded-lg border transition"
                      style={{ background: 'rgba(167,139,250,0.08)', borderColor: 'rgba(167,139,250,0.25)', color: 'var(--accent)' }}
                    >
                      Track this game →
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar + sync */}
              {(game.platform === 'psn' || game.platform === 'steam' || game.platform === 'xbox') && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{completed} / {total} {trophyLabel}</span>
                    <div className="flex items-center gap-2">
                      {game.platform === 'xbox' && game.gamerscore_total > 0
                        ? <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-primary)' }}>{game.gamerscore_earned ?? 0}G / {game.gamerscore_total}G</span>
                        : <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-primary)' }}>{percent}%</span>
                      }
                      {!isPublicView && game.platform === 'psn' && (
                        <button
                          onClick={() => { setSyncResult(null); syncMutation.mutate() }}
                          disabled={syncMutation.isPending}
                          title="Sync trophies from PSN"
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full border transition"
                          style={{ fontSize: '0.65rem', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                        >
                          <RefreshCw size={10} className={syncMutation.isPending ? 'animate-spin' : ''} />
                          {syncMutation.isPending ? 'Syncing...' : 'Sync PSN'}
                        </button>
                      )}
                      {!isPublicView && game.platform === 'steam' && (
                        <button
                          onClick={() => { setSyncResult(null); steamSyncMutation.mutate() }}
                          disabled={steamSyncMutation.isPending}
                          title="Sync achievements from Steam"
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full border transition"
                          style={{ fontSize: '0.65rem', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                        >
                          <RefreshCw size={10} className={steamSyncMutation.isPending ? 'animate-spin' : ''} />
                          {steamSyncMutation.isPending ? 'Syncing...' : 'Sync Steam'}
                        </button>
                      )}
                      {!isPublicView && game.platform === 'xbox' && (
                        <button
                          onClick={() => { setSyncResult(null); xboxSyncMutation.mutate() }}
                          disabled={xboxSyncMutation.isPending}
                          title="Sync achievements from Xbox"
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full border transition"
                          style={{ fontSize: '0.65rem', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                        >
                          <RefreshCw size={10} className={xboxSyncMutation.isPending ? 'animate-spin' : ''} />
                          {xboxSyncMutation.isPending ? 'Syncing...' : 'Sync Xbox'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="w-full rounded-full" style={{ height: 3, background: 'var(--bg-elevated)' }}>
                    <div
                      className="rounded-full transition-all"
                      style={{ width: `${percent}%`, height: 3, background: 'var(--accent)' }}
                    />
                  </div>
                  {/* Sync result toast */}
                  {syncResult && (
                    <div className="mt-2 text-xs rounded-lg px-3 py-2"
                      style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                      Synced {syncResult.synced} new, {syncResult.created} created, {syncResult.already_completed} already done
                      {' '}— {syncResult.completion_percent}% complete
                    </div>
                  )}
                  {/* Sync errors */}
                  {(syncMutation.isError || steamSyncMutation.isError || xboxSyncMutation.isError) && (
                    <div className="mt-2 text-xs rounded-lg px-3 py-2"
                      style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171' }}>
                      {(syncMutation.error || steamSyncMutation.error || xboxSyncMutation.error)?.response?.data?.detail || 'Sync failed — please try again.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Achievements header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{trophyLabel}</h2>
          <span
            className="px-2 py-0.5 rounded-full"
            style={{ fontSize: '0.65rem', background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            {total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          <div
            className="flex rounded-lg p-0.5"
            style={{ fontSize: '0.65rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            {[
              ['incomplete', 'Todo',  'Incomplete'],
              ['complete',   'Done',  'Complete'],
              ['all',        'All',   'Game Order'],
            ].map(([f, shortLabel, fullLabel]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-md transition"
                style={filter === f
                  ? { background: 'var(--bg-elevated)', color: 'var(--text-primary)' }
                  : { color: 'var(--text-muted)' }
                }
              >
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{fullLabel}</span>
              </button>
            ))}
          </div>
          {!isPublicView && (
            <button
              onClick={() => setShowAddAchievement(true)}
              className="flex items-center gap-1.5 font-medium px-3 py-1.5 rounded-lg transition"
              style={{ fontSize: '0.65rem', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', color: 'var(--accent)' }}
            >
              <Plus size={12} />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading {trophyLabel}...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && achievements.length === 0 && (
        <div className="text-center py-24 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border-default)' }}>
          <Trophy size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h3 className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No {trophyLabel.toLowerCase()} yet</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Add the {trophyLabel.toLowerCase()} you want to track for this game
          </p>
          <button
            onClick={() => setShowAddAchievement(true)}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition mx-auto"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={16} />
            Add {trophyLabel.slice(0, -1)}
          </button>
        </div>
      )}

      {/* Pinned achievements */}
      {pinned.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '0.5px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2">
              <Pin size={11} style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--accent)', letterSpacing: '0.07em' }}>Pinned</span>
            </div>
          </div>
          {pinned.map((a) => (
            <AchievementRow
              key={a.id}
              a={a}
              matchesFilter={true}
              onNavigate={() => navigate(`/achievements/${a.id}`)}
              onTick={(e) => handleTick(e, a)}
              onPin={(e) => handlePin(e, a.id, true)}
              tickPending={tickMutation.isPending}
              isPinned={true}
            />
          ))}
        </div>
      )}

      {/* Achievement list */}
      {filtered.length > 0 && (
        <div>
          {Object.entries(groupedAchievements).map(([setName, setAchievements]) => (
            <div key={setName} className="mb-6">
              {hasMultipleSets && (
                <div className="flex items-center justify-between py-2.5 mt-2" style={{ borderBottom: '0.5px solid var(--border-subtle)' }}>
                  <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                    {setName}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {setAchievements.filter(a => a.is_completed).length}/{setAchievements.length}
                  </span>
                </div>
              )}
              {setAchievements.map((a) => (
                <AchievementRow
                  key={a.id}
                  a={a}
                  matchesFilter={matchesFilter(a)}
                  onNavigate={() => navigate(`/achievements/${a.id}`)}
                  onTick={(e) => handleTick(e, a)}
                  onPin={(e) => handlePin(e, a.id, a.is_pinned)}
                  tickPending={tickMutation.isPending}
                  isPinned={a.is_pinned}
                />
              ))}
            </div>
          ))}
        </div>
      )}


      {/* Add achievement modal */}
      {showAddAchievement && (
        <AddAchievementModal
          gameId={gameId}
          platform={game?.platform}
          onClose={() => setShowAddAchievement(false)}
          onSuccess={() => {
            setShowAddAchievement(false)
            queryClient.invalidateQueries({ queryKey: ['achievements', gameId] })
          }}
        />
      )}

      {showGuestPrompt && (
        <GuestTrackingPrompt onClose={() => setShowGuestPrompt(false)} />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium animate-fade-in z-50 max-w-[calc(100vw-2rem)] text-center"
          style={toast.type === 'earned'
            ? { background: 'var(--accent)', color: '#fff' }
            : { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }
          }
        >
          {toast.type === 'earned'
            ? <CheckCircle2 size={15} />
            : <Circle size={15} />
          }
          {toast.message}
        </div>
      )}
    </div>
  )
}