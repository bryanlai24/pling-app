import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createAchievement } from '../../api/achievements'
import { X } from 'lucide-react'

const PSN_TROPHY_TYPES = [
  { value: '', label: 'None' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
]

export default function AddAchievementModal({ gameId, platform, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    trophy_type: platform === 'psn' ? 'bronze' : '',
    gamerscore: '',
    rarity: '',
  })
  const [error, setError] = useState(null)

  const mutation = useMutation({
    mutationFn: (data) => createAchievement(data),
    onSuccess,
    onError: (err) => {
      setError(err.response?.data?.detail || 'Failed to add trophy')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)
    const payload = {
      game_id: gameId,
      title: form.title,
    }
    if (form.description) payload.description = form.description
    if (form.rarity) payload.rarity = form.rarity
    if (platform === 'psn' && form.trophy_type) payload.trophy_type = form.trophy_type
    if (platform === 'xbox' && form.gamerscore) payload.gamerscore = parseInt(form.gamerscore)
    mutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Add a trophy</h2>
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
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Trophy name</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              placeholder="e.g. Lie of P"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Description <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition resize-none"
              placeholder="What does this trophy require?"
            />
          </div>

          {/* PSN trophy type */}
          {platform === 'psn' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Trophy type</label>
              <select
                value={form.trophy_type}
                onChange={(e) => setForm({ ...form, trophy_type: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              >
                {PSN_TROPHY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Xbox gamerscore */}
          {platform === 'xbox' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Gamerscore</label>
              <input
                type="number"
                min={0}
                max={1000}
                value={form.gamerscore}
                onChange={(e) => setForm({ ...form, gamerscore: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                placeholder="e.g. 50"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Rarity <span className="text-gray-600">(optional)</span>
            </label>
            <input
              type="text"
              value={form.rarity}
              onChange={(e) => setForm({ ...form, rarity: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              placeholder="e.g. Ultra Rare"
            />
          </div>

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
              className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-2.5 transition"
            >
              {mutation.isPending ? 'Adding...' : 'Add trophy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}