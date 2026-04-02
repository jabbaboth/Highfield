import { useEffect } from 'react'
import { supabase, CONTRACT_ID } from './supabase'

export function useRealtimeTable(table, onChange) {
  useEffect(() => {
    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `contract_id=eq.${CONTRACT_ID}`,
        },
        () => {
          onChange()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, onChange])
}
