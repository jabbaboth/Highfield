import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import PinScreen from './components/PinScreen'
import Layout from './components/Layout'
import Jobs from './pages/Jobs'
import Planner from './pages/Planner'
import Progress from './pages/Progress'
import Settings from './pages/Settings'

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('hf_authed') === 'true')

  if (!authed) {
    return <PinScreen onSuccess={() => { sessionStorage.setItem('hf_authed', 'true'); setAuthed(true) }} />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/jobs" replace />} />
      </Routes>
    </Layout>
  )
}
