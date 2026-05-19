import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { getMe } from '../../api/auth'
import { Library, LogOut, User, Shield, MessageSquarePlus } from 'lucide-react'

export default function Layout() {
  const { clearAuth, isGuest } = useAuthStore()
  const navigate = useNavigate()

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then((r) => r.data),
    enabled: !isGuest,
  })

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="min-h-screen text-[#f0ecff]" style={{background:'var(--bg-base)'}}>
      <header className="border-b sticky top-0 z-10 backdrop-blur-sm"
        style={{background:'rgba(10,10,18,0.9)', borderColor:'var(--border-subtle)'}}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <NavLink to="/library" className="font-bold tracking-tight text-white" style={{ fontSize: '1.1rem' }}>
            Pling<span style={{color:'var(--accent)'}}>.</span>
          </NavLink>

          <nav className="flex items-center gap-1">
            <NavLink to="/library"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
                  isActive ? 'text-[#f0ecff]' : 'text-[#6b6b8a] hover:text-[#f0ecff]'
                }`
              }
              style={({ isActive }) => isActive ? {background:'var(--bg-elevated)'} : {}}
            >
              <Library size={15} />
              Library
            </NavLink>

            {!isGuest && (
              <NavLink to="/requests"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
                    isActive ? 'text-[#f0ecff]' : 'text-[#6b6b8a] hover:text-[#f0ecff]'
                  }`
                }
                style={({ isActive }) => isActive ? {background:'var(--bg-elevated)'} : {}}
              >
                <MessageSquarePlus size={15} />
                Requests
              </NavLink>
            )}

            {!isGuest && (
              <NavLink to="/profile"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
                    isActive ? 'text-[#f0ecff]' : 'text-[#6b6b8a] hover:text-[#f0ecff]'
                  }`
                }
                style={({ isActive }) => isActive ? {background:'var(--bg-elevated)'} : {}}
              >
                <User size={15} />
                Profile
              </NavLink>
            )}

            {me?.role === 'admin' && (
              <NavLink to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
                    isActive ? 'text-[#f0ecff]' : 'text-[#6b6b8a] hover:text-[#f0ecff]'
                  }`
                }
                style={({ isActive }) => isActive ? {background:'var(--bg-elevated)'} : {}}
              >
                <Shield size={15} />
                Admin
              </NavLink>
            )}
          </nav>

          {/* User menu */}
          <div className="flex items-center gap-3">
            {isGuest ? (
              <button
                onClick={() => navigate('/register')}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition"
                style={{background:'var(--accent)', color:'#fff'}}
              >
                Sign up free
              </button>
            ) : (
              <>
                <span className="text-sm hidden sm:block" style={{color:'var(--text-muted)'}}>
                  {me?.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm transition px-2 py-1.5 rounded-lg"
                  style={{color:'var(--text-secondary)'}}
                >
                  <LogOut size={15} />
                  <span className="hidden sm:block">Sign out</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}