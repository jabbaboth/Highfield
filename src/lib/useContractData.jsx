import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useRealtimeTable } from './useRealtimeTable'
import { useAuth } from './useAuth'

const ContractDataContext = createContext(null)

export function ContractDataProvider({ children }) {
  const { auditLog, contractId } = useAuth()
  const value = useContractDataInternal(auditLog, contractId)
  return (
    <ContractDataContext.Provider value={value}>
      {children}
    </ContractDataContext.Provider>
  )
}

export function useContractData() {
  const ctx = useContext(ContractDataContext)
  if (!ctx) throw new Error('useContractData must be used within ContractDataProvider')
  return ctx
}

function useContractDataInternal(auditLog, contractId) {
  const audit = auditLog || (async () => {})
  const [jobs, setJobs] = useState([])
  const [assignments, setAssignments] = useState([])
  const [completions, setCompletions] = useState([])
  const [crews, setCrews] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = useCallback(async () => {
    if (!contractId) return
    const { data, error } = await supabase.from('jobs').select('*').eq('contract_id', contractId)
    if (error) console.error('fetchJobs:', error)
    if (data) setJobs(data)
  }, [contractId])

  const fetchAssignments = useCallback(async () => {
    if (!contractId) return
    const { data, error } = await supabase.from('assignments').select('*').eq('contract_id', contractId)
    if (error) console.error('fetchAssignments:', error)
    if (data) setAssignments(data)
  }, [contractId])

  const fetchCompletions = useCallback(async () => {
    if (!contractId) return
    const { data, error } = await supabase.from('completions').select('*').eq('contract_id', contractId)
    if (error) console.error('fetchCompletions:', error)
    if (data) setCompletions(data)
  }, [contractId])

  const fetchCrews = useCallback(async () => {
    if (!contractId) return
    const { data, error } = await supabase.from('crews').select('*').eq('contract_id', contractId)
    if (error) console.error('fetchCrews:', error)
    if (data) setCrews(data)
  }, [contractId])

  useEffect(() => {
    if (!contractId) { setLoading(false); return }
    setLoading(true)
    Promise.all([fetchJobs(), fetchAssignments(), fetchCompletions(), fetchCrews()])
      .finally(() => setLoading(false))
  }, [fetchJobs, fetchAssignments, fetchCompletions, fetchCrews, contractId])

  useRealtimeTable('assignments', fetchAssignments, contractId)
  useRealtimeTable('completions', fetchCompletions, contractId)
  useRealtimeTable('jobs', fetchJobs, contractId)
  useRealtimeTable('crews', fetchCrews, contractId)

  const assignJobs = async (jobIds, crewName, plannedDate, phase = 'main', assignedByName = '') => {
    const rows = jobIds.map(job_id => ({
      contract_id: contractId,
      job_id: Number(job_id),
      crew_name: crewName,
      planned_date: plannedDate,
      phase,
      assigned_by_name: assignedByName,
    }))
    const { error } = await supabase
      .from('assignments')
      .upsert(rows, { onConflict: 'contract_id,job_id,phase' })
      .select()
    if (error) { console.error('assignJobs:', error); return error }
    await fetchAssignments()
    return null
  }

  const bulkAssign = async (rows, assignedByName = '') => {
    if (!rows?.length) return null
    const shaped = rows.map(r => ({
      contract_id: contractId,
      job_id: Number(r.job_id),
      crew_name: r.crew_name,
      planned_date: r.planned_date,
      phase: r.phase || 'main',
      assigned_by_name: assignedByName,
    }))
    for (let i = 0; i < shaped.length; i += 200) {
      const { error } = await supabase
        .from('assignments')
        .upsert(shaped.slice(i, i + 200), { onConflict: 'contract_id,job_id,phase' })
      if (error) { console.error('bulkAssign:', error); return error }
    }
    await fetchAssignments()
    await audit('schedule.bulk', 'assignments', null, { count: shaped.length })
    return null
  }

  const unassignJob = async (jobId, phase = 'main') => {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('contract_id', contractId)
      .eq('job_id', Number(jobId))
      .eq('phase', phase)
    if (error) console.error('unassignJob:', error)
    else await fetchAssignments()
    return error
  }

  const completeJob = async (jobId, phase = 'main', completedByUserId = null, completedByName = '', notes = '') => {
    const row = {
      contract_id: contractId,
      job_id: Number(jobId),
      phase,
      completed_at: new Date().toISOString(),
      notes,
    }
    if (completedByUserId) row.completed_by_user_id = completedByUserId
    if (completedByName) row.completed_by_name = completedByName
    const { error } = await supabase
      .from('completions')
      .upsert(row, { onConflict: 'contract_id,job_id,phase' })
    if (error) console.error('completeJob:', error)
    else await fetchCompletions()
    return error
  }

  const uncompleteJob = async (jobId, phase = 'main') => {
    const { error } = await supabase
      .from('completions')
      .delete()
      .eq('contract_id', contractId)
      .eq('job_id', Number(jobId))
      .eq('phase', phase)
    if (error) console.error('uncompleteJob:', error)
    else await fetchCompletions()
    return error
  }

  const addCrew = async (name, crewType = null, ewpSize = null) => {
    const row = { contract_id: contractId, name }
    if (crewType) row.crew_type = crewType
    if (ewpSize) row.ewp_size = ewpSize
    const { error } = await supabase.from('crews').insert(row)
    if (!error) {
      await fetchCrews()
      await audit('crew.create', 'crew', name, { name, crew_type: crewType })
    }
    return error
  }

  const removeCrew = async (name) => {
    const { error } = await supabase.from('crews').delete().eq('contract_id', contractId).eq('name', name)
    if (!error) {
      await fetchCrews()
      await audit('crew.delete', 'crew', name, { name })
    }
    return error
  }

  const importJobs = async (jobsArray) => {
    await supabase.from('jobs').delete().eq('contract_id', contractId)
    const rows = jobsArray.map(j => {
      const { assigned_crew, assigned_date, completed, house_no, location, ht, cleanup, ...rest } = j
      return { ...rest, contract_id: contractId }
    })
    const errors = []
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from('jobs').insert(rows.slice(i, i + 100))
      if (error) errors.push(error)
    }
    await fetchJobs()
    await audit('jobs.import', 'jobs', null, { count: rows.length, errors: errors.length })
    return errors.length ? errors : null
  }

  const assignmentsByJob = {}
  assignments.forEach(a => {
    const jid = String(a.job_id)
    if (!assignmentsByJob[jid]) assignmentsByJob[jid] = {}
    assignmentsByJob[jid][a.phase || 'main'] = a
  })

  const completionsByJob = {}
  completions.forEach(c => {
    const jid = String(c.job_id)
    if (!completionsByJob[jid]) completionsByJob[jid] = {}
    completionsByJob[jid][c.phase || 'main'] = c
  })

  return {
    jobs, assignments, completions, crews, loading,
    assignmentsByJob, completionsByJob,
    assignJobs, bulkAssign, unassignJob, completeJob, uncompleteJob,
    addCrew, removeCrew, importJobs,
    refresh: () => Promise.all([fetchJobs(), fetchAssignments(), fetchCompletions(), fetchCrews()]),
  }
}
