// legalActions: never empty before the result (Arch).
import type { Action, GameState } from './types'
import { defaultBundle } from './data'
import type { DataBundle } from '../data'
import { mkCtx } from './ctx'
import { legalFor } from './strategic/commands'
import { legalForUnit } from './battle/actions'
import { active, humanControls } from './battle/core'

export function legalActions(s: GameState, data: DataBundle = defaultBundle): Action[] {
  if (s.phase === 'result') return []
  if (s.pending) return s.pending.options.map((option) => ({ t: 'choose' as const, option }))
  const c = mkCtx(s, data)
  if (s.phase === 'battle' && s.battle) {
    const b = s.battle
    if (!humanControls(b, b.toAct)) return [{ t: 'bEndSide' }]
    const out: Action[] = []
    for (const u of active(b, b.toAct).sort((p, q) => (p.id < q.id ? -1 : 1))) out.push(...legalForUnit(c, u))
    out.push({ t: 'bEndSide' })
    if (b.toAct === 'a' && b.human === 'a') out.push({ t: 'bWithdraw' })
    if (b.human && !b.auto[b.human]) out.push({ t: 'bAuto' })
    return out
  }
  if (s.flow.stage !== 'commands') return [{ t: 'endPhase' }]
  const out: Action[] = []
  for (const id of c.x.order) if (s.prefectures[id]?.owner === 'player') out.push(...legalFor(c, 'player', id))
  out.push({ t: 'endPhase' })
  return out
}
