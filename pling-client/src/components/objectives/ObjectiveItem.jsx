import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { updateObjective, deleteObjective, updateObjectiveProgress } from '../../api/objectives'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Pencil, Trash2, X, Check, Plus, Minus } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useContributorCheck } from '../../hooks/useContributorCheck'
import ContributorPrompt from '../ui/ContributorPrompt'

export default function ObjectiveItem({
  objective,
  index,
  userProgress,
  onTick,
  onUpdated,
  isPending,
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: objective.title,
    method: objective.method || '',
  })
  const [counterValue, setCounterValue] = useState(
    userProgress?.counter_current ?? 0
  )
  useEffect(() => {
    setCounterValue(userProgress?.counter_current ?? 0)
  }, [userProgress?.counter_current])

  const isCompleted = userProgress?.is_completed ?? false
  const isCounter = objective.is_counter
  const counterTarget = objective.counter_target ?? 0
  const counterCurrent = userProgress?.counter_current ?? 0
  const counterPercent = counterTarget > 0
    ? Math.min(Math.round((counterCurrent / counterTarget) * 100), 100)
    : 0

  const updateMutation = useMutation({
    mutationFn: (data) => updateObjective(objective.id, data),
    onSuccess: () => {
      setEditing(false)
      onUpdated()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteObjective(objective.id),
    onSuccess: onUpdated,
  })

  const counterMutation = useMutation({
    mutationFn: (counter_current) =>
      updateObjectiveProgress(objective.id, { counter_current }),
    onSuccess: onUpdated,
  })

  const handleSaveEdit = (e) => {
    e.preventDefault()
    updateMutation.mutate({
      title: editForm.title,
      method: editForm.method || null,
    })
  }

  const handleCounterChange = (newValue) => {
    const clamped = Math.max(0, Math.min(newValue, counterTarget))
    setCounterValue(clamped)
    counterMutation.mutate(clamped)
  }

  const handleCounterInput = (e) => {
    const val = parseInt(e.target.value)
    if (!isNaN(val)) {
      setCounterValue(val)
    }
  }

  const handleCounterBlur = () => {
    const clamped = Math.max(0, Math.min(counterValue, counterTarget))
    setCounterValue(clamped)
    counterMutation.mutate(clamped)
  }

  const { isContributor, showPrompt, setShowPrompt, requireContributor } = useContributorCheck()

  return (
    <div className={`border rounded-xl transition ${
      isCompleted
        ? 'bg-gray-900/50 border-gray-800/50'
        : 'bg-gray-900 border-gray-800'
    }`}>
      {/* Main row */}
      <div className="flex items-center gap-3 p-4">
        {/* Checkbox — only for non-counter objectives */}
        {!isCounter && (
          <button
            onClick={onTick}
            disabled={isPending}
            className="flex-shrink-0 transition hover:scale-110"
          >
            {isCompleted ? (
              <CheckCircle2 size={20} className="text-violet-400" />
            ) : (
              <Circle size={20} className="text-gray-600 hover:text-gray-400" />
            )}
          </button>
        )}

        {/* Counter icon */}
        {isCounter && (
          <div className="flex-shrink-0">
            {isCompleted ? (
              <CheckCircle2 size={20} className="text-violet-400" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-gray-600 flex items-center justify-center">
                <span className="text-gray-600 text-xs font-bold">#</span>
              </div>
            )}
          </div>
        )}

        {/* Title + counter */}
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${
            isCompleted ? 'text-gray-500 line-through' : 'text-white'
          }`}>
            <span className="text-gray-600 mr-2">{index + 1}.</span>
            {objective.title}
          </span>

        {/* Counter progress bar */}
        {isCounter && !isCompleted && (
            <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">
                    {counterValue.toLocaleString()} / {counterTarget.toLocaleString()}
                </span>
                <span className="text-xs text-gray-500">
                    {counterTarget > 0 ? Math.min(Math.round((counterValue / counterTarget) * 100), 100) : 0}%
                </span>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full">
                <div
                    className="h-1.5 bg-violet-500 rounded-full transition-all"
                    style={{ width: `${counterTarget > 0 ? Math.min((counterValue / counterTarget) * 100, 100) : 0}%` }}
                />
                </div>
            </div>
        )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {objective.method && !isCounter && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-gray-500 hover:text-white transition rounded-lg hover:bg-gray-800"
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
          {objective.method && isCounter && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-gray-500 hover:text-white transition rounded-lg hover:bg-gray-800"
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
          {/* Edit */}
          <button
            onClick={() => requireContributor(() => {
              setEditing(!editing)
              setExpanded(false)
            })}
            className="p-1.5 rounded-lg transition"
            style={{ color: 'var(--text-muted)' }}
          >
            <Pencil size={14} />
          </button>
          {/* Delete */}
          <button
            onClick={() => requireContributor(() => {
              if (confirm(`Delete "${objective.title}"?`)) {
                deleteMutation.mutate()
              }
            })}
            className="p-1.5 rounded-lg transition"
            style={{ color: 'var(--text-muted)' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Counter controls */}
      {isCounter && !isCompleted && !editing && (
        <div className="px-4 pb-4 pt-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCounterChange(counterValue - 1)}
              disabled={counterValue <= 0 || counterMutation.isPending}
              className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-30 transition"
            >
              <Minus size={14} />
            </button>

            <input
              type="number"
              value={counterValue}
              onChange={handleCounterInput}
              onBlur={handleCounterBlur}
              min={0}
              max={counterTarget}
              className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none focus:border-violet-500 transition"
            />

            <button
              onClick={() => handleCounterChange(counterValue + 1)}
              disabled={counterValue >= counterTarget || counterMutation.isPending}
              className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-30 transition"
            >
              <Plus size={14} />
            </button>

            <span className="text-gray-600 text-sm">of {counterTarget.toLocaleString()}</span>

            {/* Jump to max button for testing */}
            <button
              onClick={() => handleCounterChange(counterTarget)}
              className="ml-auto text-xs text-gray-600 hover:text-violet-400 transition"
            >
              Max
            </button>
          </div>
        </div>
      )}

      {/* Method expanded */}
      {expanded && objective.method && !editing && (
        <div className="px-4 pb-4 pt-0">
          <div className="bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700/50">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5 font-medium">Method</p>
            <p className="text-sm text-gray-300 leading-relaxed">{objective.method}</p>
          </div>
        </div>
      )}

      {/* No method hint */}
      {!objective.method && !editing && !isCounter && (
        <div className="px-4 pb-3 pt-0">
          <p className="text-xs text-gray-600 italic">No method added yet</p>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <form onSubmit={handleSaveEdit} className="px-4 pb-4 pt-0 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Title</label>
            <input
              type="text"
              required
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Method</label>
            <textarea
              value={editForm.method}
              onChange={(e) => setEditForm({ ...editForm, method: e.target.value })}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition resize-none"
              placeholder="How to accomplish this objective..."
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition"
            >
              <X size={13} /> Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg transition"
            >
              <Check size={13} /> Save
            </button>
          </div>
        </form>
      )}

      {showPrompt && (
        <ContributorPrompt
          onClose={() => setShowPrompt(false)}
          discordUrl="https://discord.gg/VCKmQ7jftR"
        />
      )}
    </div>
  )
}