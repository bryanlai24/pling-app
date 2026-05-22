import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { updateObjective, deleteObjective, updateObjectiveProgress } from '../../api/objectives'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Pencil, Trash2, X, Check, Plus, Minus, GripVertical } from 'lucide-react'
import { useContributorCheck } from '../../hooks/useContributorCheck'
import { useAuthStore } from '../../store/authStore'
import ContributorPrompt from '../ui/ContributorPrompt'
import GuestTrackingPrompt from '../ui/GuestTrackingPrompt'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
// Lightweight markdown renderer — supports **bold**, *italic*, `code`,
// - bullet lists, 1. numbered lists, and blank-line paragraph breaks.
function MethodMarkdown({ text }) {
  if (!text) return null

  const inlineStyles = (str) => {
    // Split on bold, italic, inline code markers and render spans
    const parts = []
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
    let last = 0, m
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) parts.push(str.slice(last, m.index))
      if (m[0].startsWith('**'))
        parts.push(<strong key={m.index} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{m[2]}</strong>)
      else if (m[0].startsWith('*'))
        parts.push(<em key={m.index} style={{ fontStyle: 'italic' }}>{m[3]}</em>)
      else
        parts.push(<code key={m.index} style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border-default)', borderRadius: 4, padding: '0.1em 0.35em', fontSize: '0.8em', color: 'var(--accent-soft)', fontFamily: 'ui-monospace, monospace' }}>{m[4]}</code>)
      last = m.index + m[0].length
    }
    if (last < str.length) parts.push(str.slice(last))
    return parts
  }

  // Split into blocks by blank lines
  const blocks = text.split(/\n\n+/)
  const elements = []

  blocks.forEach((block, bi) => {
    const lines = block.split('\n')
    const isBullet = lines.every(l => /^[-*]\s/.test(l.trim()) || l.trim() === '')
    const isNumbered = lines.every(l => /^\d+\.\s/.test(l.trim()) || l.trim() === '')

    if (isBullet && lines.some(l => /^[-*]\s/.test(l.trim()))) {
      elements.push(
        <ul key={bi} style={{ margin: '0.4em 0 0.5em 1.2em', padding: 0 }}>
          {lines.filter(l => /^[-*]\s/.test(l.trim())).map((l, i) => (
            <li key={i} style={{ marginBottom: '0.2em' }}>{inlineStyles(l.replace(/^[-*]\s/, ''))}</li>
          ))}
        </ul>
      )
    } else if (isNumbered && lines.some(l => /^\d+\.\s/.test(l.trim()))) {
      elements.push(
        <ol key={bi} style={{ margin: '0.4em 0 0.5em 1.2em', padding: 0 }}>
          {lines.filter(l => /^\d+\.\s/.test(l.trim())).map((l, i) => (
            <li key={i} style={{ marginBottom: '0.2em' }}>{inlineStyles(l.replace(/^\d+\.\s/, ''))}</li>
          ))}
        </ol>
      )
    } else {
      // Paragraph — join lines with spaces, treat single newlines as <br>
      const paraLines = block.split('\n').filter(l => l.trim())
      elements.push(
        <p key={bi} style={{ margin: bi < blocks.length - 1 ? '0 0 0.6em' : 0 }}>
          {paraLines.map((l, i) => (
            <span key={i}>{inlineStyles(l)}{i < paraLines.length - 1 && <br />}</span>
          ))}
        </p>
      )
    }
  })

  return (
    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
      {elements}
    </div>
  )
}

// Parse YouTube timestamp strings like "1m30s", "90", "1h2m3s" → seconds
function parseYouTubeTimestamp(t) {
  if (!t) return null
  // Already a plain number
  if (/^\d+$/.test(t)) return t
  // e.g. 1h2m3s, 1m30s, 45s
  const match = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/)
  if (!match) return null
  const h = parseInt(match[1] || 0)
  const m = parseInt(match[2] || 0)
  const s = parseInt(match[3] || 0)
  const total = h * 3600 + m * 60 + s
  return total > 0 ? String(total) : null
}

function getYouTubeEmbedUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    let videoId = null
    if (u.hostname.includes('youtu.be')) videoId = u.pathname.slice(1)
    else if (u.hostname.includes('youtube.com')) videoId = u.searchParams.get('v')
    if (!videoId) return null
    const rawStart = u.searchParams.get('t') || u.searchParams.get('start')
    const start = parseYouTubeTimestamp(rawStart)
    return `https://www.youtube.com/embed/${videoId}${start ? `?start=${start}` : ''}`
  } catch { return null }
}

// Strip markdown syntax for plain-text snippet preview
function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // bold
    .replace(/\*(.+?)\*/g, '$1')        // italic
    .replace(/`(.+?)`/g, '$1')          // inline code
    .replace(/#{1,6}\s+/g, '')          // headings
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links/images
    .replace(/\n+/g, ' ')              // newlines → space
    .trim()
}

export default function ObjectiveItem({ objective, index, userProgress, onTick, onUpdated, isPending, canReorder = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: objective.id })
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: objective.title,
    method: objective.method || '',
    image_url: objective.image_url || '',
    video_url: objective.video_url || '',
  })
  const [counterValue, setCounterValue] = useState(userProgress?.counter_current ?? 0)
  useEffect(() => { setCounterValue(userProgress?.counter_current ?? 0) }, [userProgress?.counter_current])

  const { showPrompt, setShowPrompt, requireContributor } = useContributorCheck()
  const { isGuest } = useAuthStore()
  const [showGuestPrompt, setShowGuestPrompt] = useState(false)

  const isCompleted = userProgress?.is_completed ?? false
  const isCounter = objective.is_counter
  const counterTarget = objective.counter_target ?? 0
  const hasMethod = !!objective.method
  const hasMedia = !!(objective.image_url || objective.video_url)
  const hasExpandable = hasMethod || hasMedia

  const updateMutation = useMutation({
    mutationFn: (data) => updateObjective(objective.id, data),
    onSuccess: () => { setEditing(false); onUpdated() },
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteObjective(objective.id),
    onSuccess: onUpdated,
  })
  const counterMutation = useMutation({
    mutationFn: (counter_current) => updateObjectiveProgress(objective.id, { counter_current }),
    onSuccess: onUpdated,
  })

  const handleSaveEdit = (e) => {
    e.preventDefault()
    updateMutation.mutate({
      title: editForm.title,
      method: editForm.method || null,
      image_url: editForm.image_url || null,
      video_url: editForm.video_url || null,
    })
  }

  const handleCounterChange = (newValue) => {
    const clamped = Math.max(0, Math.min(newValue, counterTarget))
    setCounterValue(clamped)
    counterMutation.mutate(clamped)
  }

  const handleCounterInput = (e) => {
    const val = parseInt(e.target.value)
    if (!isNaN(val)) setCounterValue(val)
  }

  const handleCounterBlur = () => {
    const clamped = Math.max(0, Math.min(counterValue, counterTarget))
    setCounterValue(clamped)
    counterMutation.mutate(clamped)
  }

  const handleTick = () => {
    if (isGuest) { setShowGuestPrompt(true); return }
    onTick()
  }

  // Flat-row style: bottom border separator, no card bg
  const rowStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    padding: '14px 0',
    borderBottom: '0.5px solid var(--border-deep)',
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-elevated)',
    border: '0.5px solid var(--border-default)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    outline: 'none',
  }

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={dragStyle}>
      {/* Edit form — shown above the row when editing */}
      {editing ? (
        <form onSubmit={handleSaveEdit} style={{ padding: '12px 0', borderBottom: '0.5px solid var(--border-deep)' }} className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Title</label>
            <input type="text" required value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Method</label>
            <textarea value={editForm.method}
              onChange={(e) => setEditForm({ ...editForm, method: e.target.value })}
              rows={5} placeholder="How to accomplish this objective..."
              style={{ ...inputStyle, resize: 'vertical' }} />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Supports markdown: <code style={{ color: 'var(--accent-soft)' }}>**bold**</code>{' '}
              <code style={{ color: 'var(--accent-soft)' }}>*italic*</code>{' '}
              <code style={{ color: 'var(--accent-soft)' }}>- list</code>{' '}
              <code style={{ color: 'var(--accent-soft)' }}>1. numbered</code>
            </p>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Image URL</label>
            <input type="url" value={editForm.image_url}
              onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })}
              placeholder="https://example.com/image.jpg" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>YouTube URL</label>
            <input type="url" value={editForm.video_url}
              onChange={(e) => setEditForm({ ...editForm, video_url: e.target.value })}
              placeholder="https://youtube.com/watch?v=..." style={inputStyle} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition"
              style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              <X size={13} /> Cancel
            </button>
            <button type="submit" disabled={updateMutation.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              <Check size={13} /> {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <div style={rowStyle}>
          {/* Drag handle — contributor only, hidden when filtering */}
          {canReorder && (
            <button
              {...attributes}
              {...listeners}
              className="flex-shrink-0 flex items-center justify-center rounded transition cursor-grab active:cursor-grabbing"
              style={{
                width: 20, height: 20, marginTop: 2,
                color: 'var(--border-default)',
                background: 'none', border: 'none', padding: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-muted)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--border-default)'}
              tabIndex={-1}
            >
              <GripVertical size={14} />
            </button>
          )}

          {/* Checkbox / counter icon */}
          {!isCounter ? (
            <button onClick={handleTick} disabled={isPending}
              className="flex-shrink-0 transition hover:scale-110 mt-0.5">
              {isCompleted
                ? <CheckCircle2 size={22} style={{ color: 'var(--accent)' }} />
                : <Circle size={22} style={{ color: 'var(--border-default)' }} />
              }
            </button>
          ) : (
            <div className="flex-shrink-0 mt-0.5">
              {isCompleted
                ? <CheckCircle2 size={22} style={{ color: 'var(--accent)' }} />
                : (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ border: '0.5px solid var(--border-default)' }}>
                    <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>#</span>
                  </div>
                )
              }
            </div>
          )}

          {/* Body */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <p style={{
              fontSize: '1rem',
              color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: isCompleted ? 'line-through' : 'none',
              margin: 0,
              lineHeight: 1.4,
              fontWeight: 400,
            }}>
              {index !== undefined && (
                <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{index + 1}.</span>
              )}
              {objective.title}
            </p>

            {/* Method snippet — shown inline when not expanded (plain text preview) */}
            {hasMethod && !expanded && !isCompleted && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.55 }}>
                {(() => {
                  const plain = stripMarkdown(objective.method)
                  return plain.length > 120 ? plain.slice(0, 120) + '…' : plain
                })()}
              </p>
            )}

            {/* Counter progress */}
            {isCounter && !isCompleted && (
              <div className="mt-2">
                <div className="flex justify-between mb-1" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  <span>{counterValue.toLocaleString()} / {counterTarget.toLocaleString()}</span>
                  <span>{counterTarget > 0 ? Math.min(Math.round((counterValue / counterTarget) * 100), 100) : 0}%</span>
                </div>
                <div className="rounded" style={{ height: 3, background: 'var(--bg-elevated)' }}>
                  <div className="rounded transition-all" style={{
                    height: 3, background: 'var(--accent)',
                    width: `${counterTarget > 0 ? Math.min((counterValue / counterTarget) * 100, 100) : 0}%`,
                  }} />
                </div>
              </div>
            )}

            {/* Expanded: full method + media */}
            {expanded && !editing && (
              <div className="mt-2 space-y-3">
                {hasMethod && (
                  <div style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: 6, padding: '10px 12px',
                    borderLeft: '2px solid var(--accent-border)',
                  }}>
                    <MethodMarkdown text={objective.method} />
                  </div>
                )}
                {objective.image_url && (
                  <img src={objective.image_url} alt="Guide"
                    className="w-full rounded-lg object-cover max-h-64"
                    style={{ border: '0.5px solid var(--border-subtle)' }} />
                )}
                {objective.video_url && getYouTubeEmbedUrl(objective.video_url) && (
                  <div className="rounded-lg overflow-hidden aspect-video"
                    style={{ border: '0.5px solid var(--border-subtle)' }}>
                    <iframe src={getYouTubeEmbedUrl(objective.video_url)}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen />
                  </div>
                )}
              </div>
            )}

            {/* Counter controls */}
            {isCounter && !isCompleted && (
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => handleCounterChange(counterValue - 1)}
                  disabled={counterValue <= 0 || counterMutation.isPending}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition disabled:opacity-30"
                  style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                  <Minus size={14} />
                </button>
                <input type="number" value={counterValue}
                  onChange={handleCounterInput} onBlur={handleCounterBlur}
                  min={0} max={counterTarget}
                  className="rounded-lg text-center text-sm focus:outline-none"
                  style={{ width: 80, background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)', color: 'var(--text-primary)', padding: '6px 8px' }} />
                <button onClick={() => handleCounterChange(counterValue + 1)}
                  disabled={counterValue >= counterTarget || counterMutation.isPending}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition disabled:opacity-30"
                  style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                  <Plus size={14} />
                </button>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>of {counterTarget.toLocaleString()}</span>
                <button onClick={() => handleCounterChange(counterTarget)}
                  className="ml-auto text-xs transition"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                  Max
                </button>
              </div>
            )}
          </div>

          {/* Right: expand + edit + delete */}
          <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
            {hasExpandable && (
              <button onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded transition"
                style={{ color: expanded ? 'var(--accent)' : 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                onMouseLeave={e => e.currentTarget.style.color = expanded ? 'var(--accent)' : 'var(--text-muted)'}>
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            <button onClick={() => requireContributor(() => { setEditing(true); setExpanded(false) })}
              className="p-1.5 rounded transition"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <Pencil size={13} />
            </button>
            <button onClick={() => requireContributor(() => {
              if (confirm(`Delete "${objective.title}"?`)) deleteMutation.mutate()
            })}
              className="p-1.5 rounded transition"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}

      {showPrompt && (
        <ContributorPrompt onClose={() => setShowPrompt(false)} discordUrl="https://discord.gg/VCKmQ7jftR" />
      )}
      {showGuestPrompt && (
        <GuestTrackingPrompt onClose={() => setShowGuestPrompt(false)} />
      )}
    </div>
  )
}
