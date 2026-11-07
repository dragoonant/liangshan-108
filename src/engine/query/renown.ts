// R-6..R-8, R-10 numbers.
import { edictBy, label, lastT } from '../calendar'
import { TUNE } from '../tuning'
const EDICT = (): number => TUNE.edict
import type { GameState } from '../types'
import type { Idx } from '../data'

export interface RenownInfo {
  renown: number; trend: number; projectedT: number | null; projectedLabel: string
  edictBy: number; edictByLabel: string; required: number; rate: number
  status: 'green' | 'amber' | 'red'; granted: boolean; missing: number
}
export function renownInfo(s: GameState, _x?: Idx): RenownInfo {
  const f = s.factions['player']!
  const last = s.t - 1
  let trend = 0
  if (last >= 0) {
    const bi = last - 6
    const base = bi >= 0 ? (f.renownHistory[bi] as number) : f.renownStart
    const months = Math.min(6, last + 1)
    trend = ((f.renownHistory[last] ?? f.renown) - base) / months
  }
  const eb = edictBy(s)
  const granted = f.edict !== null
  let projectedT: number | null = null
  let projectedLabel = 'never at this pace'
  if (granted) { projectedT = f.edict; projectedLabel = `granted ${label(f.edict as number)}` }
  else if (f.renown >= EDICT()) { projectedT = s.t; projectedLabel = label(s.t) }
  else if (trend > 0) {
    projectedT = s.t + Math.ceil((EDICT() - f.renown) / trend)
    projectedLabel = projectedT > lastT(s) ? 'after the deadline' : label(projectedT)
  }
  let status: RenownInfo['status'] = 'red'
  if (granted || (projectedT !== null && projectedT <= eb - 6)) status = 'green'
  else if (projectedT !== null && projectedT <= eb) status = 'amber'
  const left = eb - s.t
  const required = granted ? 0 : left > 0 ? (EDICT() - f.renown) / left : EDICT() - f.renown
  return { renown: f.renown, trend: Math.round(trend * 10) / 10, projectedT, projectedLabel, edictBy: eb, edictByLabel: label(eb), required: Math.max(0, required), rate: trend, status, granted, missing: Math.max(0, EDICT() - f.renown) }
}
