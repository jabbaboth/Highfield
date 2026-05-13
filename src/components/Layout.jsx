import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import NotificationBell from './NotificationBell'

const allTabs = [
  { to: '/jobs', label: 'Jobs', roles: ['admin', 'foreman'] },
  { to: '/planner', label: 'Planner', roles: ['admin', 'foreman', 'crew'] },
  { to: '/work-authorities', label: 'WAs', roles: ['admin', 'foreman', 'crew'] },
  { to: '/notifications', label: 'Notifs', roles: ['admin', 'foreman'] },
  { to: '/progress', label: 'Progress', roles: ['admin', 'foreman'] },
  { to: '/settings', label: 'Settings', roles: ['admin'] },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const role = user?.role || 'crew'
  const tabs = allTabs.filter(t => t.roles.includes(role))
  const initials = (user?.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--apple-bg)' }}>
      {/* Frosted glass header */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--apple-separator)',
        }}
      >
        <div className="px-4 py-3 flex items-center justify-between max-w-7xl mx-auto w-full">
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--apple-text)', letterSpacing: '-0.02em' }}>
              Highfield
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--apple-secondary)', fontWeight: 400 }}>
              Contract Planner
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--apple-text)' }}>{user?.name}</p>
              <p style={{ fontSize: '11px', color: 'var(--apple-tertiary)', textTransform: 'capitalize' }}>{role}</p>
            </div>
            {(role === 'admin' || role === 'foreman') && <NotificationBell />}
            {/* Avatar circle */}
            <div
              className="flex items-center justify-center"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--apple-blue)', color: 'white',
                fontSize: '13px', fontWeight: 600,
              }}
            >
              {initials}
            </div>
            <button
              onClick={logout}
              style={{
                background: 'var(--apple-bg)', color: 'var(--apple-secondary)',
                fontSize: '13px', fontWeight: 500,
                padding: '6px 12px', borderRadius: 8, border: 'none',
                cursor: 'pointer', transition: 'var(--apple-transition)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#e5e5ea'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--apple-bg)'}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Segmented control nav */}
        <div className="px-4 pb-3 flex justify-center">
          <div
            className="flex p-1 gap-0.5"
            style={{ background: 'var(--apple-segment-bg)', borderRadius: 10 }}
          >
            {tabs.map(t => (
              <NavLink
                key={t.to}
                to={t.to}
                className="block"
                style={({ isActive }) => ({
                  padding: '7px 18px',
                  borderRadius: 8,
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isActive ? 'var(--apple-text)' : 'var(--apple-secondary)',
                  background: isActive ? 'white' : 'transparent',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'var(--apple-transition)',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                })}
              >
                {t.label}
              </NavLink>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">{children}</main>

      {/* Footer */}
      <footer
        className="text-center py-6"
        style={{ borderTop: '1px solid var(--apple-separator)' }}
      >
        <p style={{ fontSize: '12px', color: 'var(--apple-tertiary)', fontWeight: 500 }}>
          Highfield Contract Planner
        </p>
        <p style={{ fontSize: '11px', color: 'var(--apple-tertiary)', marginTop: 2 }}>
          {new Date().toLocaleDateString()}
        </p>
      </footer>
    </div>
  )
}
