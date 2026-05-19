import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getLibrary, updateLibraryEntry, removeFromLibrary, syncPsnGame } from '../api/games'
import { listAchievements, updateAchievementProgress } from '../api/achievements'
import { listGenres, updateGameGenres } from '../api/genres'
import { Trophy, Plus, ChevronRight, ChevronLeft, CheckCircle2, Circle, Loader2, Trash2, Pencil, X, Check, RefreshCw, Pin, PinOff } from 'lucide-react'
import AddAchievementModal from '../components/achievements/AddAchievementModal'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import GuestTrackingPrompt from '../components/ui/GuestTrackingPrompt'
import client from '../api/client'

const TROPHY_COLORS = {
  bronze: 'text-amber-600',
  silver: 'text-gray-400',
  gold: 'text-yellow-400',
  platinum: 'text-violet-400',
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

export default function GamePage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAddAchievement, setShowAddAchievement] = useState(false)
  const { achievementFilter: filter, setAchievementFilter: setFilter } = useUIStore()
  const { isGuest } = useAuthStore()
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
    enabled: !isGuest,
  })

  const { data: catalogueGame } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => client.get(`/games/${gameId}`).then((r) => r.data),
    enabled: isGuest && !!gameId,
  })

  const userGame = isGuest ? null : library.find((ug) => ug.game.id === gameId)
  const game = isGuest ? catalogueGame : userGame?.game

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
      setSyncResult(res.data)
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
    if (isGuest) { setShowGuestPrompt(true); return }
    tickMutation.mutate({ achievementId: a.id, is_completed: !a.is_completed, title: a.title })
  }

  const pinMutation = useMutation({
    mutationFn: ({ achievementId, is_pinned }) =>
      client.patch(`/achievements/${achievementId}/progress`, { is_pinned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['achievements', gameId] }),
  })

  const handlePin = (e, achievementId, currentlyPinned) => {
    e.stopPropagation()
    if (isGuest) { setShowGuestPrompt(true); return }
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
        {isGuest ? 'Game not found.' : 'Game not found in your library.'}
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
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            {/* Cover */}
            <div className="w-16 h-16 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {game.cover_image_url ? (
                <img
                  src={game.cover_image_url}
                  alt={game.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Trophy size={24} className="text-gray-600" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white">{game.title}</h1>

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

                {/* Status selector */}
                <select
                  value={userGame?.status || 'not_started'}
                  onChange={(e) => statusMutation.mutate(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-violet-500 transition flex-shrink-0"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Progress bar + sync */}
              {game.platform === 'psn' && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">{completed} / {total} {trophyLabel}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{percent}%</span>
                      {!isGuest && (
                        <button
                          onClick={() => { setSyncResult(null); syncMutation.mutate() }}
                          disabled={syncMutation.isPending}
                          title="Sync trophies from PSN"
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition"
                          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                        >
                          <RefreshCw size={10} className={syncMutation.isPending ? 'animate-spin' : ''} />
                          {syncMutation.isPending ? 'Syncing...' : 'Sync PSN'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full">
                    <div
                      className="h-2 bg-violet-500 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Achievements header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">{trophyLabel}</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            {total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-0.5 text-xs">
            {[['incomplete', 'Incomplete'], ['complete', 'Complete'], ['all', 'Game Order']].map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md transition ${
                  filter === f
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {!isGuest && (
            <button
              onClick={() => setShowAddAchievement(true)}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
            >
              <Plus size={15} />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-16 text-gray-500 text-sm">
          Loading {trophyLabel}...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && achievements.length === 0 && (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <Trophy size={40} className="text-gray-700 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-1">No {trophyLabel.toLowerCase()} yet</h3>
          <p className="text-gray-500 text-sm mb-6">
            Add the {trophyLabel.toLowerCase()} you want to track for this game
          </p>
          <button
            onClick={() => setShowAddAchievement(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition mx-auto"
          >
            <Plus size={16} />
            Add {trophyLabel.slice(0, -1)}
          </button>
        </div>
      )}

      {/* Pinned achievements */}
      {pinned.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <Pin size={12} style={{color:'var(--accent)'}} />
            <h3 className="text-xs font-medium uppercase tracking-wider" style={{color:'var(--accent)'}}>
              Pinned
            </h3>
            <div className="flex-1 h-px" style={{background:'var(--border-subtle)'}} />
          </div>
          <div className="space-y-2">
            {pinned.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/achievements/${a.id}`)}
                className="w-full border rounded-xl p-4 flex items-center gap-4 transition text-left"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--accent-border)',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
              >
                <div className="flex-shrink-0">
                  {a.icon_url ? (
                    <div className="relative">
                      <img
                        src={a.icon_url}
                        alt={a.title}
                        className={`w-10 h-10 rounded-lg object-cover transition ${a.is_completed ? 'opacity-100' : 'opacity-40 grayscale'}`}
                      />
                      {a.is_completed && (
                        <CheckCircle2 size={14} className="absolute -bottom-1 -right-1 bg-black rounded-full" style={{color:'var(--accent)'}} />
                      )}
                    </div>
                  ) : (
                    a.is_completed
                      ? <CheckCircle2 size={20} style={{color:'var(--accent)'}} />
                      : <Circle size={20} style={{color:'var(--text-muted)'}} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`font-medium text-sm ${a.is_completed ? 'line-through' : ''}`}
                      style={{color: a.is_completed ? 'var(--text-muted)' : 'var(--text-primary)'}}>
                      {a.title}
                    </span>
                    {a.trophy_type && <span className={`text-xs ${TROPHY_COLORS[a.trophy_type]}`}>{TROPHY_LABELS[a.trophy_type]}</span>}
                    {a.gamerscore && <span className="text-xs text-green-400">{a.gamerscore}G</span>}
                  </div>
                  {a.description && (
                    <p className="text-xs truncate" style={{color:'var(--text-muted)'}}>{a.description}</p>
                  )}
                </div>
                {a.rarity && <span className="text-xs flex-shrink-0" style={{color:'var(--text-muted)'}}>{a.rarity}</span>}
                <button
                  onClick={(e) => handlePin(e, a.id, true)}
                  className="flex-shrink-0 p-1 rounded transition hover:bg-gray-700/50"
                  title="Unpin"
                >
                  <PinOff size={14} style={{color:'var(--accent)'}} />
                </button>
                <ChevronRight size={16} className="flex-shrink-0" style={{color:'var(--text-muted)'}} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Achievement list */}
      {filtered.length > 0 && (
        <div>
          {Object.entries(groupedAchievements).map(([setName, setAchievements]) => (
            <div key={setName} className="mb-6">
              {/* Trophy set header — only show if multiple sets */}
              {hasMultipleSets && (
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xs font-medium uppercase tracking-wider"
                    style={{color:'var(--text-muted)'}}>
                    {setName}
                  </h3>
                  <div className="flex-1 h-px" style={{background:'var(--border-subtle)'}} />
                  <span className="text-xs" style={{color:'var(--text-muted)'}}>
                    {setAchievements.filter(a => a.is_completed).length}/{setAchievements.length}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {setAchievements.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => navigate(`/achievements/${a.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/achievements/${a.id}`)}
                    className={`w-full border rounded-xl p-4 flex items-center gap-4 transition text-left cursor-pointer ${!matchesFilter(a) ? 'opacity-40' : ''}`}
                    style={{
                      background: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                  >
                    {/* Tick button */}
                    <button
                      onClick={(e) => handleTick(e, a)}
                      disabled={tickMutation.isPending}
                      className="flex-shrink-0 transition hover:scale-110"
                    >
                      {a.is_completed
                        ? <CheckCircle2 size={18} style={{color:'var(--accent)'}} />
                        : <Circle size={18} className="text-gray-600 hover:text-gray-400" />
                      }
                    </button>

                    {/* Trophy icon */}
                    <div className="flex-shrink-0">
                      {a.icon_url ? (
                        <div className="relative">
                          <img
                            src={a.icon_url}
                            alt={a.title}
                            className={`w-10 h-10 rounded-lg object-cover transition ${
                              a.is_completed ? 'opacity-100' : 'opacity-40 grayscale'
                            }`}
                          />
                          {a.is_completed && (
                            <CheckCircle2
                              size={14}
                              className="absolute -bottom-1 -right-1 bg-black rounded-full"
                              style={{color:'var(--accent)'}}
                            />
                          )}
                        </div>
                      ) : (
                        a.is_completed
                          ? <CheckCircle2 size={20} style={{color:'var(--accent)'}} />
                          : <Circle size={20} style={{color:'var(--text-muted)'}} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-medium text-sm ${
                          a.is_completed ? 'line-through' : ''
                        }`} style={{color: a.is_completed ? 'var(--text-muted)' : 'var(--text-primary)'}}>
                          {a.title}
                        </span>
                        {a.trophy_type && (
                          <span className={`text-xs ${TROPHY_COLORS[a.trophy_type]}`}>
                            {TROPHY_LABELS[a.trophy_type]}
                          </span>
                        )}
                        {a.gamerscore && (
                          <span className="text-xs text-green-400">{a.gamerscore}G</span>
                        )}
                      </div>
                      {a.description && (
                        <p className="text-xs truncate" style={{color:'var(--text-muted)'}}>
                          {a.description}
                        </p>
                      )}
                    </div>

                    {a.rarity && (
                      <span className="text-xs flex-shrink-0" style={{color:'var(--text-muted)'}}>
                        {a.rarity}
                      </span>
                    )}
                    <button
                      onClick={(e) => handlePin(e, a.id, a.is_pinned)}
                      className="flex-shrink-0 p-1 rounded transition hover:bg-gray-700/50"
                      title={a.is_pinned ? 'Unpin' : 'Pin to top'}
                    >
                      {a.is_pinned
                        ? <PinOff size={14} style={{color:'var(--accent)'}} />
                        : <Pin size={14} style={{color:'var(--text-muted)'}} />
                      }
                    </button>
                    <ChevronRight size={16} className="flex-shrink-0" style={{color:'var(--text-muted)'}} />
                  </div>
                ))}
              </div>
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

      {/* Status + remove — logged in only */}
      {!isGuest && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={userGame?.status || 'not_started'}
            onChange={(e) => statusMutation.mutate(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-violet-500 transition"
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
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {/* Guest CTA */}
      {isGuest && (
        <button
          onClick={() => setShowGuestPrompt(true)}
          className="text-sm px-4 py-2 rounded-lg border transition flex-shrink-0"
          style={{
            background:'var(--accent-dim)',
            borderColor:'var(--accent-border)',
            color:'var(--accent)'
          }}
        >
          Track this game →
        </button>
      )}

      {showGuestPrompt && (
        <GuestTrackingPrompt onClose={() => setShowGuestPrompt(false)} />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg transition-all animate-fade-in z-50 ${
            toast.type === 'earned'
              ? 'bg-violet-600 text-white'
              : 'bg-gray-700 text-gray-300'
          }`}
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