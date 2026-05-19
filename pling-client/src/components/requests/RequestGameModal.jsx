import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createGameRequest } from '../../api/gameRequests'
import { X } from 'lucide-react'

const PLATFORMS = [
  { value: '', label: 'Any platform' },
  { value: 'psn', label: 'PlayStation (PSN)' },
  { value: 'xbox', label: 'Xbox' },
  { value: 'steam', label: 'Steam' },
  { value: 'manual', label: 'Other / Manual' },
]

export default function RequestGameModal({ onClose }) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState('')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () => createGameRequest({
      title: title.trim(),
      platform: platform || null,
      notes: notes.trim() || null,
    }),
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
    padding: '10px 14px',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border-default)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold" style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
              Request a game
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Requests are voted on — popular ones get seeded first.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
          <div>
            <label className="block mb-1.5" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Game title <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Elden Ring"
              style={inputStyle}
              autoFocus
            />
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Platform
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Notes <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific version, DLC, or context..."
              rows={2}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>

          {mutation.isError && (
            <p style={{ fontSize: '0.75rem', color: '#f87171' }}>
              Something went wrong — please try again.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl transition"
              style={{ fontSize: '0.85rem', background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending || !title.trim()}
              className="flex-1 py-2.5 rounded-xl font-medium transition disabled:opacity-50"
              style={{ fontSize: '0.85rem', background: 'var(--accent)', color: '#fff' }}>
              {mutation.isPending ? 'Submitting...' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
