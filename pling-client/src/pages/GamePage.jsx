import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getLibrary, updateLibraryEntry, removeFromLibrary } from '../api/games'
import { listAchievements } from '../api/achievements'
import { Trophy, Plus, ChevronRight, ChevronLeft, CheckCircle2, Circle, Loader2, Trash2 } from 'lucide-react'
import AddAchievementModal from '../components/achievements/AddAchievementModal'

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
  const [filter, setFilter] = useState('all') // all | incomplete | complete

  const { data: library = [] } = useQuery({
    queryKey: ['library'],
    queryFn: () => getLibrary().then((r) => r.data),
  })

  const userGame = library.find((ug) => ug.game.id === gameId)
  const game = userGame?.game

  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ['achievements', gameId],
    queryFn: () => listAchievements(gameId).then((r) => r.data),
    enabled: !!gameId,
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

  const filtered = achievements.filter((a) => {
    if (filter === 'complete') return a.is_completed
    if (filter === 'incomplete') return !a.is_completed
    return true
  })

  const groupedAchievements = filtered.reduce((groups, a) => {
    const key = a.trophy_set_name || 'Base Game'
    if (!groups[key]) groups[key] = []
    groups[key].push(a)
    return groups
  }, {})

  const completed = achievements.filter((a) => a.is_completed).length
  const total = achievements.length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const hasMultipleSets = Object.keys(groupedAchievements).length > 1

  if (!game && !isLoading) {
    return (
      <div className="text-center py-24 text-gray-500">
        Game not found in your library.
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
                  <p className="text-gray-500 text-sm mt-0.5">{game.genre || 'No genre set'}</p>
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

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500">{completed} / {total} trophies</span>
                  <span className="text-xs font-medium text-white">{percent}%</span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full">
                  <div
                    className="h-2 bg-violet-500 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Xbox gamerscore */}
              {game.platform === 'xbox' && userGame?.gamerscore_total > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {userGame.gamerscore_earned ?? 0}G / {userGame.gamerscore_total}G
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Achievements header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">Trophies</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            {total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-0.5 text-xs">
            {['all', 'incomplete', 'complete'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md transition capitalize ${
                  filter === f
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAddAchievement(true)}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
          >
            <Plus size={15} />
            Add
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-16 text-gray-500 text-sm">
          Loading trophies...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && achievements.length === 0 && (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <Trophy size={40} className="text-gray-700 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-1">No trophies yet</h3>
          <p className="text-gray-500 text-sm mb-6">
            Add the trophies you want to track for this game
          </p>
          <button
            onClick={() => setShowAddAchievement(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition mx-auto"
          >
            <Plus size={16} />
            Add trophy
          </button>
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
                  <button
                    key={a.id}
                    onClick={() => navigate(`/achievements/${a.id}`)}
                    className="w-full border rounded-xl p-4 flex items-center gap-4 transition text-left"
                    style={{
                      background: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                  >
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
                    <ChevronRight size={16} className="flex-shrink-0" style={{color:'var(--text-muted)'}} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results from filter */}
      {!isLoading && achievements.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500 text-sm">
          No {filter} trophies
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
      {/* Status + remove */}
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
            if (confirm(`Remove ${game?.title} from your library? Your progress will be lost.`)) {
                removeMutation.mutate()
            }
            }}
            disabled={removeMutation.isPending}
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
            title="Remove from library"
        >
            <Trash2 size={16} />
        </button>
        </div>
    </div>
  )
}