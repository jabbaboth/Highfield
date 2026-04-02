import { useState, useMemo } from 'react'
import { useContractData } from '../lib/useContractData'
import { feederBgClass } from '../lib/feeder'

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

export default function Planner() {
  const { jobs, assignments, assignmentMap, completionMap, crews, assignJobs, unassignJob, completeJob, loading } = useContractData()
  const [date, setDate] = useState(() => formatDate(new Date()))
  const [selectedUnplanned, setSelectedUnplanned] = useState(new Set())
  const [assignCrew, setAssignCrew] = useState('')

  function prevDay() {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    setDate(formatDate(d))
  }

  function nextDay() {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    setDate(formatDate(d))
  }

  const jobMap = useMemo(() => {
    const m = {}
    jobs.forEach(j => { m[j.job_id] = j })
    return m
  }, [jobs])

  const dayAssignments = useMemo(() => {
    return assignments.filter(a => a.planned_date === date)
  }, [assignments, date])

  const crewJobs = useMemo(() => {
    const map = {}
    crews.forEach(c => { map[c.name] = [] })
    dayAssignments.forEach(a => {
      const job = jobMap[a.job_id]
      if (job && map[a.crew_name]) {
        map[a.crew_name].push({ ...job, assignment: a })
      }
    })
    return map
  }, [crews, dayAssignments, jobMap])

  const unplanned = useMemo(() => {
    return jobs.filter(j => !assignmentMap[j.job_id] && !completionMap[j.job_id])
  }, [jobs, assignmentMap, completionMap])

  function toggleUnplanned(id) {
    setSelectedUnplanned(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleQuickAssign() {
    if (!assignCrew || selectedUnplanned.size === 0) return
    await assignJobs([...selectedUnplanned], assignCrew, date)
    setSelectedUnplanned(new Set())
  }

  function getCrewStats(crewName) {
    const crewJobList = crewJobs[crewName] || []
    const totalSpans = crewJobList.reduce((s, j) => s + (parseFloat(j.spans) || 0), 0)
    const totalHs = crewJobList.reduce((s, j) => s + (parseFloat(j.hs_hrs) || 0), 0)
    const totalEwp = crewJobList.reduce((s, j) => s + (parseFloat(j.ewp_hrs) || 0), 0)
    const maxHrs = Math.max(totalHs, totalEwp)
    return { count: crewJobList.length, totalSpans, totalHs, totalEwp, maxHrs }
  }

  function hourBarColor(hrs) {
    if (hrs > 7) return 'bg-red-500'
    if (hrs > 5) return 'bg-amber-500'
    return 'bg-green-500'
  }

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>

  return (
    <div className="flex flex-col h-full">
      {/* Date picker */}
      <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-center gap-4">
        <button onClick={prevDay} className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-lg font-bold">◀</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm font-medium" />
        <button onClick={nextDay} className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-lg font-bold">▶</button>
      </div>

      {/* Crew columns */}
      <div className="flex-1 overflow-auto p-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${crews.length}, minmax(220px, 1fr))` }}>
          {crews.map(crew => {
            const stats = getCrewStats(crew.name)
            const jobList = crewJobs[crew.name] || []

            return (
              <div key={crew.name} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="p-3 border-b border-gray-100">
                  <h3 className="font-bold text-sm">{crew.name}</h3>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {stats.count} jobs · {stats.totalSpans} spans · {stats.maxHrs.toFixed(1)}h
                  </div>
                  {/* Hour budget bar */}
                  <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${hourBarColor(stats.maxHrs)}`}
                      style={{ width: `${Math.min((stats.maxHrs / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="divide-y divide-gray-50">
                  {jobList.length === 0 && (
                    <p className="text-xs text-gray-400 p-3 text-center">No jobs</p>
                  )}
                  {jobList.map(job => {
                    const isComplete = !!completionMap[job.job_id]
                    return (
                      <div key={job.job_id} className={`p-2.5 ${isComplete ? 'opacity-50' : ''}`}>
                        <div className="flex items-start gap-2">
                          <div className={`w-1 self-stretch rounded-full ${feederBgClass(job.feeder)}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{job.full_address}</p>
                            <div className="flex flex-wrap gap-1 mt-0.5 text-xs text-gray-500">
                              <span>Spans: {job.spans || 0}</span>
                              <span>· {(parseFloat(job.hs_hrs) || 0) + (parseFloat(job.ewp_hrs) || 0)}h</span>
                              {job.tm_type && (
                                <span className="bg-amber-100 text-amber-700 px-1 rounded">{job.tm_type}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {!isComplete && (
                              <button
                                onClick={() => completeJob(job.job_id)}
                                className="w-7 h-7 rounded-full border-2 border-green-400 text-green-500 hover:bg-green-50 flex items-center justify-center text-xs"
                                title="Mark complete"
                              >
                                ✓
                              </button>
                            )}
                            <button
                              onClick={() => unassignJob(job.job_id)}
                              className="w-7 h-7 rounded-full border-2 border-red-300 text-red-400 hover:bg-red-50 flex items-center justify-center text-xs"
                              title="Unassign"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Unplanned jobs */}
        <div className="mt-6">
          <h3 className="font-bold text-sm text-gray-700 mb-2">Unplanned Jobs ({unplanned.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unplanned.slice(0, 50).map(job => (
              <div
                key={job.job_id}
                onClick={() => toggleUnplanned(job.job_id)}
                className={`p-2.5 rounded-lg border cursor-pointer text-sm ${
                  selectedUnplanned.has(job.job_id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${feederBgClass(job.feeder)}`} />
                  <span className="truncate text-xs font-medium">{job.full_address}</span>
                </div>
                <div className="text-xs text-gray-500 ml-4 mt-0.5">
                  {job.spans && `${job.spans} spans`} {job.hs_hrs && `· ${job.hs_hrs}h`}
                </div>
              </div>
            ))}
          </div>
          {unplanned.length > 50 && <p className="text-xs text-gray-400 mt-2">Showing 50 of {unplanned.length}</p>}
        </div>
      </div>

      {/* Quick assign banner */}
      {selectedUnplanned.size > 0 && (
        <div className="sticky bottom-0 bg-gray-900 text-white p-3 flex items-center gap-3">
          <span className="text-sm font-medium flex-shrink-0">Assign {selectedUnplanned.size} to {date}:</span>
          <select value={assignCrew} onChange={e => setAssignCrew(e.target.value)} className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white flex-1">
            <option value="">Select crew</option>
            {crews.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <button
            onClick={handleQuickAssign}
            disabled={!assignCrew}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            Assign
          </button>
        </div>
      )}
    </div>
  )
}
