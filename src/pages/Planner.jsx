import { useState, useMemo } from 'react'
import { useContractData } from '../lib/useContractData'
import { feederStyle, PHASES, crewColor } from '../lib/feeder'

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

export default function Planner() {
  const { jobs, assignments, assignmentsByJob, completionsByJob, crews, assignJobs, unassignJob, completeJob, loading } = useContractData()
  const [date, setDate] = useState(() => formatDate(new Date()))
  const [selectedUnplanned, setSelectedUnplanned] = useState(new Set())
  const [assignCrew, setAssignCrew] = useState('')
  const [activePhase, setActivePhase] = useState('main')

  const phaseInfo = PHASES.find(p => p.key === activePhase) || PHASES[0]

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

  // Filter assignments for this date AND the active phase
  const dayAssignments = useMemo(() => {
    return assignments.filter(a => a.planned_date === date && (a.phase || 'main') === activePhase)
  }, [assignments, date, activePhase])

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

  // Unplanned = no assignment for the active phase AND not completed for that phase
  const unplanned = useMemo(() => {
    return jobs.filter(j => {
      const jid = String(j.job_id)
      const a = assignmentsByJob[jid] || {}
      const c = completionsByJob[jid] || {}
      return !a[activePhase] && !c[activePhase]
    })
  }, [jobs, assignmentsByJob, completionsByJob, activePhase])

  function toggleUnplanned(id) {
    setSelectedUnplanned(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleQuickAssign() {
    if (!assignCrew || selectedUnplanned.size === 0) return
    await assignJobs([...selectedUnplanned], assignCrew, date, activePhase)
    setSelectedUnplanned(new Set())
  }

  function getCrewStats(crewName) {
    const crewJobList = crewJobs[crewName] || []
    const totalSpans = crewJobList.reduce((s, j) => s + (parseFloat(j.spans) || 0), 0)
    const totalHrs = crewJobList.reduce((s, j) => s + (parseFloat(j[phaseInfo.hrsField]) || 0), 0)
    return { count: crewJobList.length, totalSpans, totalHrs }
  }

  function hourBarColor(hrs) {
    if (hrs > 7) return '#ef4444'
    if (hrs > 5) return '#f59e0b'
    return '#22c55e'
  }

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>

  return (
    <div className="flex flex-col h-full">
      {/* Phase toggle */}
      <div className="bg-white border-b border-gray-200 p-2 flex justify-center gap-1">
        {PHASES.map(p => (
          <button
            key={p.key}
            onClick={() => { setActivePhase(p.key); setSelectedUnplanned(new Set()) }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activePhase === p.key
                ? 'text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            style={activePhase === p.key ? { background: 'linear-gradient(135deg, #2563eb, #1e40af)' } : {}}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date picker */}
      <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-center gap-4">
        <button onClick={prevDay} className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-lg font-bold">◀</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm font-medium" />
        <button onClick={nextDay} className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-lg font-bold">▶</button>
      </div>

      {/* Crew columns */}
      <div className="flex-1 overflow-auto p-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(crews.length, 1)}, minmax(220px, 1fr))` }}>
          {crews.map(crew => {
            const stats = getCrewStats(crew.name)
            const jobList = crewJobs[crew.name] || []
            const color = crewColor(crews, crew.name)

            return (
              <div key={crew.name} className="rounded-xl border shadow-sm overflow-hidden" style={{ background: '#fff' }}>
                {/* Crew header with gradient */}
                <div className="p-3" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
                  <h3 className="font-bold text-sm text-white">{crew.name}</h3>
                  <div className="text-xs text-blue-100 mt-0.5">
                    {stats.count} jobs · {stats.totalSpans} spans · {stats.totalHrs.toFixed(1)}h
                  </div>
                  {/* Hour budget bar */}
                  <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((stats.totalHrs / 10) * 100, 100)}%`,
                        background: hourBarColor(stats.totalHrs),
                      }}
                    />
                  </div>
                </div>

                <div className="divide-y divide-gray-50">
                  {jobList.length === 0 && (
                    <p className="text-xs text-gray-400 p-3 text-center">No jobs</p>
                  )}
                  {jobList.map(job => {
                    const jid = String(job.job_id)
                    const comp = completionsByJob[jid]?.[activePhase]
                    const fs = feederStyle(job.feeder)
                    return (
                      <div key={job.job_id} className={`p-2.5 ${comp ? 'opacity-50' : ''}`}>
                        <div className="flex items-start gap-2">
                          <div className="w-1 self-stretch rounded-full" style={{ background: fs.border }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{job.full_address}</p>
                            <div className="flex flex-wrap gap-1 mt-0.5 text-xs text-gray-500">
                              <span>Spans: {job.spans || 0}</span>
                              <span>· {parseFloat(job[phaseInfo.hrsField]) || 0}h</span>
                              {job.tm_type && (
                                <span className="bg-amber-100 text-amber-700 px-1 rounded">{job.tm_type}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {!comp && (
                              <button
                                onClick={() => completeJob(job.job_id, activePhase)}
                                className="w-7 h-7 rounded-full border-2 border-green-400 text-green-500 hover:bg-green-50 flex items-center justify-center text-xs"
                                title="Mark complete"
                              >
                                ✓
                              </button>
                            )}
                            <button
                              onClick={() => unassignJob(job.job_id, activePhase)}
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

        {/* Unplanned jobs for this phase */}
        <div className="mt-6">
          <h3 className="font-bold text-sm text-gray-700 mb-2">
            Unplanned {phaseInfo.label} Jobs ({unplanned.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unplanned.slice(0, 50).map(job => {
              const fs = feederStyle(job.feeder)
              return (
                <div
                  key={job.job_id}
                  onClick={() => toggleUnplanned(job.job_id)}
                  className={`p-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                    selectedUnplanned.has(job.job_id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'bg-white hover:border-gray-300'
                  }`}
                  style={{ borderLeft: `3px solid ${fs.border}` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium">{job.full_address}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {job.spans && `${job.spans} spans`} {job[phaseInfo.hrsField] && `· ${job[phaseInfo.hrsField]}h`}
                  </div>
                </div>
              )
            })}
          </div>
          {unplanned.length > 50 && <p className="text-xs text-gray-400 mt-2">Showing 50 of {unplanned.length}</p>}
        </div>
      </div>

      {/* Quick assign banner */}
      {selectedUnplanned.size > 0 && (
        <div className="sticky bottom-0 text-white p-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
          <span className="text-sm font-medium flex-shrink-0">Assign {selectedUnplanned.size} ({phaseInfo.label}) to {date}:</span>
          <select value={assignCrew} onChange={e => setAssignCrew(e.target.value)} className="bg-white/10 border border-white/30 rounded-lg px-2 py-1.5 text-sm text-white flex-1">
            <option value="">Select crew</option>
            {crews.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <button
            onClick={handleQuickAssign}
            disabled={!assignCrew}
            className="bg-white text-blue-700 hover:bg-blue-50 disabled:bg-gray-300 disabled:text-gray-500 px-4 py-1.5 rounded-lg text-sm font-semibold"
          >
            Assign
          </button>
        </div>
      )}
    </div>
  )
}
