import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createObjective } from '../../api/objectives'
import { X } from 'lucide-react'

export default function AddObjectiveModal({
  achievementId,
  nextSortOrder,
  groups = [], // parent objectives with children — for the parent selector
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
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Add objective</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition p-1 rounded-lg hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {groups.length > 0 && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Group <span className="text-gray-600">(optional)</span>
              </label>
              <select
                value={form.parent_objective_id}
                onChange={(e) => setForm({ ...form, parent_objective_id: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition"
              >
                <option value="">— No group (top level) —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Objective</label>
            <input
              type="text"
              required
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              placeholder="e.g. Acquire the Puppet's Saber"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Method <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition resize-none"
              placeholder="How to accomplish this — where to find it, what to do..."
            />
          </div>

          {/* Counter toggle */}
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <input
              type="checkbox"
              id="is_counter"
              checked={form.is_counter}
              onChange={(e) => setForm({ ...form, is_counter: e.target.checked, counter_target: '' })}
              className="w-4 h-4 accent-violet-500"
            />
            <label htmlFor="is_counter" className="text-sm text-gray-300 cursor-pointer">
              This is a counter objective (e.g. kill 1000 enemies)
            </label>
          </div>

          {form.is_counter && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Target count</label>
              <input
                type="number"
                required
                min={1}
                value={form.counter_target}
                onChange={(e) => setForm({ ...form, counter_target: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
                placeholder="e.g. 1000"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg py-2.5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2.5 transition"
            >
              {mutation.isPending ? 'Adding...' : 'Add objective'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}