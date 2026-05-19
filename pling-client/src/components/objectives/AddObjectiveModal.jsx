import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createObjective } from '../../api/objectives'
import { X } from 'lucide-react'

const inputCls = 'w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none'
const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '0.5px solid var(--border-default)',
  color: 'var(--text-primary)',
}

export default function AddObjectiveModal({
  achievementId,
  nextSortOrder,
  groups = [],
  onClose,
  onSuccess,
}) {
  const [form, setForm] = useState({
    title: '',
    method: '',
    is_counter: false,
    counter_target: '',
    parent_objective_id: '',
  })
  const [error, setError] = useState(null)

  const mutation = useMutation({
    mutationFn: (data) => createObjective(achievementId, data),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to add objective'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)
    const payload = {
      title: form.title,
      sort_order: nextSortOrder,
      is_counter: form.is_counter,
    }
    if (form.method) payload.method = form.method
    if (form.parent_objective_id) payload.parent_objective_id = form.parent_objective_id
    if (form.is_counter && form.counter_target) {
      payload.counter_target = parseInt(form.counter_target)
    }
    mutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border-default)' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Add objective</h2>
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

        {error && (
          <div className="flex items-start gap-2 rounded-lg px-4 py-3 mb-4 text-sm"
            style={{ background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {groups.length > 0 && (
            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Group{' '}
                <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <select
                value={form.parent_objective_id}
                onChange={(e) => setForm({ ...form, parent_objective_id: e.target.value })}
                className={inputCls}
                style={inputStyle}
              >
                <option value="">— No group (top level) —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Objective
            </label>
            <input
              type="text"
              required
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
              style={inputStyle}
              placeholder="e.g. Acquire the Puppet's Saber"
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Method{' '}
              <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <textarea
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              rows={3}
              className={`${inputCls} resize-none`}
              style={inputStyle}
              placeholder="How to accomplish this — where to find it, what to do…"
            />
          </div>

          {/* Counter toggle */}
          <div className="flex items-center gap-3 p-3 rounded-lg"
            style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-subtle)' }}>
            <input
              type="checkbox"
              id="is_counter"
              checked={form.is_counter}
              onChange={(e) => setForm({ ...form, is_counter: e.target.checked, counter_target: '' })}
              className="w-4 h-4 accent-violet-500"
            />
            <label htmlFor="is_counter" className="text-sm cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}>
              This is a counter objective (e.g. kill 1000 enemies)
            </label>
          </div>

          {form.is_counter && (
            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Target count
              </label>
              <input
                type="number"
                required
                min={1}
                value={form.counter_target}
                onChange={(e) => setForm({ ...form, counter_target: e.target.value })}
                className={inputCls}
                style={inputStyle}
                placeholder="e.g. 1000"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition"
              style={{
                background: 'var(--bg-elevated)',
                border: '0.5px solid var(--border-default)',
                color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {mutation.isPending ? 'Adding…' : 'Add objective'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
