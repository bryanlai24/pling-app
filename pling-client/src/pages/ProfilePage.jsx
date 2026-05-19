import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMe, updateMe, getMyStats } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { User, Link, Unlink, Eye, EyeOff, Type, ExternalLink } from 'lucide-react'
import client from '../api/client'
import { useUIStore } from '../store/uiStore'

const connectPSN = (data) => client.post('/users/me/psn/connect', data)
const disconnectPSN = () => client.delete('/users/me/psn/disconnect')

const ROLE_BADGES = {
  user:        { label: 'User',        style: { background: 'rgba(107,114,128,0.1)', color: '#9ca3af', border: '0.5px solid rgba(107,114,128,0.25)' } },
  contributor: { label: 'Contributor', style: { background: 'rgba(96,165,250,0.1)',  color: '#60a5fa', border: '0.5px solid rgba(96,165,250,0.25)'  } },
  admin:       { label: 'Admin',       style: { background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '0.5px solid rgba(167,139,250,0.25)' } },
}

const sectionStyle = {
  background: 'var(--bg-surface)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 16,
  padding: 24,
  marginBottom: 12,
}

const inputStyle = {
  width: '100%',
  background: 'var(--bg-elevated)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 8,
  padding: '10px 14px',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
  outline: 'none',
}

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const { user: authUser } = useAuthStore()
  const [npsso, setNpsso] = useState('')
  const [showNpsso, setShowNpsso] = useState(false)
  const [psnError, setPsnError] = useState(null)
  const [steamInput, setSteamInput] = useState('')
  const { scale, scales, scaleLabels, setScale } = useUIStore()

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then((r) => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['myStats'],
    queryFn: () => getMyStats().then((r) => r.data),
  })

  const connectPsnMutation = useMutation({
    mutationFn: (token) => connectPSN({ npsso_token: token }),
    onSuccess: () => {
      setNpsso('')
      setPsnError(null)
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err) => {
      setPsnError(err.response?.data?.detail || 'Failed to connect PSN account')
    },
  })

  const disconnectPsnMutation = useMutation({
    mutationFn: disconnectPSN,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })

  const [steamError, setSteamError] = useState(null)
  const [xboxCode, setXboxCode] = useState('')
  const [xboxError, setXboxError] = useState(null)
  const [xboxAuthUrl, setXboxAuthUrl] = useState(null)

  const connectSteamMutation = useMutation({
    mutationFn: (input) => client.post('/users/me/steam/connect', { steam_input: input }),
    onSuccess: () => {
      setSteamInput('')
      setSteamError(null)
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err) => {
      setSteamError(err.response?.data?.detail || 'Could not resolve Steam ID — please try again.')
    },
  })

  const disconnectSteamMutation = useMutation({
    mutationFn: () => client.delete('/users/me/steam/disconnect'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })

  const connectXboxMutation = useMutation({
    mutationFn: (code) => client.post('/users/me/xbox/connect', { code }),
    onSuccess: () => {
      setXboxCode('')
      setXboxError(null)
      setXboxAuthUrl(null)
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err) => {
      setXboxError(err.response?.data?.detail || 'Failed to connect Xbox account — check the code and try again.')
    },
  })

  const disconnectXboxMutation = useMutation({
    mutationFn: () => client.delete('/users/me/xbox/disconnect'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })

  const fetchXboxAuthUrl = async () => {
    try {
      const res = await client.get('/users/me/xbox/auth-url')
      setXboxAuthUrl(res.data.auth_url)
      window.open(res.data.auth_url, '_blank', 'noopener,noreferrer')
    } catch {
      setXboxError('Could not generate Xbox auth URL.')
    }
  }

  const badge = ROLE_BADGES[me?.role || 'user']

  const sectionHeader = (icon, title) => (
    <div className="flex items-center gap-2.5 mb-5">
      {icon}
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
    </div>
  )

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 className="font-bold mb-6" style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Profile</h1>

      {/* Account info */}
      <div style={sectionStyle}>
        <div className="flex items-center gap-4 mb-5">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)' }}
          >
            <User size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{me?.username}</span>
              {badge && (
                <span className="px-2 py-0.5 rounded-full" style={{ ...badge.style, fontSize: '0.7rem' }}>
                  {badge.label}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{me?.email}</p>
          </div>
        </div>

        {/* Stats row */}
        <div
          className="grid grid-cols-3 gap-px rounded-xl overflow-hidden"
          style={{ background: 'var(--border-default)' }}
        >
          {[
            { value: stats?.games_tracked ?? '—', label: 'Games tracked' },
            { value: stats?.trophies_earned ?? '—', label: 'Achievements' },
            { value: stats?.platinums ?? '—', label: 'Completed' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center py-4" style={{ background: 'var(--bg-elevated)' }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</p>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Per-platform breakdown */}
        {stats && (stats.psn || stats.xbox || stats.steam) && (
          <div className="mt-4 space-y-2">
            {stats.psn && (
              <div className="flex items-center justify-between" style={{ fontSize: '0.8rem' }}>
                <span style={{ color: '#60a5fa' }}>PSN</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {stats.psn.platinums} platinums · {stats.psn.trophies_earned} trophies
                </span>
              </div>
            )}
            {stats.xbox && (
              <div className="flex items-center justify-between" style={{ fontSize: '0.8rem' }}>
                <span style={{ color: '#34d399' }}>Xbox</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {stats.xbox.gamerscore_earned.toLocaleString()} / {stats.xbox.gamerscore_total.toLocaleString()} G
                </span>
              </div>
            )}
            {stats.steam && (
              <div className="flex items-center justify-between" style={{ fontSize: '0.8rem' }}>
                <span style={{ color: '#9ca3af' }}>Steam</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {stats.steam.games_completed} games 100%
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PlayStation Network */}
      <div style={sectionStyle}>
        {sectionHeader(
          <div style={{ width: 16, height: 16, borderRadius: 4, background: '#003087', flexShrink: 0 }} />,
          'PlayStation Network'
        )}

        {me?.psn_id ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{me.psn_id}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Connected</p>
              </div>
            </div>
            <button
              onClick={() => disconnectPsnMutation.mutate()}
              disabled={disconnectPsnMutation.isPending}
              className="flex items-center gap-1.5 transition px-3 py-1.5 rounded-lg"
              style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <Unlink size={13} />
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Connect your PSN account to enable trophy sync.
            </p>
            <div
              className="rounded-xl p-4 mb-4"
              style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)' }}
            >
              <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                How to get your NPSSO token:
              </p>
              <ol style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: 16, lineHeight: 2 }}>
                <li>Log into <span style={{ color: 'var(--accent)' }}>playstation.com</span> in your browser</li>
                <li>Visit <span style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>ca.account.sony.com/api/v1/ssocookie</span></li>
                <li>Copy the value next to <code style={{ background: 'var(--bg-hero)', padding: '1px 4px', borderRadius: 3 }}>npsso</code></li>
                <li>Paste it below</li>
              </ol>
            </div>

            {psnError && (
              <div
                className="rounded-lg px-4 py-3 mb-4"
                style={{ background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)', fontSize: '0.8rem', color: '#f87171' }}
              >
                {psnError}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); connectPsnMutation.mutate(npsso) }} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showNpsso ? 'text' : 'password'}
                  value={npsso}
                  onChange={(e) => setNpsso(e.target.value)}
                  placeholder="Paste your NPSSO token"
                  required
                  style={{ ...inputStyle, paddingRight: 36 }}
                />
                <button
                  type="button"
                  onClick={() => setShowNpsso(!showNpsso)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showNpsso ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={connectPsnMutation.isPending || !npsso}
                className="flex items-center gap-1.5 font-medium px-4 rounded-lg flex-shrink-0 transition disabled:opacity-50"
                style={{ fontSize: '0.85rem', background: '#003087', color: '#fff' }}
              >
                <Link size={13} />
                {connectPsnMutation.isPending ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Steam */}
      <div style={sectionStyle}>
        {sectionHeader(
          <div style={{ width: 16, height: 16, borderRadius: 4, background: '#1b2838', flexShrink: 0, border: '0.5px solid #2a475e' }} />,
          'Steam'
        )}

        {me?.steam_id ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{me.steam_id}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Steam ID connected</p>
              </div>
            </div>
            <button
              onClick={() => disconnectSteamMutation.mutate()}
              disabled={disconnectSteamMutation.isPending}
              className="flex items-center gap-1.5 transition px-3 py-1.5 rounded-lg"
              style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <Unlink size={13} />
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Connect your Steam account to enable achievement sync.
            </p>
            <div
              className="rounded-xl p-4 mb-4"
              style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)' }}
            >
              <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                How to connect:
              </p>
              <ol style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: 16, lineHeight: 2 }}>
                <li>Paste your Steam profile URL, vanity name, or steamID64 below</li>
                <li>In Steam → <span style={{ color: 'var(--accent)' }}>Edit Profile → Privacy Settings</span></li>
                <li>Set <strong style={{ color: 'var(--text-secondary)' }}>Profile</strong>, <strong style={{ color: 'var(--text-secondary)' }}>Game details</strong>, and <strong style={{ color: 'var(--text-secondary)' }}>Playtime</strong> to <strong style={{ color: 'var(--text-secondary)' }}>Public</strong></li>
                <li>All three must be public for achievement sync to work</li>
              </ol>
            </div>

            {steamError && (
              <div
                className="rounded-lg px-4 py-3 mb-4"
                style={{ background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)', fontSize: '0.8rem', color: '#f87171' }}
              >
                {steamError}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); connectSteamMutation.mutate(steamInput.trim()) }} className="flex gap-2">
              <input
                type="text"
                value={steamInput}
                onChange={(e) => setSteamInput(e.target.value)}
                placeholder="steamcommunity.com/id/yourname"
                required
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="submit"
                disabled={connectSteamMutation.isPending || !steamInput.trim()}
                className="flex items-center gap-1.5 font-medium px-4 rounded-lg flex-shrink-0 transition disabled:opacity-50"
                style={{ fontSize: '0.85rem', background: '#1b2838', color: '#c7d5e0', border: '0.5px solid #2a475e' }}
              >
                <Link size={13} />
                {connectSteamMutation.isPending ? 'Resolving...' : 'Connect'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Xbox */}
      <div style={sectionStyle}>
        {sectionHeader(
          <div style={{ width: 16, height: 16, borderRadius: 4, background: '#107c10', flexShrink: 0 }} />,
          'Xbox'
        )}

        {me?.xbox_gamertag ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{me.xbox_gamertag}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Xbox account connected</p>
              </div>
            </div>
            <button
              onClick={() => disconnectXboxMutation.mutate()}
              disabled={disconnectXboxMutation.isPending}
              className="flex items-center gap-1.5 transition px-3 py-1.5 rounded-lg"
              style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <Unlink size={13} />
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Connect your Microsoft account to enable Xbox achievement sync.
            </p>

            {!xboxAuthUrl ? (
              <button
                onClick={fetchXboxAuthUrl}
                className="flex items-center gap-2 font-medium px-4 py-2.5 rounded-lg transition"
                style={{ fontSize: '0.85rem', background: '#107c10', color: '#fff' }}
              >
                <ExternalLink size={13} />
                Sign in with Microsoft
              </button>
            ) : (
              <div>
                <div
                  className="rounded-xl p-4 mb-4"
                  style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)' }}
                >
                  <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Almost there:
                  </p>
                  <ol style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: 16, lineHeight: 2 }}>
                    <li>Sign in with your Microsoft account in the window that opened</li>
                    <li>After signing in, you'll be redirected to a blank-looking page</li>
                    <li>Copy the <code style={{ background: 'var(--bg-hero)', padding: '1px 4px', borderRadius: 3 }}>code=</code> value from the URL</li>
                    <li>Paste it below and click Connect</li>
                  </ol>
                </div>

                {xboxError && (
                  <div
                    className="rounded-lg px-4 py-3 mb-4"
                    style={{ background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)', fontSize: '0.8rem', color: '#f87171' }}
                  >
                    {xboxError}
                  </div>
                )}

                <form onSubmit={(e) => { e.preventDefault(); connectXboxMutation.mutate(xboxCode.trim()) }} className="flex gap-2">
                  <input
                    type="text"
                    value={xboxCode}
                    onChange={(e) => setXboxCode(e.target.value)}
                    placeholder="Paste auth code here"
                    required
                    autoFocus
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="submit"
                    disabled={connectXboxMutation.isPending || !xboxCode.trim()}
                    className="flex items-center gap-1.5 font-medium px-4 rounded-lg flex-shrink-0 transition disabled:opacity-50"
                    style={{ fontSize: '0.85rem', background: '#107c10', color: '#fff' }}
                  >
                    <Link size={13} />
                    {connectXboxMutation.isPending ? 'Connecting...' : 'Connect'}
                  </button>
                </form>

                <button
                  onClick={() => { setXboxAuthUrl(null); setXboxError(null) }}
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 12 }}
                >
                  ← Start over
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Display size */}
      <div style={sectionStyle}>
        {sectionHeader(
          <Type size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />,
          'Display size'
        )}
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          Adjust text and UI element size across the app.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {scales.map((s) => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className="py-2.5 rounded-lg font-medium transition"
              style={{
                fontSize: '0.8rem',
                border: scale === s ? '0.5px solid var(--accent-border)' : '0.5px solid var(--border-default)',
                background: scale === s ? 'rgba(167,139,250,0.1)' : 'var(--bg-elevated)',
                color: scale === s ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {scaleLabels[s]}
            </button>
          ))}
        </div>
        <div
          className="mt-4 rounded-lg p-3"
          style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)' }}
        >
          <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>Preview</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>This is how text will appear across the app.</p>
        </div>
      </div>
    </div>
  )
}
