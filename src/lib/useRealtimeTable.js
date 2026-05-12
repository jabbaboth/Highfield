import { useEffect } from 'react'
import { supabase } from './supabase'

export function useRealtimeTable(table, onChange, contractId) {
  useEffect(() => {
    if (!contractId) return
    const channel = supabase
      .channel(`${table}-${contractId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `contract_id=eq.${contractId}`,
        },
        () => {
          onChange()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, onChange, contractId])
}
