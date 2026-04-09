import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, CONTRACT_ID } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('hf_user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('contract_id', CONTRACT_ID)
      .order('name')
    if (error) console.error('fetchUsers:', error)
    if (data) setUsers(data)
    setLoadingUsers(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  function login(userData) {
    const u = { id: userData.id, name: userData.name, role: userData.role }
    sessionStorage.setItem('hf_user', JSON.stringify(u))
    setUser(u)
  }

  function logout() {
    sessionStorage.removeItem('hf_user')
    setUser(null)
  }

  async function addUser(name, pin, role) {
    const { error } = await supabase.from('users').insert({
      contract_id: CONTRACT_ID, name, pin, role,
    })
    if (!error) await fetchUsers()
    return error
  }

  async function updateUser(id, updates) {
    const { error } = await supabase.from('users').update(updates).eq('id', id)
    if (!error) await fetchUsers()
    return error
  }

  async function removeUser(id) {
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (!error) await fetchUsers()
    return error
  }

  return (
    <AuthContext.Provider value={{ user, users, loadingUsers, login, logout, fetchUsers, addUser, updateUser, removeUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
