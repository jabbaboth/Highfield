export const FEEDERS = ['111', '112', '113', '114']

export const FEEDER_STYLES = {
  '111': { bg: '#ffa07a20', border: '#ffa07a', label: 'MOTU 111' },
  '112': { bg: '#ff6b6b20', border: '#ff6b6b', label: 'MOTU 112' },
  '113': { bg: '#45b7d120', border: '#45b7d1', label: 'MOTU 113' },
  '114': { bg: '#4ecdc420', border: '#4ecdc4', label: 'MOTU 114' },
}

export function feederStyle(feeder) {
  return FEEDER_STYLES[String(feeder)] || { bg: '#e5e7eb20', border: '#9ca3af', label: feeder }
}

export const CREW_COLORS = ['#2E86AB', '#A23B72', '#F18F01', '#2ecc71', '#9b59b6', '#e74c3c', '#1abc9c', '#f39c12']

export function crewColor(crews, crewName) {
  const idx = crews.findIndex(c => c.name === crewName)
  return CREW_COLORS[idx >= 0 ? idx % CREW_COLORS.length : 0]
}

export const PHASES = [
  { key: 'main', label: 'H&S Crew', hrsField: 'hs_hrs' },
  { key: 'bucket', label: 'EWP Crew', hrsField: 'ewp_hrs' },
  { key: 'chip', label: 'Chip Crew', hrsField: 'cleanup_hrs' },
]

// Treats "0", "", null, undefined, 0 as "no hours required".
// Important: JSON imports store these fields as strings, and !"0" is false in JS.
export function needsPhase(job, phaseKey) {
  const field = phaseKey === 'main' ? 'hs_hrs'
              : phaseKey === 'bucket' ? 'ewp_hrs'
              : 'cleanup_hrs'
  return (parseFloat(job?.[field]) || 0) > 0
}

export function isJobComplete(job, completions) {
  const c = completions || {}
  return !!c.main
    && (!!c.bucket || !needsPhase(job, 'bucket'))
    && (!!c.chip   || !needsPhase(job, 'chip'))
}
