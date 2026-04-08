import { useState, useMemo, useRef } from 'react'
import { useContractData } from '../lib/useContractData'
import { crewColor } from '../lib/feeder'

export default function Settings() {
  const { jobs, assignments, completions, completionsByJob, crews, addCrew, removeCrew, importJobs, loading } = useContractData()
  const [newCrew, setNewCrew] = useState('')
  const [importStatus, setImportStatus] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  const stats = useMemo(() => {
    const totalSpans = jobs.reduce((s, j) => s + (parseFloat(j.spans) || 0), 0)
    const totalHs = jobs.reduce((s, j) => s + (parseFloat(j.hs_hrs) || 0), 0)
    const totalEwp = jobs.reduce((s, j) => s + (parseFloat(j.ewp_hrs) || 0), 0)
    const totalCleanup = jobs.reduce((s, j) => s + (parseFloat(j.cleanup_hrs) || 0), 0)
    const withTm = jobs.filter(j => j.tm_type).length
    const withLv = jobs.filter(j => j.lv).length
    return { total: jobs.length, totalSpans, totalHs, totalEwp, totalCleanup, withTm, withLv }
  }, [jobs])

  async function handleAddCrew(e) {
    e.preventDefault()
    if (!newCrew.trim()) return
    await addCrew(newCrew.trim())
    setNewCrew('')
  }

  function exportCSV() {
    let csv = 'Type,Job ID,Phase,Crew,Date,Completed At,Completed By,Notes\n'
    assignments.forEach(a => {
      const jid = String(a.job_id)
      const phase = a.phase || 'main'
      const comp = completionsByJob[jid]?.[phase]
      csv += `assignment,${a.job_id},${phase},${a.crew_name},${a.planned_date},${comp?.completed_at || ''},${comp?.completed_by || ''},${(comp?.notes || '').replace(/,/g, ';')}\n`
    })
    completions.forEach(c => {
      const phase = c.phase || 'main'
      if (!assignments.find(a => a.job_id === c.job_id && (a.phase || 'main') === phase)) {
        csv += `completion,${c.job_id},${phase},,,"${c.completed_at}","${c.completed_by || ''}","${(c.notes || '').replace(/,/g, ';')}"\n`
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
    setImporting(true)
    setImportStatus(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data)) throw new Error('JSON must be an array of jobs')
      const errors = await importJobs(data)
      if (errors) {
        setImportStatus({ ok: false, msg: `Imported with ${errors.length} errors` })
      } else {
        setImportStatus({ ok: true, msg: `Imported ${data.length} jobs successfully` })
      }
    } catch (err) {
      setImportStatus({ ok: false, msg: err.message })
    }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      {/* Import jobs */}
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
          <h2 className="font-bold text-sm text-white">Import Jobs</h2>
          <p className="text-xs text-blue-100 mt-0.5">Upload highfield_jobs.json to replace all jobs</p>
        </div>
        <div className="p-4">
          <label className={`block w-full text-center py-3 rounded-lg border-2 border-dashed cursor-pointer text-sm font-medium transition-colors ${importing ? 'border-gray-200 text-gray-400' : 'border-blue-300 text-blue-600 hover:bg-blue-50'}`}>
            {importing ? 'Importing...' : 'Choose JSON file'}
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={importing}
              className="hidden"
            />
          </label>
          {importStatus && (
            <p className={`text-sm mt-2 ${importStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
              {importStatus.msg}
            </p>
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
                  <button
                    onClick={() => removeCrew(c.name)}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >
                    Remove
                  </button>
                </div>
              )
            })}
            {crews.length === 0 && <p className="text-sm text-gray-400 text-center py-2">No crews added yet</p>}
          </div>
          <form onSubmit={handleAddCrew} className="flex gap-2">
            <input
              value={newCrew}
              onChange={e => setNewCrew(e.target.value)}
              placeholder="New crew name"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button type="submit" className="text-white px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
              Add
            </button>
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
          <button
            onClick={exportCSV}
            className="w-full text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}
          >
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
