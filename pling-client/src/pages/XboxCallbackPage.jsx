import { useEffect, useRef } from 'react'

/**
 * Microsoft redirects here after Xbox OAuth sign-in.
 * This page lives in a popup — it reads the code from the URL,
 * calls the backend callback endpoint, then postMessages the result
 * to the opener (ProfilePage) and closes itself.
 */
export default function XboxCallbackPage() {
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')

    if (error) {
      if (window.opener) {
        window.opener.postMessage({ type: 'xbox_error', message: `Microsoft login failed: ${error}` }, window.location.origin)
        window.close()
      }
      return
    }

    // The backend handles the code exchange at /api/users/me/xbox/callback —
    // Microsoft is redirecting directly there, so this page should never
    // actually be reached unless something is misconfigured.
    // Belt-and-suspenders: if we end up here with a code, post an error.
    window.opener?.postMessage(
      { type: 'xbox_error', message: 'Unexpected callback route — check redirect URI config' },
      window.location.origin
    )
    window.close()
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
      <p>Connecting Xbox account…</p>
    </div>
  )
}
