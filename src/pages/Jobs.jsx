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

const pillColors = {
  locked: { bg: '#f5f5f7', color: '#aeaeb2' },
  'not started': { bg: '#f5f5f7', color: '#6e6e73' },
  assigned: { bg: '#e8f4fd', color: '#0071e3' },
  complete: { bg: '#e8f8ed', color: '#34c759' },
}

function PhasePill({ label, status }) {
  const c = pillColors[status] || pillColors.locked
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>
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

  if (loading) return <div style={{ padding: 24, color: 'var(--apple-secondary)' }}>Loading jobs...</div>

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 p-4" style={{ borderBottom: '1px solid var(--apple-separator)' }}>
        <select value={feederFilter} onChange={e => setFeederFilter(e.target.value)}>
          <option value="">All Feeders</option>
          {FEEDERS.map(f => <option key={f} value={f}>Feeder {f}</option>)}
        </select>
        <select value={streetFilter} onChange={e => setStreetFilter(e.target.value)}>
          <option value="">All Streets</option>
          {streets.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={ewpFilter} onChange={e => setEwpFilter(e.target.value)}>
          <option value="">All EWP</option>
          {ewpTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option>Unplanned</option>
          <option>Planned</option>
          <option>Complete</option>
        </select>
        <input
          type="text" placeholder="Search address, species, ref..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-auto p-4" style={{ paddingBottom: selected.size > 0 ? 110 : 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
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
                style={{
                  background: allDone ? '#f0faf2' : 'white',
                  borderRadius: 'var(--apple-radius)',
                  boxShadow: 'var(--apple-shadow)',
                  borderTop: `3px solid ${fs.border}`,
                  opacity: allDone ? 0.8 : 1,
                  transition: 'var(--apple-transition)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--apple-shadow-hover)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--apple-shadow)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ padding: 16 }}>
                  {/* Top row: address + ref + checkbox */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox" checked={isSelected}
                      onChange={() => toggleSelect(job.job_id)}
                      onClick={e => e.stopPropagation()}
                      style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--apple-text)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                          {job.full_address}
                        </p>
                        <span style={{ fontSize: 11, color: 'var(--apple-tertiary)', fontFamily: 'monospace', flexShrink: 0 }}>
                          #{job.job_id}
                        </span>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1" style={{ marginTop: 8 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: fs.border + '20', color: fs.border }}>
                          {fs.label}
                        </span>
                        {job.ewp_type && (
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#fff3e0', color: '#e65100' }}>
                            {job.ewp_type}
                          </span>
                        )}
                        {job.species && (
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: '#f5f5f7', color: '#6e6e73' }}>
                            {job.species}
                          </span>
                        )}
                        {job.tm_type && (
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#ffeaea', color: '#c0392b' }}>
                            TM: {job.tm_type}
                          </span>
                        )}
                        {allDone && (
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#e8f8ed', color: '#34c759' }}>
                            ✓ Done
                          </span>
                        )}
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-4 gap-1" style={{ marginTop: 12 }}>
                        {job.spans != null && (
                          <div className="text-center">
                            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Spans</div>
                            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--apple-text)' }}>{job.spans}</div>
                          </div>
                        )}
                        {job.hs_hrs != null && (
                          <div className="text-center">
                            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>H&S</div>
                            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--apple-text)' }}>{job.hs_hrs}h</div>
                          </div>
                        )}
                        {job.ewp_hrs != null && (
                          <div className="text-center">
                            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>EWP</div>
                            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--apple-text)' }}>{job.ewp_hrs}h</div>
                          </div>
                        )}
                        {job.cleanup_hrs != null && (
                          <div className="text-center">
                            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cleanup</div>
                            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--apple-text)' }}>{job.cleanup_hrs}h</div>
                          </div>
                        )}
                      </div>

                      {/* Phase pills */}
                      <div className="flex flex-wrap gap-1" style={{ marginTop: 10 }}>
                        <PhasePill label="H&S" status={phases.main} />
                        <PhasePill label="EWP" status={phases.bucket} />
                        <PhasePill label="Chip" status={phases.chip} />
                      </div>

                      {/* Crew assignment badges */}
                      {['main', 'bucket', 'chip'].map(ph => {
                        const asg = asgns[ph]; if (!asg) return null
                        const phLabel = ph === 'main' ? 'H&S' : ph === 'bucket' ? 'EWP' : 'Chip'
                        const comp = comps[ph]
                        return (
                          <div key={ph} className="flex items-center gap-1.5" style={{ marginTop: 4 }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                              background: comp ? '#e8f8ed' : '#e8f4fd', color: comp ? '#248a3d' : '#0071e3',
                            }}>
                              {phLabel}: {asg.crew_name} · {asg.planned_date} {comp && '✓'}
                            </span>
                            {!comp && (
                              <button
                                onClick={e => { e.stopPropagation(); unassignJob(job.job_id, ph) }}
                                style={{ background: 'none', border: 'none', color: 'var(--apple-red)', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Expand toggle */}
                <button
                  onClick={() => toggleExpand(job.job_id)}
                  style={{
                    background: 'none', border: 'none', borderTop: '1px solid var(--apple-separator)',
                    padding: '8px 16px', fontSize: 11, fontWeight: 500,
                    color: 'var(--apple-tertiary)', cursor: 'pointer', textAlign: 'center',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--apple-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--apple-tertiary)'}
                >
                  {isExpanded ? '▲ LESS DETAIL' : '▼ MORE DETAIL'}
                </button>

                {isExpanded && (
                  <div style={{
                    padding: '12px 16px', borderTop: '1px solid var(--apple-separator)',
                    fontSize: 12, color: 'var(--apple-secondary)', fontStyle: 'italic',
                  }}>
                    <div className="space-y-1">
                      {job.pole_no && <p><strong style={{ fontStyle: 'normal', color: 'var(--apple-text)' }}>Pole:</strong> {job.pole_no}</p>}
                      {job.comments && <p><strong style={{ fontStyle: 'normal', color: 'var(--apple-text)' }}>Comments:</strong> {job.comments}</p>}
                      {job.ok_lett && <p><strong style={{ fontStyle: 'normal', color: 'var(--apple-text)' }}>OK Letter:</strong> {job.ok_lett}</p>}
                      {job.owner && <p><strong style={{ fontStyle: 'normal', color: 'var(--apple-text)' }}>Owner:</strong> {job.owner} {job.phone && `· ${job.phone}`}</p>}
                      {job.notify && <p><strong style={{ fontStyle: 'normal', color: 'var(--apple-text)' }}>Notify:</strong> {job.notify}</p>}
                      {job.additional && <p><strong style={{ fontStyle: 'normal', color: 'var(--apple-text)' }}>Additional:</strong> {job.additional}</p>}
                      {job.road_level && <p><strong style={{ fontStyle: 'normal', color: 'var(--apple-text)' }}>Road Level:</strong> {job.road_level}</p>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {filtered.length === 0 && <p className="text-center py-8" style={{ color: 'var(--apple-tertiary)' }}>No jobs match filters</p>}
      </div>

      {/* Floating assign bar */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          transform: selected.size > 0 ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid var(--apple-separator)',
            borderRadius: '16px 16px 0 0',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
            padding: '12px 16px',
          }}
        >
          {assignError && (
            <p style={{ fontSize: 13, color: 'var(--apple-red)', background: '#fff0f0', borderRadius: 8, padding: 8, marginBottom: 8 }}>{assignError}</p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--apple-text)', flexShrink: 0 }}>
              {selected.size} job{selected.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <select value={barPhase} onChange={e => setBarPhase(e.target.value)}>
                {PHASES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <select value={barCrew} onChange={e => setBarCrew(e.target.value)}>
                <option value="">Select crew</option>
                {crews.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <input type="date" value={barDate} onChange={e => setBarDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleAssign}
                disabled={!barCrew || assigning}
                style={{
                  background: !barCrew || assigning ? 'var(--apple-segment-bg)' : 'var(--apple-blue)',
                  color: !barCrew || assigning ? 'var(--apple-tertiary)' : 'white',
                  border: 'none', borderRadius: 8, padding: '8px 20px',
                  fontSize: 14, fontWeight: 500, cursor: !barCrew || assigning ? 'default' : 'pointer',
                  transition: 'var(--apple-transition)',
                }}
              >
                {assigning ? 'Assigning...' : 'Assign to Crew'}
              </button>
              <button
                onClick={() => { setSelected(new Set()); setAssignError(null) }}
                style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--apple-secondary)', cursor: 'pointer', textDecoration: 'underline' }}
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
