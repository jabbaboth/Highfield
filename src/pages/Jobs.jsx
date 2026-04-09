import { useState, useMemo } from 'react'
import { useContractData } from '../lib/useContractData'
import { useAuth } from '../lib/useAuth'
import { FEEDERS, feederStyle, PHASES } from '../lib/feeder'

function getJobPhaseStatus(job, assignmentsByJob, completionsByJob) {
  const jid = String(job.job_id)
  const a = assignmentsByJob[jid] || {}
  const c = completionsByJob[jid] || {}

  const mainStatus = c.main ? 'complete' : a.main ? 'assigned' : 'not started'
  const bucketUnlocked = !!c.main
  const bucketStatus = c.bucket ? 'complete' : a.bucket ? 'assigned' : bucketUnlocked ? 'not started' : 'locked'
  const chipUnlocked = c.bucket ? true : (c.main && !job.ewp_hrs)
  const chipStatus = c.chip ? 'complete' : a.chip ? 'assigned' : chipUnlocked ? 'not started' : 'locked'

  return { main: mainStatus, bucket: bucketStatus, chip: chipStatus }
}

function PhasePill({ label, status }) {
  const colors = {
    locked: 'bg-gray-100 text-gray-400',
    'not started': 'bg-gray-100 text-gray-600',
    assigned: 'bg-blue-100 text-blue-700',
    complete: 'bg-green-100 text-green-700',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${colors[status] || colors.locked}`}>
      {label}: {status}
    </span>
  )
}

export default function Jobs() {
  const { jobs, assignmentsByJob, completionsByJob, crews, assignJobs, unassignJob, loading } = useContractData()
  const { user } = useAuth()
  const [feederFilter, setFeederFilter] = useState('')
  const [streetFilter, setStreetFilter] = useState('')
  const [ewpFilter, setEwpFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [expanded, setExpanded] = useState(new Set())
  const [barCrew, setBarCrew] = useState('')
  const [barDate, setBarDate] = useState(() => new Date().toISOString().split('T')[0])
  const [barPhase, setBarPhase] = useState('main')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState(null)

  const streets = useMemo(() => [...new Set(jobs.map(j => j.street).filter(Boolean))].sort(), [jobs])
  const ewpTypes = useMemo(() => [...new Set(jobs.map(j => j.ewp_type).filter(Boolean))].sort(), [jobs])

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      const jid = String(j.job_id)
      const a = assignmentsByJob[jid] || {}
      const c = completionsByJob[jid] || {}
      if (feederFilter && String(j.feeder) !== feederFilter) return false
      if (streetFilter && j.street !== streetFilter) return false
      if (ewpFilter && j.ewp_type !== ewpFilter) return false
      const hasAny = a.main || a.bucket || a.chip
      const allDone = c.main && (c.bucket || !j.ewp_hrs) && (c.chip || !j.cleanup_hrs)
      if (statusFilter === 'Complete' && !allDone) return false
      if (statusFilter === 'Planned' && (!hasAny || allDone)) return false
      if (statusFilter === 'Unplanned' && (hasAny || allDone)) return false
      if (search) {
        const q = search.toLowerCase()
        if (![j.full_address, j.species, j.job_id].some(v => v && String(v).toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [jobs, feederFilter, streetFilter, ewpFilter, statusFilter, search, assignmentsByJob, completionsByJob])

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleExpand(id) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handleAssign() {
    if (!barCrew || !barDate) return
    setAssigning(true); setAssignError(null)
    const error = await assignJobs([...selected], barCrew, barDate, barPhase, user?.name || '')
    setAssigning(false)
    if (error) { setAssignError(error.message || 'Failed to assign'); return }
    setSelected(new Set())
  }

  if (loading) return <div className="p-6 text-gray-500">Loading jobs...</div>

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="p-3 bg-white border-b border-gray-200 shadow-sm space-y-2">
        <div className="flex flex-wrap gap-2">
          <select value={feederFilter} onChange={e => setFeederFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All Feeders</option>
            {FEEDERS.map(f => <option key={f} value={f}>Feeder {f}</option>)}
          </select>
          <select value={streetFilter} onChange={e => setStreetFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All Streets</option>
            {streets.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={ewpFilter} onChange={e => setEwpFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All EWP</option>
            {ewpTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All Status</option>
            <option>Unplanned</option>
            <option>Planned</option>
            <option>Complete</option>
          </select>
        </div>
        <input
          type="text" placeholder="Search address, species, ref..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-auto p-3" style={{ paddingBottom: selected.size > 0 ? '100px' : '12px' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {filtered.map(job => {
            const jid = String(job.job_id)
            const asgns = assignmentsByJob[jid] || {}
            const comps = completionsByJob[jid] || {}
            const phases = getJobPhaseStatus(job, assignmentsByJob, completionsByJob)
            const allDone = phases.main === 'complete' && (phases.bucket === 'complete' || phases.bucket === 'locked') && (phases.chip === 'complete' || phases.chip === 'locked')
            const isExpanded = expanded.has(job.job_id)
            const isSelected = selected.has(job.job_id)
            const fs = feederStyle(job.feeder)

            return (
              <div
                key={job.job_id}
                className="rounded-lg shadow-sm hover:shadow-md flex flex-col"
                style={{
                  background: allDone ? '#d4edda' : fs.bg,
                  borderLeft: `4px solid ${fs.border}`,
                  opacity: allDone ? 0.75 : 1,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { if (!allDone) e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {/* Card top: address + ref + checkbox */}
                <div className="p-3 flex items-start gap-2">
                  <input
                    type="checkbox" checked={isSelected}
                    onChange={() => toggleSelect(job.job_id)}
                    className="mt-1 w-5 h-5 rounded flex-shrink-0"
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-gray-900" style={{ fontSize: '15px', lineHeight: '1.3' }}>
                        {job.full_address}
                      </p>
                      <span className="text-xs text-gray-400 font-mono flex-shrink-0">#{job.job_id}</span>
                    </div>

                    {/* Tag badges */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: fs.border }}>
                        {fs.label}
                      </span>
                      {job.ewp_type && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">
                          {job.ewp_type}
                        </span>
                      )}
                      {job.species && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          {job.species}
                        </span>
                      )}
                      {job.tm_type && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-pink-100 text-pink-700">
                          TM: {job.tm_type}
                        </span>
                      )}
                      {allDone && (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-200 text-green-800">
                          ✓ Done
                        </span>
                      )}
                    </div>

                    {/* Metrics row */}
                    <div className="grid grid-cols-4 gap-1 mt-2">
                      {job.spans != null && (
                        <div className="text-center">
                          <div className="text-[10px] uppercase text-gray-400 font-semibold tracking-wide">Spans</div>
                          <div className="text-sm font-bold text-gray-800">{job.spans}</div>
                        </div>
                      )}
                      {job.hs_hrs != null && (
                        <div className="text-center">
                          <div className="text-[10px] uppercase text-gray-400 font-semibold tracking-wide">H&S</div>
                          <div className="text-sm font-bold text-gray-800">{job.hs_hrs}h</div>
                        </div>
                      )}
                      {job.ewp_hrs != null && (
                        <div className="text-center">
                          <div className="text-[10px] uppercase text-gray-400 font-semibold tracking-wide">EWP</div>
                          <div className="text-sm font-bold text-gray-800">{job.ewp_hrs}h</div>
                        </div>
                      )}
                      {job.cleanup_hrs != null && (
                        <div className="text-center">
                          <div className="text-[10px] uppercase text-gray-400 font-semibold tracking-wide">Cleanup</div>
                          <div className="text-sm font-bold text-gray-800">{job.cleanup_hrs}h</div>
                        </div>
                      )}
                    </div>

                    {/* Phase pills */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      <PhasePill label="H&S" status={phases.main} />
                      <PhasePill label="EWP" status={phases.bucket} />
                      <PhasePill label="Chip" status={phases.chip} />
                    </div>

                    {/* Crew assignment badges */}
                    {['main', 'bucket', 'chip'].map(ph => {
                      const asg = asgns[ph]
                      if (!asg) return null
                      const phLabel = ph === 'main' ? 'H&S' : ph === 'bucket' ? 'EWP' : 'Chip'
                      const comp = comps[ph]
                      return (
                        <div key={ph} className="flex items-center gap-1.5 mt-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${comp ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                            {phLabel}: {asg.crew_name} · {asg.planned_date} {comp && '✓'}
                          </span>
                          {!comp && (
                            <button
                              onClick={e => { e.stopPropagation(); unassignJob(job.job_id, ph) }}
                              className="text-red-400 hover:text-red-600 text-xs"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Expand toggle */}
                <button
                  onClick={() => toggleExpand(job.job_id)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 font-medium border-t border-gray-100 text-center transition-colors"
                >
                  {isExpanded ? '▲ LESS DETAIL' : '▼ MORE DETAIL'}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 text-xs text-gray-500 space-y-1 italic border-t border-gray-100 pt-2">
                    {job.pole_no && <p><strong className="not-italic text-gray-600">Pole:</strong> {job.pole_no}</p>}
                    {job.comments && <p><strong className="not-italic text-gray-600">Comments:</strong> {job.comments}</p>}
                    {job.ok_lett && <p><strong className="not-italic text-gray-600">OK Letter:</strong> {job.ok_lett}</p>}
                    {job.owner && <p><strong className="not-italic text-gray-600">Owner:</strong> {job.owner} {job.phone && `· ${job.phone}`}</p>}
                    {job.notify && <p><strong className="not-italic text-gray-600">Notify:</strong> {job.notify}</p>}
                    {job.additional && <p><strong className="not-italic text-gray-600">Additional:</strong> {job.additional}</p>}
                    {job.road_level && <p><strong className="not-italic text-gray-600">Road Level:</strong> {job.road_level}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {filtered.length === 0 && <p className="text-gray-400 text-center py-8">No jobs match filters</p>}
      </div>

      {/* Floating assignment bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out"
        style={{ transform: selected.size > 0 ? 'translateY(0)' : 'translateY(100%)' }}
      >
        <div className="bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] px-4 py-3">
          {assignError && (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg p-2 mb-2">{assignError}</p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="font-bold text-sm text-gray-900 flex-shrink-0">
              {selected.size} job{selected.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <select value={barPhase} onChange={e => setBarPhase(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                {PHASES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <select value={barCrew} onChange={e => setBarCrew(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">Select crew</option>
                {crews.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <input type="date" value={barDate} onChange={e => setBarDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleAssign}
                disabled={!barCrew || assigning}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                {assigning ? 'Assigning...' : 'Assign to Crew'}
              </button>
              <button
                onClick={() => { setSelected(new Set()); setAssignError(null) }}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
