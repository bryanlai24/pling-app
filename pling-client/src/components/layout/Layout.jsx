import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { getMe } from '../../api/auth'
import { Trophy, Library, LogOut, User, Shield } from 'lucide-react'

export default function Layout() {
  const { clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then((r) => r.data),
  })

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="min-h-screen text-[#f0ecff]" style={{background:'var(--bg-base)'}}>
      <header className="border-b sticky top-0 z-10 backdrop-blur-sm"
        style={{background:'rgba(0,0,0,0.85)', borderColor:'var(--border-subtle)'}}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <NavLink to="/library" className="text-xl font-bold tracking-tight text-white">
            Pling<span style={{color:'var(--accent)'}}>.</span>
          </NavLink>

          <nav className="flex items-center gap-1">
            {['library', 'profile', me?.role === 'admin' ? 'admin' : null]
              .filter(Boolean)
              .map((path) => (
                path === 'admin' ? (
                  <NavLink key="admin" to="/admin"
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
                        isActive
                          ? 'text-[#f0ecff]'
                          : 'text-[#6b6b8a] hover:text-[#f0ecff]'
                      }`
                    }
                    style={({ isActive }) => isActive ? {background:'var(--bg-elevated)'} : {}}
                  >
                    <Shield size={15} />
                    Admin
                  </NavLink>
                ) : (
                  <NavLink key={path} to={`/${path}`}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition capitalize ${
                        isActive
                          ? 'text-[#f0ecff]'
                          : 'text-[#6b6b8a] hover:text-[#f0ecff]'
                      }`
                    }
                    style={({ isActive }) => isActive ? {background:'var(--bg-elevated)'} : {}}
                  >
                    {path === 'library' ? <Library size={15} /> : <User size={15} />}
                    {path.charAt(0).toUpperCase() + path.slice(1)}
                  </NavLink>
                )
              ))}
          </nav>

          <div className="flex items-center gap-3">
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
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}