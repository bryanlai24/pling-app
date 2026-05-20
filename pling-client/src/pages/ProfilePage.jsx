import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMe, updateMe, getMyStats } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { User, Link, Unlink, Eye, EyeOff, Type, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import client from '../api/client'
import { useUIStore } from '../store/uiStore'

const connectPSN = (data) => client.post('/users/me/psn/connect', data)
const disconnectPSN = () => client.delete('/users/me/psn/disconnect')

const ROLE_BADGES = {
  user:        { label: 'User',        style: { background: 'rgba(107,114,128,0.1)', color: '#9ca3af', border: '0.5px solid rgba(107,114,128,0.25)' } },
  contributor: { label: 'Contributor', style: { background: 'rgba(96,165,250,0.1)',  color: '#60a5fa', border: '0.5px solid rgba(96,165,250,0.25)'  } },
  admin:       { label: 'Admin',       style: { background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '0.5px solid rgba(167,139,250,0.25)' } },
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

const sectionStyle = {
  background: 'var(--bg-surface)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 16,
  marginBottom: 12,
  overflow: 'hidden',
}

const sectionPad = { padding: '20px 24px' }

// A platform row in the connections section
function PlatformRow({ color, label, connected, connectedLabel, onDisconnect, disconnecting, children, expandKey, expanded, onToggle }) {
  return (
    <div style={{ borderBottom: '0.5px solid var(--border-deep)' }}>
      {/* Row header */}
      <div className="flex items-center gap-3" style={{ padding: '16px 24px' }}>
        <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{label}</span>

        {connected ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{connectedLabel}</span>
            </div>
            <button
              onClick={onDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1 transition px-2 py-1 rounded-lg"
              style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <Unlink size={12} />
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 transition px-3 py-1.5 rounded-lg"
            style={{
              fontSize: '0.75rem',
              background: expanded ? 'var(--bg-elevated)' : 'transparent',
              border: '0.5px solid var(--border-default)',
              color: 'var(--text-muted)',
            }}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Cancel' : 'Connect'}
          </button>
        )}
      </div>

      {/* Expandable connect form */}
      {!connected && expanded && (
        <div style={{ padding: '0 24px 20px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function InstructionBox({ children }) {
  return (
    <div className="rounded-xl p-4 mb-4"
      style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)' }}>
      {children}
    </div>
  )
}

function InstructionList({ steps }) {
  return (
    <ol style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: 16, lineHeight: 2, margin: 0 }}>
      {steps.map((step, i) => <li key={i}>{step}</li>)}
    </ol>
  )
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="rounded-lg px-4 py-3 mb-4"
      style={{ background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)', fontSize: '0.8rem', color: '#f87171' }}>
      {message}
    </div>
  )
}

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const [npsso, setNpsso] = useState('')
  const [showNpsso, setShowNpsso] = useState(false)
  const [psnError, setPsnError] = useState(null)
  const [psnExpanded, setPsnExpanded] = useState(false)

  const [steamInput, setSteamInput] = useState('')
  const [steamError, setSteamError] = useState(null)
  const [steamExpanded, setSteamExpanded] = useState(false)

  const [xboxError, setXboxError] = useState(null)
  const [xboxExpanded, setXboxExpanded] = useState(false)
  const [xboxConnecting, setXboxConnecting] = useState(false)
  const xboxPopupRef = useRef(null)

  const { scale, scales, scaleLabels, setScale } = useUIStore()

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then((r) => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['myStats'],
    queryFn: () => getMyStats().then((r) => r.data),
  })

  // PSN
  const connectPsnMutation = useMutation({
    mutationFn: (token) => connectPSN({ npsso_token: token }),
    onSuccess: () => { setNpsso(''); setPsnError(null); setPsnExpanded(false); queryClient.invalidateQueries({ queryKey: ['me'] }) },
    onError: (err) => setPsnError(err.response?.data?.detail || 'Failed to connect PSN account'),
  })
  const disconnectPsnMutation = useMutation({
    mutationFn: disconnectPSN,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })

  // Steam
  const connectSteamMutation = useMutation({
    mutationFn: (input) => client.post('/users/me/steam/connect', { steam_input: input }),
    onSuccess: () => { setSteamInput(''); setSteamError(null); setSteamExpanded(false); queryClient.invalidateQueries({ queryKey: ['me'] }) },
    onError: (err) => setSteamError(err.response?.data?.detail || 'Could not resolve Steam ID — please try again.'),
  })
  const disconnectSteamMutation = useMutation({
    mutationFn: () => client.delete('/users/me/steam/disconnect'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })

  // Xbox — popup OAuth flow
  const disconnectXboxMutation = useMutation({
    mutationFn: () => client.delete('/users/me/xbox/disconnect'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'xbox_connected') {
        setXboxConnecting(false)
        setXboxError(null)
        setXboxExpanded(false)
        xboxPopupRef.current?.close()
        queryClient.invalidateQueries({ queryKey: ['me'] })
      } else if (event.data?.type === 'xbox_error') {
        setXboxConnecting(false)
        setXboxError(event.data.message || 'Failed to connect Xbox account')
        xboxPopupRef.current?.close()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [queryClient])

  const openXboxPopup = async () => {
    setXboxError(null)
    setXboxConnecting(true)
    try {
      const res = await client.get('/users/me/xbox/auth-url')
      const popup = window.open(
        res.data.auth_url,
        'xbox_auth',
        'width=520,height=620,left=200,top=100,resizable=yes,scrollbars=yes'
      )
      xboxPopupRef.current = popup
      // Detect if popup was closed manually without completing auth
      const poll = setInterval(() => {
        if (popup?.closed) {
          clearInterval(poll)
          setXboxConnecting(false)
        }
      }, 500)
    } catch {
      setXboxConnecting(false)
      setXboxError('Could not generate Xbox auth URL.')
    }
  }

  const badge = ROLE_BADGES[me?.role || 'user']

  return (
    <div>
      <h1 className="font-bold mb-6" style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Profile</h1>

      {/* Account + stats */}
      <div style={sectionStyle}>
        {/* Identity */}
        <div className="flex items-center gap-4" style={{ ...sectionPad, paddingBottom: 16 }}>
          <div className="flex items-center justify-center flex-shrink-0"
            style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)' }}>
            <User size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{me?.username}</span>
              {badge && (
                <span className="px-2 py-0.5 rounded-full" style={{ ...badge.style, fontSize: '0.65rem' }}>
                  {badge.label}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>{me?.email}</p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '0.5px solid var(--border-deep)' }} />

        {/* Stats */}
        <div className="grid grid-cols-3" style={{ borderBottom: '0.5px solid var(--border-deep)' }}>
          {[
            { value: stats?.games_tracked ?? '—', label: 'Games' },
            { value: stats?.trophies_earned ?? '—', label: 'Achievements' },
            { value: stats?.platinums ?? '—', label: 'Completed' },
          ].map(({ value, label }, i) => (
            <div key={label} className="text-center py-4"
              style={{ borderRight: i < 2 ? '0.5px solid var(--border-deep)' : 'none' }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</p>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Per-platform breakdown */}
        {stats && (stats.psn || stats.xbox || stats.steam) && (
          <div style={{ ...sectionPad, paddingTop: 16, paddingBottom: 16 }}>
            {stats.psn && (
              <div className="flex items-center justify-between" style={{ fontSize: '0.8rem', marginBottom: 6 }}>
                <span style={{ color: '#60a5fa' }}>PSN</span>
                <span style={{ color: 'var(--text-secondary)' }}>{stats.psn.platinums} platinums · {stats.psn.trophies_earned} trophies</span>
              </div>
            )}
            {stats.xbox && (
              <div className="flex items-center justify-between" style={{ fontSize: '0.8rem', marginBottom: 6 }}>
                <span style={{ color: '#34d399' }}>Xbox</span>
                <span style={{ color: 'var(--text-secondary)' }}>{stats.xbox.gamerscore_earned.toLocaleString()} / {stats.xbox.gamerscore_total.toLocaleString()} G</span>
              </div>
            )}
            {stats.steam && (
              <div className="flex items-center justify-between" style={{ fontSize: '0.8rem' }}>
                <span style={{ color: '#9ca3af' }}>Steam</span>
                <span style={{ color: 'var(--text-secondary)' }}>{stats.steam.games_completed} games 100%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connected accounts */}
      <div style={{ ...sectionStyle, marginTop: 0 }}>
        <div style={{ ...sectionPad, paddingBottom: 16 }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Connected accounts</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Link your gaming accounts to sync achievements automatically.</p>
        </div>
        <div style={{ borderTop: '0.5px solid var(--border-deep)' }} />

        {/* PSN */}
        <PlatformRow
          color="#003087"
          label="PlayStation Network"
          connected={!!me?.psn_id}
          connectedLabel={me?.psn_id}
          onDisconnect={() => disconnectPsnMutation.mutate()}
          disconnecting={disconnectPsnMutation.isPending}
          expanded={psnExpanded}
          onToggle={() => { setPsnExpanded(v => !v); setPsnError(null) }}
        >
          <InstructionBox>
            <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>How to get your NPSSO token:</p>
            <InstructionList steps={[
              <span>Log into <span style={{ color: 'var(--accent)' }}>playstation.com</span> in your browser</span>,
              <span>Visit <span style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>ca.account.sony.com/api/v1/ssocookie</span></span>,
              <span>Copy the value next to <code style={{ background: 'var(--bg-hero)', padding: '1px 4px', borderRadius: 3 }}>npsso</code></span>,
              'Paste it below',
            ]} />
          </InstructionBox>
          <ErrorBanner message={psnError} />
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
              <button type="button" onClick={() => setShowNpsso(!showNpsso)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition"
                style={{ color: 'var(--text-muted)' }}>
                {showNpsso ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button type="submit" disabled={connectPsnMutation.isPending || !npsso}
              className="flex items-center gap-1.5 font-medium px-4 rounded-lg flex-shrink-0 transition disabled:opacity-50"
              style={{ fontSize: '0.85rem', background: '#003087', color: '#fff' }}>
              <Link size={13} />
              {connectPsnMutation.isPending ? 'Connecting...' : 'Connect'}
            </button>
          </form>
        </PlatformRow>

        {/* Steam */}
        <PlatformRow
          color="#1b2838"
          label="Steam"
          connected={!!me?.steam_id}
          connectedLabel={me?.steam_id}
          onDisconnect={() => disconnectSteamMutation.mutate()}
          disconnecting={disconnectSteamMutation.isPending}
          expanded={steamExpanded}
          onToggle={() => { setSteamExpanded(v => !v); setSteamError(null) }}
        >
          <InstructionBox>
            <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>How to connect:</p>
            <InstructionList steps={[
              'Paste your Steam profile URL, vanity name, or steamID64 below',
              <span>In Steam → <span style={{ color: 'var(--accent)' }}>Edit Profile → Privacy Settings</span></span>,
              <span>Set <strong style={{ color: 'var(--text-secondary)' }}>Profile</strong>, <strong style={{ color: 'var(--text-secondary)' }}>Game details</strong>, and <strong style={{ color: 'var(--text-secondary)' }}>Playtime</strong> to Public</span>,
              'All three must be public for achievement sync to work',
            ]} />
          </InstructionBox>
          <ErrorBanner message={steamError} />
          <form onSubmit={(e) => { e.preventDefault(); connectSteamMutation.mutate(steamInput.trim()) }} className="flex gap-2">
            <input
              type="text"
              value={steamInput}
              onChange={(e) => setSteamInput(e.target.value)}
              placeholder="steamcommunity.com/id/yourname"
              required
              style={{ ...inputStyle, flex: 1 }}
            />
            <button type="submit" disabled={connectSteamMutation.isPending || !steamInput.trim()}
              className="flex items-center gap-1.5 font-medium px-4 rounded-lg flex-shrink-0 transition disabled:opacity-50"
              style={{ fontSize: '0.85rem', background: '#1b2838', color: '#c7d5e0', border: '0.5px solid #2a475e' }}>
              <Link size={13} />
              {connectSteamMutation.isPending ? 'Resolving...' : 'Connect'}
            </button>
          </form>
        </PlatformRow>

        {/* Xbox */}
        <PlatformRow
          color="#107c10"
          label="Xbox"
          connected={!!me?.xbox_gamertag}
          connectedLabel={me?.xbox_gamertag}
          onDisconnect={() => disconnectXboxMutation.mutate()}
          disconnecting={disconnectXboxMutation.isPending}
          expanded={xboxExpanded}
          onToggle={() => { setXboxExpanded(v => !v); setXboxError(null) }}
        >
          <ErrorBanner message={xboxError} />
          <button
            onClick={openXboxPopup}
            disabled={xboxConnecting}
            className="flex items-center gap-2 font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-50"
            style={{ fontSize: '0.85rem', background: '#107c10', color: '#fff' }}
          >
            <ExternalLink size={13} />
            {xboxConnecting ? 'Waiting for sign-in…' : 'Sign in with Microsoft'}
          </button>
          {xboxConnecting && (
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
              Complete sign-in in the popup window — it will close automatically when done.
            </p>
          )}
        </PlatformRow>

        {/* last row has no bottom border */}
        <div style={{ height: 1 }} />
      </div>

      {/* Display size */}
      <div style={sectionStyle}>
        <div style={sectionPad}>
          <div className="flex items-center gap-2.5 mb-1">
            <Type size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <h2 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Display size</h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 16 }}>
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
          <div className="mt-4 rounded-lg p-3"
            style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>Preview</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>This is how text will appear across the app.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
