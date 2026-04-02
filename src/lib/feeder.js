export const FEEDERS = ['111', '112', '113', '114']

export const FEEDER_COLORS = {
  '111': { bg: 'bg-feeder-111', text: 'text-white', label: 'MOTU 111' },
  '112': { bg: 'bg-feeder-112', text: 'text-white', label: 'MOTU 112' },
  '113': { bg: 'bg-feeder-113', text: 'text-white', label: 'MOTU 113' },
  '114': { bg: 'bg-feeder-114', text: 'text-white', label: 'MOTU 114' },
}

export function feederBgClass(feeder) {
  const f = String(feeder)
  return FEEDER_COLORS[f]?.bg || 'bg-gray-400'
}

export function feederTextClass(feeder) {
  return FEEDER_COLORS[feeder]?.text || 'text-white'
}
