/**
 * Discord redirects here after OAuth authorization.
 * This page lives in a popup — it extracts the code from the URL,
 * forwards it to the backend callback endpoint, which does the token
 * exchange and postMessages the result back to the opener.
 */
import { useEffect } from 'react'
import client from '../api/client'

export default function DiscordCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')

    if (error || !code) {
      if (window.opener) {
        window.opener.postMessage(
          { type: 'discord_auth', error: 'Discord sign-in was cancelled or failed' },
          window.location.origin
        )
        window.close()
      }
      return
    }

    // Forward the code to the backend callback endpoint
    client.get(`/auth/discord/callback?code=${encodeURIComponent(code)}`)
      .then(res => {
        // Backend returns an HTML page that does the postMessage itself —
        // inject it into the current popup window so it can run
        document.open()
        document.write(res.data)
        document.close()
      })
      .catch(() => {
        if (window.opener) {
          window.opener.postMessage(
            { type: 'discord_auth', error: 'Discord sign-in failed — please try again' },
            window.location.origin
          )
          window.close()
        }
      })
  }, [])

  return (
    <div style={{
      background: '#0a0a0f',
      color: '#f0ecff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      margin: 0,
      fontFamily: 'sans-serif',
      fontSize: '0.9rem',
    }}>
      <p>Connecting with Discord…</p>
    </div>
  )
}
