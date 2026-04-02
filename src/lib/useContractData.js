import { useState, useEffect, useCallback } from 'react'
import { supabase, CONTRACT_ID } from './supabase'
import { useRealtimeTable } from './useRealtimeTable'

export function useContractData() {
  const [jobs, setJobs] = useState([])
  const [assignments, setAssignments] = useState([])
  const [completions, setCompletions] = useState([])
  const [crews, setCrews] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = useCallback(async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('contract_id', CONTRACT_ID)
    if (data) setJobs(data)
  }, [])

  const fetchAssignments = useCallback(async () => {
    const { data } = await supabase
      .from('assignments')
      .select('*')
      .eq('contract_id', CONTRACT_ID)
    if (data) setAssignments(data)
  }, [])

  const fetchCompletions = useCallback(async () => {
    const { data } = await supabase
      .from('completions')
      .select('*')
      .eq('contract_id', CONTRACT_ID)
    if (data) setCompletions(data)
  }, [])

  const fetchCrews = useCallback(async () => {
    const { data } = await supabase
      .from('crews')
      .select('*')
      .eq('contract_id', CONTRACT_ID)
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
      job_id,
      crew_name: crewName,
      planned_date: plannedDate,
    }))
    const { error } = await supabase
      .from('assignments')
      .upsert(rows, { onConflict: 'contract_id,job_id' })
    if (!error) await fetchAssignments()
    return error
  }

  const unassignJob = async (jobId) => {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('contract_id', CONTRACT_ID)
      .eq('job_id', jobId)
    if (!error) await fetchAssignments()
    return error
  }

  const completeJob = async (jobId, completedBy = '', notes = '') => {
    const { error } = await supabase
      .from('completions')
      .upsert({
        contract_id: CONTRACT_ID,
        job_id: jobId,
        completed_at: new Date().toISOString(),
        completed_by: completedBy,
        notes,
      }, { onConflict: 'contract_id,job_id' })
    if (!error) await fetchCompletions()
    return error
  }

  const uncompleteJob = async (jobId) => {
    const { error } = await supabase
      .from('completions')
      .delete()
      .eq('contract_id', CONTRACT_ID)
      .eq('job_id', jobId)
    if (!error) await fetchCompletions()
    return error
  }

  const addCrew = async (name) => {
    const { error } = await supabase
      .from('crews')
      .insert({ contract_id: CONTRACT_ID, name })
    if (!error) await fetchCrews()
    return error
  }

  const removeCrew = async (name) => {
    const { error } = await supabase
      .from('crews')
      .delete()
      .eq('contract_id', CONTRACT_ID)
      .eq('name', name)
    if (!error) await fetchCrews()
    return error
  }

  // Build lookup maps
  const assignmentMap = {}
  assignments.forEach(a => { assignmentMap[a.job_id] = a })
  const completionMap = {}
  completions.forEach(c => { completionMap[c.job_id] = c })

  return {
    jobs, assignments, completions, crews, loading,
    assignmentMap, completionMap,
    assignJobs, unassignJob, completeJob, uncompleteJob,
    addCrew, removeCrew,
    refresh: () => Promise.all([fetchJobs(), fetchAssignments(), fetchCompletions(), fetchCrews()]),
  }
}
