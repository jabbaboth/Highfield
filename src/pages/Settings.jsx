import { useState, useMemo } from 'react'
import { useContractData } from '../lib/useContractData'

export default function Settings() {
  const { jobs, assignments, completions, completionMap, crews, addCrew, removeCrew, loading } = useContractData()
  const [newCrew, setNewCrew] = useState('')

  const stats = useMemo(() => {
    const totalSpans = jobs.reduce((s, j) => s + (parseFloat(j.spans) || 0), 0)
    const totalHs = jobs.reduce((s, j) => s + (parseFloat(j.hs_hrs) || 0), 0)
    const totalEwp = jobs.reduce((s, j) => s + (parseFloat(j.ewp_hrs) || 0), 0)
    const withTm = jobs.filter(j => j.tm_type).length
    const withLv = jobs.filter(j => j.lv).length
    return { total: jobs.length, totalSpans, totalHs, totalEwp, withTm, withLv }
  }, [jobs])

  async function handleAddCrew(e) {
    e.preventDefault()
    if (!newCrew.trim()) return
    await addCrew(newCrew.trim())
    setNewCrew('')
  }

  function exportCSV() {
    // Build assignments CSV
    let csv = 'Type,Job ID,Crew,Date,Completed At,Completed By,Notes\n'
    assignments.forEach(a => {
      const comp = completionMap[a.job_id]
      csv += `assignment,${a.job_id},${a.crew_name},${a.planned_date},${comp?.completed_at || ''},${comp?.completed_by || ''},${(comp?.notes || '').replace(/,/g, ';')}\n`
    })
    // Add completions without assignments
    completions.forEach(c => {
      if (!assignments.find(a => a.job_id === c.job_id)) {
        csv += `completion,${c.job_id},,,"${c.completed_at}","${c.completed_by || ''}","${(c.notes || '').replace(/,/g, ';')}"\n`
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

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      {/* Crew management */}
      <section className="bg-white rounded-xl border shadow-sm p-4">
        <h2 className="font-bold text-sm mb-3">Crew Members</h2>
        <div className="space-y-2 mb-3">
          {crews.map(c => (
            <div key={c.name} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">{c.name}</span>
              <button
                onClick={() => removeCrew(c.name)}
                className="text-red-400 hover:text-red-600 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddCrew} className="flex gap-2">
          <input
            value={newCrew}
            onChange={e => setNewCrew(e.target.value)}
            placeholder="New crew name"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Add
          </button>
        </form>
      </section>

      {/* Contract totals */}
      <section className="bg-white rounded-xl border shadow-sm p-4">
        <h2 className="font-bold text-sm mb-3">Contract Totals</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total Jobs" value={stats.total} />
          <Stat label="Total Spans" value={stats.totalSpans} />
          <Stat label="H&S Hours" value={stats.totalHs.toFixed(1)} />
          <Stat label="EWP Hours" value={stats.totalEwp.toFixed(1)} />
          <Stat label="Jobs with TM" value={stats.withTm} />
          <Stat label="Jobs with LV" value={stats.withLv} />
        </div>
      </section>

      {/* Export */}
      <section className="bg-white rounded-xl border shadow-sm p-4">
        <h2 className="font-bold text-sm mb-3">Export Data</h2>
        <button
          onClick={exportCSV}
          className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800"
        >
          Download CSV
        </button>
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
