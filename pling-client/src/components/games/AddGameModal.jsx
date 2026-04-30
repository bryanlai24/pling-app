import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createGame, addToLibrary, listGames } from '../../api/games'
import { X, Search, Plus, ChevronRight } from 'lucide-react'

const PLATFORMS = [
  { value: 'psn', label: 'PlayStation (PSN)' },
  { value: 'xbox', label: 'Xbox' },
  { value: 'steam', label: 'Steam' },
  { value: 'manual', label: 'Manual' },
]

const PLATFORM_BADGES = {
  psn: { label: 'PSN', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  xbox: { label: 'Xbox', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  steam: { label: 'Steam', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  manual: { label: 'Manual', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
}

export default function AddGameModal({ onClose, onSuccess }) {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('search') // search | manual
  const [form, setForm] = useState({
    title: '',
    platform: 'psn',
    genre: '',
    cover_image_url: '',
  })
  const [error, setError] = useState(null)

  // Fetch full catalogue
  const { data: catalogue = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => listGames().then((r) => r.data),
  })

  // Filter by search
  const results = search.length > 1
    ? catalogue.filter((g) =>
        g.title.toLowerCase().includes(search.toLowerCase())
      )
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
    if (!payload.genre) delete payload.genre
    if (!payload.cover_image_url) delete payload.cover_image_url
    createMutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold text-white">Add a game</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition p-1 rounded-lg hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex mx-6 mb-4 bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setMode('search')}
            className={`flex-1 text-sm py-1.5 rounded-md transition ${
              mode === 'search' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Search catalogue
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 text-sm py-1.5 rounded-md transition ${
              mode === 'manual' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Add manually
          </button>
        </div>

        {/* Search mode */}
        {mode === 'search' && (
          <div className="px-6 pb-6">
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search for a game..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            {/* Results */}
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {results.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
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
                    className="w-full flex items-center gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-xl px-4 py-3 transition text-left"
                  >
                    {game.cover_image_url ? (
                      <img
                        src={game.cover_image_url}
                        alt={game.title}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-700 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{game.title}</div>
                      {game.genre && (
                        <div className="text-xs text-gray-500 mt-0.5">{game.genre}</div>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${badge.color}`}>
                      {badge.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {results.length > 0 && (
              <p className="text-center text-gray-600 text-xs mt-4">
                Can't find your game?{' '}
                <button
                  onClick={() => setMode('manual')}
                  className="text-violet-400 hover:text-violet-300 transition"
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
              <label className="block text-sm text-gray-400 mb-1.5">Game title</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                placeholder="e.g. Elden Ring"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Genre <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="text"
                value={form.genre}
                onChange={(e) => setForm({ ...form, genre: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
                placeholder="e.g. Action RPG"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Cover image URL <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="url"
                value={form.cover_image_url}
                onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
                placeholder="https://..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMode('search')}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg py-2.5 transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2.5 transition"
              >
                {createMutation.isPending ? 'Adding...' : 'Add game'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}