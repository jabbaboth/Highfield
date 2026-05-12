import { useState, useMemo, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useContractData } from '../lib/useContractData'
import { useAuth } from '../lib/useAuth'
import { feederStyle, PHASES, crewColor } from '../lib/feeder'

function formatDate(d) { return d.toISOString().split('T')[0] }

// Draggable job tile
function DraggableJob({ id, children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(id) })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        opacity: isDragging ? 0.4 : 1,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: 'opacity 0.15s ease, transform 0.15s ease',
        touchAction: 'none',
      }}
    >
      {children}
    </div>
  )
}

// Droppable zone
function DroppableZone({ id, isOver, children }) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? '#f0f7ff' : 'transparent',
        border: isOver ? '2px dashed var(--apple-blue)' : '2px solid transparent',
        borderRadius: 12,
        transition: 'all 0.15s ease',
        minHeight: 60,
        flex: 1,
      }}
    >
      {children}
    </div>
  )
}

// Job tile card for planner
function JobTile({ job, phaseInfo, isComplete, onComplete, onUnassign, canAssign }) {
  const fs = feederStyle(job.feeder)
  return (
    <div
      style={{
        background: 'var(--apple-bg)',
        borderRadius: 8,
        padding: '8px 10px',
        border: '1px solid rgba(0,0,0,0.06)',
        opacity: isComplete ? 0.5 : 1,
        cursor: 'grab',
      }}
    >
      <div className="flex items-start gap-2">
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: fs.border, flexShrink: 0, marginTop: 4 }} />
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--apple-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {job.full_address}
          </p>
          <div className="flex gap-2" style={{ marginTop: 2, fontSize: 11, color: 'var(--apple-secondary)' }}>
            <span>{job.spans || 0} spans</span>
            <span>{parseFloat(job[phaseInfo.hrsField]) || 0}h</span>
            {job.tm_type && <span style={{ color: '#c0392b' }}>{job.tm_type}</span>}
          </div>
        </div>
        <div className="flex gap-1">
          {!isComplete && onComplete && (
            <button
              onClick={e => { e.stopPropagation(); onComplete() }}
              style={{
                width: 24, height: 24, borderRadius: '50%',
                border: '2px solid var(--apple-green)', background: 'none',
                color: 'var(--apple-green)', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✓</button>
          )}
          {canAssign && onUnassign && (
            <button
              onClick={e => { e.stopPropagation(); onUnassign() }}
              style={{
                width: 24, height: 24, borderRadius: '50%',
                border: '2px solid var(--apple-red)', background: 'none',
                color: 'var(--apple-red)', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Planner() {
  const { jobs, assignments, assignmentsByJob, completionsByJob, crews, assignJobs, unassignJob, completeJob, loading } = useContractData()
  const { user } = useAuth()
  const role = user?.role || 'crew'
  const [date, setDate] = useState(() => formatDate(new Date()))
  const [activePhase, setActivePhase] = useState('main')
  const [activeId, setActiveId] = useState(null)
  const [overId, setOverId] = useState(null)

  const phaseInfo = PHASES.find(p => p.key === activePhase) || PHASES[0]
  const canAssign = role === 'admin' || role === 'foreman'

  const userCrewName = useMemo(() => {
    if (role !== 'crew') return null
    const match = crews.find(c => c.name.toLowerCase().includes(user?.name?.toLowerCase()))
    return match?.name || null
  }, [role, crews, user])

  const phaseCrewType = activePhase === 'main' ? 'hs' : activePhase === 'bucket' ? 'ewp' : 'chip'

  const visibleCrews = useMemo(() => {
    if (role === 'crew' && userCrewName) return crews.filter(c => c.name === userCrewName)
    return crews.filter(c => !c.crew_type || c.crew_type === phaseCrewType)
  }, [role, userCrewName, crews, phaseCrewType])

  // Sensors: pointer + touch with 150ms delay
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)

  const jobMap = useMemo(() => {
    const m = {}; jobs.forEach(j => { m[String(j.job_id)] = j }); return m
  }, [jobs])

  const dayAssignments = useMemo(() => {
    return assignments.filter(a => a.planned_date === date && (a.phase || 'main') === activePhase)
  }, [assignments, date, activePhase])

  const crewJobs = useMemo(() => {
    const map = {}
    visibleCrews.forEach(c => { map[c.name] = [] })
    dayAssignments.forEach(a => {
      const job = jobMap[String(a.job_id)]
      if (job && map[a.crew_name] !== undefined) {
        map[a.crew_name].push({ ...job, assignment: a })
      }
    })
    return map
  }, [visibleCrews, dayAssignments, jobMap])

  const unplanned = useMemo(() => {
    return jobs.filter(j => {
      const jid = String(j.job_id)
      const a = assignmentsByJob[jid] || {}
      const c = completionsByJob[jid] || {}
      return !a[activePhase] && !c[activePhase]
    })
  }, [jobs, assignmentsByJob, completionsByJob, activePhase])

  // Find which crew a job is currently in
  const findJobCrew = useCallback((jobId) => {
    const jid = String(jobId)
    const asg = dayAssignments.find(a => String(a.job_id) === jid)
    return asg?.crew_name || null
  }, [dayAssignments])

  function getCrewStats(crewName) {
    const list = crewJobs[crewName] || []
    const totalSpans = list.reduce((s, j) => s + (parseFloat(j.spans) || 0), 0)
    const totalHrs = list.reduce((s, j) => s + (parseFloat(j[phaseInfo.hrsField]) || 0), 0)
    return { count: list.length, totalSpans, totalHrs }
  }

  function hourBarColor(hrs) {
    if (hrs > 7) return 'var(--apple-red)'
    if (hrs > 5) return 'var(--apple-orange)'
    return 'var(--apple-green)'
  }

  // DnD handlers
  function handleDragStart(event) { setActiveId(event.active.id) }
  function handleDragOver(event) { setOverId(event.over?.id || null) }

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null); setOverId(null)
    if (!over || !canAssign) return

    const jobId = active.id
    const targetId = over.id // crew name or 'unplanned'
    const currentCrew = findJobCrew(jobId)

    if (targetId === 'unplanned') {
      // Drag to unplanned = unassign
      if (currentCrew) await unassignJob(Number(jobId), activePhase)
    } else {
      // Drag to a crew column
      if (currentCrew === targetId) return // same column, no-op
      if (currentCrew) {
        // Reassign: unassign then assign to new crew
        await unassignJob(Number(jobId), activePhase)
      }
      await assignJobs([Number(jobId)], targetId, date, activePhase, user?.name || '')
    }
  }

  const activeJob = activeId ? jobMap[String(activeId)] : null

  function prevDay() { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() - 1); setDate(formatDate(d)) }
  function nextDay() { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() + 1); setDate(formatDate(d)) }

  if (loading) return <div style={{ padding: 24, color: 'var(--apple-secondary)' }}>Loading...</div>

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full">
        {/* Phase toggle — segmented control */}
        <div className="flex justify-center p-3" style={{ borderBottom: '1px solid var(--apple-separator)' }}>
          <div className="flex p-1 gap-0.5" style={{ background: 'var(--apple-segment-bg)', borderRadius: 10 }}>
            {PHASES.map(p => (
              <button
                key={p.key}
                onClick={() => setActivePhase(p.key)}
                style={{
                  padding: '7px 18px', borderRadius: 8, border: 'none',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  color: activePhase === p.key ? 'var(--apple-text)' : 'var(--apple-secondary)',
                  background: activePhase === p.key ? 'white' : 'transparent',
                  boxShadow: activePhase === p.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'var(--apple-transition)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date picker */}
        <div className="flex items-center justify-center gap-4 p-3" style={{ borderBottom: '1px solid var(--apple-separator)' }}>
          <button onClick={prevDay} style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--apple-bg)', border: 'none', fontSize: 16, cursor: 'pointer', fontWeight: 600, color: 'var(--apple-secondary)' }}>◀</button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <button onClick={nextDay} style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--apple-bg)', border: 'none', fontSize: 16, cursor: 'pointer', fontWeight: 600, color: 'var(--apple-secondary)' }}>▶</button>
        </div>

        {/* Crew columns */}
        <div className="flex-1 overflow-auto p-3">
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: `repeat(${Math.max(visibleCrews.length, 1)}, minmax(220px, 1fr))` }}>
            {visibleCrews.map(crew => {
              const stats = getCrewStats(crew.name)
              const jobList = crewJobs[crew.name] || []
              const color = crewColor(crews, crew.name)
              const isOverThis = overId === crew.name

              return (
                <div key={crew.name} style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Column header card */}
                  <div style={{
                    background: 'white', borderRadius: 'var(--apple-radius)',
                    boxShadow: 'var(--apple-shadow)',
                    borderTop: `3px solid ${color}`,
                    padding: 12, marginBottom: 8,
                  }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--apple-text)' }}>{crew.name}</h3>
                    <div style={{ fontSize: 12, color: 'var(--apple-secondary)', marginTop: 2 }}>
                      {stats.count} jobs · {stats.totalSpans} spans · {stats.totalHrs.toFixed(1)}h
                    </div>
                    <div style={{ marginTop: 8, height: 6, background: 'var(--apple-segment-bg)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${Math.min((stats.totalHrs / 10) * 100, 100)}%`,
                        background: hourBarColor(stats.totalHrs),
                        transition: 'width 0.3s ease, background 0.3s ease',
                      }} />
                    </div>
                  </div>

                  {/* Droppable job list */}
                  <DroppableZone id={crew.name} isOver={isOverThis}>
                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: 6, padding: 4,
                      opacity: activeId && !isOverThis ? 0.7 : 1,
                      transition: 'opacity 0.15s ease',
                    }}>
                      {jobList.length === 0 && !isOverThis && (
                        <p style={{ fontSize: 12, color: 'var(--apple-tertiary)', textAlign: 'center', padding: 16 }}>No jobs</p>
                      )}
                      {jobList.map(job => {
                        const jid = String(job.job_id)
                        const comp = completionsByJob[jid]?.[activePhase]
                        return (
                          <DraggableJob key={job.job_id} id={job.job_id}>
                            <JobTile
                              job={job} phaseInfo={phaseInfo} isComplete={!!comp}
                              onComplete={() => completeJob(job.job_id, activePhase, user?.id, user?.name)}
                              onUnassign={() => unassignJob(job.job_id, activePhase)}
                              canAssign={canAssign}
                            />
                          </DraggableJob>
                        )
                      })}
                    </div>
                  </DroppableZone>
                </div>
              )
            })}
          </div>

          {/* Unplanned jobs — droppable + draggable (admin/foreman only) */}
          {canAssign && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--apple-text)', marginBottom: 8 }}>
                Unplanned {phaseInfo.label} Jobs ({unplanned.length})
              </h3>
              <DroppableZone id="unplanned" isOver={overId === 'unplanned'}>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 8, padding: 4,
                }}>
                  {unplanned.slice(0, 60).map(job => (
                    <DraggableJob key={job.job_id} id={job.job_id}>
                      <JobTile
                        job={job} phaseInfo={phaseInfo} isComplete={false}
                        canAssign={false}
                      />
                    </DraggableJob>
                  ))}
                </div>
                {unplanned.length > 60 && (
                  <p style={{ fontSize: 12, color: 'var(--apple-tertiary)', marginTop: 8 }}>
                    Showing 60 of {unplanned.length}
                  </p>
                )}
              </DroppableZone>
            </div>
          )}
        </div>
      </div>

      {/* Drag overlay — preview card following cursor */}
      <DragOverlay>
        {activeJob && (
          <div style={{
            background: 'white', borderRadius: 8, padding: '8px 12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            border: '1px solid rgba(0,0,0,0.06)',
            maxWidth: 250, transform: 'scale(1.02)',
          }}>
            <div className="flex items-center gap-2">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: feederStyle(activeJob.feeder).border }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--apple-text)' }}>
                {activeJob.full_address}
              </span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
