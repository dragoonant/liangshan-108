// K rules: camps (mountain bands), alliance, joining together, slow growth. PLAN D18.
import type { Ctx } from '../ctx'
import { abil, chieftainId, compat, emit, hs, heroName, prefName, ps } from '../ctx'
import { roll } from '../rng'
import { clamp } from '../util'
import { joinHero } from './heroes'
import { joinLoyalty } from './recruit'

export const JOIN_RENOWN = 60
export const ALLY_MONTHS = 24
export const ALLY_MIN_MONTHS = 3
export const ALLY_COST = 200

export const isCamp = (c: Ctx, f: string): boolean => !!c.x.campOf[f]
/** K-5: is this camp allied with the player this month. */
export function allied(c: Ctx, camp: string): boolean {
  const f = c.s.factions[camp]
  return !!f && f.alive && f.allyUntil > c.s.t
}
/** Camp heroes: those who serve the camp and are not captive. */
export function campHeroes(c: Ctx, camp: string): string[] {
  return Object.keys(c.s.heroes).filter((h) => { const x = c.s.heroes[h]!; return x.faction === camp && x.status === 'ordinary' && !!x.loc })
}
export function campPrefs(c: Ctx, camp: string): string[] { return c.x.order.filter((p) => ps(c, p).owner === camp) }

const compatChief = (c: Ctx, hero: string): number => { const ch = chieftainId(c); return ch ? compat(c, ch, hero) : 50 }
export interface CampOdds { ally: number; join: number }
/** K-5, K-6: the chief the camp has now (its recorded chief, else its highest-command hero). */
export function campChief(c: Ctx, camp: string): string | null {
  const rec = c.x.campOf[camp]
  if (!rec) return null
  const live = campHeroes(c, camp)
  if (live.includes(rec.chief)) return rec.chief
  return [...live].sort((a, b) => abil(c, b).command - abil(c, a).command || (a < b ? -1 : 1))[0] ?? null
}
export function allyOdds(c: Ctx, camp: string, actor: string): number {
  const chief = campChief(c, camp)
  const renown = c.s.factions['player']!.renown
  const cm = chief ? compatChief(c, chief) : 50
  return clamp(5, 90, 15 + Math.min(30, Math.floor(renown / 10)) + Math.floor(cm / 3) + Math.floor((abil(c, actor).cunning - 50) / 5))
}
export function joinOdds(c: Ctx, camp: string): number {
  const chief = campChief(c, camp)
  const renown = c.s.factions['player']!.renown
  return clamp(5, 60, 5 + Math.floor(renown / 10) + Math.floor((chief ? compatChief(c, chief) : 50) / 4))
}
export function followOdds(c: Ctx, member: string): number { return clamp(10, 95, 45 + Math.floor(compatChief(c, member) / 3)) }

/** K-3, at month-end. */
export function growCamps(c: Ctx): void {
  for (const k of c.x.camps) {
    const f = c.s.factions[k.id]
    if (!f || !f.alive) continue
    for (const id of campPrefs(c, k.id)) {
      const p = ps(c, id)
      const n = p.heroes.filter((h) => hs(c, h).faction === k.id).length
      const add = Math.max(0, Math.min(5 * n, Math.floor(p.pop / 20) - p.men))
      p.men += add; p.arms += add; p.gold += 15; p.food += 30
    }
  }
}

/** K-6, at month-end (after growth): an allied camp may join together. */
export function campMonthEnd(c: Ctx): void {
  const s = c.s
  for (const k of c.x.camps) {
    const f = s.factions[k.id]
    if (!f || !f.alive || f.allyUntil <= s.t) continue
    if (s.t - f.allySince < ALLY_MIN_MONTHS || s.factions['player']!.renown < JOIN_RENOWN) continue
    const p = joinOdds(c, k.id)
    if (roll(s, 100) >= p) continue
    joinCamp(c, k.id, p)
  }
}
function joinCamp(c: Ctx, camp: string, pct: number): void {
  const s = c.s
  const rec = c.x.campOf[camp]!
  const prefs = campPrefs(c, camp)
  const heroes = campHeroes(c, camp)
  for (const id of prefs) {
    const p = ps(c, id)
    p.owner = 'player'; p.governor = null
    for (const h of [...p.captives]) { const x = hs(c, h); if (x.heldBy === camp) { x.faction = 'free'; x.status = 'free'; x.heldBy = null; p.captives = p.captives.filter((q) => q !== h); p.heroes.push(h) } }
  }
  for (const h of heroes) joinHero(c, h, 'player', joinLoyalty(c, h, 'invite'), hs(c, h).loc as string)
  s.factions[camp]!.alive = false
  s.factions[camp]!.allyUntil = 0
  s.fired.push(`joined:${camp}`)
  emit(c, 'campJoins', 'K-6', `${rec.name} throws in its lot with you (${pct}%): ${heroes.map((h) => heroName(c, h)).join(', ')} and ${prefs.map((p) => prefName(c, p)).join(', ')}`, prefs[0])
}

/** K-7: the chief has just been persuaded; the rest of the camp may follow him. */
export function campFollow(c: Ctx, chief: string, pref: string): void {
  const rec = c.x.camps.find((k) => k.chief === chief)
  if (!rec) return
  for (const m of rec.members) {
    if (m === chief) continue
    const h = c.s.heroes[m]
    if (!h || h.status === 'dormant' || h.status === 'captive' || !h.loc) continue
    if (h.faction !== 'free' && h.faction !== rec.id) continue
    const p = followOdds(c, m)
    if (roll(c.s, 100) < p) {
      joinHero(c, m, 'player', joinLoyalty(c, m, 'invite'), pref)
      emit(c, 'campFollows', 'K-7', `${heroName(c, m)} follows ${heroName(c, chief)} to your banner (${p}%)`, pref)
    } else emit(c, 'campStays', 'K-7', `${heroName(c, m)} does not follow ${heroName(c, chief)} (${p}%)`, pref)
  }
}

export function campView(c: Ctx, camp: string, actor?: string) {
  const rec = c.x.campOf[camp]!
  const f = c.s.factions[camp]!
  const prefs = campPrefs(c, camp)
  const chief = campChief(c, camp)
  const best = actor ?? chieftainId(c) ?? ''
  return {
    id: camp, name: rec.name, alive: f.alive, stronghold: rec.stronghold, prefectures: prefs, chief, heroes: campHeroes(c, camp),
    men: prefs.reduce((a, p) => a + ps(c, p).men, 0), allied: allied(c, camp), allyUntil: f.allyUntil,
    allyOdds: best && f.alive ? allyOdds(c, camp, best) : null, joinOdds: f.alive ? joinOdds(c, camp) : null,
    followOdds: Object.fromEntries(rec.members.filter((m) => m !== rec.chief).map((m) => [m, followOdds(c, m)])),
  }
}
