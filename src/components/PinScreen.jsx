import { useState } from 'react'
import { useAuth } from '../lib/useAuth'

export default function PinScreen() {
  const { users, loadingUsers, login } = useAuth()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [error, setError] = useState('')

  const selectedUser = users.find(u => u.id === selectedUserId)

  function handleKey(digit) {
    if (pin.length < 6) setPin(p => p + digit)
  }

  function handleBackspace() {
    setPin(p => p.slice(0, -1))
  }

  function handleSubmit() {
    if (!selectedUser || pin.length < 4) return
    if (selectedUser.pin === pin) {
      login(selectedUser)
    } else {
      setShake(true)
      setError('Incorrect PIN')
      setPin('')
      setTimeout(() => setShake(false), 500)
    }
  }

  if (loadingUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f172a)' }}>
        <p className="text-blue-200 text-lg">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f172a)' }}>
      <div className={`bg-white rounded-2xl p-8 w-full max-w-xs shadow-2xl ${shake ? 'animate-shake' : ''}`}>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
            <span className="text-white text-2xl font-bold">H</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Highfield</h1>
          <p className="text-gray-500 text-sm">Contract Planner</p>
        </div>

        {/* Step 1: Select user */}
        <label className="text-sm font-medium text-gray-700 block mb-1">Who are you?</label>
        <select
          value={selectedUserId}
          onChange={e => { setSelectedUserId(e.target.value); setPin(''); setError('') }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4 bg-white"
        >
          <option value="">Select your name...</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        {/* Step 2: Enter PIN (only shown after selecting user) */}
        {selectedUserId && (
          <>
            <label className="text-sm font-medium text-gray-700 block mb-2">Enter your PIN</label>

            {/* PIN dots */}
            <div className="flex justify-center gap-2 mb-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-colors ${i < pin.length ? 'bg-blue-600' : 'bg-gray-200'}`}
                />
              ))}
            </div>

            {error && <p className="text-red-500 text-xs text-center mb-2">{error}</p>}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[1,2,3,4,5,6,7,8,9].map(d => (
                <button
                  key={d}
                  onClick={() => handleKey(String(d))}
                  className="bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-900 text-xl font-semibold py-3.5 rounded-xl transition-colors"
                >
                  {d}
                </button>
              ))}
              <button
                onClick={handleBackspace}
                className="bg-gray-50 hover:bg-gray-100 text-gray-500 text-lg py-3.5 rounded-xl"
              >
                ←
              </button>
              <button
                onClick={() => handleKey('0')}
                className="bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-900 text-xl font-semibold py-3.5 rounded-xl"
              >
                0
              </button>
              <button
                onClick={handleSubmit}
                disabled={pin.length < 4}
                className="text-white text-sm font-semibold py-3.5 rounded-xl disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                style={pin.length >= 4 ? { background: 'linear-gradient(135deg, #2563eb, #1e40af)' } : {}}
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
