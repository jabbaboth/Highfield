import { useState, useMemo } from 'react'
import { useContractData } from '../lib/useContractData'
import { useAuth } from '../lib/useAuth'
import { FEEDERS, feederStyle, PHASES } from '../lib/feeder'

function getJobPipelineStage(job, assignmentsByJob, completionsByJob) {
  const jid = String(job.job_id)
  const a = assignmentsByJob[jid] || {}
  const c = completionsByJob[jid] || {}
  if (c.chip) return 'complete'
  if (a.chip) return 'chip_active'
  if (c.bucket || (c.main && !job.ewp_hrs)) return 'ready_chip'
  if (a.bucket) return 'ewp_active'
  if (c.main) return 'ready_ewp'
  if (a.main) return 'hs_active'
  return 'not_started'
}

const PIPELINE_STAGES = [
  { key: 'not_started', label: 'Not Started', color: '#aeaeb2', bg: '#f5f5f7' },
  { key: 'hs_active', label: 'H&S Active', color: '#0071e3', bg: '#e8f4fd' },
  { key: 'ready_ewp', label: 'Ready EWP', color: '#ff9500', bg: '#fff8ef' },
  { key: 'ewp_active', label: 'EWP Active', color: '#af52de', bg: '#f5ecfc' },
  { key: 'ready_chip', label: 'Ready Chip', color: '#ff6723', bg: '#fff1eb' },
  { key: 'chip_active', label: 'Chip Active', color: '#32ade6', bg: '#eaf6fd' },
  { key: 'complete', label: 'Complete', color: '#34c759', bg: '#e8f8ed' },
]

export default function Progress() {
  const { jobs, assignmentsByJob, completionsByJob, completeJob, uncompleteJob, loading } = useContractData()
  const { user } = useAuth()
  const [feederFilter, setFeederFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')

  const pipelineCounts = useMemo(() => {
    const counts = {}
    PIPELINE_STAGES.forEach(s => { counts[s.key] = 0 })
    jobs.forEach(j => { counts[getJobPipelineStage(j, assignmentsByJob, completionsByJob)]++ })
    return counts
  }, [jobs, assignmentsByJob, completionsByJob])

  const feederStats = useMemo(() => {
    return FEEDERS.map(f => {
      const fJobs = jobs.filter(j => String(j.feeder) === f)
      const fullyDone = fJobs.filter(j => {
        const c = completionsByJob[String(j.job_id)] || {}
        return c.main && (c.bucket || !j.ewp_hrs) && (c.chip || !j.cleanup_hrs)
      })
      const totalSpans = fJobs.reduce((s, j) => s + (parseFloat(j.spans) || 0), 0)
      const doneSpans = fullyDone.reduce((s, j) => s + (parseFloat(j.spans) || 0), 0)
      const totalHs = fJobs.reduce((s, j) => s + (parseFloat(j.hs_hrs) || 0), 0)
      const totalEwp = fJobs.reduce((s, j) => s + (parseFloat(j.ewp_hrs) || 0), 0)
      const fs = feederStyle(f)
      return { feeder: f, style: fs, total: fJobs.length, done: fullyDone.length,
        pct: fJobs.length ? Math.round((fullyDone.length / fJobs.length) * 100) : 0,
        totalSpans, doneSpans, totalHs, totalEwp }
    })
  }, [jobs, completionsByJob])

  const filtered = useMemo(() => {
    let list = [...jobs]
    if (feederFilter) list = list.filter(j => String(j.feeder) === feederFilter)
    if (stageFilter) list = list.filter(j => getJobPipelineStage(j, assignmentsByJob, completionsByJob) === stageFilter)
    list.sort((a, b) => {
      const stages = PIPELINE_STAGES.map(s => s.key)
      const sa = stages.indexOf(getJobPipelineStage(a, assignmentsByJob, completionsByJob))
      const sb = stages.indexOf(getJobPipelineStage(b, assignmentsByJob, completionsByJob))
      if (sa !== sb) return sb - sa
      return String(a.feeder).localeCompare(String(b.feeder))
    })
    return list
  }, [jobs, feederFilter, stageFilter, assignmentsByJob, completionsByJob])

  if (loading) return <div style={{ padding: 24, color: 'var(--apple-secondary)' }}>Loading...</div>

  return (
    <div style={{ padding: 16 }} className="space-y-4">
      {/* Pipeline */}
      <div style={{ background: 'white', borderRadius: 'var(--apple-radius-lg)', boxShadow: 'var(--apple-shadow)', padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--apple-text)', marginBottom: 12 }}>Pipeline</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {PIPELINE_STAGES.map(s => (
            <button
              key={s.key}
              onClick={() => setStageFilter(stageFilter === s.key ? '' : s.key)}
              style={{
                background: s.bg, borderRadius: 12, padding: 10, textAlign: 'center',
                border: stageFilter === s.key ? `2px solid ${s.color}` : '2px solid transparent',
                cursor: 'pointer', transition: 'var(--apple-transition)',
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 600, color: s.color }}>{pipelineCounts[s.key]}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Feeder cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {feederStats.map(fs => (
          <div key={fs.feeder} style={{ background: 'white', borderRadius: 'var(--apple-radius-lg)', boxShadow: 'var(--apple-shadow)', padding: 16 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: fs.style.border }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--apple-text)' }}>Feeder {fs.feeder}</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--apple-text)' }}>{fs.pct}%</div>
            <div style={{ height: 6, background: 'var(--apple-segment-bg)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${fs.pct}%`, background: fs.style.border, transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--apple-secondary)' }} className="space-y-0.5">
              <p>Jobs: {fs.done}/{fs.total}</p>
              <p>Spans: {fs.doneSpans}/{fs.totalSpans}</p>
              <p>H&S: {fs.totalHs.toFixed(1)}h · EWP: {fs.totalEwp.toFixed(1)}h</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={feederFilter} onChange={e => setFeederFilter(e.target.value)}>
          <option value="">All Feeders</option>
          {FEEDERS.map(f => <option key={f} value={f}>Feeder {f}</option>)}
        </select>
        {stageFilter && (
          <button onClick={() => setStageFilter('')}
            style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--apple-blue)', cursor: 'pointer' }}>
            Clear stage filter
          </button>
        )}
      </div>

      {/* Job list */}
      <div className="space-y-2">
        {filtered.map(job => {
          const jid = String(job.job_id)
          const a = assignmentsByJob[jid] || {}
          const c = completionsByJob[jid] || {}
          const stage = getJobPipelineStage(job, assignmentsByJob, completionsByJob)
          const stageInfo = PIPELINE_STAGES.find(s => s.key === stage)
          const fs = feederStyle(job.feeder)
          const fullyDone = stage === 'complete'

          return (
            <div key={job.job_id}
              className="flex items-center gap-3"
              style={{
                background: fullyDone ? '#f0faf2' : 'white',
                borderRadius: 'var(--apple-radius)',
                boxShadow: 'var(--apple-shadow)',
                padding: 12,
                opacity: fullyDone ? 0.7 : 1,
                transition: 'var(--apple-transition)',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: fs.border, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--apple-text)' }} className="truncate">{job.full_address}</p>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: stageInfo.bg, color: stageInfo.color }}>
                    {stageInfo.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2" style={{ marginTop: 4, fontSize: 11, color: 'var(--apple-secondary)' }}>
                  {['main', 'bucket', 'chip'].map(ph => {
                    const asg = a[ph]; const comp = c[ph]
                    if (!asg && !comp) return null
                    const phLabel = ph === 'main' ? 'H&S' : ph === 'bucket' ? 'EWP' : 'Chip'
                    return (
                      <span key={ph} style={{
                        padding: '2px 8px', borderRadius: 6,
                        background: comp ? '#e8f8ed' : '#e8f4fd',
                        color: comp ? '#248a3d' : '#0071e3',
                      }}>
                        {phLabel}: {asg?.crew_name} {comp && '✓'}
                        {comp?.completed_by_name && <span style={{ color: '#248a3d' }}> by {comp.completed_by_name}</span>}
                        {comp?.completed_at && <span style={{ color: 'var(--apple-tertiary)' }}> · {new Date(comp.completed_at).toLocaleDateString()}</span>}
                      </span>
                    )
                  })}
                  {!a.main && !c.main && <span style={{ color: 'var(--apple-tertiary)' }}>Unplanned</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {PHASES.map(p => {
                  const comp = c[p.key]; const asg = a[p.key]
                  if (!asg && !comp) return null
                  return (
                    <button key={p.key}
                      onClick={() => comp ? uncompleteJob(job.job_id, p.key) : completeJob(job.job_id, p.key, user?.id, user?.name)}
                      style={{
                        width: 26, height: 26, borderRadius: '50%',
                        border: `2px solid ${comp ? 'var(--apple-green)' : '#d1d1d6'}`,
                        background: comp ? 'var(--apple-green)' : 'none',
                        color: comp ? 'white' : '#d1d1d6',
                        fontSize: 10, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'var(--apple-transition)',
                      }}
                      title={`${comp ? 'Uncomplete' : 'Complete'} ${p.label}`}
                    >
                      {p.key === 'main' ? 'H' : p.key === 'bucket' ? 'E' : 'C'}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
