import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getLibrary, listGames } from '../api/games'
import { Plus, Gamepad2, Trophy, ChevronRight, Search } from 'lucide-react'
import AddGameModal from '../components/games/AddGameModal.jsx'
import GuestTrackingPrompt from '../components/ui/GuestTrackingPrompt'
import { useAuthStore } from '../store/authStore'

const STATUS_COLORS = {
  not_started: 'text-gray-500',
  in_progress: 'text-blue-400',
  completed: 'text-green-400',
  platinum: 'text-violet-400',
  full_completion: 'text-amber-400',
}

const STATUS_LABELS = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  platinum: 'Platinum',
  full_completion: '100%',
}

const PLATFORM_BADGES = {
  psn: { label: 'PSN', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  xbox: { label: 'Xbox', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  steam: { label: 'Steam', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  manual: { label: 'Manual', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
}

export default function LibraryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAddGame, setShowAddGame] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const { isGuest } = useAuthStore()
  const [showGuestPrompt, setShowGuestPrompt] = useState(false)

  const { data: library = [], isLoading: libraryLoading } = useQuery({
    queryKey: ['library'],
    queryFn: () => getLibrary().then((r) => r.data),
    enabled: !isGuest,
  })

  const { data: catalogue = [], isLoading: catalogueLoading } = useQuery({
    queryKey: ['games'],
    queryFn: () => listGames().then((r) => r.data),
    enabled: isGuest,
  })

  const isLoading = isGuest ? catalogueLoading : libraryLoading
  const displayGames = isGuest ? catalogue : library

  const filtered = isGuest
    ? displayGames.filter((g) =>
        g.title.toLowerCase().includes(search.toLowerCase())
      )
    : displayGames.filter((ug) => {
        const matchesSearch = ug.game.title.toLowerCase().includes(search.toLowerCase())
        const matchesStatus = statusFilter === 'all' || ug.status === statusFilter
        return matchesSearch && matchesStatus
      })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>
            {isGuest ? 'Game Catalogue' : 'My Library'}
          </h1>
          <p className="text-sm mt-0.5" style={{color:'var(--text-muted)'}}>
            {isGuest
              ? `${catalogue.length} games available`
              : `${library.length} ${library.length === 1 ? 'game' : 'games'} tracked`}
          </p>
        </div>
        <button
          onClick={() => isGuest ? setShowGuestPrompt(true) : setShowAddGame(true)}
          className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          style={{background:'var(--accent)'}}
        >
          <Plus size={16} />
          {isGuest ? 'Sign up to add games' : 'Add game'}
        </button>
      </div>

      {/* Filters */}
      {displayGames.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search games..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-violet-500 transition"
              style={{
                background:'var(--bg-surface)',
                border:'1px solid var(--border-subtle)',
                color:'var(--text-primary)'
              }}
            />
          </div>
          {!isGuest && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition"
              style={{
                background:'var(--bg-surface)',
                border:'1px solid var(--border-subtle)',
                color:'var(--text-primary)'
              }}
            >
              <option value="all">All statuses</option>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="platinum">Platinum</option>
              <option value="full_completion">100%</option>
            </select>
          )}
        </div>
      )}

      {/* Empty state */}
      {displayGames.length === 0 && (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <Gamepad2 size={40} className="text-gray-700 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-1">
            {isGuest ? 'No games in catalogue yet' : 'No games yet'}
          </h3>
          <p className="text-gray-500 text-sm mb-6">
            {isGuest
              ? 'Check back soon as the catalogue grows'
              : 'Add your first game to start tracking achievements'}
          </p>
          {!isGuest && (
            <button
              onClick={() => setShowAddGame(true)}
              className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition mx-auto"
              style={{background:'var(--accent)'}}
            >
              <Plus size={16} />
              Add game
            </button>
          )}
        </div>
      )}

      {/* Game list */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((item) => {
            const game = isGuest ? item : item.game
            const completion = isGuest ? null : item.completion_percent
            const status = isGuest ? null : item.status
            const platform = PLATFORM_BADGES[game.platform]

            return (
              <button
                key={game.id}
                onClick={() => navigate(`/games/${game.id}`)}
                className="w-full border rounded-xl p-4 flex items-center gap-4 transition text-left"
                style={{background:'var(--bg-surface)', borderColor:'var(--border-subtle)'}}
              >
                {/* Cover */}
                <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden"
                  style={{background:'var(--bg-elevated)'}}>
                  {game.cover_image_url ? (
                    <img src={game.cover_image_url} alt={game.title}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Trophy size={20} style={{color:'var(--text-muted)'}} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate"
                      style={{color:'var(--text-primary)'}}>
                      {game.title}
                    </span>
                    {platform && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${platform.color}`}>
                        {platform.label}
                      </span>
                    )}
                  </div>
                  {status && (
                    <span className={`text-xs ${STATUS_COLORS[status]}`}>
                      {STATUS_LABELS[status]}
                    </span>
                  )}
                  {/* Genre chips */}
                  {(game.genres || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {game.genres.slice(0, 3).map((g) => (
                        <span
                          key={g.id}
                          className="text-xs px-1.5 py-0.5 rounded-full border capitalize"
                          style={{
                            background: 'var(--accent-dim)',
                            borderColor: 'var(--accent-border)',
                            color: 'var(--accent)',
                          }}
                        >
                          {g.genre}
                        </span>
                      ))}
                      {game.genres.length > 3 && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          +{game.genres.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  {isGuest && (game.genres || []).length === 0 && (
                    <span className="text-xs" style={{color:'var(--text-muted)'}}>
                      Browse achievements →
                    </span>
                  )}
                  {!isGuest && item.game?.platform === 'xbox' && item.gamerscore_total > 0 && (
                    <span className="text-xs text-gray-500 ml-2">
                      {item.gamerscore_earned ?? 0}G / {item.gamerscore_total}G
                    </span>
                  )}
                </div>

                {/* Progress — logged in only */}
                {!isGuest && completion !== null && (
                  <div className="items-center gap-3 flex-shrink-0 hidden sm:flex">
                    <div className="text-right">
                      <div className="text-sm font-medium" style={{color:'var(--text-primary)'}}>
                        {completion}%
                      </div>
                      <div className="w-24 h-1.5 rounded-full mt-1"
                        style={{background:'var(--bg-elevated)'}}>
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{width:`${completion}%`, background:'var(--accent)'}}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <ChevronRight size={16} className="flex-shrink-0"
                  style={{color:'var(--text-muted)'}} />
              </button>
            )
          })}
        </div>
      )}

      {/* No results from filter */}
      {displayGames.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-sm" style={{color:'var(--text-muted)'}}>
          No games match your search
        </div>
      )}

      {/* Modals */}
      {showAddGame && (
        <AddGameModal
          onClose={() => setShowAddGame(false)}
          onSuccess={() => {
            setShowAddGame(false)
            queryClient.invalidateQueries({ queryKey: ['library'] })
          }}
        />
      )}

      {showGuestPrompt && (
        <GuestTrackingPrompt onClose={() => setShowGuestPrompt(false)} />
      )}
    </div>
  )
}