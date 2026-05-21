import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getFeaturedGame, listGames } from '../api/games'
import { usePageTitle } from '../hooks/usePageTitle'
import { Trophy, ChevronRight, CheckCircle2, Circle } from 'lucide-react'

// ── Completion ring ────────────────────────────────────────────────────────────

function CompletionRing({ completed, total, size = 80 }) {
  const percent = total > 0 ? completed / total : 0
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * percent

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      {/* Track */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="var(--bg-elevated)"
        strokeWidth={6}
      />
      {/* Progress */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      {/* Label */}
      <text
        x={size / 2} y={size / 2 + 1}
        textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-primary)"
        fontSize={size * 0.18}
        fontWeight="600"
      >
        {Math.round(percent * 100)}%
      </text>
    </svg>
  )
}

// ── Achievement row (read-only) ────────────────────────────────────────────────

function AchievementRow({ achievement }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition"
      style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border-default)' }}
    >
      {/* Icon */}
      {achievement.icon_url ? (
        <img src={achievement.icon_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--bg-elevated)' }}>
          <Trophy size={16} style={{ color: 'var(--accent)' }} />
        </div>
      )}

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {achievement.title}
        </p>
        {achievement.description && (
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {achievement.description}
          </p>
        )}
      </div>

      {/* Status icon — always incomplete for guests */}
      <Circle size={16} className="flex-shrink-0" style={{ color: 'var(--border-default)' }} />
    </div>
  )
}

// ── Game card (catalogue grid) ─────────────────────────────────────────────────

function CatalogueCard({ game, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl overflow-hidden transition hover:scale-[1.02] active:scale-[0.99]"
      style={{
        background: 'var(--bg-card)',
        border: '0.5px solid var(--border-default)',
      }}
    >
      {/* Cover */}
      <div className="w-full aspect-video bg-[var(--bg-elevated)] overflow-hidden">
        {game.cover_image_url ? (
          <img src={game.cover_image_url} alt={game.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Trophy size={28} style={{ color: 'var(--accent-border)' }} />
          </div>
        )}
      </div>
      {/* Meta */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {game.title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Browse achievements →
        </p>
      </div>
    </button>
  )
}

// ── Landing page ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  usePageTitle(null) // just "Pling"
  const navigate = useNavigate()

  const { data: featured, isLoading: featuredLoading } = useQuery({
    queryKey: ['featured-game'],
    queryFn: () => getFeaturedGame().then(r => r.data),
    staleTime: 1000 * 60 * 15, // re-fetch every 15 min
  })

  const { data: allGames } = useQuery({
    queryKey: ['games'],
    queryFn: () => listGames().then(r => r.data),
    staleTime: 1000 * 60 * 5,
  })

  const catalogueGames = (allGames || []).filter(g => g.cover_image_url).slice(0, 12)

  const featuredGame = featured?.game
  const featuredAchievements = featured?.achievements || []
  const completedCount = 0 // guests always see 0
  const totalCount = featuredAchievements.length

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-10 backdrop-blur-sm border-b"
        style={{ background: 'rgba(10,10,18,0.9)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold tracking-tight text-white" style={{ fontSize: '1.1rem' }}>
            Pling<span style={{ color: 'var(--accent)' }}>.</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="text-sm px-3 py-1.5 rounded-lg transition"
              style={{ color: 'var(--text-secondary)' }}
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/register')}
              className="text-sm font-medium px-3 py-1.5 rounded-lg transition"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Sign up free
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-12">
        {/* Tagline */}
        <div className="text-center mb-12">
          <h1 className="font-bold tracking-tight mb-3" style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', lineHeight: 1.1 }}>
            Track every achievement.<br />
            <span style={{ color: 'var(--accent)' }}>Master every game.</span>
          </h1>
          <p className="text-base max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
            Detailed guides and objectives for every trophy and achievement — PSN, Xbox, and Steam.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => navigate('/register')}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl transition"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Get started free
            </button>
            <button
              onClick={() => document.getElementById('catalogue').scrollIntoView({ behavior: 'smooth' })}
              className="text-sm font-medium px-5 py-2.5 rounded-xl transition"
              style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)', color: 'var(--text-secondary)' }}
            >
              Browse catalogue
            </button>
          </div>
        </div>

        {/* Featured game card */}
        {featuredLoading && (
          <div className="rounded-2xl p-6 animate-pulse" style={{ background: 'var(--bg-hero)', border: '0.5px solid var(--border-default)', minHeight: 260 }} />
        )}

        {featuredGame && (
          <div
            className="rounded-2xl overflow-hidden cursor-pointer transition hover:border-[var(--accent-border)]"
            style={{ background: 'var(--bg-hero)', border: '0.5px solid var(--border-default)' }}
            onClick={() => navigate(`/games/${featuredGame.id}`)}
          >
            {/* Game header */}
            <div className="flex items-center gap-4 p-4 sm:p-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              {/* Cover */}
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
                style={{ background: 'var(--bg-card-purple)', border: '0.5px solid var(--accent-border)' }}>
                {featuredGame.cover_image_url ? (
                  <img src={featuredGame.cover_image_url} alt={featuredGame.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Trophy size={24} style={{ color: 'var(--accent)' }} />
                  </div>
                )}
              </div>

              {/* Title + meta */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>
                  🔥 Recently active
                </p>
                <h2 className="font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>
                  {featuredGame.title}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {totalCount} achievements · Browse guide →
                </p>
              </div>

              {/* Ring */}
              <CompletionRing completed={completedCount} total={totalCount} size={72} />
            </div>

            {/* Achievement rows */}
            <div className="p-4 sm:p-6 space-y-2">
              {featuredAchievements.map(a => (
                <AchievementRow key={a.id} achievement={a} />
              ))}
              <div
                className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium rounded-xl transition"
                style={{ color: 'var(--accent)', background: 'var(--bg-card-purple)', border: '0.5px solid var(--accent-border)' }}
              >
                View full guide
                <ChevronRight size={15} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Catalogue grid ───────────────────────────────────────────────────── */}
      <section id="catalogue" className="max-w-5xl mx-auto px-4 pb-20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Browse the catalogue</h2>
          <button
            onClick={() => navigate('/register')}
            className="text-sm px-3 py-1.5 rounded-lg transition"
            style={{ color: 'var(--accent)', background: 'var(--bg-card-purple)', border: '0.5px solid var(--accent-border)' }}
          >
            Track your progress →
          </button>
        </div>

        {catalogueGames.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {catalogueGames.map(game => (
              <CatalogueCard
                key={game.id}
                game={game}
                onClick={() => navigate(`/games/${game.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            Loading catalogue…
          </div>
        )}
      </section>

      {/* ── Footer CTA ───────────────────────────────────────────────────────── */}
      <section className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h2 className="font-bold text-2xl mb-3">Ready to hunt?</h2>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            Create a free account to track your progress, sync PSN, Xbox, and Steam, and never miss a trophy.
          </p>
          <button
            onClick={() => navigate('/register')}
            className="text-sm font-semibold px-6 py-3 rounded-xl transition"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Create free account
          </button>
          <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="underline" style={{ color: 'var(--text-secondary)' }}>
              Sign in
            </button>
          </p>
        </div>
      </section>
    </div>
  )
}
