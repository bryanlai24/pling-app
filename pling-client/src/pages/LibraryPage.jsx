import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getLibrary, createGame, addToLibrary } from '../api/games'
import { Plus, Gamepad2, Trophy, ChevronRight, Search } from 'lucide-react'
import AddGameModal from '../components/games/AddGameModal.jsx'

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

  const { data: library = [], isLoading } = useQuery({
    queryKey: ['library'],
    queryFn: () => getLibrary().then((r) => r.data),
  })

  const filtered = library.filter((ug) => {
    const matchesSearch = ug.game.title.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || ug.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-sm">Loading library...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">My Library</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {library.length} {library.length === 1 ? 'game' : 'games'} tracked
          </p>
        </div>
        <button
          onClick={() => setShowAddGame(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <Plus size={16} />
          Add game
        </button>
      </div>

      {/* Filters */}
      {library.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search games..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-violet-500 transition"
          >
            <option value="all">All statuses</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="platinum">Platinum</option>
            <option value="full_completion">100%</option>
          </select>
        </div>
      )}

      {/* Empty state */}
      {library.length === 0 && (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <Gamepad2 size={40} className="text-gray-700 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-1">No games yet</h3>
          <p className="text-gray-500 text-sm mb-6">Add your first game to start tracking achievements</p>
          <button
            onClick={() => setShowAddGame(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition mx-auto"
          >
            <Plus size={16} />
            Add game
          </button>
        </div>
      )}

      {/* Game list */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((ug) => {
            const platform = PLATFORM_BADGES[ug.game.platform]
            return (
              <button
                key={ug.id}
                onClick={() => navigate(`/games/${ug.game.id}`)}
                className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl p-4 flex items-center gap-4 transition text-left"
              >
                {/* Cover placeholder */}
                <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {ug.game.cover_image_url ? (
                    <img
                      src={ug.game.cover_image_url}
                      alt={ug.game.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Trophy size={20} className="text-gray-600" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white truncate">{ug.game.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${platform.color} flex-shrink-0`}>
                      {platform.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${STATUS_COLORS[ug.status]}`}>
                      {STATUS_LABELS[ug.status]}
                    </span>
                    {ug.game.platform === 'xbox' && ug.gamerscore_total > 0 && (
                      <span className="text-xs text-gray-500">
                        {ug.gamerscore_earned ?? 0}G / {ug.gamerscore_total}G
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-medium text-white">{ug.completion_percent}%</div>
                    <div className="w-24 h-1.5 bg-gray-800 rounded-full mt-1">
                      <div
                        className="h-1.5 bg-violet-500 rounded-full transition-all"
                        style={{ width: `${ug.completion_percent}%` }}
                      />
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-600" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* No results */}
      {library.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500 text-sm">
          No games match your search
        </div>
      )}

      {/* Add game modal */}
      {showAddGame && (
        <AddGameModal
          onClose={() => setShowAddGame(false)}
          onSuccess={() => {
            setShowAddGame(false)
            queryClient.invalidateQueries({ queryKey: ['library'] })
          }}
        />
      )}
    </div>
  )
}