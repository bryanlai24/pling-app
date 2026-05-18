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
  const groups = [] // [{ title, children: [{ title, method }] }]
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
        // Flat leaf with no parent
        groups.push({ title: title.trim(), method, children: null })
      } else {
        currentGroup.children.push({ title: title.trim(), method })
      }
    } else {
      // New group header
      currentGroup = { title: title.trim(), method: null, children: [] }
      groups.push(currentGroup)
    }
  }

  return groups
}

export default function SeedObjectivesModal({ achievementId, onClose, onSuccess }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [log, setLog] = useState([]) // [{ msg, type }] type = info | success | error

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
        // Flat leaf — no parent
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
        // Group header with no children — create as flat leaf
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

      // Create parent
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

      // Create children
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
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Seed objectives</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Indented lines = children. Use <span className="font-mono bg-gray-800 px-1 rounded">|</span> to separate title from method.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition p-1 rounded-lg hover:bg-gray-800"
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
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-violet-500 transition resize-none"
            />
          )}

          {status !== 'idle' && (
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 font-mono text-xs space-y-1 max-h-80 overflow-y-auto">
              {log.map((entry, i) => (
                <div
                  key={i}
                  className={
                    entry.type === 'success' ? 'text-green-400' :
                    entry.type === 'error' ? 'text-red-400' :
                    'text-gray-400'
                  }
                >
                  {entry.msg}
                </div>
              ))}
              {status === 'running' && (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 size={12} className="animate-spin" />
                  Running...
                </div>
              )}
            </div>
          )}

          {(status === 'done' || status === 'error') && (
            <div className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 ${
              errorCount > 0
                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                : 'bg-green-500/10 border border-green-500/30 text-green-400'
            }`}>
              {errorCount > 0
                ? <AlertCircle size={15} />
                : <CheckCircle2 size={15} />
              }
              {successCount} seeded{errorCount > 0 ? `, ${errorCount} failed` : ' successfully'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-800">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg py-2.5 transition"
          >
            {status === 'done' ? 'Close' : 'Cancel'}
          </button>
          {status === 'idle' && (
            <button
              onClick={handleSeed}
              disabled={!text.trim()}
              className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg py-2.5 transition"
            >
              Seed objectives
            </button>
          )}
          {status === 'done' && errorCount > 0 && (
            <button
              onClick={() => { setStatus('idle'); setLog([]) }}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg py-2.5 transition"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
