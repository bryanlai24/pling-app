import { useEffect } from 'react'

/**
 * Sets the document title. Appends " · Pling" unless the title IS "Pling".
 * Resets to "Pling" on unmount.
 *
 * Usage:
 *   usePageTitle('Your Library')           → "Your Library · Pling"
 *   usePageTitle('Elden Ring')             → "Elden Ring · Pling"
 *   usePageTitle(null)                     → "Pling" (loading state)
 */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Pling` : 'Pling'
    return () => { document.title = 'Pling' }
  }, [title])
}
