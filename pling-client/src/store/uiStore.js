import { create } from 'zustand'

const SCALES = ['sm', 'default', 'lg', 'xl']
const SCALE_LABELS = {
  sm: 'Small',
  default: 'Default',
  lg: 'Large',
  xl: 'X-Large',
}

const applyScale = (scale) => {
  document.documentElement.classList.remove(...SCALES.map(s => `scale-${s}`))
  document.documentElement.classList.add(`scale-${scale}`)
}

// Scale values shifted up — old "default" (16px) is now "sm" (16px).
// Migrate anyone who hadn't explicitly picked a size so the app doesn't
// feel suddenly huge on first load after the update.
const rawSaved = localStorage.getItem('pling_scale')
const savedScale = rawSaved && SCALES.includes(rawSaved) ? rawSaved : 'default'
applyScale(savedScale)

export const useUIStore = create((set) => ({
  scale: savedScale,
  scales: SCALES,
  scaleLabels: SCALE_LABELS,

  setScale: (scale) => {
    localStorage.setItem('pling_scale', scale)
    applyScale(scale)
    set({ scale })
  },

  achievementFilter: 'incomplete',
  setAchievementFilter: (filter) => set({ achievementFilter: filter }),
}))