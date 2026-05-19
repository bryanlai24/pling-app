import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMe, updateMe, getMyStats } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { User, Trophy, Shield, Link, Unlink, Eye, EyeOff, Type } from 'lucide-react'
import axios from 'axios'
import client from '../api/client'
import { useUIStore } from '../store/uiStore'
import XboxConnect from '../components/profile/XboxConnect'

const connectPSN = (data) => client.post('/users/me/psn/connect', data)
const disconnectPSN = () => client.delete('/users/me/psn/disconnect')

const ROLE_BADGES = {
  user: { label: 'User', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  contributor: { label: 'Contributor', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  admin: { label: 'Admin', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
}

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const { user: authUser } = useAuthStore()
  const [npsso, setNpsso] = useState('')
  const [showNpsso, setShowNpsso] = useState(false)
  const [error, setError] = useState(null)
  const { scale, scales, scaleLabels, setScale } = useUIStore()

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then((r) => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['myStats'],
    queryFn: () => getMyStats().then((r) => r.data),
  })

  const connectMutation = useMutation({
    mutationFn: (token) => connectPSN({ npsso_token: token }),
    onSuccess: () => {
      setNpsso('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err) => {
      setError(err.response?.data?.detail || 'Failed to connect PSN account')
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: disconnectPSN,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })

  const updateMeMutation = useMutation({
    mutationFn: (data) => updateMe(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })

  const handleConnect = (e) => {
    e.preventDefault()
    setError(null)
    connectMutation.mutate(npsso)
  }

  const badge = ROLE_BADGES[me?.role || 'user']

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Profile</h1>

      {/* Account info */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center">
            <User size={24} className="text-gray-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{me?.username}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-gray-500 text-sm">{me?.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-800/50 rounded-xl">
          <div className="text-center">
            <p className="text-xl font-bold text-white">{stats?.games_tracked ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Games tracked</p>
          </div>
          <div className="text-center border-x border-gray-700">
            <p className="text-xl font-bold text-white">{stats?.trophies_earned ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Achievements earned</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-white">{stats?.platinums ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Completed games</p>
          </div>
        </div>
      </div>

      {stats && (stats.psn || stats.xbox || stats.steam) && (
        <div className="mt-3 space-y-2 px-1">
          {stats.psn && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">PSN</span>
              <span className="text-gray-300">
                {stats.psn.platinums} platinums · {stats.psn.trophies_earned} trophies
              </span>
            </div>
          )}
          {stats.xbox && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Xbox</span>
              <span className="text-gray-300">
                {stats.xbox.gamerscore_earned.toLocaleString()} / {stats.xbox.gamerscore_total.toLocaleString()} G
              </span>
            </div>
          )}
          {stats.steam && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Steam</span>
              <span className="text-gray-300">
                {stats.steam.games_completed} games 100%
              </span>
            </div>
          )}
        </div>
      )}

      {/* PSN Connection */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <Trophy size={18} className="text-blue-400" />
          <h3 className="text-white font-medium">PlayStation Network</h3>
        </div>

        {me?.psn_id ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <div>
                <p className="text-white text-sm font-medium">{me.psn_id}</p>
                <p className="text-gray-500 text-xs">Connected</p>
              </div>
            </div>
            <button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-400 transition px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              <Unlink size={14} />
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <p className="text-gray-500 text-sm mb-4">
              Connect your PSN account to enable game imports and trophy sync.
            </p>

            {/* How to get NPSSO */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 mb-4">
              <p className="text-xs font-medium text-gray-400 mb-2">How to get your NPSSO token:</p>
              <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
                <li>Log into <span className="text-violet-400">playstation.com</span> in your browser</li>
                <li>Visit <span className="text-violet-400 break-all">ca.account.sony.com/api/v1/ssocookie</span></li>
                <li>Copy the value next to <span className="font-mono bg-gray-800 px-1 rounded">npsso</span></li>
                <li>Paste it below</li>
              </ol>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleConnect} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showNpsso ? 'text' : 'password'}
                  value={npsso}
                  onChange={(e) => setNpsso(e.target.value)}
                  placeholder="Paste your NPSSO token"
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNpsso(!showNpsso)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition"
                >
                  {showNpsso ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={connectMutation.isPending || !npsso}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition flex-shrink-0"
              >
                <Link size={14} />
                {connectMutation.isPending ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Xbox */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mt-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-4 h-4 rounded-sm bg-green-500 flex-shrink-0" />
          <h3 className="text-white font-medium">Xbox</h3>
        </div>

        {me?.role === 'admin' || me?.role === 'contributor' ? (
          <XboxConnect />
        ) : (
          <p className="text-sm" style={{color:'var(--text-secondary)'}}>
            Xbox connection is managed by admins for game imports.
          </p>
        )}
      </div>

      {/* Steam */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mt-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-4 h-4 rounded-sm" style={{background:'#1b2838'}} />
          <h3 className="text-white font-medium">Steam</h3>
        </div>

        {me?.steam_id ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <div>
                <p className="text-white text-sm font-medium">{me.steam_id}</p>
                <p className="text-gray-500 text-xs">Steam ID connected</p>
              </div>
            </div>
            <button
              onClick={async () => {
                await updateMe({ steam_id: null })
                queryClient.invalidateQueries({ queryKey: ['me'] })
              }}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-400 transition px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              <Unlink size={14} />
              Remove
            </button>
          </div>
        ) : (
          <div>
            <p className="text-gray-500 text-sm mb-4">
              Add your Steam ID to enable game imports from your Steam library.
            </p>
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 mb-4">
              <p className="text-xs font-medium text-gray-400 mb-2">How to find your Steam ID:</p>
              <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
                <li>Go to <span className="text-violet-400">steamidfinder.com</span></li>
                <li>Enter your Steam profile URL or username</li>
                <li>Copy the <span className="font-mono bg-gray-800 px-1 rounded">steamID64</span> value</li>
                <li>Paste it below</li>
              </ol>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const steamId = e.target.steam_id.value.trim()
              await updateMe({ steam_id: steamId })
              queryClient.invalidateQueries({ queryKey: ['me'] })
            }} className="flex gap-2">
              <input
                type="text"
                name="steam_id"
                placeholder="76561198084471335"
                className="flex-1 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                }}
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg flex-shrink-0"
                style={{background:'#1b2838', color:'#fff'}}
              >
                <Link size={14} />
                Save
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mt-4">
        <div className="flex items-center gap-3 mb-4">
          <Type size={18} className="text-violet-400" />
          <h3 className="text-white font-medium">Display size</h3>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Adjust the size of text and UI elements across the app. Default is a comfortable reading size.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {scales.map((s) => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className={`py-2.5 rounded-lg border text-sm font-medium transition ${
                scale === s
                  ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
              }`}
            >
              {scaleLabels[s]}
            </button>
          ))}
        </div>
        {/* Preview text */}
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
          <p className="text-white text-sm font-medium mb-0.5">Preview</p>
          <p className="text-gray-500 text-xs">This is how text will appear across the app.</p>
        </div>
      </div>
    </div>
  )
}