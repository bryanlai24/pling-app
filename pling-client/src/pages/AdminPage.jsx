import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMe } from '../api/auth'
import { useNavigate } from 'react-router-dom'
import { Shield, Download, Loader2, CheckCircle2, AlertCircle, Search, Trophy } from 'lucide-react'
import client from '../api/client'

const searchPSN = (query) => client.get(`/admin/psn/search?query=${encodeURIComponent(query)}`)
const importGame = (data) => client.post('/admin/import/psn', data)
const listAllGames = () => client.get('/games')

export default function AdminPage() {
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

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedGame, setSelectedGame] = useState(null)
  const [importForm, setImportForm] = useState({
    genre: '',
    trophy_set_name: 'Base Game',
    existing_game_id: '',
  })
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!search.trim()) return
    setSearching(true)
    setSearchResults([])
    setSelectedGame(null)
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

  if (!meLoading && me?.role !== 'admin') {
    return (
      <div className="text-center py-24">
        <Shield size={40} className="text-gray-700 mx-auto mb-4" />
        <h2 className="text-white font-medium mb-1">Access denied</h2>
        <p className="text-gray-500 text-sm">You need admin access to view this page.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={20} className="text-violet-400" />
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{gamesData?.length ?? '—'}</p>
          <p className="text-gray-500 text-sm mt-0.5">Games in catalogue</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          {me?.psn_id ? (
            <>
              <p className="text-green-400 text-base font-medium">{me.psn_id}</p>
              <p className="text-gray-500 text-sm mt-0.5">PSN connected</p>
            </>
          ) : (
            <>
              <p className="text-red-400 text-sm font-medium">Not connected</p>
              <p className="text-gray-500 text-sm mt-0.5">PSN account</p>
            </>
          )}
        </div>
      </div>

      {/* Import section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Download size={18} className="text-violet-400" />
          <h2 className="text-white font-semibold">Import from PSN</h2>
        </div>

        {!me?.psn_id && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm rounded-lg px-4 py-3 mb-4">
            Connect your PSN account in your{' '}
            <button onClick={() => navigate('/profile')} className="underline hover:text-amber-300">
              profile
            </button>{' '}
            before importing games.
          </div>
        )}

        {importResult && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-lg px-4 py-3 mb-4 flex items-start gap-2">
            <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{importResult.message}</p>
              <p className="text-green-500/70 text-xs mt-0.5">
                {importResult.trophies_imported} trophies imported
              </p>
            </div>
          </div>
        )}

        {importError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4 flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p>{importError}</p>
          </div>
        )}

        {/* Step 1 — Search */}
        {!selectedGame && (
          <div>
            <p className="text-sm text-gray-400 mb-3">
              Search your PSN library to find a game to import:
            </p>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your PSN library..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
                />
              </div>
              <button
                type="submit"
                disabled={searching || !me?.psn_id}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition flex-shrink-0"
              >
                {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Search
              </button>
            </form>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {searchResults.map((game) => (
                  <button
                    key={game.np_communication_id}
                    onClick={() => setSelectedGame(game)}
                    className="w-full flex items-center gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-violet-500/50 rounded-xl px-4 py-3 transition text-left"
                  >
                    {game.cover_image_url ? (
                      <img
                        src={game.cover_image_url}
                        alt={game.title}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <Trophy size={20} className="text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{game.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {game.platform.join(', ')} · {game.total_trophies} trophies
                        {game.defined_trophies.platinum > 0 && (
                          <span className="text-violet-400 ml-1">· Platinum</span>
                        )}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchResults.length === 0 && search && !searching && (
              <p className="text-gray-500 text-sm text-center py-4">
                No games found matching "{search}" in your PSN library
              </p>
            )}
          </div>
        )}

        {/* Step 2 — Configure and import */}
        {selectedGame && (
          <div>
            {/* Selected game preview */}
            <div className="flex items-center gap-3 bg-gray-800/50 border border-violet-500/30 rounded-xl p-4 mb-4">
              {selectedGame.cover_image_url ? (
                <img
                  src={selectedGame.cover_image_url}
                  alt={selectedGame.title}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-700 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-white font-medium">{selectedGame.title}</p>
                <p className="text-gray-500 text-xs">
                  {selectedGame.platform.join(', ')} · {selectedGame.total_trophies} trophies
                </p>
              </div>
              <button
                onClick={() => setSelectedGame(null)}
                className="text-gray-500 hover:text-white text-xs transition"
              >
                Change
              </button>
            </div>

            <form onSubmit={handleImport} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Genre <span className="text-gray-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={importForm.genre}
                    onChange={(e) => setImportForm({ ...importForm, genre: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
                    placeholder="e.g. Action RPG"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Trophy set name</label>
                  <input
                    type="text"
                    required
                    value={importForm.trophy_set_name}
                    onChange={(e) => setImportForm({ ...importForm, trophy_set_name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
                    placeholder="Base Game"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Add to existing game <span className="text-gray-600">(for DLC)</span>
                </label>
                <select
                  value={importForm.existing_game_id}
                  onChange={(e) => setImportForm({ ...importForm, existing_game_id: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition"
                >
                  <option value="">Create new game entry</option>
                  {gamesData?.map((g) => (
                    <option key={g.id} value={g.id}>{g.title} ({g.platform})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedGame(null)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg py-2.5 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={importMutation.isPending}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition flex items-center justify-center gap-2"
                >
                  {importMutation.isPending ? (
                    <><Loader2 size={16} className="animate-spin" /> Importing...</>
                  ) : (
                    <><Download size={16} /> Import</>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Catalogue */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4">
          Catalogue
          <span className="text-gray-500 text-sm font-normal ml-2">
            {gamesData?.length ?? 0} games
          </span>
        </h2>
        <div className="space-y-2">
          {gamesData?.map((g) => (
            <div key={g.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl">
              {g.cover_image_url ? (
                <img
                  src={g.cover_image_url}
                  alt={g.title}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{g.title}</p>
                <p className="text-gray-500 text-xs">{g.platform} · {g.genre || 'No genre'}</p>
              </div>
              <button
                onClick={() => navigate(`/games/${g.id}`)}
                className="text-xs text-gray-500 hover:text-violet-400 transition"
              >
                View →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}