import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPublicProfile } from '../api/auth'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAuthStore } from '../store/authStore'
import { ArrowLeft } from 'lucide-react'

// ── Platform meta ─────────────────────────────────────────────────────────────
const PLATFORM_META = {
  psn:   { color: '#60a5fa', label: 'PSN' },
  xbox:  { color: '#34d399', label: 'Xbox' },
  steam: { color: '#9ca3af', label: 'Steam' },
}

// ── Trophy type dot colors ────────────────────────────────────────────────────
const TROPHY_COLORS = {
  platinum: '#e2c9ff',
  gold:     '#fbbf24',
  silver:   '#94a3b8',
  bronze:   '#c97c4a',
}

// ── PSN Platinum Trophy SVG ───────────────────────────────────────────────────
function PlatinumTrophySVG({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="plat-body" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#f3e8ff" />
          <stop offset="40%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </radialGradient>
        <radialGradient id="plat-shine" cx="35%" cy="25%" r="40%">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <filter id="plat-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Glow halo */}
      <ellipse cx="28" cy="44" rx="12" ry="3" fill="#a78bfa" opacity="0.35" />
      {/* Base */}
      <rect x="18" y="43" width="20" height="4" rx="2" fill="url(#plat-body)" />
      <rect x="21" y="40" width="14" height="4" rx="1.5" fill="url(#plat-body)" />
      {/* Cup body */}
      <path d="M14 12 C14 8 18 6 28 6 C38 6 42 8 42 12 L40 32 C40 36 35 40 28 40 C21 40 16 36 16 32 Z"
        fill="url(#plat-body)" filter="url(#plat-glow)" />
      {/* Handles */}
      <path d="M14 14 C10 14 8 17 8 20 C8 23 10 25 14 25" stroke="url(#plat-body)" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M42 14 C46 14 48 17 48 20 C48 23 46 25 42 25" stroke="url(#plat-body)" strokeWidth="3" fill="none" strokeLinecap="round"/>
      {/* Shine overlay */}
      <path d="M14 12 C14 8 18 6 28 6 C38 6 42 8 42 12 L40 32 C40 36 35 40 28 40 C21 40 16 36 16 32 Z"
        fill="url(#plat-shine)" />
      {/* Star */}
      <path d="M28 15 L29.5 19.5 L34 19.5 L30.5 22 L32 26.5 L28 24 L24 26.5 L25.5 22 L22 19.5 L26.5 19.5 Z"
        fill="white" opacity="0.85" />
    </svg>
  )
}

// ── Steam Perfect Game Ribbon SVG — blue ribbon, yellow center star ───────────
function SteamRibbonSVG({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ribbon-blue" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <radialGradient id="medal-gold" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
        <filter id="ribbon-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Soft glow behind the whole badge */}
      <circle cx="28" cy="32" r="18" fill="#3b82f6" opacity="0.15" />

      {/* Ribbon tails — two angled strips hanging below */}
      <path d="M20 30 L16 52 L28 44 L40 52 L36 30 Z" fill="url(#ribbon-blue)" opacity="0.9" />

      {/* Ribbon split notch at bottom center */}
      <path d="M24 44 L28 40 L32 44 L28 48 Z" fill="#1e3a8a" opacity="0.6" />

      {/* Medal circle */}
      <circle cx="28" cy="24" r="17" fill="url(#ribbon-blue)" filter="url(#ribbon-glow)" />
      <circle cx="28" cy="24" r="14" fill="url(#medal-gold)" />
      <circle cx="28" cy="24" r="11" fill="url(#medal-gold)" opacity="0.6" />

      {/* Inner shine ring */}
      <circle cx="28" cy="24" r="11" stroke="rgba(255,255,255,0.25)" strokeWidth="1" fill="none" />

      {/* Star */}
      <path d="M28 14 L30 20 L36.5 20 L31.5 24 L33.5 30.5 L28 26.5 L22.5 30.5 L24.5 24 L19.5 20 L26 20 Z"
        fill="white" opacity="0.95" filter="url(#ribbon-glow)" />
    </svg>
  )
}

// ── Xbox Gamerscore Badge ─────────────────────────────────────────────────────
function XboxGscoreBadge({ total, size = 56 }) {
  const label = total ? `${total.toLocaleString()}G` : '100%'
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="xbox-green" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="60%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#065f46" />
        </radialGradient>
        <filter id="xbox-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Glow */}
      <circle cx="28" cy="28" r="22" fill="#10b981" opacity="0.18" filter="url(#xbox-glow)" />
      {/* Outer ring */}
      <circle cx="28" cy="28" r="20" stroke="url(#xbox-green)" strokeWidth="2.5" fill="none" />
      {/* Inner fill */}
      <circle cx="28" cy="28" r="17" fill="url(#xbox-green)" opacity="0.15" />
      {/* Xbox X mark */}
      <text x="28" y="24" textAnchor="middle" fontSize="10" fontWeight="700"
        fill="#34d399" fontFamily="system-ui, sans-serif" opacity="0.6">✕</text>
      {/* Score text */}
      <text x="28" y="36" textAnchor="middle"
        fontSize={label.length > 5 ? "9" : "11"}
        fontWeight="800"
        fill="#6ee7b7"
        fontFamily="system-ui, sans-serif"
        filter="url(#xbox-glow)"
      >{label}</text>
    </svg>
  )
}

// ── CompletionSymbol — picks the right badge per platform ─────────────────────
function CompletionSymbol({ platform, gamerscoreTotal }) {
  if (platform === 'psn')   return <PlatinumTrophySVG size={80} />
  if (platform === 'steam') return <SteamRibbonSVG size={80} />
  if (platform === 'xbox')  return <XboxGscoreBadge total={gamerscoreTotal} size={80} />
  return null
}

// ── TrophyRoomCard — tall portrait, full-bleed cover art ─────────────────────
function TrophyRoomCard({ g }) {
  return (
    <Link to={`/games/${g.id}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Card */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          aspectRatio: '2/3',
          background: 'var(--bg-elevated)',
          border: '0.5px solid var(--border-default)',
          cursor: 'pointer',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--border-hover)'
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.6)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border-default)'
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        {/* Full-bleed cover art — dimmed so symbol pops */}
        {g.cover_image_url && (
          <img
            src={g.cover_image_url}
            alt={g.title}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              opacity: 0.45,
            }}
          />
        )}

        {/* Dark overlay — heavier radial so symbol centre is visible */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.65) 100%)',
        }} />

        {/* Completion symbol — dead center */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.9))',
        }}>
          <CompletionSymbol
            platform={g.platform}
            gamerscoreTotal={g.gamerscore_total}
          />
        </div>
      </div>

      {/* Game title label — below the card, not inside */}
      <p style={{
        fontSize: '0.72rem', fontWeight: 600,
        color: 'var(--text-secondary)',
        textAlign: 'center',
        lineHeight: 1.3,
        display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        padding: '0 2px',
      }}>{g.title}</p>
    </Link>
  )
}

// ── Legacy score hero ─────────────────────────────────────────────────────────
function LegacyHero({ score = 0, stats }) {
  const formatted = (score ?? 0).toLocaleString()

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 20,
      padding: '28px 28px 24px',
      marginBottom: 28,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle purple radial glow behind the number */}
      <div style={{
        position: 'absolute', top: -20, left: -20, right: -20,
        height: 120,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Label */}
      <p style={{
        fontSize: '0.65rem', fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--accent)',
        marginBottom: 6,
        position: 'relative',
      }}>Legacy</p>

      {/* Score */}
      <p style={{
        fontSize: '3rem', fontWeight: 800, lineHeight: 1,
        color: 'var(--text-primary)',
        letterSpacing: '-0.02em',
        marginBottom: 16,
        position: 'relative',
        textShadow: '0 0 40px rgba(139,92,246,0.35)',
      }}>{formatted}</p>

      {/* Platform breakdown */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, position: 'relative' }}>
        {stats.psn && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(96,165,250,0.08)',
            border: '0.5px solid rgba(96,165,250,0.2)',
            borderRadius: 8, padding: '5px 10px',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 2, background: '#60a5fa' }} />
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>PSN</span>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              {stats.psn.trophies_earned.toLocaleString()} trophies{stats.psn.platinums > 0 && ` · ${stats.psn.platinums} 🏆`}
            </span>
          </div>
        )}
        {stats.xbox && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(52,211,153,0.08)',
            border: '0.5px solid rgba(52,211,153,0.2)',
            borderRadius: 8, padding: '5px 10px',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 2, background: '#34d399' }} />
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>Xbox</span>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              {stats.xbox.gamerscore_earned.toLocaleString()} / {stats.xbox.gamerscore_total.toLocaleString()}G
            </span>
          </div>
        )}
        {stats.steam && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(156,163,175,0.08)',
            border: '0.5px solid rgba(156,163,175,0.2)',
            borderRadius: 8, padding: '5px 10px',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 2, background: '#9ca3af' }} />
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>Steam</span>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              {stats.steam.games_completed} × 100%
            </span>
          </div>
        )}
        {!stats.psn && !stats.xbox && !stats.steam && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No platforms synced yet</span>
        )}
      </div>
    </div>
  )
}

// ── PlatformBadge ─────────────────────────────────────────────────────────────
function PlatformBadge({ platform, value }) {
  if (!value) return null
  const meta = PLATFORM_META[platform] || { color: '#9ca3af', label: platform }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
      style={{
        background: 'var(--bg-elevated)',
        border: '0.5px solid var(--border-default)',
        fontSize: '0.75rem',
      }}>
      <div style={{ width: 7, height: 7, borderRadius: 2, background: meta.color, flexShrink: 0 }} />
      <span style={{ color: 'var(--text-muted)' }}>{meta.label}</span>
      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

// ── CompletionRing SVG ────────────────────────────────────────────────────────
function CompletionRing({ percent, size = 32, stroke = 2.5 }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (percent / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--border-deep)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--accent)" strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round" />
    </svg>
  )
}

// ── RecentGameRow ─────────────────────────────────────────────────────────────
function RecentGameRow({ g }) {
  const meta = PLATFORM_META[g.platform] || { color: '#9ca3af' }
  const isXbox = g.platform === 'xbox' && g.gamerscore_total > 0

  return (
    <Link to={`/games/${g.id}`}
      className="flex items-center gap-3 rounded-xl transition"
      style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border-default)',
        padding: '12px 14px',
        textDecoration: 'none',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 8, flexShrink: 0,
        background: 'var(--bg-elevated)', border: '0.5px solid var(--border-deep)',
        overflow: 'hidden',
      }}>
        {g.cover_image_url && (
          <img src={g.cover_image_url} alt={g.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p style={{
          fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{g.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div style={{ width: 5, height: 5, borderRadius: 1.5, background: meta.color, flexShrink: 0 }} />
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{meta.label}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isXbox
          ? <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {g.gamerscore_earned ?? 0}G / {g.gamerscore_total}G
            </span>
          : <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {g.completion_percent}%
            </span>
        }
        <CompletionRing percent={g.completion_percent} />
      </div>
    </Link>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 16, r = 8 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'var(--bg-elevated)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PublicProfilePage() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { token } = useAuthStore()

  usePageTitle(username ? username : 'Profile')

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['publicProfile', username],
    queryFn: () => getPublicProfile(username).then(r => r.data),
    enabled: !!username,
    staleTime: 2 * 60 * 1000,
  })

  const backLabel = token ? 'Back to library' : 'Back to catalogue'

  if (isLoading) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 0' }}>
        <Skeleton w={100} h={12} r={6} />
        <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Skeleton w={56} h={56} r={28} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton w={140} h={18} />
            <Skeleton w={200} h={12} />
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <Skeleton h={140} r={16} />
        </div>
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[1,2,3,4].map(i => <Skeleton key={i} h={220} r={16} />)}
        </div>
      </div>
    )
  }

  if (isError || !profile) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 0', textAlign: 'center' }}>
        <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>👤</p>
        <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          User not found
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 24 }}>
          There's no Pling account for <strong style={{ color: 'var(--text-secondary)' }}>@{username}</strong>.
        </p>
        <button onClick={() => navigate(token ? '/library' : '/')}
          style={{
            fontSize: '0.8rem', cursor: 'pointer',
            background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)',
            color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: 10,
          }}>
          {backLabel}
        </button>
      </div>
    )
  }

  const { stats, trophy_room, recently_played, legacy_score = 0 } = profile

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 0 64px' }}>

      {/* Back nav */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 mb-6 transition"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <ArrowLeft size={14} />
        {backLabel}
      </button>

      {/* Header — avatar + username + platform badges */}
      <div className="flex items-start gap-4 mb-8">
        <div className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))',
            border: '0.5px solid var(--border-default)',
            fontSize: '1.4rem', fontWeight: 700,
            color: 'var(--accent)',
          }}>
          {profile.username.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
            {profile.username}
          </h1>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            Member since {new Date(profile.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <div className="flex flex-wrap gap-2">
            <PlatformBadge platform="psn"   value={profile.psn_id} />
            <PlatformBadge platform="xbox"  value={profile.xbox_gamertag} />
            <PlatformBadge platform="steam" value={profile.steam_display_name} />
          </div>
        </div>
      </div>

      {/* Legacy score hero */}
      <LegacyHero score={legacy_score} stats={stats} />

      {/* Trophy Room */}
      {trophy_room?.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <h2 style={{
            fontSize: '0.72rem', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 14,
          }}>
            Trophy Room
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 12,
          }}>
            {trophy_room.map(g => (
              <TrophyRoomCard key={g.id} g={g} />
            ))}
          </div>
        </section>
      )}

      {/* Recently played */}
      {recently_played.length > 0 && (
        <section>
          <h2 style={{
            fontSize: '0.72rem', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 14,
          }}>
            Recently Played
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recently_played.map(g => <RecentGameRow key={g.id} g={g} />)}
          </div>
        </section>
      )}

      {/* Full empty state */}
      {trophy_room?.length === 0 && recently_played.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: '2rem', marginBottom: 8 }}>🎮</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {profile.username} hasn't tracked any games yet.
          </p>
        </div>
      )}
    </div>
  )
}
