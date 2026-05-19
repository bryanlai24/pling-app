import { useState } from 'react'
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import client from '../../api/client'

const PLACEHOLDER = `Mos Eisley
  Welcome to Mos Eisley! | Stack and Force-lift a droid at the Landing Pad.
  Dome Alone | Climb to the top of a domed building in the northwest.

Jundland Wastes
  Top of the Shop | Reach the rooftop of the desert shop.
  Hot Pursuit | Chase the Kyber Swiper near Jabba's Palace and swat it.

Tatooine Space
  Kyber Brick Comet | Shoot down the comet orbiting Tatooine for 5 Kyber Bricks.`

/**
 * Parse the seed format into a tree:
 *   Non-indented lines = group headers (parent objectives, no method)
 *   Indented lines     = leaf objectives, format: "Title | Method"
 *
 * A non-indented line with a pipe is treated as a flat leaf (no parent).
 * Blank lines are ignored.
 */
function parseInput(text) {
  const lines = text.split('\n')
  const groups = []
  let currentGroup = null

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) continue

    const isIndented = line.startsWith(' ') || line.startsWith('\t')
    const trimmed = line.trim()
    const [title, ...methodParts] = trimmed.split('|')
    const method = methodParts.join('|').trim() || null

    if (isIndented) {
      if (!currentGroup) {
        groups.push({ title: title.trim(), method, children: null })
      } else {
        currentGroup.children.push({ title: title.trim(), method })
      }
    } else {
      currentGroup = { title: title.trim(), method: null, children: [] }
      groups.push(currentGroup)
    }
  }

  return groups
}

export default function SeedObjectivesModal({ achievementId, onClose, onSuccess }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [log, setLog] = useState([])

  const appendLog = (msg, type = 'info') =>
    setLog((prev) => [...prev, { msg, type }])

  const handleSeed = async () => {
    const groups = parseInput(text)
    if (!groups.length) return

    setStatus('running')
    setLog([])

    let parentSortOrder = 0

    for (const group of groups) {
      if (group.children === null) {
        try {
          await client.post(`/objectives/achievement/${achievementId}`, {
            title: group.title,
            method: group.method,
            sort_order: parentSortOrder++,
          })
          appendLog(`✓ ${group.title}`, 'success')
        } catch (e) {
          appendLog(`✗ ${group.title}: ${e.response?.data?.detail || e.message}`, 'error')
        }
        continue
      }

      if (group.children.length === 0) {
        try {
          await client.post(`/objectives/achievement/${achievementId}`, {
            title: group.title,
            method: null,
            sort_order: parentSortOrder++,
          })
          appendLog(`✓ ${group.title} (no children)`, 'success')
        } catch (e) {
          appendLog(`✗ ${group.title}: ${e.response?.data?.detail || e.message}`, 'error')
        }
        continue
      }

      let parentId = null
      try {
        const res = await client.post(`/objectives/achievement/${achievementId}`, {
          title: group.title,
          method: null,
          sort_order: parentSortOrder++,
        })
        parentId = res.data.id
        appendLog(`▸ ${group.title}`, 'info')
      } catch (e) {
        appendLog(`✗ ${group.title}: ${e.response?.data?.detail || e.message}`, 'error')
        continue
      }

      let childSortOrder = 0
      for (const child of group.children) {
        try {
          await client.post(`/objectives/achievement/${achievementId}`, {
            title: child.title,
            method: child.method,
            sort_order: childSortOrder++,
            parent_objective_id: parentId,
          })
          appendLog(`  ✓ ${child.title}`, 'success')
        } catch (e) {
          appendLog(`  ✗ ${child.title}: ${e.response?.data?.detail || e.message}`, 'error')
        }
      }
    }

    const hasErrors = log.some((l) => l.type === 'error')
    setStatus(hasErrors ? 'error' : 'done')
    onSuccess()
  }

  const errorCount = log.filter((l) => l.type === 'error').length
  const successCount = log.filter((l) => l.type === 'success').length

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[90vh]"
        style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border-default)' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-6"
          style={{ borderBottom: '0.5px solid var(--border-subtle)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Seed objectives
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Indented lines = children. Use{' '}
              <span className="font-mono px-1 rounded"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>|</span>{' '}
              to separate title from method.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {status === 'idle' && (
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={16}
              placeholder={PLACEHOLDER}
              className="w-full rounded-xl px-4 py-3 text-sm font-mono focus:outline-none resize-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '0.5px solid var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
          )}

          {status !== 'idle' && (
            <div className="rounded-xl p-4 font-mono text-xs space-y-1 max-h-80 overflow-y-auto"
              style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-subtle)' }}>
              {log.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    color: entry.type === 'success' ? '#34d399'
                         : entry.type === 'error'   ? '#f87171'
                         : 'var(--text-muted)',
                  }}
                >
                  {entry.msg}
                </div>
              ))}
              {status === 'running' && (
                <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <Loader2 size={12} className="animate-spin" />
                  Running…
                </div>
              )}
            </div>
          )}

          {(status === 'done' || status === 'error') && (
            <div className="flex items-center gap-2 text-sm rounded-lg px-4 py-3"
              style={errorCount > 0
                ? { background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.2)', color: '#f87171' }
                : { background: 'rgba(52,211,153,0.08)', border: '0.5px solid rgba(52,211,153,0.2)', color: '#34d399' }
              }>
              {errorCount > 0 ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
              {successCount} seeded{errorCount > 0 ? `, ${errorCount} failed` : ' successfully'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6" style={{ borderTop: '0.5px solid var(--border-subtle)' }}>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition"
            style={{
              background: 'var(--bg-elevated)',
              border: '0.5px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
          >
            {status === 'done' ? 'Close' : 'Cancel'}
          </button>
          {status === 'idle' && (
            <button
              onClick={handleSeed}
              disabled={!text.trim()}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Seed objectives
            </button>
          )}
          {status === 'done' && errorCount > 0 && (
            <button
              onClick={() => { setStatus('idle'); setLog([]) }}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
