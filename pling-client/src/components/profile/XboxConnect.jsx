import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Unlink, ExternalLink } from 'lucide-react'
import client from '../../api/client'

const getXboxStatus = () => client.get('/admin/xbox/status').then(r => r.data)
const getXboxAuthUrl = () => client.get('/admin/xbox/auth-url').then(r => r.data)
const submitXboxCode = (code) => client.post('/admin/xbox/auth-callback', { code })

export default function XboxConnect() {
  const queryClient = useQueryClient()
  const [authUrl, setAuthUrl] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [connecting, setConnecting] = useState(false)

  const { data: xboxStatus, refetch } = useQuery({
    queryKey: ['xbox-status'],
    queryFn: getXboxStatus,
  })

  const handleConnect = async () => {
    const res = await getXboxAuthUrl()
    setAuthUrl(res.url)
    window.open(res.url, '_blank')
  }

  const handleSubmitCode = async (e) => {
    e.preventDefault()
    setError(null)
    setConnecting(true)
    try {
      let extractedCode = code
      if (code.includes('code=')) {
        extractedCode = new URL(code).searchParams.get('code') || code
      }
      await submitXboxCode(extractedCode)
      setAuthUrl(null)
      setCode('')
      refetch()
      queryClient.invalidateQueries({ queryKey: ['xbox-status'] })
    } catch (err) {
      setError(err.response?.data?.detail || 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  const isHealthy = xboxStatus?.status === 'healthy' || xboxStatus?.status === 'needs_refresh'

  return (
    <div>
      {isHealthy ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <div>
              <p className="text-white text-sm font-medium">
                {xboxStatus.gamertag || 'Connected'}
              </p>
              <p className="text-xs" style={{color:'var(--text-muted)'}}>
                Refresh token expires: {xboxStatus.refresh_token_expires_at
                  ? new Date(xboxStatus.refresh_token_expires_at).toLocaleDateString()
                  : 'Unknown'}
              </p>
            </div>
          </div>
          <button
            onClick={handleConnect}
            className="flex items-center gap-1.5 text-sm transition px-3 py-1.5 rounded-lg"
            style={{color:'var(--text-secondary)'}}
          >
            <ExternalLink size={14} />
            Re-authenticate
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>
            Connect your Xbox account to enable game imports.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {!authUrl ? (
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition"
              style={{background:'#107c10', color:'#fff'}}
            >
              <Link size={14} />
              Connect Xbox Account
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm" style={{color:'var(--text-secondary)'}}>
                After authorizing in the browser, paste the full redirect URL below:
              </p>
              <form onSubmit={handleSubmitCode} className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste the redirect URL here..."
                  required
                  className="flex-1 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)'
                  }}
                />
                <button
                  type="submit"
                  disabled={connecting || !code}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg flex-shrink-0 transition"
                  style={{background:'#107c10', color:'#fff', opacity: connecting ? 0.7 : 1}}
                >
                  {connecting ? 'Connecting...' : 'Connect'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}