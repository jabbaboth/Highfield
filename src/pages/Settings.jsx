import { useState, useMemo, useRef } from 'react'
import { useContractData } from '../lib/useContractData'
import { useAuth } from '../lib/useAuth'
import { crewColor, feederStyle } from '../lib/feeder'

export default function Settings() {
  const { jobs, assignments, completions, completionsByJob, crews, addCrew, removeCrew, importJobs, loading } = useContractData()
  const { users, addUser, updateUser, removeUser } = useAuth()
  const [newCrew, setNewCrew] = useState('')
  const [importStatus, setImportStatus] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  // User management state
  const [newUserName, setNewUserName] = useState('')
  const [newUserPin, setNewUserPin] = useState('')
  const [newUserRole, setNewUserRole] = useState('crew')
  const [editingUser, setEditingUser] = useState(null)
  const [editPin, setEditPin] = useState('')
  const [editRole, setEditRole] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(null)

  const stats = useMemo(() => {
    const totalSpans = jobs.reduce((s, j) => s + (parseFloat(j.spans) || 0), 0)
    const totalHs = jobs.reduce((s, j) => s + (parseFloat(j.hs_hrs) || 0), 0)
    const totalEwp = jobs.reduce((s, j) => s + (parseFloat(j.ewp_hrs) || 0), 0)
    const totalCleanup = jobs.reduce((s, j) => s + (parseFloat(j.cleanup_hrs) || 0), 0)
    const withTm = jobs.filter(j => j.tm_type).length
    const withLv = jobs.filter(j => j.lv).length
    return { total: jobs.length, totalSpans, totalHs, totalEwp, totalCleanup, withTm, withLv }
  }, [jobs])

  // Job map for activity log
  const jobMap = useMemo(() => {
    const m = {}
    jobs.forEach(j => { m[String(j.job_id)] = j })
    return m
  }, [jobs])

  // Recent activity: last 50 completions sorted by date
  const recentActivity = useMemo(() => {
    return [...completions]
      .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
      .slice(0, 50)
  }, [completions])

  async function handleAddCrew(e) {
    e.preventDefault()
    if (!newCrew.trim()) return
    await addCrew(newCrew.trim())
    setNewCrew('')
  }

  async function handleAddUser(e) {
    e.preventDefault()
    if (!newUserName.trim() || !newUserPin.trim()) return
    await addUser(newUserName.trim(), newUserPin.trim(), newUserRole)
    setNewUserName(''); setNewUserPin(''); setNewUserRole('crew')
  }

  async function handleSaveEdit() {
    if (!editingUser) return
    const updates = {}
    if (editPin) updates.pin = editPin
    if (editRole) updates.role = editRole
    await updateUser(editingUser.id, updates)
    setEditingUser(null); setEditPin(''); setEditRole('')
  }

  async function handleRemoveUser(id) {
    await removeUser(id)
    setConfirmRemove(null)
  }

  function exportCSV() {
    let csv = 'Type,Job ID,Phase,Crew,Date,Completed At,Completed By,Notes\n'
    assignments.forEach(a => {
      const jid = String(a.job_id)
      const phase = a.phase || 'main'
      const comp = completionsByJob[jid]?.[phase]
      csv += `assignment,${a.job_id},${phase},${a.crew_name},${a.planned_date},${comp?.completed_at || ''},${comp?.completed_by_name || ''},${(comp?.notes || '').replace(/,/g, ';')}\n`
    })
    completions.forEach(c => {
      const phase = c.phase || 'main'
      if (!assignments.find(a => a.job_id === c.job_id && (a.phase || 'main') === phase)) {
        csv += `completion,${c.job_id},${phase},,,"${c.completed_at}","${c.completed_by_name || ''}","${(c.notes || '').replace(/,/g, ';')}"\n`
      }
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `highfield-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setImportStatus(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data)) throw new Error('JSON must be an array of jobs')
      const errors = await importJobs(data)
      if (errors) { setImportStatus({ ok: false, msg: `Imported with ${errors.length} errors` }) }
      else { setImportStatus({ ok: true, msg: `Imported ${data.length} jobs successfully` }) }
    } catch (err) { setImportStatus({ ok: false, msg: err.message }) }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">

      {/* User Management */}
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
          <h2 className="font-bold text-sm text-white">User Management</h2>
          <p className="text-xs text-blue-100 mt-0.5">Manage logins and roles</p>
        </div>
        <div className="p-4">
          <div className="space-y-2 mb-4">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-gray-900">{u.name}</span>
                  <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700">{u.role}</span>
                  <span className="ml-2 text-xs text-gray-400 font-mono tracking-widest">{'••••'}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingUser(u); setEditPin(''); setEditRole(u.role) }}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >Edit</button>
                  <button
                    onClick={() => setConfirmRemove(u.id)}
                    className="text-red-400 hover:text-red-600 text-xs font-medium"
                  >Remove</button>
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="text-sm text-gray-400 text-center py-2">No users</p>}
          </div>

          {/* Confirm remove dialog */}
          {confirmRemove && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
              <p className="text-sm text-red-700">Remove this user? This cannot be undone.</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => handleRemoveUser(confirmRemove)} className="bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold">Yes, Remove</button>
                <button onClick={() => setConfirmRemove(null)} className="border border-gray-300 px-3 py-1 rounded text-xs">Cancel</button>
              </div>
            </div>
          )}

          {/* Edit user inline */}
          {editingUser && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <p className="text-sm font-semibold text-blue-900 mb-2">Editing: {editingUser.name}</p>
              <div className="flex flex-wrap gap-2">
                <input value={editPin} onChange={e => setEditPin(e.target.value)} placeholder="New PIN (leave blank to keep)" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1" />
                <select value={editRole} onChange={e => setEditRole(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                  <option value="admin">Admin</option>
                  <option value="foreman">Foreman</option>
                  <option value="crew">Crew</option>
                </select>
                <button onClick={handleSaveEdit} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">Save</button>
                <button onClick={() => setEditingUser(null)} className="border border-gray-300 px-3 py-1.5 rounded-lg text-xs">Cancel</button>
              </div>
            </div>
          )}

          {/* Add new user */}
          <form onSubmit={handleAddUser} className="flex flex-wrap gap-2">
            <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Name" className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[100px]" />
            <input value={newUserPin} onChange={e => setNewUserPin(e.target.value)} placeholder="PIN" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-20" />
            <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="crew">Crew</option>
              <option value="foreman">Foreman</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="text-white px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
              Add User
            </button>
          </form>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
          <h2 className="font-bold text-sm text-white">Recent Activity</h2>
          <p className="text-xs text-blue-100 mt-0.5">Last 50 completions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Date/Time</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Job</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Completed By</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Feeder</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((c, i) => {
                const job = jobMap[String(c.job_id)]
                const fs = job ? feederStyle(job.feeder) : null
                return (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                      {c.completed_at ? new Date(c.completed_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-900 truncate max-w-[200px]">
                      {job?.full_address || `Job #${c.job_id}`}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-gray-700">
                      {c.completed_by_name || '—'}
                    </td>
                    <td className="px-3 py-2">
                      {fs && (
                        <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: fs.border }}>
                          {job.feeder}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {recentActivity.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400 text-xs">No completions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Import jobs */}
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
          <h2 className="font-bold text-sm text-white">Import Jobs</h2>
          <p className="text-xs text-blue-100 mt-0.5">Upload highfield_jobs.json to replace all jobs</p>
        </div>
        <div className="p-4">
          <label className={`block w-full text-center py-3 rounded-lg border-2 border-dashed cursor-pointer text-sm font-medium transition-colors ${importing ? 'border-gray-200 text-gray-400' : 'border-blue-300 text-blue-600 hover:bg-blue-50'}`}>
            {importing ? 'Importing...' : 'Choose JSON file'}
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} disabled={importing} className="hidden" />
          </label>
          {importStatus && (
            <p className={`text-sm mt-2 ${importStatus.ok ? 'text-green-600' : 'text-red-600'}`}>{importStatus.msg}</p>
          )}
        </div>
      </section>

      {/* Crew management */}
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
          <h2 className="font-bold text-sm text-white">Crew Members</h2>
        </div>
        <div className="p-4">
          <div className="space-y-2 mb-3">
            {crews.map(c => {
              const color = crewColor(crews, c.name)
              return (
                <div key={c.name} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: color + '15', borderLeft: `3px solid ${color}` }}>
                  <span className="text-sm font-medium" style={{ color }}>{c.name}</span>
                  <button onClick={() => removeCrew(c.name)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                </div>
              )
            })}
            {crews.length === 0 && <p className="text-sm text-gray-400 text-center py-2">No crews added yet</p>}
          </div>
          <form onSubmit={handleAddCrew} className="flex gap-2">
            <input value={newCrew} onChange={e => setNewCrew(e.target.value)} placeholder="New crew name" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <button type="submit" className="text-white px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>Add</button>
          </form>
        </div>
      </section>

      {/* Contract totals */}
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
          <h2 className="font-bold text-sm text-white">Contract Totals</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total Jobs" value={stats.total} />
            <Stat label="Total Spans" value={stats.totalSpans} />
            <Stat label="H&S Hours" value={stats.totalHs.toFixed(1)} />
            <Stat label="EWP Hours" value={stats.totalEwp.toFixed(1)} />
            <Stat label="Chip Hours" value={stats.totalCleanup.toFixed(1)} />
            <Stat label="Jobs with TM" value={stats.withTm} />
          </div>
        </div>
      </section>

      {/* Export */}
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
          <h2 className="font-bold text-sm text-white">Export Data</h2>
        </div>
        <div className="p-4">
          <button onClick={exportCSV}
            className="w-full text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
            Download CSV
          </button>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
