/**
 * useGuestProgress — localStorage-backed achievement tracking for unauthenticated visitors.
 *
 * Schema:
 *   pling_guest_progress = {
 *     gameId: string,
 *     gameTitle: string,
 *     achievements: { [achievementId]: { is_completed: bool, completed_at: string|null } }
 *   }
 *
 * Rules:
 *   - One game at a time.
 *   - First tick on any achievement silently claims that game.
 *   - Attempting to tick an achievement from a different game returns { conflict: true }.
 */

import { useState, useCallback } from 'react'

const STORAGE_KEY = 'pling_guest_progress'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage full or unavailable — fail silently
  }
}

export function useGuestProgress() {
  // Keep a version counter so components re-render when localStorage changes
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion(v => v + 1), [])

  const data = load()
  const claimedGameId = data?.gameId ?? null
  const claimedGameTitle = data?.gameTitle ?? null

  /**
   * Get completion state for a specific game.
   * Returns { [achievementId]: { is_completed, completed_at } }
   */
  const getProgress = useCallback((gameId) => {
    const d = load()
    if (!d || d.gameId !== gameId) return {}
    return d.achievements || {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Toggle an achievement's completion state.
   *
   * Returns:
   *   { success: true, is_completed: bool }  — written OK
   *   { conflict: true }                      — guest already tracking a different game
   */
  const toggleAchievement = useCallback((gameId, gameTitle, achievementId) => {
    const d = load()

    // Conflict: guest has a different game claimed
    if (d && d.gameId && d.gameId !== gameId) {
      return { conflict: true }
    }

    // Build or update the record
    const existing = d?.gameId === gameId ? (d.achievements || {}) : {}
    const current = existing[achievementId] || { is_completed: false, completed_at: null }
    const is_completed = !current.is_completed

    const next = {
      gameId,
      gameTitle,
      achievements: {
        ...existing,
        [achievementId]: {
          is_completed,
          completed_at: is_completed ? new Date().toISOString() : null,
        },
      },
    }

    save(next)
    bump()
    return { success: true, is_completed }
  }, [bump])

  /**
   * Clear all guest progress (e.g. on sign-up to allow migration).
   */
  const clearProgress = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    bump()
  }, [bump])

  return {
    claimedGameId,
    claimedGameTitle,
    getProgress,
    toggleAchievement,
    clearProgress,
    /** Force a re-read (useful after external writes) */
    version,
  }
}
