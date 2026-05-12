import { useAuth } from '../lib/useAuth'

export default function ContractPicker() {
  const { contracts, selectContract } = useAuth()

  // Auto-skip if only one contract exists
  if (contracts.length === 1) {
    selectContract(contracts[0].id)
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--apple-bg)' }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: '40px 32px',
        width: '100%', maxWidth: 400,
        boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
      }}>
        <div className="text-center" style={{ marginBottom: 32 }}>
          <div
            className="mx-auto flex items-center justify-center"
            style={{
              width: 56, height: 56, borderRadius: 14, marginBottom: 16,
              background: 'var(--apple-blue)', color: 'white',
              fontSize: 24, fontWeight: 700,
            }}
          >
            H
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--apple-text)', letterSpacing: '-0.02em' }}>
            Contract Planner
          </h1>
          <p style={{ fontSize: 14, color: 'var(--apple-secondary)', marginTop: 4 }}>
            Select a contract to continue
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {contracts.map(c => (
            <button
              key={c.id}
              onClick={() => selectContract(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 18px', borderRadius: 12,
                background: 'var(--apple-bg)', border: 'none',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'var(--apple-transition)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#e5e5ea'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--apple-bg)'}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'var(--apple-blue)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, flexShrink: 0,
              }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--apple-text)' }}>
                  {c.name}
                </p>
                <p style={{ fontSize: 12, color: 'var(--apple-tertiary)', marginTop: 1 }}>
                  Created {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
            </button>
          ))}

          {contracts.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--apple-tertiary)', padding: 20 }}>
              Loading contracts...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
