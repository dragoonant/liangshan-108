// Shared helpers: the working context, events, hero lookups, abilities, links.
import type { GameEvent, GameState, HeroState, Kind, PrefectureState } from './types'
import { indexOf } from './data'
import type { Idx } from './data'
import { isWinter, monthOf } from './calendar'
import type { DataBundle, HeroRecord } from '../data'

export interface Ctx { s: GameState; x: Idx; ev: GameEvent[] }
export const mkCtx = (s: GameState, d: DataBundle): Ctx => ({ s, x: indexOf(d), ev: [] })
const LOG_MAX = 600

export function emit(c: Ctx, k: string, rule: string, text: string, pref?: string, n?: number): void {
  const e: GameEvent = { t: c.s.t, k, rule, text }
  if (pref !== undefined) e.pref = pref
  if (n !== undefined) e.n = n
  c.ev.push(e)
  const le: { t: number; kind: string; rule: string; text: string; pref?: string } = { t: c.s.t, kind: k, rule, text }
  if (pref !== undefined) le.pref = pref
  c.s.log.push(le)
  if (c.s.log.length > LOG_MAX) c.s.log.splice(0, c.s.log.length - LOG_MAX)
}

export const rec = (c: Ctx, id: string): HeroRecord => c.x.hero[id] as HeroRecord
export const hs = (c: Ctx, id: string): HeroState => c.s.heroes[id] as HeroState
export const ps = (c: Ctx, id: string): PrefectureState => c.s.prefectures[id] as PrefectureState
export const heroName = (c: Ctx, id: string): string => c.x.hero[id]?.name ?? id
export const prefName = (c: Ctx, id: string): string => c.x.pref[id]?.name ?? id
export const rank = (c: Ctx, id: string): number => c.x.hero[id]?.star?.rank ?? 200
export const EMPEROR = 'emperor-huizong'
export const GAO_QIU = 'gao-qiu'

export const has = (c: Ctx, id: string, skill: string): boolean => (rec(c, id)?.skills as string[] | undefined)?.includes(skill) ?? false
export const abil = (c: Ctx, id: string) => rec(c, id).abilities
export const virt = (c: Ctx, id: string) => rec(c, id).virtues

/** Heroes present in a prefecture able to act: not wounded, not the Emperor figure. */
export function ableHeroes(c: Ctx, pref: string): string[] {
  return ps(c, pref).heroes.filter((h) => h !== EMPEROR && hs(c, h).wounded <= c.s.t)
}
export function anyHas(c: Ctx, pref: string, skill: string, onlyFaction?: string): boolean {
  return ps(c, pref).heroes.some((h) => has(c, h, skill) && (!onlyFaction || hs(c, h).faction === onlyFaction))
}

export function compat(c: Ctx, a: string, b: string): number {
  const va = virt(c, a), vb = virt(c, b)
  const d = Math.abs(va.righteousness - vb.righteousness) + Math.abs(va.compassion - vb.compassion) + Math.abs(va.daring - vb.daring)
  return Math.max(0, 100 - 6 * d)
}
export function graftOf(c: Ctx, id: string): number {
  const v = virt(c, id)
  return Math.max(10, Math.min(95, 95 - 9 * v.righteousness - 2 * v.compassion))
}
/** Graft of a court prefecture's governor; 50 when it has none (RULING E-3 ungoverned). */
export function prefGraft(c: Ctx, pref: string): number {
  const g = ps(c, pref).governor
  const base = g ? graftOf(c, g) : 50
  return Math.max(0, base - ps(c, pref).graftMod)
}

export function combatKind(c: Ctx, id: string, fallbackSkills?: string[]): Kind {
  const sk = fallbackSkills ?? rec(c, id).skills
  if (sk.includes('horseman')) return 'cavalry'
  if (sk.includes('archer')) return 'archers'
  if (sk.includes('marine')) return 'boats'
  return 'infantry'
}

export const playerPrefs = (c: Ctx): string[] => c.x.order.filter((p) => ps(c, p).owner === 'player')
export const chieftainId = (c: Ctx): string | null => c.s.factions['player']?.chieftain ?? null
export const isPlayerHero = (c: Ctx, h: string): boolean => hs(c, h).faction === 'player' && (hs(c, h).status === 'chieftain' || hs(c, h).status === 'sworn' || hs(c, h).status === 'ordinary')

export function linkKind(c: Ctx, a: string, b: string): string | null {
  return c.x.adj[a]?.find((n) => n.to === b)?.kind ?? null
}
export const isNorth = (c: Ctx, p: string): boolean => (c.x.pref[p]?.pos.y ?? 1) <= 0.3

/** T-6 / V-5: is the link snowed in during month t. */
export function snowedIn(c: Ctx, a: string, b: string, t = c.s.t): boolean {
  const kind = linkKind(c, a, b)
  if (!kind) return false
  const m = monthOf(t)
  if (kind === 'mountain-pass' && (m === 12 || m <= 2) && (isNorth(c, a) || isNorth(c, b))) return true
  const pa = c.s.prefectures[a], pb = c.s.prefectures[b]
  if (pa && pa.stormT === t) return true
  if (pb && pb.stormT === t) return true
  return false
}
export const winterNow = (c: Ctx): boolean => isWinter(c.s.t)

export function foodUpkeep(c: Ctx, pref: string, t = c.s.t): number {
  const p = ps(c, pref)
  let u = Math.ceil(p.men / 10)
  if (isWinter(t)) u = Math.ceil((u * 3) / 2)
  if (p.stormT === t) u += Math.ceil(u / 4)
  return u
}

/** Move hero between prefecture lists. */
export function place(c: Ctx, hero: string, pref: string | null): void {
  const h = hs(c, hero)
  if (h.loc) {
    const p = c.s.prefectures[h.loc]
    if (p) { p.heroes = p.heroes.filter((x) => x !== hero); p.captives = p.captives.filter((x) => x !== hero) }
  }
  h.loc = pref
  if (pref) {
    const q = ps(c, pref)
    if (h.status === 'captive') q.captives.push(hero)
    else q.heroes.push(hero)
  }
}
export function sortHeroes(c: Ctx, ids: string[]): string[] {
  return [...ids].sort((a, b) => rank(c, a) - rank(c, b) || (a < b ? -1 : 1))
}

export interface Reject { code: import('./types').RejectCode; message: string }
export const rej = (code: import('./types').RejectCode, rule: string, message: string): Reject => ({ code, message: `${rule}: ${message}` })
