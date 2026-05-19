import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { getMe } from '../../api/auth'
import { Library, LogOut, User, Shield, MessageSquarePlus } from 'lucide-react'

function TopNavLink({ to, icon, label }) {
  return (
    <NavLink to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
          isActive ? 'text-[#f0ecff]' : 'text-[#6b6b8a] hover:text-[#f0ecff]'
        }`
      }
      style={({ isActive }) => isActive ? { background: 'var(--bg-elevated)' } : {}}
    >
      {icon}
      {label}
    </NavLink>
  )
}

function BottomNavLink({ to, icon, label }) {
  return (
    <NavLink to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 px-4 py-2 transition ${
          isActive ? 'text-[#f0ecff]' : 'text-[#6b6b8a]'
        }`
      }
    >
      {icon}
      <span style={{ fontSize: '0.6rem' }}>{label}</span>
    </NavLink>
  )
}

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
    <div className="min-h-screen text-[#f0ecff]" style={{ background: 'var(--bg-base)' }}>

      {/* Top header — always visible */}
      <header className="border-b sticky top-0 z-10 backdrop-blur-sm"
        style={{ background: 'rgba(10,10,18,0.9)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <NavLink to="/library" className="font-bold tracking-tight text-white" style={{ fontSize: '1.1rem' }}>
            Pling<span style={{ color: 'var(--accent)' }}>.</span>
          </NavLink>

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden sm:flex items-center gap-1">
            <TopNavLink to="/library" icon={<Library size={15} />} label="Library" />
            {!isGuest && <TopNavLink to="/requests" icon={<MessageSquarePlus size={15} />} label="Requests" />}
            {!isGuest && <TopNavLink to="/profile" icon={<User size={15} />} label="Profile" />}
            {me?.role === 'admin' && <TopNavLink to="/admin" icon={<Shield size={15} />} label="Admin" />}
          </nav>

          {/* User menu */}
          <div className="flex items-center gap-3">
            {isGuest ? (
              <button
                onClick={() => navigate('/register')}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Sign up free
              </button>
            ) : (
              <>
                <span className="text-sm hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                  {me?.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm transition px-2 py-1.5 rounded-lg"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <LogOut size={15} />
                  <span className="hidden sm:block">Sign out</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content — extra bottom padding on mobile to clear the bottom nav */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-24 sm:pb-8">
        <Outlet />
      </main>

      {/* Bottom nav — mobile only, hidden on sm+ */}
      {!isGuest && (
        <nav
          className="sm:hidden fixed bottom-0 left-0 right-0 z-10 flex items-center justify-around backdrop-blur-sm border-t"
          style={{ background: 'rgba(10,10,18,0.95)', borderColor: 'var(--border-subtle)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <BottomNavLink to="/library" icon={<Library size={20} />} label="Library" />
          <BottomNavLink to="/requests" icon={<MessageSquarePlus size={20} />} label="Requests" />
          <BottomNavLink to="/profile" icon={<User size={20} />} label="Profile" />
          {me?.role === 'admin' && <BottomNavLink to="/admin" icon={<Shield size={20} />} label="Admin" />}
        </nav>
      )}

      {/* Guest bottom nav — just a sign-up prompt */}
      {isGuest && (
        <div
          className="sm:hidden fixed bottom-0 left-0 right-0 z-10 flex items-center justify-center py-3 border-t backdrop-blur-sm"
          style={{ background: 'rgba(10,10,18,0.95)', borderColor: 'var(--border-subtle)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <button
            onClick={() => navigate('/register')}
            className="flex items-center gap-1.5 text-sm font-medium px-5 py-2 rounded-lg transition"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Sign up free
          </button>
        </div>
      )}
    </div>
  )
}
