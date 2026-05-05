import { useState } from 'react'
import { useAuthStore } from '../store/authStore'

export function useContributorCheck() {
  const { user } = useAuthStore()
  const [showPrompt, setShowPrompt] = useState(false)

  const isContributor = user?.role === 'contributor' || user?.role === 'admin'

  const requireContributor = (callback) => {
    if (isContributor) {
      callback()
    } else {
      setShowPrompt(true)
    }
  }

  return { isContributor, showPrompt, setShowPrompt, requireContributor }
}