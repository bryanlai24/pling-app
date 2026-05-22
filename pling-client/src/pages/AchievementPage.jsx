import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAchievement, updateAchievementProgress } from '../api/achievements'
import { updateObjectiveProgress, reorderObjectives } from '../api/objectives'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { ChevronLeft, ChevronDown, ChevronUp, Plus, Trophy, CheckCircle2, Circle, Loader2, Layers, Crown, Search, X } from 'lucide-react'
import { useContributorCheck } from '../hooks/useContributorCheck'
import { useAuthStore } from '../store/authStore'
import { usePageTitle } from '../hooks/usePageTitle'
import { useGuestProgress } from '../hooks/useGuestProgress'
import AddObjectiveModal from '../components/objectives/AddObjectiveModal'
import SeedObjectivesModal from '../components/objectives/SeedObjectivesModal'
import ObjectiveItem from '../components/objectives/ObjectiveItem'
import ContributorPrompt from '../components/ui/ContributorPrompt'
import GuestTrackingPrompt from '../components/ui/GuestTrackingPrompt'
import GuestGameCTA from '../components/ui/GuestGameCTA'

const TROPHY_COLORS = {
  bronze:  { text: '#d97706', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.2)'   },
  silver:  { text: '#9ca3af', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.2)' },
  gold:    { text: '#facc15', bg: 'rgba(250,204,21,0.08)',   border: 'rgba(250,204,21,0.2)'  },
  platinum:{ text: '#c4b5fd', bg: '#a78bfa18',               border: '#a78bfa33'              },
}

const TROPHY_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' }

export default function AchievementPage() {
  const { achievementId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAddObjective, setShowAddObjective] = useState(false)
  const [showSeedObjectives, setShowSeedObjectives] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [filterQuery, setFilterQuery] = useState('')
  const [localObjectives, setLocalObjectives] = useState(null) // optimistic reorder state

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const toggleGroup = (id) => setCollapsedGroups(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const { showPrompt, setShowPrompt, requireContributor } = useContributorCheck()
  const { isGuest, token } = useAuthStore()
  const isPublicView = isGuest || !token
  const [showGuestPrompt, setShowGuestPrompt] = useState(false)
  const [showGameCTA, setShowGameCTA] = useState(false)

  const { toggleAchievement: guestToggle, claimedGameId, claimedGameTitle, getProgress } = useGuestProgress()

  const { data: achievement, isLoading } = useQuery({
    queryKey: ['achievement', achievementId],
    queryFn: () => getAchievement(achievementId).then((r) => r.data),
    staleTime: 0,
  })

  // Keep localObjectives in sync with server data
  useEffect(() => {
    if (achievement?.objectives) setLocalObjectives(achievement.objectives)
  }, [achievement])

  // Auto-collapse groups when all their children are completed
  useEffect(() => {
    if (!achievement?.objectives) return
    const groups = achievement.objectives.filter(o => o.children?.length > 0)
    const fullyDone = groups
      .filter(g => g.children.every(c => c.user_progress?.is_completed))
      .map(g => g.id)
    if (fullyDone.length === 0) return
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      fullyDone.forEach(id => next.add(id))
      return next
    })
  }, [achievement])

  usePageTitle(achievement?.title || null)

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
      if (allCompleted) {
        progressMutation.mutate({ is_completed: true, completed_at: new Date().toISOString() })
      }
    },
  })

  const reorderMutation = useMutation({
    mutationFn: ({ achievementId, orderedIds }) => reorderObjectives(achievementId, orderedIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['achievement', achievementId] }),
    onError: () => {
      // Revert optimistic update on failure
      if (achievement?.objectives) setLocalObjectives(achievement.objectives)
    },
  })

  const handleDragEnd = (event, parentGroupId = null) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setLocalObjectives(prev => {
      if (!prev) return prev
      if (parentGroupId) {
        // Reordering within a group
        return prev.map(obj => {
          if (obj.id !== parentGroupId) return obj
          const oldIdx = obj.children.findIndex(c => c.id === active.id)
          const newIdx = obj.children.findIndex(c => c.id === over.id)
          if (oldIdx === -1 || newIdx === -1) return obj
          const newChildren = arrayMove(obj.children, oldIdx, newIdx)
          reorderMutation.mutate({ achievementId, orderedIds: newChildren.map(c => c.id) })
          return { ...obj, children: newChildren }
        })
      } else {
        // Reordering top-level objectives
        const oldIdx = prev.findIndex(o => o.id === active.id)
        const newIdx = prev.findIndex(o => o.id === over.id)
        if (oldIdx === -1 || newIdx === -1) return prev
        const newOrder = arrayMove(prev, oldIdx, newIdx)
        reorderMutation.mutate({ achievementId, orderedIds: newOrder.map(o => o.id) })
        return newOrder
      }
    })
  }

  const handleTickObjective = (objective, userProgress) => {
    if (isPublicView) { setShowGuestPrompt(true); return }
    const isCurrentlyCompleted = userProgress?.is_completed ?? false
    const newCompleted = !isCurrentlyCompleted
    const leafObjectives = achievement.objectives.flatMap(o =>
      o.children?.length > 0 ? o.children : [o]
    )
    const allCompleted = newCompleted && leafObjectives.every((o) => {
      if (o.id === objective.id) return newCompleted
      return o.user_progress?.is_completed ?? false
    })
    objectiveProgressMutation.mutate({ objectiveId: objective.id, data: { is_completed: newCompleted }, allCompleted })
  }

  const handleToggleAchievement = () => {
    if (!isPublicView) {
      // Authenticated user — write to backend as before
      const isCompleted = achievement?.user_progress?.is_completed ?? false
      progressMutation.mutate({ is_completed: !isCompleted })
      return
    }

    // Public view — write to localStorage
    const gameId = achievement?.game_id
    const gameTitle = achievement?.game_title || claimedGameTitle || 'this game'
    if (!gameId) return

    // Check for game conflict
    const result = guestToggle(gameId, gameTitle, achievementId)
    if (result.conflict) {
      setShowGameCTA(true)
    }
    // success — state re-renders via useGuestProgress version bump
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (!achievement) {
    return <div className="text-center py-24" style={{ color: 'var(--text-muted)' }}>Achievement not found.</div>
  }

  // For public view, read completion from localStorage; for authed, from backend
  const guestAchProgress = isPublicView ? getProgress(achievement.game_id) : {}
  const isCompleted = isPublicView
    ? (guestAchProgress[achievementId]?.is_completed ?? false)
    : (achievement.user_progress?.is_completed ?? false)

  const allObjectives = achievement.objectives.flatMap(o =>
    o.children?.length > 0 ? o.children : [o]
  )
  const completedCount = allObjectives.filter(o => o.user_progress?.is_completed).length
  const totalCount = allObjectives.length
  const allObjectivesDone = totalCount > 0 && completedCount === totalCount
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const trophyColor = achievement.trophy_type ? TROPHY_COLORS[achievement.trophy_type] : null

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm transition mb-6"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <ChevronLeft size={16} />
        Back
      </button>

      {/* Hero — dark panel with always-on radial glow */}
      <div
        className="rounded-2xl mb-2 relative overflow-hidden"
        style={{ background: 'var(--bg-hero)', border: '0.5px solid var(--border-default)' }}
      >
        {/* Radial purple glow — always on */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 240, height: 240,
            background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)',
            top: -60, left: 20,
          }}
        />

        <div className="p-4 sm:p-6 relative" style={{ zIndex: 1 }}>
          <div className="flex items-start gap-4">
            {/* Trophy art — 80×80, purple-tinted bg */}
            <div
              className="flex-shrink-0 rounded-xl flex items-center justify-center overflow-hidden relative"
              style={{
                width: 80, height: 80,
                background: achievement.icon_url ? 'transparent' : 'var(--bg-card-purple)',
                border: '0.5px solid var(--accent-border)',
              }}
            >
              {achievement.icon_url ? (
                <img
                  src={achievement.icon_url}
                  alt={achievement.title}
                  className="w-full h-full object-cover"
                  style={{ opacity: isCompleted ? 1 : 0.45, filter: isCompleted ? 'none' : 'grayscale(1)' }}
                />
              ) : (
                <Trophy size={32} style={{ color: 'var(--accent)' }} />
              )}
              {/* Platinum crown badge */}
              {achievement.trophy_type === 'platinum' && (
                <div
                  className="absolute flex items-center justify-center rounded-full"
                  style={{
                    bottom: -6, right: -6,
                    width: 22, height: 22,
                    background: 'var(--accent)',
                    border: '2px solid var(--bg-hero)',
                  }}
                >
                  <Crown size={11} style={{ color: '#0a0012' }} />
                </div>
              )}
            </div>

            {/* Title / description / badges */}
            <div className="flex-1 min-w-0">
              <h1
                className="font-medium leading-snug mb-1"
                style={{ fontSize: '1rem', color: 'var(--text-primary)' }}
              >
                {achievement.title}
              </h1>
              {achievement.description && (
                <p className="text-sm leading-relaxed mb-2.5" style={{ color: 'var(--text-secondary)' }}>
                  {achievement.description}
                </p>
              )}
              <div className="flex items-center gap-1.5 flex-wrap">
                {trophyColor && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ color: trophyColor.text, background: trophyColor.bg, border: `0.5px solid ${trophyColor.border}` }}
                  >
                    {achievement.trophy_type === 'platinum' && <Crown size={9} className="inline mr-1 -mt-0.5" />}
                    {TROPHY_LABELS[achievement.trophy_type]}
                  </span>
                )}
                {achievement.gamerscore && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '0.5px solid rgba(52,211,153,0.2)' }}
                  >
                    {achievement.gamerscore}G
                  </span>
                )}
                {achievement.rarity && (
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ color: 'var(--text-secondary)', background: 'var(--bg-card-purple)', border: '0.5px solid var(--border-default)' }}
                  >
                    {achievement.rarity}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar (objectives) */}
          {totalCount > 0 && (
            <div className="mt-5">
              <div className="flex justify-between mb-1.5" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                <span>Progress</span>
                <span>{completedCount} / {totalCount} objectives</span>
              </div>
              <div className="rounded" style={{ height: 3, background: '#1c1c2e' }}>
                <div
                  className="rounded transition-all"
                  style={{ width: `${progressPct}%`, height: 3, background: 'var(--accent)' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mark earned / unmark button */}
      <button
        onClick={handleToggleAchievement}
        disabled={!isPublicView && progressMutation.isPending}
        className="w-full text-sm font-medium py-2.5 rounded-xl transition mb-4"
        style={isCompleted
          ? { background: 'var(--accent-dim)', border: '0.5px solid var(--accent-border)', color: 'var(--accent-soft)' }
          : { background: 'var(--accent-dim)', border: '0.5px solid var(--accent-border)', color: 'var(--accent-soft)' }
        }
        onMouseEnter={e => e.currentTarget.style.background = '#a78bfa28'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-dim)'}
      >
        {isCompleted
          ? <><CheckCircle2 size={14} className="inline mr-1.5 -mt-0.5" />Earned</>
          : 'Mark as earned'}
      </button>

      {/* All-done banner (authed only — objectives don't track for guests yet) */}
      {!isPublicView && allObjectivesDone && !isCompleted && (
        <div
          className="rounded-xl p-4 flex items-center justify-between mb-4"
          style={{ background: 'var(--accent-dim)', border: '0.5px solid var(--accent-border)' }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--accent-soft)' }}>All objectives complete!</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(167,139,250,0.5)' }}>Mark the trophy as earned?</p>
          </div>
          <button
            onClick={handleToggleAchievement}
            className="text-sm font-medium px-4 py-2 rounded-lg transition"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Mark earned
          </button>
        </div>
      )}

      {/* Objectives section header */}
      <div className="flex items-center justify-between mb-1 mt-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)', letterSpacing: '0.07em' }}>
            Objectives
          </span>
          {totalCount > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{totalCount}</span>
          )}
        </div>
        {!isPublicView && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => requireContributor(() => setShowSeedObjectives(true))}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition"
              style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)', color: 'var(--text-muted)' }}
            >
              <Layers size={13} />
              Seed
            </button>
            <button
              onClick={() => requireContributor(() => setShowAddObjective(true))}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition"
              style={{ background: 'var(--accent-dim)', border: '0.5px solid var(--accent-border)', color: 'var(--accent-soft)' }}
            >
              <Plus size={13} />
              Add
            </button>
          </div>
        )}
      </div>

      {/* Search/filter — only shown when there are objectives */}
      {totalCount > 0 && (
        <div className="relative mt-2 mb-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            placeholder="Filter objectives…"
            className="w-full text-sm pl-8 pr-8 py-2 rounded-lg focus:outline-none transition"
            style={{
              background: 'var(--bg-elevated)',
              border: '0.5px solid var(--border-default)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
            }}
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {totalCount === 0 && (
        <div
          className="text-center py-24 rounded-2xl border border-dashed mt-4"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div className="mb-4" style={{ color: 'var(--text-muted)', fontSize: 36 }}>📋</div>
          <h3 className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No objectives yet</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Break this trophy down into steps with methods for each
          </p>
          {!isPublicView && (
            <button
              onClick={() => requireContributor(() => setShowAddObjective(true))}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition mx-auto"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Plus size={16} />
              Add first objective
            </button>
          )}
        </div>
      )}

      {/* Objectives list */}
      {totalCount > 0 && localObjectives && (
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, null)}>
          <SortableContext
            items={localObjectives.map(o => o.id)}
            strategy={verticalListSortingStrategy}
          >
            <div>
              {(() => {
                const q = filterQuery.trim().toLowerCase()
                const invalidate = () => queryClient.invalidateQueries({ queryKey: ['achievement', achievementId] })
                const canReorder = !isPublicView && !q

                return localObjectives.map((objective) => {
                  if (objective.children?.length > 0) {
                    const visibleChildren = q
                      ? objective.children.filter(c => c.title.toLowerCase().includes(q))
                      : objective.children
                    if (q && visibleChildren.length === 0) return null

                    const doneCount = objective.children.filter(c => c.user_progress?.is_completed).length
                    const isCollapsed = collapsedGroups.has(objective.id) && !q

                    return (
                      <div key={objective.id}>
                        <button
                          onClick={() => toggleGroup(objective.id)}
                          className="w-full flex items-center justify-between py-3 mt-2 transition"
                          style={{ borderBottom: '0.5px solid var(--border-subtle)' }}
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed
                              ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
                              : <ChevronUp size={13} style={{ color: 'var(--text-muted)' }} />
                            }
                            <span className="text-xs font-medium uppercase"
                              style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                              {objective.title}
                            </span>
                          </div>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {doneCount}/{objective.children.length}
                          </span>
                        </button>
                        {!isCollapsed && (
                          <DndContext sensors={sensors} collisionDetection={closestCenter}
                            onDragEnd={(e) => handleDragEnd(e, objective.id)}>
                            <SortableContext
                              items={visibleChildren.map(c => c.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {visibleChildren.map((child) => (
                                <ObjectiveItem
                                  key={child.id}
                                  objective={child}
                                  userProgress={child.user_progress}
                                  onTick={() => handleTickObjective(child, child.user_progress)}
                                  onUpdated={invalidate}
                                  isPending={objectiveProgressMutation.isPending}
                                  canReorder={canReorder}
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
                        )}
                      </div>
                    )
                  } else {
                    if (q && !objective.title.toLowerCase().includes(q)) return null
                    return (
                      <ObjectiveItem
                        key={objective.id}
                        objective={objective}
                        userProgress={objective.user_progress}
                        onTick={() => handleTickObjective(objective, objective.user_progress)}
                        onUpdated={invalidate}
                        isPending={objectiveProgressMutation.isPending}
                        canReorder={canReorder}
                      />
                    )
                  }
                })
              })()}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Modals */}
      {showSeedObjectives && (
        <SeedObjectivesModal
          achievementId={achievementId}
          onClose={() => setShowSeedObjectives(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['achievement', achievementId] })}
        />
      )}
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
        <ContributorPrompt onClose={() => setShowPrompt(false)} discordUrl="https://discord.gg/VCKmQ7jftR" />
      )}
      {showGuestPrompt && (
        <GuestTrackingPrompt onClose={() => setShowGuestPrompt(false)} />
      )}
      {showGameCTA && (
        <GuestGameCTA
          claimedGameTitle={claimedGameTitle}
          onClose={() => setShowGameCTA(false)}
        />
      )}
    </div>
  )
}
