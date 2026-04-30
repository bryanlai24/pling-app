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

const savedScale = localStorage.getItem('pling_scale') || 'default'
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
}))