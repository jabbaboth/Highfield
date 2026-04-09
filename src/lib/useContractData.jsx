import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, CONTRACT_ID } from './supabase'
import { useRealtimeTable } from './useRealtimeTable'

const ContractDataContext = createContext(null)

export function ContractDataProvider({ children }) {
  const value = useContractDataInternal()
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

function useContractDataInternal() {
  const [jobs, setJobs] = useState([])
  const [assignments, setAssignments] = useState([])
  const [completions, setCompletions] = useState([])
  const [crews, setCrews] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = useCallback(async () => {
    const { data, error } = await supabase.from('jobs').select('*').eq('contract_id', CONTRACT_ID)
    if (error) console.error('fetchJobs:', error)
    if (data) setJobs(data)
  }, [])

  const fetchAssignments = useCallback(async () => {
    const { data, error } = await supabase.from('assignments').select('*').eq('contract_id', CONTRACT_ID)
    if (error) console.error('fetchAssignments:', error)
    if (data) setAssignments(data)
  }, [])

  const fetchCompletions = useCallback(async () => {
    const { data, error } = await supabase.from('completions').select('*').eq('contract_id', CONTRACT_ID)
    if (error) console.error('fetchCompletions:', error)
    if (data) setCompletions(data)
  }, [])

  const fetchCrews = useCallback(async () => {
    const { data, error } = await supabase.from('crews').select('*').eq('contract_id', CONTRACT_ID)
    if (error) console.error('fetchCrews:', error)
    if (data) setCrews(data)
  }, [])

  useEffect(() => {
    Promise.all([fetchJobs(), fetchAssignments(), fetchCompletions(), fetchCrews()])
      .finally(() => setLoading(false))
  }, [fetchJobs, fetchAssignments, fetchCompletions, fetchCrews])

  useRealtimeTable('assignments', fetchAssignments)
  useRealtimeTable('completions', fetchCompletions)
  useRealtimeTable('jobs', fetchJobs)
  useRealtimeTable('crews', fetchCrews)

  // Multi-phase assign: phase = 'main' | 'bucket' | 'chip'
  const assignJobs = async (jobIds, crewName, plannedDate, phase = 'main', assignedByName = '') => {
    const rows = jobIds.map(job_id => ({
      contract_id: CONTRACT_ID,
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

  const unassignJob = async (jobId, phase = 'main') => {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('contract_id', CONTRACT_ID)
      .eq('job_id', Number(jobId))
      .eq('phase', phase)
    if (error) console.error('unassignJob:', error)
    else await fetchAssignments()
    return error
  }

  const completeJob = async (jobId, phase = 'main', completedByUserId = null, completedByName = '', notes = '') => {
    const row = {
      contract_id: CONTRACT_ID,
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
      .eq('contract_id', CONTRACT_ID)
      .eq('job_id', Number(jobId))
      .eq('phase', phase)
    if (error) console.error('uncompleteJob:', error)
    else await fetchCompletions()
    return error
  }

  const addCrew = async (name) => {
    const { error } = await supabase.from('crews').insert({ contract_id: CONTRACT_ID, name })
    if (!error) await fetchCrews()
    return error
  }

  const removeCrew = async (name) => {
    const { error } = await supabase.from('crews').delete().eq('contract_id', CONTRACT_ID).eq('name', name)
    if (!error) await fetchCrews()
    return error
  }

  const importJobs = async (jobsArray) => {
    await supabase.from('jobs').delete().eq('contract_id', CONTRACT_ID)
    const rows = jobsArray.map(j => {
      const { assigned_crew, assigned_date, completed, house_no, location, ht, cleanup, ...rest } = j
      return { ...rest, contract_id: CONTRACT_ID }
    })
    const errors = []
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from('jobs').insert(rows.slice(i, i + 100))
      if (error) errors.push(error)
    }
    await fetchJobs()
    return errors.length ? errors : null
  }

  // Build phase-aware lookup maps
  // assignmentsByJob[jobId] = { main: assignment, bucket: assignment, chip: assignment }
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
    assignJobs, unassignJob, completeJob, uncompleteJob,
    addCrew, removeCrew, importJobs,
    refresh: () => Promise.all([fetchJobs(), fetchAssignments(), fetchCompletions(), fetchCrews()]),
  }
}
