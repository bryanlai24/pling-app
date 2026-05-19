import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getLibrary, listGames } from '../api/games'
import { Plus, Gamepad2, Trophy, ChevronRight, Search, MessageSquarePlus } from 'lucide-react'
import AddGameModal from '../components/games/AddGameModal.jsx'
import GuestTrackingPrompt from '../components/ui/GuestTrackingPrompt'
import RequestGameModal from '../components/requests/RequestGameModal.jsx'
import { useAuthStore } from '../store/authStore'

const STATUS_COLORS = {
  not_started: 'var(--text-muted)',
  in_progress: '#60a5fa',
  completed: '#34d399',
  platinum: '#a78bfa',
  full_completion: '#fbbf24',
}

const STATUS_LABELS = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  platinum: 'Platinum',
  full_completion: '100%',
}

const PLATFORM_BADGES = {
  psn:    { label: 'PSN',    style: { background: 'rgba(96,165,250,0.08)',  color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)'  } },
  xbox:   { label: 'Xbox',   style: { background: 'rgba(52,211,153,0.08)',  color: '#34d399', border: '1px solid rgba(52,211,153,0.2)'  } },
  steam:  { label: 'Steam',  style: { background: 'rgba(156,163,175,0.08)', color: '#9ca3af', border: '1px solid rgba(156,163,175,0.2)' } },
  manual: { label: 'Manual', style: { background: 'rgba(167,139,250,0.08)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' } },
}

export default function LibraryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAddGame, setShowAddGame] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
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
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-bold" style={{ fontSize: '1.2rem', color:'var(--text-primary)'}}>
            {isGuest ? 'Game Catalogue' : 'My Library'}
          </h1>
          <p className="mt-0.5" style={{ fontSize: '0.75rem', color:'var(--text-muted)'}}>
            {isGuest
              ? `${catalogue.length} games available`
              : `${library.length} ${library.length === 1 ? 'game' : 'games'} tracked`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isGuest && (
            <button
              onClick={() => setShowRequestModal(true)}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition"
              style={{
                background: 'var(--bg-elevated)',
                border: '0.5px solid var(--border-default)',
                color: 'var(--text-secondary)',
              }}
            >
              <MessageSquarePlus size={15} />
              Request
            </button>
          )}
          <button
            onClick={() => isGuest ? setShowGuestPrompt(true) : setShowAddGame(true)}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={16} />
            {isGuest ? 'Sign up to add games' : 'Add game'}
          </button>
        </div>
      </div>

      {/* Filters */}
      {displayGames.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search games..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none transition"
              style={{
                background:'var(--bg-surface)',
                border:'0.5px solid var(--border-subtle)',
                color:'var(--text-primary)'
              }}
            />
          </div>
          {!isGuest && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm focus:outline-none transition"
              style={{
                background:'var(--bg-surface)',
                border:'0.5px solid var(--border-subtle)',
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
        <div className="text-center py-24 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border-default)' }}>
          <Gamepad2 size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h3 className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            {isGuest ? 'No games in catalogue yet' : 'No games yet'}
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {isGuest
              ? 'Check back soon as the catalogue grows'
              : 'Add your first game to start tracking achievements'}
          </p>
          {!isGuest && (
            <div className="flex items-center gap-2 justify-center">
              <button
                onClick={() => setShowAddGame(true)}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <Plus size={16} />
                Add game
              </button>
              <button
                onClick={() => setShowRequestModal(true)}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '0.5px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                }}
              >
                <MessageSquarePlus size={15} />
                Request a game
              </button>
            </div>
          )}
        </div>
      )}

      {/* Game list */}
      {filtered.length > 0 && (
        <div>
          {filtered.map((item) => {
            const game = isGuest ? item : item.game
            const completion = isGuest ? null : item.completion_percent
            const status = isGuest ? null : item.status
            const platform = PLATFORM_BADGES[game.platform]

            return (
              <button
                key={game.id}
                onClick={() => navigate(`/games/${game.id}`)}
                className="w-full flex items-center gap-4 transition text-left"
                style={{ padding: '12px 0', borderBottom: '0.5px solid var(--border-deep)' }}
              >
                {/* Cover — compact square */}
                <div
                  className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ background: 'var(--bg-card-purple)', border: '0.5px solid var(--accent-border)' }}
                >
                  {game.cover_image_url ? (
                    <img src={game.cover_image_url} alt={game.title} className="w-full h-full object-cover" />
                  ) : (
                    <Trophy size={16} style={{ color: 'var(--accent)' }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span style={{ fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {game.title}
                    </span>
                    {platform && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded" style={{ ...platform.style, fontSize: '0.65rem' }}>
                        {platform.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {status && (
                      <span style={{ fontSize: '0.75rem', color: STATUS_COLORS[status] }}>
                        {STATUS_LABELS[status]}
                      </span>
                    )}
                    {(game.genres || []).slice(0, 3).map((g) => (
                      <span
                        key={g.id}
                        className="capitalize"
                        style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                      >
                        {g.genre}
                      </span>
                    ))}
                    {!isGuest && item.game?.platform === 'xbox' && item.gamerscore_total > 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.gamerscore_earned ?? 0}G / {item.gamerscore_total}G
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress */}
                {!isGuest && completion !== null && (
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <div style={{ fontSize: '0.75rem', color: completion === 100 ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 500 }}>
                      {completion}%
                    </div>
                    <div className="w-20 rounded-full mt-1" style={{ height: 2, background: 'var(--border-subtle)' }}>
                      <div
                        className="rounded-full transition-all"
                        style={{ width: `${completion}%`, height: 2, background: 'var(--accent)' }}
                      />
                    </div>
                  </div>
                )}

                <ChevronRight size={15} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
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

      {showRequestModal && (
        <RequestGameModal onClose={() => setShowRequestModal(false)} />
      )}
    </div>
  )
}