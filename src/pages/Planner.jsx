import { useState, useMemo, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Link } from 'react-router-dom'
import { useContractData } from '../lib/useContractData'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import { feederStyle, PHASES, crewColor } from '../lib/feeder'

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatPhone(phone) {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('64')) return `+${digits}`
  if (digits.startsWith('0')) return `+64${digits.slice(1)}`
  return phone
}

function getWeekDays(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  const days = []
  for (let i = 0; i < 5; i++) {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    days.push(formatDate(dd))
  }
  return days
}

function DetailRow({ label, value, large }) {
  if (!value && value !== 0) return null
  const sz = large ? 13 : 11
  const minW = large ? 80 : 70
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: sz, lineHeight: 1.6 }}>
      <span style={{ color: 'var(--apple-tertiary)', fontWeight: 500, minWidth: minW, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--apple-text)', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}

// ─── Crew View ──────────────────────────────────────────────────────────────

function CrewPlanner() {
  const { jobs, assignments, completionsByJob, crews, workAuthorities, completeJob, uncompleteJob, loading } = useContractData()
  const { user, contractId, contracts } = useAuth()

  const [date, setDate] = useState(() => formatDate(new Date()))
  const [expandedJobId, setExpandedJobId] = useState(null)

  const myCrew = useMemo(() => {
    if (!user?.name) return null
    return crews.find(c => c.name.toLowerCase() === user.name.toLowerCase()) ||
           crews.find(c => c.name.toLowerCase().includes(user.name.toLowerCase())) ||
           null
  }, [crews, user])

  const crewName = myCrew?.name
  const crewType = myCrew?.crew_type || 'hs'
  const phase = crewType === 'ewp' ? 'bucket' : crewType === 'chip' ? 'chip' : 'main'
  const phaseInfo = PHASES.find(p => p.key === phase) || PHASES[0]

  const jobMap = useMemo(() => {
    const m = {}; jobs.forEach(j => { m[String(j.job_id)] = j }); return m
  }, [jobs])

  const myDayJobs = useMemo(() => {
    if (!crewName) return []
    return assignments
      .filter(a => a.crew_name === crewName && a.planned_date === date && (a.phase || 'main') === phase)
      .map(a => jobMap[String(a.job_id)])
      .filter(Boolean)
  }, [assignments, crewName, date, phase, jobMap])

  const weekDays = useMemo(() => getWeekDays(date), [date])

  const weekStats = useMemo(() => {
    if (!crewName) return weekDays.map(d => ({ date: d, jobs: 0, spans: 0, hrs: 0 }))
    return weekDays.map(d => {
      const dayJobs = assignments
        .filter(a => a.crew_name === crewName && a.planned_date === d && (a.phase || 'main') === phase)
        .map(a => jobMap[String(a.job_id)])
        .filter(Boolean)
      return {
        date: d,
        jobs: dayJobs.length,
        spans: dayJobs.reduce((s, j) => s + (parseFloat(j.spans) || 0), 0),
        hrs: dayJobs.reduce((s, j) => s + (parseFloat(j[phaseInfo.hrsField]) || 0), 0),
      }
    })
  }, [weekDays, assignments, crewName, phase, jobMap, phaseInfo])

  const weekTotals = useMemo(() => ({
    jobs: weekStats.reduce((s, d) => s + d.jobs, 0),
    spans: weekStats.reduce((s, d) => s + d.spans, 0),
    hrs: weekStats.reduce((s, d) => s + d.hrs, 0),
  }), [weekStats])

  const waColorByFeeder = useMemo(() => {
    const map = {}
    workAuthorities.forEach(wa => {
      if (wa.color && !map[String(wa.feeder)]) map[String(wa.feeder)] = wa.color
    })
    return map
  }, [workAuthorities])

  const wasByFeeder = useMemo(() => {
    const map = {}
    workAuthorities.forEach(wa => {
      const f = String(wa.feeder)
      if (!map[f]) map[f] = []
      map[f].push(wa)
    })
    return map
  }, [workAuthorities])

  const waCoverageToday = useMemo(() => {
    const myFeeders = [...new Set(myDayJobs.map(j => String(j.feeder)).filter(Boolean))]
    return myFeeders.map(f => {
      const was = workAuthorities.filter(wa => String(wa.feeder) === f && (wa.dates || []).includes(date))
      return { feeder: f, covered: was.length > 0, was }
    })
  }, [myDayJobs, workAuthorities, date])

  const dailySpans = myDayJobs.reduce((s, j) => s + (parseFloat(j.spans) || 0), 0)
  const dailyHrs = myDayJobs.reduce((s, j) => s + (parseFloat(j[phaseInfo.hrsField]) || 0), 0)
  const completedCount = myDayJobs.filter(j => !!completionsByJob[String(j.job_id)]?.[phase]).length

  const contract = contracts.find(c => c.id === contractId)
  const mapPdfPath = contract?.map_pdf_path

  function getDotColor(job) {
    return waColorByFeeder[String(job.feeder)] || feederStyle(job.feeder).border
  }

  function hourBarColor(hrs) {
    if (hrs > 7) return 'var(--apple-red)'
    if (hrs > 5) return 'var(--apple-orange)'
    return 'var(--apple-green)'
  }

  function prevDay() { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() - 1); setDate(formatDate(d)) }
  function nextDay() { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() + 1); setDate(formatDate(d)) }

  const todayStr = formatDate(new Date())

  async function handleViewMap() {
    if (!mapPdfPath) return
    const win = window.open('', '_blank')
    const { data, error } = await supabase.storage.from('work-authorities').createSignedUrl(mapPdfPath, 3600)
    if (error || !data?.signedUrl) { if (win) win.close(); return }
    win.location.href = data.signedUrl
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--apple-secondary)' }}>Loading...</div>

  if (!crewName) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--apple-text)' }}>No crew found</p>
      <p style={{ fontSize: 14, color: 'var(--apple-secondary)', marginTop: 8 }}>
        Your account isn't linked to a crew yet. Contact your foreman or admin.
      </p>
    </div>
  )

  const dateDisplay = new Date(date + 'T00:00:00').toLocaleDateString('en-NZ', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 32 }}>
      {/* Date navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', background: 'white',
        borderBottom: '1px solid var(--apple-separator)',
      }}>
        <button onClick={prevDay} style={{
          width: 44, height: 44, borderRadius: 12, background: 'var(--apple-bg)',
          border: 'none', fontSize: 18, cursor: 'pointer', fontWeight: 600,
          color: 'var(--apple-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>&#9664;</button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--apple-text)' }}>{dateDisplay}</p>
          {date === todayStr && <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--apple-blue)', marginTop: 2 }}>Today</p>}
        </div>
        <button onClick={nextDay} style={{
          width: 44, height: 44, borderRadius: 12, background: 'var(--apple-bg)',
          border: 'none', fontSize: 18, cursor: 'pointer', fontWeight: 600,
          color: 'var(--apple-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>&#9654;</button>
      </div>

      {/* Daily stats */}
      <div style={{ margin: '16px 16px 0', padding: 16, borderRadius: 16, background: 'white', boxShadow: 'var(--apple-shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: crewColor(crews, crewName) }} />
          <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--apple-text)' }}>{crewName}</h2>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, marginLeft: 'auto',
            background: completedCount === myDayJobs.length && myDayJobs.length > 0 ? '#d4edda' : 'var(--apple-bg)',
            color: completedCount === myDayJobs.length && myDayJobs.length > 0 ? '#155724' : 'var(--apple-secondary)',
          }}>
            {completedCount}/{myDayJobs.length} done
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div style={{ textAlign: 'center', padding: '14px 8px', borderRadius: 12, background: 'var(--apple-bg)' }}>
            <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--apple-text)' }}>{myDayJobs.length}</p>
            <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--apple-secondary)', marginTop: 2 }}>Jobs</p>
          </div>
          <div style={{ textAlign: 'center', padding: '14px 8px', borderRadius: 12, background: 'var(--apple-bg)' }}>
            <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--apple-blue)' }}>{dailySpans}</p>
            <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--apple-secondary)', marginTop: 2 }}>Spans</p>
          </div>
          <div style={{ textAlign: 'center', padding: '14px 8px', borderRadius: 12, background: 'var(--apple-bg)' }}>
            <p style={{ fontSize: 26, fontWeight: 700, color: hourBarColor(dailyHrs) }}>{dailyHrs.toFixed(1)}</p>
            <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--apple-secondary)', marginTop: 2 }}>Hours</p>
          </div>
        </div>
      </div>

      {/* Weekly overview */}
      <div style={{ margin: '12px 16px 0', padding: 16, borderRadius: 16, background: 'white', boxShadow: 'var(--apple-shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--apple-text)' }}>This Week</h3>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--apple-blue)' }}>
            {weekTotals.spans} spans · {weekTotals.hrs.toFixed(1)}h
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {weekStats.map(d => {
            const isSelected = d.date === date
            const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en-NZ', { weekday: 'short' })
            const dayNum = new Date(d.date + 'T00:00:00').getDate()
            return (
              <button
                key={d.date}
                onClick={() => setDate(d.date)}
                style={{
                  flex: 1, padding: '10px 4px', borderRadius: 12, border: 'none',
                  background: isSelected ? 'var(--apple-blue)' : d.date === todayStr ? '#e8f4fd' : 'var(--apple-bg)',
                  cursor: 'pointer', textAlign: 'center',
                }}
              >
                <p style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                  color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--apple-tertiary)',
                }}>{dayLabel}</p>
                <p style={{
                  fontSize: 15, fontWeight: 700, marginTop: 2,
                  color: isSelected ? 'white' : 'var(--apple-text)',
                }}>{dayNum}</p>
                <p style={{
                  fontSize: 12, fontWeight: 600, marginTop: 4,
                  color: isSelected ? 'rgba(255,255,255,0.9)' : d.spans > 0 ? 'var(--apple-blue)' : 'var(--apple-tertiary)',
                }}>
                  {d.spans > 0 ? `${d.spans}` : '-'}
                </p>
                <p style={{
                  fontSize: 9, fontWeight: 500, marginTop: 1,
                  color: isSelected ? 'rgba(255,255,255,0.6)' : 'var(--apple-tertiary)',
                }}>
                  {d.spans > 0 ? 'spans' : ''}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick links: Map */}
      {mapPdfPath && (
        <div style={{ margin: '12px 16px 0' }}>
          <button onClick={handleViewMap} style={{
            width: '100%', padding: '14px 16px', borderRadius: 12,
            background: 'white', boxShadow: 'var(--apple-shadow)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--apple-text)' }}>Contract Map</span>
            <span style={{ fontSize: 13, color: 'var(--apple-blue)', fontWeight: 600 }}>View PDF &#8250;</span>
          </button>
        </div>
      )}

      {/* WA coverage for today's feeders */}
      {waCoverageToday.length > 0 && (
        <div style={{ margin: '12px 16px 0', padding: 16, borderRadius: 16, background: 'white', boxShadow: 'var(--apple-shadow)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--apple-text)', marginBottom: 10 }}>WA Coverage</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {waCoverageToday.map(({ feeder, covered, was }) => (
              <div key={feeder} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                borderRadius: 10, background: covered ? '#d4edda' : '#fff3cd',
              }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: covered ? '#155724' : '#856404' }}>
                  {covered ? '✓' : '!'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--apple-text)' }}>
                  {feederStyle(feeder).label || feeder}
                </span>
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
                  {covered ? was.map(w => (
                    <span key={w.id} style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                      background: (w.color || '#155724') + '20', color: w.color || '#155724',
                    }}>{w.wa_number}</span>
                  )) : (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#856404' }}>No WA</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job list */}
      <div style={{ margin: '16px 16px 0' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--apple-text)', marginBottom: 10, padding: '0 4px' }}>
          Today's Jobs
        </h3>

        {myDayJobs.length === 0 && (
          <div style={{
            padding: 40, textAlign: 'center', borderRadius: 16,
            background: 'white', boxShadow: 'var(--apple-shadow)',
          }}>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--apple-secondary)' }}>No jobs planned</p>
            <p style={{ fontSize: 13, color: 'var(--apple-tertiary)', marginTop: 6 }}>
              Use the week view above to check other days
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {myDayJobs.map(job => {
            const jid = String(job.job_id)
            const isComplete = !!completionsByJob[jid]?.[phase]
            const expanded = expandedJobId === job.job_id
            const dotColor = getDotColor(job)
            const noWa = !workAuthorities.some(wa =>
              String(wa.feeder) === String(job.feeder) && (wa.dates || []).includes(date)
            )

            return (
              <div
                key={job.job_id}
                onClick={() => setExpandedJobId(expanded ? null : job.job_id)}
                style={{
                  background: isComplete ? '#f0fff0' : noWa ? '#fff8f0' : 'white',
                  borderRadius: 14, padding: '14px 16px',
                  boxShadow: 'var(--apple-shadow)',
                  border: isComplete ? '1px solid #c3e6cb' : noWa ? '1px solid #f0ad4e40' : '1px solid rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%', background: dotColor,
                    flexShrink: 0, marginTop: 5,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 15, fontWeight: 600,
                      color: isComplete ? 'var(--apple-secondary)' : 'var(--apple-text)',
                      textDecoration: isComplete ? 'line-through' : 'none',
                    }}>
                      {job.full_address}
                    </p>
                    <div style={{ display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--apple-blue)' }}>
                        {parseFloat(job.spans) || 0} spans
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--apple-secondary)' }}>
                        {(parseFloat(job[phaseInfo.hrsField]) || 0).toFixed(1)}h
                      </span>
                      {job.tm_type && (
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: '#c0392b',
                          padding: '2px 8px', borderRadius: 6, background: '#c0392b12',
                        }}>{job.tm_type}</span>
                      )}
                      {noWa && (
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: '#f0ad4e',
                          padding: '2px 8px', borderRadius: 6, background: '#f0ad4e20',
                        }}>No WA</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={e => {
                      e.stopPropagation()
                      if (isComplete) uncompleteJob(job.job_id, phase)
                      else completeJob(job.job_id, phase, user?.id, user?.name)
                    }}
                    style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      border: isComplete ? 'none' : '2.5px solid var(--apple-green)',
                      background: isComplete ? 'var(--apple-green)' : 'transparent',
                      color: isComplete ? 'white' : 'var(--apple-green)',
                      fontSize: 20, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >&#10003;</button>
                </div>

                {expanded && (
                  <div style={{
                    marginTop: 14, paddingTop: 14,
                    borderTop: '1px solid var(--apple-separator)',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <DetailRow large label="Job ID" value={job.job_id} />
                    <DetailRow large label="Address" value={job.full_address} />
                    <DetailRow large label="Owner" value={job.owner} />
                    {job.phone && (
                      <div style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.6 }}>
                        <span style={{ color: 'var(--apple-tertiary)', fontWeight: 500, minWidth: 80, flexShrink: 0 }}>Phone</span>
                        <a href={`tel:${formatPhone(job.phone)}`}
                          onClick={e => e.stopPropagation()}
                          style={{ color: 'var(--apple-blue)', fontWeight: 600, textDecoration: 'none', fontSize: 16 }}>
                          {job.phone}
                        </a>
                      </div>
                    )}
                    <DetailRow large label="Feeder" value={job.feeder} />
                    <DetailRow large label="Spans" value={job.spans} />
                    <DetailRow large label="H&S Hrs" value={parseFloat(job.hs_hrs) || null} />
                    <DetailRow large label="EWP Hrs" value={parseFloat(job.ewp_hrs) || null} />
                    <DetailRow large label="Cleanup" value={parseFloat(job.cleanup_hrs) || null} />
                    <DetailRow large label="TM Type" value={job.tm_type} />
                    <DetailRow large label="Notify" value={job.notify} />
                    <DetailRow large label="OK Lett" value={job.ok_lett} />
                    <DetailRow large label="Comments" value={job.comments} />
                    <DetailRow large label="Additional" value={job.additional} />
                    {wasByFeeder[String(job.feeder)]?.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.6 }}>
                        <span style={{ color: 'var(--apple-tertiary)', fontWeight: 500, minWidth: 80, flexShrink: 0 }}>WA</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {wasByFeeder[String(job.feeder)].map(wa => (
                            <span key={wa.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: wa.color || '#9ca3af' }} />
                              <span style={{ fontWeight: 500 }}>{wa.wa_number}</span>
                              {wa.pdf_path && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    const win = window.open('', '_blank')
                                    const { data } = await supabase.storage.from('work-authorities').createSignedUrl(wa.pdf_path, 3600)
                                    if (data?.signedUrl) win.location.href = data.signedUrl
                                    else if (win) win.close()
                                  }}
                                  style={{
                                    background: 'var(--apple-blue)', color: 'white',
                                    border: 'none', borderRadius: 6, padding: '3px 8px',
                                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                  }}
                                >PDF</button>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Admin / Foreman View ───────────────────────────────────────────────────

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

function JobTile({ job, phaseInfo, isComplete, onComplete, onUnassign, canAssign, noWaCoverage, dotColor, expanded, onToggle, waInfo }) {
  return (
    <div
      onClick={onToggle}
      style={{
        background: noWaCoverage ? '#fff8f0' : 'var(--apple-bg)',
        borderRadius: 8,
        padding: '8px 10px',
        border: noWaCoverage ? '1px solid #f0ad4e40' : '1px solid rgba(0,0,0,0.06)',
        opacity: isComplete ? 0.5 : 1,
        cursor: 'grab',
      }}
    >
      <div className="flex items-start gap-2">
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 4 }} />
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--apple-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {job.full_address}
          </p>
          <div className="flex gap-2" style={{ marginTop: 2, fontSize: 11, color: 'var(--apple-secondary)' }}>
            <span>{job.spans || 0} spans</span>
            <span>{parseFloat(job[phaseInfo.hrsField]) || 0}h</span>
            {job.tm_type && <span style={{ color: '#c0392b' }}>{job.tm_type}</span>}
            {noWaCoverage && <span style={{ color: '#f0ad4e', fontWeight: 600 }}>No WA</span>}
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
            >&#10003;</button>
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
            >x</button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--apple-separator)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <DetailRow label="Job ID" value={job.job_id} />
            <DetailRow label="Address" value={job.full_address} />
            <DetailRow label="Owner" value={job.owner} />
            {job.phone && (
              <div style={{ display: 'flex', gap: 8, fontSize: 11, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--apple-tertiary)', fontWeight: 500, minWidth: 70, flexShrink: 0 }}>Phone</span>
                <a href={`tel:${formatPhone(job.phone)}`} style={{ color: 'var(--apple-blue)', fontWeight: 600, textDecoration: 'none' }}
                  onClick={e => e.stopPropagation()}>
                  {job.phone}
                </a>
              </div>
            )}
            <DetailRow label="Feeder" value={job.feeder} />
            <DetailRow label="Spans" value={job.spans} />
            <DetailRow label="H&S Hrs" value={parseFloat(job.hs_hrs) || null} />
            <DetailRow label="EWP Hrs" value={parseFloat(job.ewp_hrs) || null} />
            <DetailRow label="Cleanup Hrs" value={parseFloat(job.cleanup_hrs) || null} />
            <DetailRow label="TM Type" value={job.tm_type} />
            <DetailRow label="Notify" value={job.notify} />
            <DetailRow label="OK Lett" value={job.ok_lett} />
            <DetailRow label="Comments" value={job.comments} />
            <DetailRow label="Additional" value={job.additional} />
            {waInfo && waInfo.length > 0 && (
              <div style={{ display: 'flex', gap: 8, fontSize: 11, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--apple-tertiary)', fontWeight: 500, minWidth: 70, flexShrink: 0 }}>WA</span>
                <div className="flex flex-wrap gap-1">
                  {waInfo.map(wa => (
                    <span key={wa.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: wa.color || '#9ca3af' }} />
                      <span style={{ color: 'var(--apple-text)', fontWeight: 500 }}>{wa.wa_number}</span>
                      {wa.pdf_path && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            const win = window.open('', '_blank')
                            const { data } = await supabase.storage.from('work-authorities').createSignedUrl(wa.pdf_path, 3600)
                            if (data?.signedUrl) win.location.href = data.signedUrl
                            else if (win) win.close()
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--apple-blue)', cursor: 'pointer', fontSize: 11, fontWeight: 500, padding: 0 }}
                        >PDF</button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AdminPlanner() {
  const { jobs, assignments, assignmentsByJob, completionsByJob, crews, workAuthorities, notifications, assignJobs, unassignJob, completeJob, loading } = useContractData()
  const { user } = useAuth()
  const role = user?.role || 'crew'
  const [date, setDate] = useState(() => formatDate(new Date()))
  const [activePhase, setActivePhase] = useState('main')
  const [activeId, setActiveId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [expandedJobId, setExpandedJobId] = useState(null)

  const phaseInfo = PHASES.find(p => p.key === activePhase) || PHASES[0]
  const canAssign = role === 'admin' || role === 'foreman'

  const phaseCrewType = activePhase === 'main' ? 'hs' : activePhase === 'bucket' ? 'ewp' : 'chip'

  const visibleCrews = useMemo(() => {
    return crews.filter(c => !c.crew_type || c.crew_type === phaseCrewType)
  }, [crews, phaseCrewType])

  const waCoveredFeeders = useMemo(() => {
    const set = new Set()
    workAuthorities.forEach(wa => {
      if ((wa.dates || []).includes(date)) set.add(String(wa.feeder))
    })
    return set
  }, [workAuthorities, date])

  const waColorByFeeder = useMemo(() => {
    const map = {}
    workAuthorities.forEach(wa => {
      if (wa.color && !map[String(wa.feeder)]) map[String(wa.feeder)] = wa.color
    })
    return map
  }, [workAuthorities])

  const wasByFeeder = useMemo(() => {
    const map = {}
    workAuthorities.forEach(wa => {
      const f = String(wa.feeder)
      if (!map[f]) map[f] = []
      map[f].push(wa)
    })
    return map
  }, [workAuthorities])

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

  function getDotColor(job) {
    const feederColor = waColorByFeeder[String(job.feeder)]
    if (feederColor) return feederColor
    return feederStyle(job.feeder).border
  }

  function handleDragStart(event) { setActiveId(event.active.id) }
  function handleDragOver(event) { setOverId(event.over?.id || null) }

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null); setOverId(null)
    if (!over || !canAssign) return

    const jobId = active.id
    const targetId = over.id
    const currentCrew = findJobCrew(jobId)

    if (targetId === 'unplanned') {
      if (currentCrew) await unassignJob(Number(jobId), activePhase)
    } else {
      if (currentCrew === targetId) return
      if (currentCrew) await unassignJob(Number(jobId), activePhase)
      await assignJobs([Number(jobId)], targetId, date, activePhase, user?.name || '')
    }
  }

  const activeJob = activeId ? jobMap[String(activeId)] : null

  function prevDay() { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() - 1); setDate(formatDate(d)) }
  function nextDay() { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() + 1); setDate(formatDate(d)) }

  const todayStr = formatDate(new Date())
  const dueNotifCount = useMemo(() =>
    notifications.filter(n => !n.contacted && n.notify_date && n.notify_date <= todayStr).length,
    [notifications, todayStr]
  )

  if (loading) return <div style={{ padding: 24, color: 'var(--apple-secondary)' }}>Loading...</div>

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full">
        {dueNotifCount > 0 && canAssign && (
          <Link to="/notifications" style={{
            background: 'linear-gradient(135deg, #fff8ef 0%, #fff0e0 100%)',
            borderBottom: '1px solid #f0ad4e40',
            padding: '10px 16px', textDecoration: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--apple-text)' }}>
              {dueNotifCount} homeowner{dueNotifCount !== 1 ? 's' : ''} to contact today before crews arrive
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--apple-blue)' }}>View</span>
          </Link>
        )}

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

        <div className="flex items-center justify-center gap-4 p-3" style={{ borderBottom: '1px solid var(--apple-separator)' }}>
          <button onClick={prevDay} style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--apple-bg)', border: 'none', fontSize: 16, cursor: 'pointer', fontWeight: 600, color: 'var(--apple-secondary)' }}>&#9664;</button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <button onClick={nextDay} style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--apple-bg)', border: 'none', fontSize: 16, cursor: 'pointer', fontWeight: 600, color: 'var(--apple-secondary)' }}>&#9654;</button>
        </div>

        <div className="flex-1 overflow-auto p-3">
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: `repeat(${Math.max(visibleCrews.length, 1)}, minmax(220px, 1fr))` }}>
            {visibleCrews.map(crew => {
              const stats = getCrewStats(crew.name)
              const jobList = crewJobs[crew.name] || []
              const color = crewColor(crews, crew.name)
              const isOverThis = overId === crew.name

              return (
                <div key={crew.name} style={{ display: 'flex', flexDirection: 'column' }}>
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
                              noWaCoverage={!waCoveredFeeders.has(String(job.feeder))}
                              dotColor={getDotColor(job)}
                              expanded={expandedJobId === job.job_id}
                              onToggle={() => setExpandedJobId(expandedJobId === job.job_id ? null : job.job_id)}
                              waInfo={wasByFeeder[String(job.feeder)]}
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
                        noWaCoverage={!waCoveredFeeders.has(String(job.feeder))}
                        dotColor={getDotColor(job)}
                        expanded={expandedJobId === job.job_id}
                        onToggle={() => setExpandedJobId(expandedJobId === job.job_id ? null : job.job_id)}
                        waInfo={wasByFeeder[String(job.feeder)]}
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

      <DragOverlay>
        {activeJob && (
          <div style={{
            background: 'white', borderRadius: 8, padding: '8px 12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            border: '1px solid rgba(0,0,0,0.06)',
            maxWidth: 250, transform: 'scale(1.02)',
          }}>
            <div className="flex items-center gap-2">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: getDotColor(activeJob) }} />
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

// ─── Router entry point ─────────────────────────────────────────────────────

export default function Planner() {
  const { user } = useAuth()
  const role = user?.role || 'crew'
  if (role === 'crew') return <CrewPlanner />
  return <AdminPlanner />
}
