import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/jobs', label: 'Jobs' },
  { to: '/planner', label: 'Planner' },
  { to: '/progress', label: 'Progress' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 shadow-lg" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-white">Highfield Contract Planner</h1>
          <p className="text-blue-100 text-sm">Vegetation Management Tracker</p>
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
