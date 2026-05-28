import { useCallback, useEffect, useRef } from 'react'
import { getDiscordAuthUrl } from '../api/auth'

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || ''

/**
 * Hook that opens a Discord OAuth popup and resolves with the result
 * postMessaged back from the backend callback page.
 *
 * Usage:
 *   const discordLogin = useDiscordLogin({
 *     onSuccess: (data) => { ... },  // data: { access_token, user } or { username_required, ... } or { merge_pending, ... }
 *     onError: (msg) => { ... },
 *   })
 *   <button onClick={discordLogin}>Continue with Discord</button>
 */
export function useDiscordLogin({ onSuccess, onError }) {
  const popupRef = useRef(null)
  const listenerRef = useRef(null)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        window.removeEventListener('message', listenerRef.current)
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close()
      }
    }
  }, [])

  const openDiscordLogin = useCallback(async () => {
    if (!DISCORD_CLIENT_ID) {
      onError?.('Discord sign-in is not configured')
      return
    }

    // Remove any stale listener
    if (listenerRef.current) {
      window.removeEventListener('message', listenerRef.current)
    }

    let authUrl
    try {
      const res = await getDiscordAuthUrl()
      authUrl = res.data?.auth_url
      if (!authUrl) {
        onError?.(res.data?.error || 'Could not get Discord auth URL')
        return
      }
    } catch (err) {
      onError?.('Could not reach server — please try again')
      return
    }

    // Open a centered popup
    const width = 500
    const height = 700
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2)
    const top = Math.round(window.screenY + (window.outerHeight - height) / 2)
    const popup = window.open(
      authUrl,
      'discord_auth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
    )
    popupRef.current = popup

    if (!popup) {
      onError?.('Popup was blocked — please allow popups for this site and try again')
      return
    }

    // Listen for the postMessage from the backend callback HTML
    const handler = (event) => {
      // Accept messages from the same origin or from the backend (which uses window.opener)
      if (event.data?.type !== 'discord_auth') return

      window.removeEventListener('message', handler)
      listenerRef.current = null

      if (!popupRef.current?.closed) {
        popupRef.current.close()
      }

      const data = event.data
      if (data.error) {
        onError?.(data.error)
      } else {
        onSuccess?.(data)
      }
    }

    listenerRef.current = handler
    window.addEventListener('message', handler)

    // Detect popup closed without completing (user manually closed it)
    const pollClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollClosed)
        if (listenerRef.current) {
          window.removeEventListener('message', listenerRef.current)
          listenerRef.current = null
          // Only fire error if we haven't already handled a message
          onError?.('Discord sign-in was cancelled')
        }
      }
    }, 500)
  }, [onSuccess, onError])

  return { openDiscordLogin, isAvailable: !!DISCORD_CLIENT_ID }
}
