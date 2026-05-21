import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('pling_token') || null,
  isGuest: localStorage.getItem('pling_guest') === 'true',

  setAuth: (user, token) => {
    localStorage.setItem('pling_token', token)
    localStorage.removeItem('pling_guest')
    set({ user, token, isGuest: false })
  },

  setGuest: () => {
    localStorage.removeItem('pling_token')
    localStorage.setItem('pling_guest', 'true')
    set({ user: null, token: null, isGuest: true })
  },

  clearAuth: () => {
    localStorage.removeItem('pling_token')
    localStorage.removeItem('pling_guest')
    localStorage.removeItem('pling_guest_progress')
    set({ user: null, token: null, isGuest: false })
  },

  setUser: (user) => set({ user }),
}))