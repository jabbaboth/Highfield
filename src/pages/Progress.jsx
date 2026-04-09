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
  { key: 'not_started', label: 'Not Started', color: '#9ca3af', bg: '#f3f4f6' },
  { key: 'hs_active', label: 'H&S Active', color: '#2563eb', bg: '#dbeafe' },
  { key: 'ready_ewp', label: 'Ready EWP', color: '#f59e0b', bg: '#fef3c7' },
  { key: 'ewp_active', label: 'EWP Active', color: '#8b5cf6', bg: '#ede9fe' },
  { key: 'ready_chip', label: 'Ready Chip', color: '#f97316', bg: '#ffedd5' },
  { key: 'chip_active', label: 'Chip Active', color: '#06b6d4', bg: '#cffafe' },
  { key: 'complete', label: 'Fully Complete', color: '#22c55e', bg: '#dcfce7' },
]

export default function Progress() {
  const { jobs, assignmentsByJob, completionsByJob, completeJob, uncompleteJob, loading } = useContractData()
  const { user } = useAuth()
  const [feederFilter, setFeederFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')

  const pipelineCounts = useMemo(() => {
    const counts = {}
    PIPELINE_STAGES.forEach(s => { counts[s.key] = 0 })
    jobs.forEach(j => {
      const stage = getJobPipelineStage(j, assignmentsByJob, completionsByJob)
      counts[stage] = (counts[stage] || 0) + 1
    })
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

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>

  return (
    <div className="p-3 space-y-4">
      {/* Pipeline summary */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <h2 className="font-bold text-sm text-gray-900 mb-3">Pipeline</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {PIPELINE_STAGES.map(s => (
            <button
              key={s.key}
              onClick={() => setStageFilter(stageFilter === s.key ? '' : s.key)}
              className={`rounded-lg p-2 text-center transition-all border-2 ${
                stageFilter === s.key ? 'border-gray-900 shadow-md' : 'border-transparent'
              }`}
              style={{ background: s.bg }}
            >
              <div className="text-2xl font-bold" style={{ color: s.color }}>{pipelineCounts[s.key]}</div>
              <div className="text-[10px] font-semibold" style={{ color: s.color }}>{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Feeder summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {feederStats.map(fs => (
          <div key={fs.feeder} className="rounded-xl shadow-sm p-4"
            style={{ background: fs.style.bg, borderLeft: `4px solid ${fs.style.border}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full" style={{ background: fs.style.border }} />
              <span className="font-bold text-sm text-gray-900">Feeder {fs.feeder}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{fs.pct}%</div>
            <div className="h-2 bg-white/60 rounded-full mt-2 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${fs.pct}%`, background: fs.style.border }} />
            </div>
            <div className="text-xs text-gray-600 mt-2 space-y-0.5">
              <p>Jobs: {fs.done}/{fs.total}</p>
              <p>Spans: {fs.doneSpans}/{fs.totalSpans}</p>
              <p>H&S: {fs.totalHs.toFixed(1)}h · EWP: {fs.totalEwp.toFixed(1)}h</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={feederFilter} onChange={e => setFeederFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">All Feeders</option>
          {FEEDERS.map(f => <option key={f} value={f}>Feeder {f}</option>)}
        </select>
        {stageFilter && (
          <button onClick={() => setStageFilter('')} className="text-sm text-blue-600 hover:underline">
            Clear stage filter
          </button>
        )}
      </div>

      {/* Job list */}
      <div className="space-y-1">
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
              className={`flex items-center gap-3 p-2.5 rounded-lg border ${fullyDone ? 'opacity-60' : ''}`}
              style={{ background: fullyDone ? '#d4edda' : '#fff', borderLeft: `3px solid ${fs.border}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 truncate">{job.full_address}</p>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{ background: stageInfo.bg, color: stageInfo.color }}>
                    {stageInfo.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-gray-500">
                  {['main', 'bucket', 'chip'].map(ph => {
                    const asg = a[ph]
                    const comp = c[ph]
                    if (!asg && !comp) return null
                    const phLabel = ph === 'main' ? 'H&S' : ph === 'bucket' ? 'EWP' : 'Chip'
                    return (
                      <span key={ph} className={`px-1.5 py-0.5 rounded ${comp ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {phLabel}: {asg?.crew_name} {comp && '✓'}
                        {comp?.completed_by_name && (
                          <span className="text-green-600"> by {comp.completed_by_name}</span>
                        )}
                        {comp?.completed_at && (
                          <span className="text-gray-400"> · {new Date(comp.completed_at).toLocaleDateString()}</span>
                        )}
                      </span>
                    )
                  })}
                  {!a.main && !c.main && <span className="text-gray-400">Unplanned</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {PHASES.map(p => {
                  const comp = c[p.key]
                  const asg = a[p.key]
                  if (!asg && !comp) return null
                  return (
                    <button key={p.key}
                      onClick={() => comp
                        ? uncompleteJob(job.job_id, p.key)
                        : completeJob(job.job_id, p.key, user?.id, user?.name)
                      }
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                        comp
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-500'
                      }`}
                      title={`${comp ? 'Uncomplete' : 'Complete'} ${p.label}`}>
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
