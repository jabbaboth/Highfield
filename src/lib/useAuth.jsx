import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)
const SESSION_KEY = 'hf_session'
const CONTRACT_KEY = 'hf_contract_id'
const IDLE_MS = 60 * 1000
const TOUCH_THROTTLE_MS = 60 * 1000

function readStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function readStoredContractId() {
  return sessionStorage.getItem(CONTRACT_KEY) || null
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession)
  const [contractId, setContractIdRaw] = useState(readStoredContractId)
  const [contracts, setContracts] = useState([])
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [bootstrapping, setBootstrapping] = useState(() => !!readStoredSession())
  const lastTouchRef = useRef(0)

  // ─── contracts ───────────────────────────────────────────────────────

  const fetchContracts = useCallback(async () => {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .order('name')
    if (error) console.error('fetchContracts:', error)
    if (data) setContracts(data)
  }, [])

  useEffect(() => { fetchContracts() }, [fetchContracts])

  function selectContract(id) {
    sessionStorage.setItem(CONTRACT_KEY, id)
    setContractIdRaw(id)
  }

  function clearContract() {
    sessionStorage.removeItem(CONTRACT_KEY)
    setContractIdRaw(null)
    setUsers([])
  }

  // ─── users (scoped to selected contract) ─────────────────────────────

  const fetchUsers = useCallback(async () => {
    if (!contractId) { setUsers([]); setLoadingUsers(false); return }
    const { data, error } = await supabase
      .from('users_public')
      .select('*')
      .eq('contract_id', contractId)
      .order('name')
    if (error) console.error('fetchUsers:', error)
    if (data) setUsers(data)
    setLoadingUsers(false)
  }, [contractId])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // ─── session bootstrap ───────────────────────────────────────────────

  useEffect(() => {
    const stored = readStoredSession()
    if (!stored?.token) {
      setBootstrapping(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('whoami', { p_token: stored.token })
      if (cancelled) return
      if (error || !data || data.length === 0) {
        sessionStorage.removeItem(SESSION_KEY)
        setSession(null)
      } else {
        const row = data[0]
        const fresh = {
          token: stored.token,
          id: row.user_id,
          name: row.name,
          role: row.role,
          expires_at: row.expires_at,
        }
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(fresh))
        setSession(fresh)
        if (row.contract_id && !readStoredContractId()) {
          selectContract(row.contract_id)
        }
      }
      setBootstrapping(false)
    })()
    return () => { cancelled = true }
  }, [])

  // ─── expiry polling ──────────────────────────────────────────────────

  useEffect(() => {
    if (!session?.expires_at) return
    const interval = setInterval(() => {
      if (new Date(session.expires_at).getTime() <= Date.now()) {
        sessionStorage.removeItem(SESSION_KEY)
        setSession(null)
      }
    }, IDLE_MS)
    return () => clearInterval(interval)
  }, [session])

  // ─── idle touch ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!session?.token) return
    async function onActivity() {
      const now = Date.now()
      if (now - lastTouchRef.current < TOUCH_THROTTLE_MS) return
      lastTouchRef.current = now
      const { data } = await supabase.rpc('touch_session', { p_token: session.token })
      if (data) {
        setSession(prev => {
          if (!prev) return prev
          const next = { ...prev, expires_at: data }
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
          return next
        })
      }
    }
    window.addEventListener('mousemove', onActivity)
    window.addEventListener('keydown', onActivity)
    window.addEventListener('click', onActivity)
    return () => {
      window.removeEventListener('mousemove', onActivity)
      window.removeEventListener('keydown', onActivity)
      window.removeEventListener('click', onActivity)
    }
  }, [session?.token])

  // ─── login / logout ──────────────────────────────────────────────────

  async function login(userId, pin) {
    const { data, error } = await supabase.rpc('verify_pin', {
      p_user_id: userId,
      p_pin: pin,
    })
    if (error) {
      if (error.message?.includes('locked')) return { ok: false, error: 'locked' }
      console.error('verify_pin:', error)
      return { ok: false, error: 'error' }
    }
    if (!data || data.length === 0) return { ok: false, error: 'wrong' }
    const row = data[0]
    const fresh = {
      token: row.token,
      id: row.user_id,
      name: row.name,
      role: row.role,
      expires_at: row.expires_at,
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(fresh))
    setSession(fresh)
    return { ok: true }
  }

  async function logout() {
    const token = session?.token
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(CONTRACT_KEY)
    setSession(null)
    setContractIdRaw(null)
    if (token) {
      await supabase.rpc('logout', { p_token: token })
    }
  }

  // ─── audit helper ────────────────────────────────────────────────────

  async function auditLog(action, entityType, entityId, payload = {}) {
    if (!contractId) return
    try {
      await supabase.from('audit_log').insert({
        contract_id: contractId,
        actor_id: session?.id || null,
        actor_name: session?.name || null,
        action,
        entity_type: entityType,
        entity_id: entityId ? String(entityId) : null,
        payload,
      })
    } catch (err) {
      console.warn('audit_log insert failed:', err)
    }
  }

  // ─── user management RPCs ────────────────────────────────────────────

  async function addUser(name, pin, role) {
    const { data, error } = await supabase.rpc('create_user', {
      p_token: session?.token, p_name: name, p_pin: pin, p_role: role,
    })
    if (!error) {
      await fetchUsers()
      await auditLog('user.create', 'user', data, { name, role })
    }
    return error
  }

  async function updateUser(id, updates) {
    let error = null
    if (updates.pin) {
      const res = await supabase.rpc('update_user_pin', {
        p_token: session?.token, p_user_id: id, p_new_pin: updates.pin,
      })
      error = res.error
    }
    if (!error && updates.role) {
      const res = await supabase.rpc('update_user_role', {
        p_token: session?.token, p_user_id: id, p_role: updates.role,
      })
      error = res.error
    }
    if (!error) {
      await fetchUsers()
      await auditLog('user.update', 'user', id, {
        pinChanged: !!updates.pin,
        role: updates.role || null,
      })
    }
    return error
  }

  async function removeUser(id) {
    const target = users.find(u => u.id === id)
    const { error } = await supabase.rpc('delete_user', {
      p_token: session?.token, p_user_id: id,
    })
    if (!error) {
      await fetchUsers()
      await auditLog('user.delete', 'user', id, { name: target?.name })
    }
    return error
  }

  // ─── contract creation ───────────────────────────────────────────────

  async function createContract(name) {
    const { data, error } = await supabase.rpc('create_contract', {
      p_token: session?.token, p_name: name,
    })
    if (!error) {
      await fetchContracts()
      await auditLog('contract.create', 'contract', data, { name })
    }
    return { id: data, error }
  }

  // ─── expose context ──────────────────────────────────────────────────

  const user = session ? { id: session.id, name: session.name, role: session.role } : null
  const contractName = contracts.find(c => c.id === contractId)?.name || ''

  return (
    <AuthContext.Provider value={{
      user, users, loadingUsers, bootstrapping,
      contractId, contractName, contracts,
      selectContract, clearContract, createContract,
      login, logout, fetchUsers,
      addUser, updateUser, removeUser, auditLog,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
