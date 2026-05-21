import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { getMe } from './api/auth'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LandingPage from './pages/LandingPage'
import LibraryPage from './pages/LibraryPage'
import GamePage from './pages/GamePage'
import AchievementPage from './pages/AchievementPage'
import Layout from './components/layout/Layout'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import RequestsPage from './pages/RequestsPage'
import XboxCallbackPage from './pages/XboxCallbackPage'

function ProtectedRoute({ children }) {
  const { token, isGuest } = useAuthStore()
  return (token || isGuest) ? children : <Navigate to="/login" replace />
}

/** Redirects logged-in users to /library; guests see the landing page. */
function HomeRoute() {
  const { token } = useAuthStore()
  return token ? <Navigate to="/library" replace /> : <LandingPage />
}

export default function App() {
  const { token, setUser } = useAuthStore()

  useEffect(() => {
    if (token) {
      getMe().then(r => setUser(r.data)).catch(() => {})
    }
  }, [token])

  return (
    <Routes>
      {/* Public landing — redirects to /library if already logged in */}
      <Route path="/" element={<HomeRoute />} />

      {/* Auth pages */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/xbox/callback" element={<XboxCallbackPage />} />

      {/* Public game + achievement browsing — no auth required */}
      <Route path="/games/:gameId" element={<Layout />}>
        <Route index element={<GamePage />} />
      </Route>
      <Route path="/achievements/:achievementId" element={<Layout />}>
        <Route index element={<AchievementPage />} />
      </Route>

      {/* Authenticated app shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="library" element={<LibraryPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="requests" element={<RequestsPage />} />
      </Route>
    </Routes>
  )
}
