import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listGameRequests, voteGameRequest, unvoteGameRequest, fulfillGameRequest } from '../api/gameRequests'
import { listGames } from '../api/games'
import { useAuthStore } from '../store/authStore'
import { MessageSquarePlus, ChevronUp, Trophy, CheckCircle2, Search } from 'lucide-react'
import RequestGameModal from '../components/requests/RequestGameModal.jsx'
import { usePageTitle } from '../hooks/usePageTitle'

const PLATFORM_LABELS = {
  psn: 'PSN',
  xbox: 'Xbox',
  steam: 'Steam',
  manual: 'Other',
}

const PLATFORM_STYLES = {
  psn:    { background: 'rgba(96,165,250,0.08)',  color: '#60a5fa', border: '0.5px solid rgba(96,165,250,0.25)'  },
  xbox:   { background: 'rgba(52,211,153,0.08)',  color: '#34d399', border: '0.5px solid rgba(52,211,153,0.25)'  },
  steam:  { background: 'rgba(156,163,175,0.08)', color: '#9ca3af', border: '0.5px solid rgba(156,163,175,0.25)' },
  manual: { background: 'rgba(167,139,250,0.08)', color: '#a78bfa', border: '0.5px solid rgba(167,139,250,0.25)' },
}

function FulfillModal({ request, onClose }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const { data: games = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => listGames().then((r) => r.data),
  })

  const filtered = games.filter((g) =>
    g.title.toLowerCase().includes(search.toLowerCase())
  )

  const mutation = useMutation({
    mutationFn: () => fulfillGameRequest(request.id, selected.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameRequests'] })
      onClose()
    },
  })

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-elevated)',
    border: '0.5px solid var(--border-default)',
    borderRadius: 8,
    padding: '9px 12px',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border-default)' }}
      >
        <h2 className="font-semibold mb-1" style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
          Fulfill request
        </h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          Link "{request.title}" to an existing game in the catalogue.
        </p>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search catalogue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 32 }}
            autoFocus
          />
        </div>

        <div
          className="rounded-xl overflow-y-auto mb-4"
          style={{ maxHeight: 220, border: '0.5px solid var(--border-default)' }}
        >
          {filtered.length === 0 ? (
            <div className="text-center py-8" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No games match
            </div>
          ) : (
            filtered.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelected(g)}
                className="w-full text-left flex items-center gap-3 transition"
                style={{
                  padding: '10px 14px',
                  borderBottom: '0.5px solid var(--border-deep)',
                  background: selected?.id === g.id ? 'var(--bg-elevated)' : 'transparent',
                  color: selected?.id === g.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <Trophy size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.85rem' }}>{g.title}</span>
                {g.platform && (
                  <span
                    className="ml-auto px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ ...(PLATFORM_STYLES[g.platform] || {}), fontSize: '0.65rem' }}
                  >
                    {PLATFORM_LABELS[g.platform] || g.platform}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {mutation.isError && (
          <p style={{ fontSize: '0.75rem', color: '#f87171', marginBottom: 8 }}>
            Something went wrong — please try again.
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl transition"
            style={{
              fontSize: '0.85rem',
              background: 'var(--bg-elevated)',
              border: '0.5px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!selected || mutation.isPending}
            className="flex-1 py-2.5 rounded-xl font-medium transition disabled:opacity-40"
            style={{ fontSize: '0.85rem', background: 'var(--accent)', color: '#fff' }}
          >
            {mutation.isPending ? 'Fulfilling...' : 'Mark fulfilled'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RequestRow({ req, isContributor, onFulfill }) {
  const queryClient = useQueryClient()

  const voteMutation = useMutation({
    mutationFn: () => req.has_voted ? unvoteGameRequest(req.id) : voteGameRequest(req.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gameRequests'] }),
  })

  const platform = req.platform ? PLATFORM_LABELS[req.platform] : null
  const platformStyle = req.platform ? PLATFORM_STYLES[req.platform] : null

  return (
    <div
      className="flex items-center gap-4"
      style={{ padding: '14px 0', borderBottom: '0.5px solid var(--border-deep)' }}
    >
      {/* Vote button */}
      <button
        onClick={() => voteMutation.mutate()}
        disabled={voteMutation.isPending}
        className="flex flex-col items-center gap-0.5 flex-shrink-0 transition disabled:opacity-40"
        style={{
          width: 44,
          padding: '6px 8px',
          borderRadius: 8,
          background: req.has_voted ? 'rgba(167,139,250,0.12)' : 'var(--bg-elevated)',
          border: `0.5px solid ${req.has_voted ? 'var(--accent-border)' : 'var(--border-default)'}`,
          color: req.has_voted ? 'var(--accent)' : 'var(--text-muted)',
        }}
      >
        <ChevronUp size={16} />
        <span style={{ fontSize: '0.7rem', fontWeight: 600, lineHeight: 1 }}>{req.vote_count}</span>
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span style={{ fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {req.title}
          </span>
          {platform && (
            <span
              className="px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ ...platformStyle, fontSize: '0.65rem' }}
            >
              {platform}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {req.requested_by && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              by {req.requested_by.username}
            </span>
          )}
          {req.notes && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {req.notes}
            </span>
          )}
        </div>
      </div>

      {/* Contributor action */}
      {isContributor && (
        <button
          onClick={() => onFulfill(req)}
          className="flex items-center gap-1.5 flex-shrink-0 transition px-3 py-1.5 rounded-lg"
          style={{
            fontSize: '0.75rem',
            background: 'var(--bg-elevated)',
            border: '0.5px solid var(--border-default)',
            color: 'var(--text-muted)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--accent)'
            e.currentTarget.style.borderColor = 'var(--accent-border)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.borderColor = 'var(--border-default)'
          }}
        >
          <CheckCircle2 size={13} />
          Seed
        </button>
      )}
    </div>
  )
}

export default function RequestsPage() {
  usePageTitle('Game Requests')
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => import('../api/auth').then(m => m.getMe()).then(r => r.data),
  })
  const { isGuest } = useAuthStore()
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [fulfillTarget, setFulfillTarget] = useState(null)

  const isContributor = me?.role === 'contributor' || me?.role === 'admin'

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['gameRequests'],
    queryFn: () => listGameRequests().then((r) => r.data),
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold" style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>
            Game requests
          </h1>
          <p className="mt-0.5" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Vote on games you want added — popular requests get seeded first.
          </p>
        </div>
        {!isGuest && (
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <MessageSquarePlus size={15} />
            Request
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading...</span>
        </div>
      )}

      {!isLoading && requests.length === 0 && (
        <div
          className="text-center py-24 rounded-2xl border border-dashed"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <MessageSquarePlus size={36} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h3 className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No requests yet</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Be the first to request a game for the catalogue.
          </p>
          {!isGuest && (
            <button
              onClick={() => setShowRequestModal(true)}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition mx-auto"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <MessageSquarePlus size={15} />
              Request a game
            </button>
          )}
        </div>
      )}

      {!isLoading && requests.length > 0 && (
        <div>
          {isContributor && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4"
              style={{
                background: 'rgba(167,139,250,0.06)',
                border: '0.5px solid var(--accent-border)',
                fontSize: '0.75rem',
                color: 'var(--accent-soft)',
              }}
            >
              <CheckCircle2 size={13} />
              Contributor view — click <strong>Seed</strong> on any request to link it to a game you've added.
            </div>
          )}
          {requests.map((req) => (
            <RequestRow
              key={req.id}
              req={req}
              isContributor={isContributor}
              onFulfill={setFulfillTarget}
            />
          ))}
        </div>
      )}

      {showRequestModal && (
        <RequestGameModal onClose={() => setShowRequestModal(false)} />
      )}

      {fulfillTarget && (
        <FulfillModal
          request={fulfillTarget}
          onClose={() => setFulfillTarget(null)}
        />
      )}
    </div>
  )
}
