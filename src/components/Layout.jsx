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
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Highfield</h1>
        <nav className="flex gap-1">
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
