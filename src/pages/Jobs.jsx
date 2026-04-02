import { useState, useMemo } from 'react'
import { useContractData } from '../lib/useContractData'
import { FEEDERS, feederBgClass } from '../lib/feeder'

export default function Jobs() {
  const { jobs, assignmentMap, completionMap, crews, assignJobs, unassignJob, loading } = useContractData()
  const [feederFilter, setFeederFilter] = useState('')
  const [streetFilter, setStreetFilter] = useState('')
  const [ewpFilter, setEwpFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [expanded, setExpanded] = useState(new Set())
  const [showModal, setShowModal] = useState(false)
  const [modalCrew, setModalCrew] = useState('')
  const [modalDate, setModalDate] = useState(() => new Date().toISOString().split('T')[0])

  const streets = useMemo(() => {
    const s = [...new Set(jobs.map(j => j.street).filter(Boolean))].sort()
    return s
  }, [jobs])

  const ewpTypes = useMemo(() => {
    return [...new Set(jobs.map(j => j.ewp_type).filter(Boolean))].sort()
  }, [jobs])

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      if (feederFilter && String(j.feeder) !== feederFilter) return false
      if (streetFilter && j.street !== streetFilter) return false
      if (ewpFilter && j.ewp_type !== ewpFilter) return false
      if (statusFilter === 'Complete' && !completionMap[j.job_id]) return false
      if (statusFilter === 'Planned' && (!assignmentMap[j.job_id] || completionMap[j.job_id])) return false
      if (statusFilter === 'Unplanned' && (assignmentMap[j.job_id] || completionMap[j.job_id])) return false
      if (search) {
        const q = search.toLowerCase()
        const match = [j.full_address, j.species, j.job_id].some(v => v && String(v).toLowerCase().includes(q))
        if (!match) return false
      }
      return true
    })
  }, [jobs, feederFilter, streetFilter, ewpFilter, statusFilter, search, assignmentMap, completionMap])

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleAssign() {
    if (!modalCrew || !modalDate) return
    await assignJobs([...selected], modalCrew, modalDate)
    setSelected(new Set())
    setShowModal(false)
  }

  if (loading) return <div className="p-4 text-gray-500">Loading jobs...</div>

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="p-3 bg-white border-b border-gray-200 space-y-2">
        <div className="flex flex-wrap gap-2">
          <select value={feederFilter} onChange={e => setFeederFilter(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-white">
            <option value="">All Feeders</option>
            {FEEDERS.map(f => <option key={f} value={f}>Feeder {f}</option>)}
          </select>
          <select value={streetFilter} onChange={e => setStreetFilter(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-white">
            <option value="">All Streets</option>
            {streets.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={ewpFilter} onChange={e => setEwpFilter(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-white">
            <option value="">All EWP</option>
            {ewpTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-white">
            <option value="">All Status</option>
            <option>Unplanned</option>
            <option>Planned</option>
            <option>Complete</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="Search address, species, ref..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {filtered.map(job => {
          const assignment = assignmentMap[job.job_id]
          const completion = completionMap[job.job_id]
          const isExpanded = expanded.has(job.job_id)
          const isSelected = selected.has(job.job_id)

          return (
            <div
              key={job.job_id}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden ${completion ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3 p-3">
                {!completion && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(job.job_id)}
                    className="mt-1 w-5 h-5 rounded"
                  />
                )}
                <div className="flex-1 min-w-0" onClick={() => toggleExpand(job.job_id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${feederBgClass(job.feeder)}`}>
                      {job.feeder}
                    </span>
                    {completion && <span className="text-green-600 font-bold text-sm">✓</span>}
                    <span className="font-medium text-sm text-gray-900 truncate">{job.full_address}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                    {job.species && <span>{job.species}</span>}
                    {job.spans && <span>Spans: {job.spans}</span>}
                    {job.hs_hrs && <span>H&S: {job.hs_hrs}h</span>}
                    {job.ewp_hrs && <span>EWP: {job.ewp_hrs}h</span>}
                    {job.ewp_type && <span className="bg-blue-100 text-blue-700 px-1.5 rounded">{job.ewp_type}</span>}
                    {job.tm_type && <span className="bg-amber-100 text-amber-700 px-1.5 rounded">TM: {job.tm_type}</span>}
                  </div>
                  {assignment && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
                        {assignment.crew_name} · {assignment.planned_date}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); unassignJob(job.job_id) }}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Unassign
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-100 text-xs text-gray-600 space-y-1">
                  {job.pole_no && <p><strong>Pole:</strong> {job.pole_no}</p>}
                  {job.comments && <p><strong>Comments:</strong> {job.comments}</p>}
                  {job.ok_lett && <p><strong>OK Letter:</strong> {job.ok_lett}</p>}
                  {job.owner && <p><strong>Owner:</strong> {job.owner}</p>}
                  {job.phone && <p><strong>Phone:</strong> {job.phone}</p>}
                  {job.notify && <p><strong>Notify:</strong> {job.notify}</p>}
                  {job.additional && <p><strong>Additional:</strong> {job.additional}</p>}
                  {job.road_level && <p><strong>Road Level:</strong> {job.road_level}</p>}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && <p className="text-gray-400 text-center py-8">No jobs match filters</p>}
      </div>

      {/* Selection banner */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 bg-gray-900 text-white p-3 flex items-center justify-between">
          <span className="font-medium">Assign {selected.size} job{selected.size > 1 ? 's' : ''} →</span>
          <button
            onClick={() => setShowModal(true)}
            className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm font-medium"
          >
            Choose crew & date
          </button>
        </div>
      )}

      {/* Assign modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <h2 className="text-lg font-bold">Assign {selected.size} jobs</h2>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Crew</label>
              <select value={modalCrew} onChange={e => setModalCrew(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                <option value="">Select crew</option>
                {crews.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Date</label>
              <input type="date" value={modalDate} onChange={e => setModalDate(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border rounded-lg text-sm">Cancel</button>
              <button
                onClick={handleAssign}
                disabled={!modalCrew}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:bg-gray-300"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
