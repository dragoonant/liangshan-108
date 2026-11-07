// X rules: victory, defeat, succession.
import { label } from '../calendar'
import type { Ctx } from '../ctx'
import { emit, hs, ps, heroName, rank } from '../ctx'
import { servingPlayer, swornBrothers } from './heroes'
import { addRenown } from './renown'

export function victory(c: Ctx): void {
  const s = c.s
  const serving = servingPlayer(c).filter((h) => c.x.kindOf[h] === 'star')
  const sworn = swornBrothers(c).length
  const ending = serving.length >= 108 ? 'The Marsh Assembled' : sworn >= 36 ? 'The Heavenly Thirty-Six' : sworn >= 10 ? 'A Few Good Men' : 'A Bitter Victory'
  const prefs = c.x.order.filter((p) => ps(c, p).owner === 'player').length
  s.phase = 'result'
  s.battle = null
  s.pending = null
  s.result = { outcome: 'victory', reason: 'Gao Qiu is captured', ending: `${ending}: ${label(s.t)}, Renown ${s.factions['player']!.renown}, ${serving.length} heroes gathered, ${prefs} prefectures held` }
  emit(c, 'victory', 'X-1', `Gao Qiu is taken. ${s.result.ending}`)
}
export function defeat(c: Ctx, reason: string): void {
  const s = c.s
  if (s.phase === 'result') return
  s.phase = 'result'
  s.battle = null
  s.pending = null
  s.result = { outcome: 'defeat', reason, ending: reason }
  emit(c, 'defeat', 'X-4', reason)
}
/** X-4: the player holds nothing. */
export function checkNoPrefecture(c: Ctx): void {
  if (c.s.phase === 'result') return
  if (!c.x.order.some((p) => ps(c, p).owner === 'player')) defeat(c, 'You hold no prefecture')
}
/** X-3: the chieftain is captured. */
export function checkChieftain(c: Ctx): void {
  const s = c.s
  const ch = s.factions['player']!.chieftain
  if (!ch || s.phase === 'result') return
  if (hs(c, ch).status !== 'captive') return
  const heir = swornBrothers(c).filter((h) => hs(c, h).status === 'sworn').sort((a, b) => rank(c, a) - rank(c, b))[0]
  if (!heir) { defeat(c, 'Your chieftain is captured and no sworn brother can lead'); return }
  s.factions['player']!.chieftain = heir
  hs(c, heir).status = 'chieftain'
  hs(c, heir).loyalty = 100
  const f = s.factions['player']!
  const loss = Math.floor(f.renown / 5)
  addRenown(c, -loss, hs(c, heir).loc ?? 'dongjing', 'X-3', 'battles', `${heroName(c, heir)} takes the chieftain's place`)
  emit(c, 'succession', 'X-3', `${heroName(c, heir)} becomes chieftain`)
}
