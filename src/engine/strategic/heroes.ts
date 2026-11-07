// H and B rules: loyalty, joining, freeing, oath.
import type { Ctx } from '../ctx'
import { compat, emit, hs, ps, place, rec, heroName, prefName, chieftainId, rank, virt } from '../ctx'
import { addRenown } from './renown'
import { clamp } from '../util'
import { TUNE } from '../tuning'

export const OATH_LOYALTY = 80
export const OATH_COMPAT = 55

export function compatWithChief(c: Ctx, hero: string): number {
  const ch = chieftainId(c)
  return ch ? compat(c, ch, hero) : 50
}
/** H-11 resting level */
export function restingLevel(c: Ctx, hero: string): number {
  const h = hs(c, hero)
  let l = 40 + Math.floor(compatWithChief(c, hero) / 2)
  const sup = h.loc ? ps(c, h.loc).support : 50
  if (sup >= 70) l += 5
  else if (sup < 30) l -= 5
  return l
}
export type LoyaltyLabel = 'sworn' | 'steady' | 'restless' | 'wavering'
export function loyaltyLabel(c: Ctx, hero: string): LoyaltyLabel {
  const h = hs(c, hero)
  if (h.status === 'sworn' || h.status === 'chieftain') return 'sworn'
  if (h.loyalty <= 25) return 'wavering'
  if (h.loyalty < 40) return 'restless'
  return 'steady'
}

export function addLoyalty(c: Ctx, hero: string, d: number): void {
  const h = hs(c, hero)
  if (h.faction !== 'player' || h.status !== 'ordinary') return
  h.loyalty = clamp(0, 100, h.loyalty + d)
}
/** Loyalty change for every ordinary player hero in a prefecture. */
export function addLoyaltyAt(c: Ctx, pref: string, d: number, filter?: (id: string) => boolean): void {
  for (const id of ps(c, pref).heroes) if (!filter || filter(id)) addLoyalty(c, id, d)
}

/** A hero joins a faction (H-10). Renown R-2 when the faction is the player. */
export function joinHero(c: Ctx, hero: string, faction: string, loyalty: number, pref: string): void {
  const h = hs(c, hero)
  h.faction = faction
  h.status = faction === 'player' ? 'ordinary' : 'ordinary'
  h.loyalty = faction === 'player' ? loyalty : 0
  h.wavering = false
  h.heldBy = null
  h.bonus = 0
  place(c, hero, pref)
  if (faction === 'player') {
    const star = rec(c, hero).star
    addRenown(c, TUNE.joinRenown + (star?.group === 'heavenly' ? 1 : 0), pref, 'R-2', 'heroes', `${heroName(c, hero)} joined`)
    if (!c.s.fired.includes(`defeated:${hero}`)) c.s.fired.push(`defeated:${hero}`)
  }
}

/** H-17 free a hero at a named prefecture. */
export function freeHero(c: Ctx, hero: string, pref: string, why: string): void {
  const h = hs(c, hero)
  h.faction = 'free'
  h.status = 'free'
  h.loyalty = 0
  h.wavering = false
  h.heldBy = null
  h.inviteBlock = 0
  place(c, hero, pref)
  emit(c, 'freed', 'H-17', `${heroName(c, hero)} is free at ${prefName(c, pref)} (${why})`, pref)
}

export interface OathStatus { loyalty: number; needLoyalty: number; compat: number; needCompat: number; ok: boolean; missing: string[] }
/** B-1, B-4 */
export function oathStatus(c: Ctx, hero: string): OathStatus {
  const h = hs(c, hero)
  const cp = compatWithChief(c, hero)
  const missing: string[] = []
  if (h.faction !== 'player' || h.status !== 'ordinary') missing.push('only an ordinary hero of yours can swear')
  if (h.loyalty < OATH_LOYALTY) missing.push(`loyalty ${OATH_LOYALTY - h.loyalty} more`)
  if (cp < OATH_COMPAT) missing.push(`match ${OATH_COMPAT - cp} more`)
  if (h.wavering || h.loyalty <= 25) missing.push('wavering')
  const ch = chieftainId(c)
  if (ch && h.loc !== hs(c, ch).loc) missing.push('the chieftain is elsewhere (B-4)')
  return { loyalty: h.loyalty, needLoyalty: OATH_LOYALTY, compat: cp, needCompat: OATH_COMPAT, ok: missing.length === 0, missing }
}

export function swornBrothers(c: Ctx): string[] {
  return Object.keys(c.s.heroes).filter((id) => c.s.heroes[id]!.status === 'sworn' && c.s.heroes[id]!.faction === 'player').sort((a, b) => rank(c, a) - rank(c, b) || (a < b ? -1 : 1))
}
export function servingPlayer(c: Ctx): string[] {
  return Object.keys(c.s.heroes).filter((id) => c.s.heroes[id]!.faction === 'player' && ['chieftain', 'sworn', 'ordinary'].includes(c.s.heroes[id]!.status))
}
export const virtueOf = virt
