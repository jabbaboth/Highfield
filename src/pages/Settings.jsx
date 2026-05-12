import { useState, useMemo, useRef, useEffect } from 'react'
import { useContractData } from '../lib/useContractData'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import { crewColor, feederStyle } from '../lib/feeder'

function Section({ title, subtitle, children }) {
  return (
    <section style={{ background: 'white', borderRadius: 'var(--apple-radius-lg)', boxShadow: 'var(--apple-shadow)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--apple-separator)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--apple-text)' }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 12, color: 'var(--apple-secondary)', marginTop: 2 }}>{subtitle}</p>}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ background: 'var(--apple-bg)', borderRadius: 10, padding: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, color: 'var(--apple-text)', marginTop: 2 }}>{value}</p>
    </div>
  )
}

export default function Settings() {
  const { jobs, assignments, completions, completionsByJob, crews, addCrew, removeCrew, importJobs, loading } = useContractData()
  const { users, addUser, updateUser, removeUser, contractId, contractName, createContract } = useAuth()
  const [newCrew, setNewCrew] = useState('')
  const [newCrewType, setNewCrewType] = useState('hs')
  const [newCrewEwpSize, setNewCrewEwpSize] = useState('')
  const [importStatus, setImportStatus] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  const [newUserName, setNewUserName] = useState('')
  const [newUserPin, setNewUserPin] = useState('')
  const [newUserRole, setNewUserRole] = useState('crew')
  const [editingUser, setEditingUser] = useState(null)
  const [editPin, setEditPin] = useState('')
  const [editRole, setEditRole] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [auditEntries, setAuditEntries] = useState([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [newContractName, setNewContractName] = useState('')
  const [contractStatus, setContractStatus] = useState(null)

  async function fetchAudit() {
    setAuditLoading(true)
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) console.error('fetchAudit:', error)
    setAuditEntries(data || [])
    setAuditLoading(false)
  }

  useEffect(() => { fetchAudit() }, [users, crews, jobs])

  const stats = useMemo(() => {
    const totalSpans = jobs.reduce((s, j) => s + (parseFloat(j.spans) || 0), 0)
    const totalHs = jobs.reduce((s, j) => s + (parseFloat(j.hs_hrs) || 0), 0)
    const totalEwp = jobs.reduce((s, j) => s + (parseFloat(j.ewp_hrs) || 0), 0)
    const totalCleanup = jobs.reduce((s, j) => s + (parseFloat(j.cleanup_hrs) || 0), 0)
    const withTm = jobs.filter(j => j.tm_type).length
    return { total: jobs.length, totalSpans, totalHs, totalEwp, totalCleanup, withTm }
  }, [jobs])

  const jobMap = useMemo(() => { const m = {}; jobs.forEach(j => { m[String(j.job_id)] = j }); return m }, [jobs])

  const recentActivity = useMemo(() => {
    return [...completions].sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || '')).slice(0, 50)
  }, [completions])

  async function handleAddCrew(e) {
    e.preventDefault(); if (!newCrew.trim()) return
    await addCrew(newCrew.trim(), newCrewType || null, newCrewType === 'ewp' ? (newCrewEwpSize || null) : null)
    setNewCrew(''); setNewCrewType('hs'); setNewCrewEwpSize('')
  }
  async function handleAddUser(e) {
    e.preventDefault(); if (!newUserName.trim() || !newUserPin.trim()) return
    await addUser(newUserName.trim(), newUserPin.trim(), newUserRole)
    setNewUserName(''); setNewUserPin(''); setNewUserRole('crew')
  }
  async function handleSaveEdit() {
    if (!editingUser) return
    const updates = {}; if (editPin) updates.pin = editPin; if (editRole) updates.role = editRole
    await updateUser(editingUser.id, updates); setEditingUser(null); setEditPin(''); setEditRole('')
  }
  async function handleRemoveUser(id) { await removeUser(id); setConfirmRemove(null) }

  function exportCSV() {
    let csv = 'Type,Job ID,Phase,Crew,Date,Completed At,Completed By,Notes\n'
    assignments.forEach(a => {
      const jid = String(a.job_id); const phase = a.phase || 'main'
      const comp = completionsByJob[jid]?.[phase]
      csv += `assignment,${a.job_id},${phase},${a.crew_name},${a.planned_date},${comp?.completed_at || ''},${comp?.completed_by_name || ''},${(comp?.notes || '').replace(/,/g, ';')}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `highfield-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true); setImportStatus(null)
    try {
      const text = await file.text(); const data = JSON.parse(text)
      if (!Array.isArray(data)) throw new Error('JSON must be an array of jobs')
      const errors = await importJobs(data)
      setImportStatus(errors ? { ok: false, msg: `Imported with ${errors.length} errors` } : { ok: true, msg: `Imported ${data.length} jobs successfully` })
    } catch (err) { setImportStatus({ ok: false, msg: err.message }) }
    setImporting(false); if (fileRef.current) fileRef.current.value = ''
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--apple-secondary)' }}>Loading...</div>

  const btnPrimary = { background: 'var(--apple-blue)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'var(--apple-transition)' }
  const btnSecondary = { background: 'var(--apple-bg)', color: 'var(--apple-text)', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
  const btnDanger = { background: '#fff0f0', color: 'var(--apple-red)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }} className="space-y-5">
      {/* Contract Management */}
      <Section title="Contracts" subtitle={`Current: ${contractName}`}>
        <form onSubmit={async (e) => {
          e.preventDefault()
          if (!newContractName.trim()) return
          setContractStatus(null)
          const { id, error } = await createContract(newContractName.trim())
          if (error) {
            setContractStatus({ ok: false, msg: error.message || 'Failed to create contract' })
          } else {
            setContractStatus({ ok: true, msg: `Created "${newContractName.trim()}". Log out and select it to start working in it.` })
            setNewContractName('')
          }
        }} className="flex gap-2">
          <input
            value={newContractName}
            onChange={e => setNewContractName(e.target.value)}
            placeholder="New contract name"
            style={{ flex: 1 }}
          />
          <button type="submit" style={btnPrimary}>Create Contract</button>
        </form>
        {contractStatus && (
          <p style={{ fontSize: 13, marginTop: 8, color: contractStatus.ok ? 'var(--apple-green)' : 'var(--apple-red)' }}>
            {contractStatus.msg}
          </p>
        )}
      </Section>

      {/* Crew Profiles */}
      <Section title="Crew Profiles" subtitle="Set crew type and EWP size for the AI scheduler">
        <div className="space-y-2">
          {crews.map(c => {
            const color = crewColor(crews, c.name)
            return (
              <div key={c.name} className="flex items-center gap-3" style={{ padding: '10px 14px', background: 'var(--apple-bg)', borderRadius: 10, borderLeft: `3px solid ${color}` }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--apple-text)', flex: 1, minWidth: 80 }}>{c.name}</span>
                <select
                  value={c.crew_type || ''}
                  onChange={async (e) => {
                    const val = e.target.value || null
                    await supabase.from('crews').update({ crew_type: val, ewp_size: val !== 'ewp' ? null : c.ewp_size }).eq('contract_id', contractId).eq('name', c.name)
                  }}
                  style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6 }}
                >
                  <option value="">Type…</option>
                  <option value="hs">H&S</option>
                  <option value="ewp">EWP</option>
                  <option value="chip">Chip</option>
                </select>
                {c.crew_type === 'ewp' && (
                  <select
                    value={c.ewp_size || ''}
                    onChange={async (e) => {
                      await supabase.from('crews').update({ ewp_size: e.target.value || null }).eq('contract_id', contractId).eq('name', c.name)
                    }}
                    style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6 }}
                  >
                    <option value="">Size…</option>
                    <option value="30m">30m</option>
                    <option value="36m">36m</option>
                    <option value="316">316</option>
                    <option value="317">317</option>
                    <option value="322">322</option>
                    <option value="323">323</option>
                  </select>
                )}
              </div>
            )
          })}
          {crews.length === 0 && <p style={{ fontSize: 13, color: 'var(--apple-tertiary)', textAlign: 'center', padding: 8 }}>Add crews below first</p>}
        </div>
      </Section>

      {/* User Management */}
      <Section title="User Management" subtitle="Manage logins and roles">
        <div className="space-y-2" style={{ marginBottom: 16 }}>
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between" style={{ padding: '10px 14px', background: 'var(--apple-bg)', borderRadius: 10 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--apple-text)' }}>{u.name}</span>
                <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: '#e8f4fd', color: '#0071e3', textTransform: 'uppercase' }}>{u.role}</span>
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--apple-tertiary)', fontFamily: 'monospace', letterSpacing: 2 }}>••••</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingUser(u); setEditPin(''); setEditRole(u.role) }}
                  style={{ ...btnSecondary, fontSize: 12, padding: '4px 10px' }}>Edit</button>
                <button onClick={() => setConfirmRemove(u.id)} style={{ ...btnDanger, padding: '4px 10px' }}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        {confirmRemove && (
          <div style={{ background: '#fff0f0', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--apple-red)' }}>Remove this user? This cannot be undone.</p>
            <div className="flex gap-2" style={{ marginTop: 8 }}>
              <button onClick={() => handleRemoveUser(confirmRemove)} style={{ ...btnDanger, background: 'var(--apple-red)', color: 'white' }}>Yes, Remove</button>
              <button onClick={() => setConfirmRemove(null)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        )}

        {editingUser && (
          <div style={{ background: '#e8f4fd', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#0071e3', marginBottom: 8 }}>Editing: {editingUser.name}</p>
            <div className="flex flex-wrap gap-2">
              <input type="password" inputMode="numeric" autoComplete="new-password" value={editPin} onChange={e => setEditPin(e.target.value)} placeholder="New PIN (blank to keep)" style={{ flex: 1 }} />
              <select value={editRole} onChange={e => setEditRole(e.target.value)}>
                <option value="admin">Admin</option>
                <option value="foreman">Foreman</option>
                <option value="crew">Crew</option>
              </select>
              <button onClick={handleSaveEdit} style={btnPrimary}>Save</button>
              <button onClick={() => setEditingUser(null)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        )}

        <form onSubmit={handleAddUser} className="flex flex-wrap gap-2">
          <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Name" style={{ flex: 1, minWidth: 100 }} />
          <input type="password" inputMode="numeric" autoComplete="new-password" value={newUserPin} onChange={e => setNewUserPin(e.target.value)} placeholder="PIN" style={{ width: 80 }} />
          <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
            <option value="crew">Crew</option>
            <option value="foreman">Foreman</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" style={btnPrimary}>Add User</button>
        </form>
      </Section>

      {/* Recent Activity */}
      <Section title="Recent Activity" subtitle="Last 50 completions">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--apple-separator)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 500, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date/Time</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 500, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Job</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 500, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Completed By</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 500, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Feeder</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((c, i) => {
                const job = jobMap[String(c.job_id)]
                const fs = job ? feederStyle(job.feeder) : null
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--apple-separator)' }}>
                    <td style={{ padding: '8px 10px', color: 'var(--apple-secondary)', whiteSpace: 'nowrap' }}>
                      {c.completed_at ? new Date(c.completed_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--apple-text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job?.full_address || `Job #${c.job_id}`}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--apple-text)' }}>
                      {c.completed_by_name || '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {fs && <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: fs.border + '20', color: fs.border }}>{job.feeder}</span>}
                    </td>
                  </tr>
                )
              })}
              {recentActivity.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--apple-tertiary)' }}>No completions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Admin Activity */}
      <Section title="Admin Activity" subtitle="Last 50 sensitive operations (user, crew, import)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--apple-separator)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 500, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>When</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 500, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Who</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 500, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Action</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 500, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditEntries.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--apple-separator)' }}>
                  <td style={{ padding: '8px 10px', color: 'var(--apple-secondary)', whiteSpace: 'nowrap' }}>
                    {e.created_at ? new Date(e.created_at).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--apple-text)' }}>
                    {e.actor_name || '—'}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#e8f4fd', color: '#0071e3', fontFamily: 'monospace' }}>
                      {e.action}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--apple-secondary)', fontSize: 12, fontFamily: 'monospace' }}>
                    {e.payload ? JSON.stringify(e.payload) : '—'}
                  </td>
                </tr>
              ))}
              {!auditLoading && auditEntries.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--apple-tertiary)' }}>No admin activity yet</td></tr>
              )}
              {auditLoading && (
                <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--apple-tertiary)' }}>Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Import Jobs */}
      <Section title="Import Jobs" subtitle="Upload highfield_jobs.json to replace all jobs">
        <label style={{
          display: 'block', width: '100%', textAlign: 'center', padding: 16, borderRadius: 10,
          border: '2px dashed var(--apple-separator)', cursor: 'pointer',
          fontSize: 14, fontWeight: 500,
          color: importing ? 'var(--apple-tertiary)' : 'var(--apple-blue)',
          transition: 'var(--apple-transition)',
        }}>
          {importing ? 'Importing...' : 'Choose JSON file'}
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} disabled={importing} style={{ display: 'none' }} />
        </label>
        {importStatus && (
          <p style={{ fontSize: 13, marginTop: 8, color: importStatus.ok ? 'var(--apple-green)' : 'var(--apple-red)' }}>{importStatus.msg}</p>
        )}
      </Section>

      {/* Crew Management */}
      <Section title="Crew Members">
        <div className="space-y-2" style={{ marginBottom: 12 }}>
          {crews.map(c => {
            const color = crewColor(crews, c.name)
            return (
              <div key={c.name} className="flex items-center justify-between" style={{ padding: '10px 14px', background: 'var(--apple-bg)', borderRadius: 10, borderLeft: `3px solid ${color}` }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--apple-text)' }}>{c.name}</span>
                  {c.crew_type && (
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: '#e8f4fd', color: '#0071e3', textTransform: 'uppercase' }}>
                      {c.crew_type}{c.ewp_size ? ` ${c.ewp_size}` : ''}
                    </span>
                  )}
                </div>
                <button onClick={() => removeCrew(c.name)} style={btnDanger}>Remove</button>
              </div>
            )
          })}
          {crews.length === 0 && <p style={{ fontSize: 13, color: 'var(--apple-tertiary)', textAlign: 'center', padding: 8 }}>No crews added yet</p>}
        </div>
        <form onSubmit={handleAddCrew} className="flex flex-wrap gap-2">
          <input value={newCrew} onChange={e => setNewCrew(e.target.value)} placeholder="New crew name" style={{ flex: 1, minWidth: 120 }} />
          <select value={newCrewType} onChange={e => { setNewCrewType(e.target.value); if (e.target.value !== 'ewp') setNewCrewEwpSize('') }}>
            <option value="hs">H&S</option>
            <option value="ewp">EWP</option>
            <option value="chip">Chip</option>
          </select>
          {newCrewType === 'ewp' && (
            <select value={newCrewEwpSize} onChange={e => setNewCrewEwpSize(e.target.value)}>
              <option value="">Size…</option>
              <option value="30m">30m</option>
              <option value="36m">36m</option>
              <option value="316">316</option>
              <option value="317">317</option>
              <option value="322">322</option>
              <option value="323">323</option>
            </select>
          )}
          <button type="submit" style={btnPrimary}>Add</button>
        </form>
      </Section>

      {/* Contract Totals */}
      <Section title="Contract Totals">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total Jobs" value={stats.total} />
          <Stat label="Total Spans" value={stats.totalSpans} />
          <Stat label="H&S Hours" value={stats.totalHs.toFixed(1)} />
          <Stat label="EWP Hours" value={stats.totalEwp.toFixed(1)} />
          <Stat label="Chip Hours" value={stats.totalCleanup.toFixed(1)} />
          <Stat label="Jobs with TM" value={stats.withTm} />
        </div>
      </Section>

      {/* Export */}
      <Section title="Export Data">
        <button onClick={exportCSV} style={{ ...btnPrimary, width: '100%', padding: '12px 20px' }}>
          Download CSV
        </button>
      </Section>
    </div>
  )
}
