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
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('contract_id', CONTRACT_ID)
    if (error) console.error('fetchJobs error:', error)
    if (data) setJobs(data)
  }, [])

  const fetchAssignments = useCallback(async () => {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('contract_id', CONTRACT_ID)
    if (error) console.error('fetchAssignments error:', error)
    if (data) setAssignments(data)
  }, [])

  const fetchCompletions = useCallback(async () => {
    const { data, error } = await supabase
      .from('completions')
      .select('*')
      .eq('contract_id', CONTRACT_ID)
    if (error) console.error('fetchCompletions error:', error)
    if (data) setCompletions(data)
  }, [])

  const fetchCrews = useCallback(async () => {
    const { data, error } = await supabase
      .from('crews')
      .select('*')
      .eq('contract_id', CONTRACT_ID)
    if (error) console.error('fetchCrews error:', error)
    if (data) setCrews(data)
  }, [])

  useEffect(() => {
    Promise.all([fetchJobs(), fetchAssignments(), fetchCompletions(), fetchCrews()])
      .finally(() => setLoading(false))
  }, [fetchJobs, fetchAssignments, fetchCompletions, fetchCrews])

  useRealtimeTable('assignments', fetchAssignments)
  useRealtimeTable('completions', fetchCompletions)

  const assignJobs = async (jobIds, crewName, plannedDate) => {
    const rows = jobIds.map(job_id => ({
      contract_id: CONTRACT_ID,
      job_id: Number(job_id),
      crew_name: crewName,
      planned_date: plannedDate,
    }))
    console.log('Assigning jobs:', rows)
    const { data, error } = await supabase
      .from('assignments')
      .upsert(rows, { onConflict: 'contract_id,job_id' })
      .select()
    if (error) {
      console.error('assignJobs error:', error)
      return error
    }
    console.log('Assignment success:', data)
    await fetchAssignments()
    return null
  }

  const unassignJob = async (jobId) => {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('contract_id', CONTRACT_ID)
      .eq('job_id', Number(jobId))
    if (error) console.error('unassignJob error:', error)
    if (!error) await fetchAssignments()
    return error
  }

  const completeJob = async (jobId, completedBy = '', notes = '') => {
    const { error } = await supabase
      .from('completions')
      .upsert({
        contract_id: CONTRACT_ID,
        job_id: Number(jobId),
        completed_at: new Date().toISOString(),
        completed_by: completedBy,
        notes,
      }, { onConflict: 'contract_id,job_id' })
    if (error) console.error('completeJob error:', error)
    if (!error) await fetchCompletions()
    return error
  }

  const uncompleteJob = async (jobId) => {
    const { error } = await supabase
      .from('completions')
      .delete()
      .eq('contract_id', CONTRACT_ID)
      .eq('job_id', Number(jobId))
    if (error) console.error('uncompleteJob error:', error)
    if (!error) await fetchCompletions()
    return error
  }

  const addCrew = async (name) => {
    const { error } = await supabase
      .from('crews')
      .insert({ contract_id: CONTRACT_ID, name })
    if (error) console.error('addCrew error:', error)
    if (!error) await fetchCrews()
    return error
  }

  const removeCrew = async (name) => {
    const { error } = await supabase
      .from('crews')
      .delete()
      .eq('contract_id', CONTRACT_ID)
      .eq('name', name)
    if (error) console.error('removeCrew error:', error)
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
      const batch = rows.slice(i, i + 100)
      const { error } = await supabase.from('jobs').insert(batch)
      if (error) errors.push(error)
    }
    await fetchJobs()
    return errors.length ? errors : null
  }

  // Build lookup maps — use String keys for consistent lookups
  const assignmentMap = {}
  assignments.forEach(a => { assignmentMap[String(a.job_id)] = a })
  const completionMap = {}
  completions.forEach(c => { completionMap[String(c.job_id)] = c })

  return {
    jobs, assignments, completions, crews, loading,
    assignmentMap, completionMap,
    assignJobs, unassignJob, completeJob, uncompleteJob,
    addCrew, removeCrew, importJobs,
    refresh: () => Promise.all([fetchJobs(), fetchAssignments(), fetchCompletions(), fetchCrews()]),
  }
}
