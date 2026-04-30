import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('pling_token') || null,

  setAuth: (user, token) => {
    localStorage.setItem('pling_token', token)
    set({ user, token })
  },

  clearAuth: () => {
    localStorage.removeItem('pling_token')
    set({ user: null, token: null })
  },

  setUser: (user) => set({ user }),
}))