import { useState } from 'react'
import { supabase, CONTRACT_ID } from '../lib/supabase'

export default function PinScreen({ onSuccess }) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (pin.length < 4) return
    setLoading(true)
    const { data } = await supabase
      .from('contracts')
      .select('pin_hash')
      .eq('id', CONTRACT_ID)
      .single()
    setLoading(false)

    if (data && data.pin_hash === pin) {
      onSuccess()
    } else {
      setShake(true)
      setPin('')
      setTimeout(() => setShake(false), 500)
    }
  }

  function handleKey(digit) {
    if (pin.length < 6) setPin(p => p + digit)
  }

  function handleBackspace() {
    setPin(p => p.slice(0, -1))
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className={`bg-gray-800 rounded-2xl p-8 w-full max-w-xs ${shake ? 'animate-shake' : ''}`}>
        <h1 className="text-white text-xl font-bold text-center mb-2">Highfield Contract Planner</h1>
        <p className="text-gray-400 text-sm text-center mb-6">Enter PIN to continue</p>

        <div className="flex justify-center gap-2 mb-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${i < pin.length ? 'bg-green-400' : 'bg-gray-600'}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1,2,3,4,5,6,7,8,9].map(d => (
            <button
              key={d}
              onClick={() => handleKey(String(d))}
              className="bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold py-4 rounded-xl active:scale-95 transition-transform"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            className="bg-gray-700 hover:bg-gray-600 text-white text-lg py-4 rounded-xl"
          >
            ←
          </button>
          <button
            onClick={() => handleKey('0')}
            className="bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold py-4 rounded-xl"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={pin.length < 4 || loading}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white text-lg font-semibold py-4 rounded-xl"
          >
            {loading ? '...' : 'Go'}
          </button>
        </div>
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
