import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAchievement, updateAchievementProgress } from '../api/achievements'
import { updateObjectiveProgress } from '../api/objectives'
import { ChevronLeft, Plus, Trophy, CheckCircle2, Circle, Loader2, UserPlus, Layers } from 'lucide-react'
import { useContributorCheck } from '../hooks/useContributorCheck'
import { useAuthStore } from '../store/authStore'
import AddObjectiveModal from '../components/objectives/AddObjectiveModal'
import SeedObjectivesModal from '../components/objectives/SeedObjectivesModal'
import ObjectiveItem from '../components/objectives/ObjectiveItem'
import ContributorPrompt from '../components/ui/ContributorPrompt'
import GuestTrackingPrompt from '../components/ui/GuestTrackingPrompt'
import { useUIStore } from '../store/uiStore'

const TROPHY_COLORS = {
  bronze: 'text-amber-600 bg-amber-600/10 border-amber-600/20',
  silver: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  gold: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  platinum: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
}

const TROPHY_LABELS = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
}

export default function AchievementPage() {
  const { achievementId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAddObjective, setShowAddObjective] = useState(false)
  const [showSeedObjectives, setShowSeedObjectives] = useState(false)
  const { isContributor, showPrompt, setShowPrompt, requireContributor } = useContributorCheck()
  const { isGuest } = useAuthStore()
  const [showGuestPrompt, setShowGuestPrompt] = useState(false)

  const { data: achievement, isLoading } = useQuery({
    queryKey: ['achievement', achievementId],
    queryFn: () => getAchievement(achievementId).then((r) => r.data),
    staleTime: 0,
  })

  const progressMutation = useMutation({
    mutationFn: (data) => updateAchievementProgress(achievementId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievement', achievementId] })
      queryClient.invalidateQueries({ queryKey: ['achievements'] })
      queryClient.invalidateQueries({ queryKey: ['library'] })
    },
  })

  const objectiveProgressMutation = useMutation({
    mutationFn: ({ objectiveId, data }) => updateObjectiveProgress(objectiveId, data),
    onSuccess: async (_, { allCompleted }) => {
      await queryClient.invalidateQueries({ queryKey: ['achievement', achievementId] })

      // Auto-complete achievement if all objectives done
      if (allCompleted) {
        progressMutation.mutate({
          is_completed: true,
          completed_at: new Date().toISOString(),
        })
      }
    },
  })

  const handleTickObjective = (objective, userProgress) => {
    if (isGuest) {
      setShowGuestPrompt(true)
      return
    }

    const isCurrentlyCompleted = userProgress?.is_completed ?? false
    const newCompleted = !isCurrentlyCompleted

    // Calculate if all leaf objectives will be complete after this tick
    const leafObjectives = achievement.objectives.flatMap(o =>
      o.children?.length > 0 ? o.children : [o]
    )
    const allCompleted = newCompleted && leafObjectives.every((o) => {
      if (o.id === objective.id) return newCompleted
      return o.user_progress?.is_completed ?? false
    })

    objectiveProgressMutation.mutate({
      objectiveId: objective.id,
      data: { is_completed: newCompleted },
      allCompleted,
    })
  }

  const handleToggleAchievement = () => {
    if (isGuest) {
      setShowGuestPrompt(true)
      return
    }
    const isCompleted = achievement?.user_progress?.is_completed ?? false
    progressMutation.mutate({ is_completed: !isCompleted })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="text-gray-500 animate-spin" />
      </div>
    )
  }

  if (!achievement) {
    return (
      <div className="text-center py-24 text-gray-500">Achievement not found.</div>
    )
  }

  const isCompleted = achievement.user_progress?.is_completed ?? false
  const allObjectives = achievement.objectives.flatMap(o =>
    o.children?.length > 0 ? o.children : [o]
  )
  const completedCount = allObjectives.filter(o => o.user_progress?.is_completed).length
  const totalCount = allObjectives.length
  const allObjectivesDone = totalCount > 0 && completedCount === totalCount

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition mb-6"
      >
        <ChevronLeft size={16} />
        Back
      </button>

      {/* Achievement header */}
      <div className={`bg-gray-900 border rounded-2xl p-6 mb-6 transition ${
        isCompleted ? 'border-violet-500/30' : 'border-gray-800'
      }`}>
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${
          !achievement.icon_url && (isCompleted ? 'bg-violet-500/20' : 'bg-gray-800')
          }`}>
          {achievement.icon_url ? (
              <img
              src={achievement.icon_url}
              alt={achievement.title}
              className={`w-full h-full object-cover transition ${
                  isCompleted ? 'opacity-100' : 'opacity-50 grayscale'
              }`}
              />
          ) : (
              <Trophy size={22} className={isCompleted ? 'text-violet-400' : 'text-gray-600'} />
          )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className={`text-xl font-bold ${isCompleted ? 'text-gray-400' : 'text-white'}`}>
                  {achievement.title}
                </h1>
                {achievement.description && (
                  <p className="text-gray-500 text-sm mt-1">{achievement.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {achievement.trophy_type && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${TROPHY_COLORS[achievement.trophy_type]}`}>
                      {TROPHY_LABELS[achievement.trophy_type]}
                    </span>
                  )}
                  {achievement.gamerscore && (
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-green-500/10 text-green-400 border-green-500/20">
                      {achievement.gamerscore}G
                    </span>
                  )}
                  {achievement.rarity && (
                    <span className="text-xs text-gray-500">{achievement.rarity}</span>
                  )}
                </div>
              </div>

              {/* Complete toggle */}
              {isGuest ? (
                <button
                  onClick={() => setShowGuestPrompt(true)}
                  className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition flex-shrink-0"
                  style={{
                    background:'var(--bg-elevated)',
                    borderColor:'var(--border-subtle)',
                    color:'var(--text-muted)'
                  }}
                >
                  <UserPlus size={15} />
                  Sign up to track
                </button>
              ) : (
                <button
                  onClick={handleToggleAchievement}
                  disabled={progressMutation.isPending}
                  className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition flex-shrink-0 ${
                    isCompleted
                      ? 'bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                  }`}
                >
                  {isCompleted ? (
                    <><CheckCircle2 size={15} /> Earned</>
                  ) : (
                    <><Circle size={15} /> Mark earned</>
                  )}
                </button>
              )}
            </div>

            {/* Objectives progress bar */}
            {totalCount > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500">
                    {completedCount} / {totalCount} objectives
                  </span>
                  <span className="text-xs font-medium text-white">
                    {Math.round((completedCount / totalCount) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full">
                  <div
                    className="h-1.5 bg-violet-500 rounded-full transition-all"
                    style={{ width: `${(completedCount / totalCount) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Objectives section */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">Objectives</h2>
          {totalCount > 0 && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
              {totalCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => requireContributor(() => setShowSeedObjectives(true))}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <Layers size={15} />
            Seed
          </button>
          <button
            onClick={() => requireContributor(() => setShowAddObjective(true))}
            className="flex items-center gap-1.5 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
          >
            <Plus size={15} />
            Add
          </button>
        </div>
      </div>

      {/* Empty state */}
      {totalCount === 0 && (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <div className="text-gray-700 text-4xl mb-4">📋</div>
          <h3 className="text-white font-medium mb-1">No objectives yet</h3>
          <p className="text-gray-500 text-sm mb-6">
            Break this trophy down into steps with methods for each
          </p>
          <button
            onClick={() => requireContributor(() => setShowAddObjective(true))}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition mx-auto"
          >
            <Plus size={16} />
            Add first objective
          </button>
        </div>
      )}

      {/* Objectives list */}
      {totalCount > 0 && (
        <div className="space-y-2">
          {achievement.objectives.map((objective) => (
            objective.children?.length > 0 ? (
              <div key={objective.id}>
                {/* Group header */}
                <div className="flex items-center gap-3 mb-2 mt-4">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    {objective.title}
                  </h3>
                  <div className="flex-1 h-px bg-gray-800" />
                  <span className="text-xs text-gray-500">
                    {objective.children.filter(c => c.user_progress?.is_completed).length}/{objective.children.length}
                  </span>
                </div>
                {/* Child steps */}
                {objective.children.map((child) => (
                  <ObjectiveItem
                    key={child.id}
                    objective={child}
                    userProgress={child.user_progress}
                    onTick={() => handleTickObjective(child, child.user_progress)}
                    onUpdated={() => queryClient.invalidateQueries({ queryKey: ['achievement', achievementId] })}
                    isPending={objectiveProgressMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <ObjectiveItem
                key={objective.id}
                objective={objective}
                userProgress={objective.user_progress}
                onTick={() => handleTickObjective(objective, objective.user_progress)}
                onUpdated={() => queryClient.invalidateQueries({ queryKey: ['achievement', achievementId] })}
                isPending={objectiveProgressMutation.isPending}
              />
            )
          ))}
        </div>
      )}

      {/* All done banner */}
      {allObjectivesDone && !isCompleted && (
        <div className="mt-6 bg-violet-500/10 border border-violet-500/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-violet-300 font-medium text-sm">All objectives complete!</p>
            <p className="text-violet-400/60 text-xs mt-0.5">Mark the trophy as earned?</p>
          </div>
          <button
            onClick={handleToggleAchievement}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            Mark earned
          </button>
        </div>
      )}

      {/* Seed objectives modal */}
      {showSeedObjectives && (
        <SeedObjectivesModal
          achievementId={achievementId}
          onClose={() => setShowSeedObjectives(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['achievement', achievementId] })
          }}
        />
      )}

      {/* Add objective modal */}
      {showAddObjective && (
        <AddObjectiveModal
          achievementId={achievementId}
          nextSortOrder={totalCount}
          groups={achievement.objectives.filter(o => o.children?.length > 0)}
          onClose={() => setShowAddObjective(false)}
          onSuccess={() => {
            setShowAddObjective(false)
            queryClient.invalidateQueries({ queryKey: ['achievement', achievementId] })
          }}
        />
      )}

      {showPrompt && (
        <ContributorPrompt
          onClose={() => setShowPrompt(false)}
          discordUrl="https://discord.gg/VCKmQ7jftR"
        />
      )}

      {showGuestPrompt && (
        <GuestTrackingPrompt onClose={() => setShowGuestPrompt(false)} />
      )}
    </div>
  )
}