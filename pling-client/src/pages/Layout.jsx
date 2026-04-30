import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}