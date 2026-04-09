import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'

const allTabs = [
  { to: '/jobs', label: 'Jobs', roles: ['admin', 'foreman'] },
  { to: '/planner', label: 'Planner', roles: ['admin', 'foreman', 'crew'] },
  { to: '/progress', label: 'Progress', roles: ['admin', 'foreman'] },
  { to: '/settings', label: 'Settings', roles: ['admin'] },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const role = user?.role || 'crew'
  const tabs = allTabs.filter(t => t.roles.includes(role))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 shadow-lg" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Highfield Contract Planner</h1>
            <p className="text-blue-100 text-sm">Vegetation Management Tracker</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-white text-sm font-semibold">{user?.name}</p>
              <p className="text-blue-200 text-xs capitalize">{role}</p>
            </div>
            <button
              onClick={logout}
              className="bg-white/15 hover:bg-white/25 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Nav tabs */}
      <nav className="bg-white shadow-sm sticky top-[72px] z-30">
        <div className="flex gap-1 p-2 overflow-x-auto">
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="flex-1 overflow-auto">{children}</main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white text-center text-sm py-6">
        <p className="font-medium">Highfield Contract Planner</p>
        <p className="text-gray-400 mt-1">Last updated: {new Date().toLocaleDateString()}</p>
      </footer>
    </div>
  )
}
