import { useState, useMemo } from 'react'
import { useContractData } from '../lib/useContractData'
import { FEEDERS, FEEDER_COLORS, feederBgClass } from '../lib/feeder'

export default function Progress() {
  const { jobs, assignmentMap, completionMap, completeJob, uncompleteJob, loading } = useContractData()
  const [feederFilter, setFeederFilter] = useState('')
  const [sortBy, setSortBy] = useState('feeder')

  const feederStats = useMemo(() => {
    return FEEDERS.map(f => {
      const fJobs = jobs.filter(j => String(j.feeder) === f)
      const done = fJobs.filter(j => completionMap[String(j.job_id)])
      const totalSpans = fJobs.reduce((s, j) => s + (parseFloat(j.spans) || 0), 0)
      const doneSpans = done.reduce((s, j) => s + (parseFloat(j.spans) || 0), 0)
      const totalHs = fJobs.reduce((s, j) => s + (parseFloat(j.hs_hrs) || 0), 0)
      return {
        feeder: f,
        label: FEEDER_COLORS[f].label,
        total: fJobs.length,
        done: done.length,
        pct: fJobs.length ? Math.round((done.length / fJobs.length) * 100) : 0,
        totalSpans,
        doneSpans,
        totalHs,
      }
    })
  }, [jobs, completionMap])

  const filtered = useMemo(() => {
    let list = [...jobs]
    if (feederFilter) list = list.filter(j => String(j.feeder) === feederFilter)

    list.sort((a, b) => {
      if (sortBy === 'feeder') return String(a.feeder).localeCompare(String(b.feeder))
      if (sortBy === 'status') {
        const sa = completionMap[String(a.job_id)] ? 2 : assignmentMap[String(a.job_id)] ? 1 : 0
        const sb = completionMap[String(b.job_id)] ? 2 : assignmentMap[String(b.job_id)] ? 1 : 0
        return sa - sb
      }
      if (sortBy === 'crew') {
        const ca = assignmentMap[String(a.job_id)]?.crew_name || 'zzz'
        const cb = assignmentMap[String(b.job_id)]?.crew_name || 'zzz'
        return ca.localeCompare(cb)
      }
      if (sortBy === 'date') {
        const da = assignmentMap[String(a.job_id)]?.planned_date || '9999'
        const db = assignmentMap[String(b.job_id)]?.planned_date || '9999'
        return da.localeCompare(db)
      }
      return 0
    })
    return list
  }, [jobs, feederFilter, sortBy, assignmentMap, completionMap])

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>

  return (
    <div className="p-3 space-y-4">
      {/* Feeder summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {feederStats.map(fs => (
          <div key={fs.feeder} className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${feederBgClass(fs.feeder)}`} />
              <span className="font-bold text-sm">{fs.label}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{fs.pct}%</div>
            <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
              <div className={`h-full rounded-full ${feederBgClass(fs.feeder)}`} style={{ width: `${fs.pct}%` }} />
            </div>
            <div className="text-xs text-gray-500 mt-2 space-y-0.5">
              <p>Jobs: {fs.done}/{fs.total}</p>
              <p>Spans: {fs.doneSpans}/{fs.totalSpans}</p>
              <p>H&S Hours: {fs.totalHs.toFixed(1)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={feederFilter} onChange={e => setFeederFilter(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-white">
          <option value="">All Feeders</option>
          {FEEDERS.map(f => <option key={f} value={f}>Feeder {f}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-white">
          <option value="feeder">Sort: Feeder</option>
          <option value="date">Sort: Date</option>
          <option value="crew">Sort: Crew</option>
          <option value="status">Sort: Status</option>
        </select>
      </div>

      {/* Job list */}
      <div className="space-y-1">
        {filtered.map(job => {
          const assignment = assignmentMap[String(job.job_id)]
          const completion = completionMap[String(job.job_id)]
          return (
            <div key={job.job_id} className={`flex items-center gap-3 p-2.5 bg-white rounded-lg border ${completion ? 'opacity-60' : ''}`}>
              <div className={`w-1.5 self-stretch rounded-full ${feederBgClass(job.feeder)}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{job.full_address}</p>
                <div className="text-xs text-gray-500">
                  {assignment && <span>{assignment.crew_name} · {assignment.planned_date}</span>}
                  {!assignment && !completion && <span className="text-gray-400">Unplanned</span>}
                </div>
              </div>
              <button
                onClick={() => completion ? uncompleteJob(job.job_id) : completeJob(job.job_id)}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm flex-shrink-0 ${
                  completion
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-500'
                }`}
              >
                ✓
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
