import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { getMe } from './api/auth'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LibraryPage from './pages/LibraryPage'
import GamePage from './pages/GamePage'
import AchievementPage from './pages/AchievementPage'
import Layout from './components/layout/Layout'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import RequestsPage from './pages/RequestsPage'

function ProtectedRoute({ children }) {
  const { token, isGuest } = useAuthStore()
  return (token || isGuest) ? children : <Navigate to="/login" replace />
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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/library" replace />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="games/:gameId" element={<GamePage />} />
        <Route path="achievements/:achievementId" element={<AchievementPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="requests" element={<RequestsPage />} />
      </Route>
    </Routes>
  )
}