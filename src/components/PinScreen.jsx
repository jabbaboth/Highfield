import { useState } from 'react'
import { useAuth } from '../lib/useAuth'

export default function PinScreen() {
  const { users, loadingUsers, login } = useAuth()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedUser = users.find(u => u.id === selectedUserId)

  function handleKey(digit) {
    if (pin.length < 6) setPin(p => p + digit)
  }
  function handleBackspace() {
    setPin(p => p.slice(0, -1))
  }
  async function handleSubmit() {
    if (!selectedUser || pin.length < 4 || submitting) return
    setSubmitting(true)
    setError('')
    const result = await login(selectedUser.id, pin)
    setSubmitting(false)
    if (result.ok) return
    setShake(true)
    setPin('')
    if (result.error === 'locked') {
      setError('Account locked. Try again in 10 minutes.')
    } else if (result.error === 'wrong') {
      setError('Incorrect PIN')
    } else {
      setError('Could not log in. Try again.')
    }
    setTimeout(() => setShake(false), 500)
  }

  if (loadingUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--apple-bg)' }}>
        <p style={{ color: 'var(--apple-secondary)', fontSize: 17 }}>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--apple-bg)' }}>
      <div
        className={shake ? 'animate-shake' : ''}
        style={{
          background: 'white', borderRadius: 20, padding: '40px 32px',
          width: '100%', maxWidth: 360,
          boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        }}
      >
        {/* Logo */}
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
            Highfield
          </h1>
          <p style={{ fontSize: 14, color: 'var(--apple-secondary)', marginTop: 2 }}>
            Contract Planner
          </p>
        </div>

        {/* User select */}
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--apple-secondary)', display: 'block', marginBottom: 6 }}>
          Who are you?
        </label>
        <select
          value={selectedUserId}
          onChange={e => { setSelectedUserId(e.target.value); setPin(''); setError('') }}
          style={{ width: '100%', marginBottom: 20 }}
        >
          <option value="">Select your name...</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        {/* PIN entry */}
        {selectedUserId && (
          <>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--apple-secondary)', display: 'block', marginBottom: 12 }}>
              Enter your PIN
            </label>

            <div className="flex justify-center gap-2" style={{ marginBottom: 16 }}>
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: i < pin.length ? 'var(--apple-blue)' : 'var(--apple-segment-bg)',
                    transition: 'background 0.15s ease',
                  }}
                />
              ))}
            </div>

            {error && (
              <p className="text-center" style={{ fontSize: 13, color: 'var(--apple-red)', marginBottom: 12 }}>{error}</p>
            )}

            <div className="grid grid-cols-3 gap-2" style={{ marginBottom: 8 }}>
              {[1,2,3,4,5,6,7,8,9].map(d => (
                <button
                  key={d}
                  onClick={() => handleKey(String(d))}
                  style={{
                    background: 'var(--apple-bg)', border: 'none', borderRadius: 10,
                    fontSize: 22, fontWeight: 400, color: 'var(--apple-text)',
                    padding: '14px 0', cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseDown={e => e.currentTarget.style.background = '#dddde0'}
                  onMouseUp={e => e.currentTarget.style.background = 'var(--apple-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--apple-bg)'}
                >
                  {d}
                </button>
              ))}
              <button
                onClick={handleBackspace}
                style={{
                  background: 'var(--apple-bg)', border: 'none', borderRadius: 10,
                  fontSize: 18, color: 'var(--apple-secondary)', padding: '14px 0', cursor: 'pointer',
                }}
              >
                ←
              </button>
              <button
                onClick={() => handleKey('0')}
                style={{
                  background: 'var(--apple-bg)', border: 'none', borderRadius: 10,
                  fontSize: 22, fontWeight: 400, color: 'var(--apple-text)', padding: '14px 0', cursor: 'pointer',
                }}
              >
                0
              </button>
              <button
                onClick={handleSubmit}
                disabled={pin.length < 4}
                style={{
                  background: pin.length >= 4 ? 'var(--apple-blue)' : 'var(--apple-segment-bg)',
                  border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 500,
                  color: pin.length >= 4 ? 'white' : 'var(--apple-tertiary)',
                  padding: '14px 0', cursor: pin.length >= 4 ? 'pointer' : 'default',
                  transition: 'var(--apple-transition)',
                }}
              >
                Go
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  )
}
