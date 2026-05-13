import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/useAuth'
import PinScreen from './components/PinScreen'
import ContractPicker from './components/ContractPicker'
import Layout from './components/Layout'
import { ContractDataProvider } from './lib/useContractData'
import Jobs from './pages/Jobs'
import Planner from './pages/Planner'
import WorkAuthorities from './pages/WorkAuthorities'
import Progress from './pages/Progress'
import Settings from './pages/Settings'

function RoleRoute({ children, allowed }) {
  const { user } = useAuth()
  const role = user?.role || 'crew'
  if (!allowed.includes(role)) {
    return <Navigate to="/planner" replace />
  }
  return children
}

function AuthedApp() {
  const { user } = useAuth()
  const role = user?.role || 'crew'
  const defaultRoute = role === 'crew' ? '/planner' : '/jobs'

  return (
    <ContractDataProvider>
      <Layout>
        <Routes>
          <Route path="/jobs" element={
            <RoleRoute allowed={['admin', 'foreman']}><Jobs /></RoleRoute>
          } />
          <Route path="/planner" element={<Planner />} />
          <Route path="/work-authorities" element={<WorkAuthorities />} />
          <Route path="/progress" element={
            <RoleRoute allowed={['admin', 'foreman']}><Progress /></RoleRoute>
          } />
          <Route path="/settings" element={
            <RoleRoute allowed={['admin']}><Settings /></RoleRoute>
          } />
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </Routes>
      </Layout>
    </ContractDataProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

function AppInner() {
  const { user, bootstrapping, contractId } = useAuth()
  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--apple-bg)' }}>
        <p style={{ color: 'var(--apple-secondary)', fontSize: 15 }}>Checking session…</p>
      </div>
    )
  }
  if (!contractId) return <ContractPicker />
  if (!user) return <PinScreen />
  return <AuthedApp />
}
