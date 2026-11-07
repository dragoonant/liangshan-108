// Battle helpers: units, visibility, movement, damage chain (W-5..W-12), rout and capture (W-19, W-20, W-26).
import type { BattleState, BUnit, Hex, Side, Terr } from '../types'
import type { Ctx } from '../ctx'
import { emit, heroName, GAO_QIU } from '../ctx'
import { roll } from '../rng'
import { clamp, pct } from '../util'
import { hexDistance, key, neighbors, same, neighbor, dirTo } from './hex'
import { IMPASSABLE, TERR, moveCostFor } from './terrain'

export const DAYS = 20
export const other = (s: Side): Side => (s === 'a' ? 'd' : 'a')
export const getUnit = (b: BattleState, id: string): BUnit | undefined => b.units.find((u) => u.id === id)
export const active = (b: BattleState, side?: Side): BUnit[] => b.units.filter((u) => u.state === 'active' && (!side || u.side === side))
export const unitAt = (b: BattleState, h: Hex): BUnit | undefined => b.units.find((u) => u.state === 'active' && same(u.pos, h))
export const terrAt = (b: BattleState, h: Hex): Terr | undefined => b.terrain[key(h)]
export const humanControls = (b: BattleState, side: Side): boolean => b.human === side && !b.auto[side]
export const hasSkill = (u: BUnit, s: string): boolean => u.skills.includes(s)

/** W-24: what `side` can see of an enemy unit. */
export function visibleTo(b: BattleState, side: Side, e: BUnit): boolean {
  if (e.side === side) return true
  if (!e.hidden) return true
  for (const u of active(b, side)) {
    const r = hasSkill(u, 'scout') ? 4 : 2
    if (hexDistance(u.pos, e.pos) <= r) return true
  }
  return false
}
export const visibleEnemies = (b: BattleState, side: Side): BUnit[] => active(b, other(side)).filter((e) => visibleTo(b, side, e))

export function maxMove(u: BUnit): number {
  let m = u.kind === 'cavalry' ? 7 : u.kind === 'boats' ? 5 : 4
  if (hasSkill(u, 'runner')) m += 1
  if (u.fatigue >= 80) m -= 2
  else if (u.fatigue >= 50) m -= 1
  return Math.max(1, m)
}

export interface Reach { cost: number; path: Hex[] }
/** W-6, W-8: reachable hexes with cost; entering an enemy zone of control ends the move. */
export function moveRange(b: BattleState, u: BUnit): Map<string, Reach> {
  const enemies = active(b, other(u.side)).filter((e) => visibleTo(b, u.side, e))
  const zoc = new Set<string>()
  for (const e of enemies) for (const n of neighbors(e.pos)) zoc.add(key(n))
  const enemyAt = new Set(enemies.map((e) => key(e.pos)))
  const hiddenEnemyAt = new Set(active(b, other(u.side)).filter((e) => !visibleTo(b, u.side, e)).map((e) => key(e.pos)))
  const friendAt = new Set(active(b, u.side).filter((f) => f.id !== u.id).map((f) => key(f.pos)))
  const swimmer = hasSkill(u, 'swimmer')
  const budget = maxMove(u)
  const best = new Map<string, { cost: number; prev: string | null; h: Hex }>()
  const startK = key(u.pos)
  best.set(startK, { cost: 0, prev: null, h: u.pos })
  const open = [startK]
  const done = new Set<string>()
  while (open.length) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if ((best.get(open[i] as string) as { cost: number }).cost < (best.get(open[bi] as string) as { cost: number }).cost) bi = i
    const ck = open.splice(bi, 1)[0] as string
    if (done.has(ck)) continue
    done.add(ck)
    const cur = best.get(ck) as { cost: number; h: Hex }
    if (ck !== startK && zoc.has(ck)) continue // movement ends in a zone of control
    for (const n of neighbors(cur.h)) {
      const nk = key(n)
      const tr = b.terrain[nk]
      if (!tr || enemyAt.has(nk) || hiddenEnemyAt.has(nk)) continue
      const step = moveCostFor(u.kind, tr, swimmer)
      if (step >= IMPASSABLE) continue
      const nc = cur.cost + step
      if (nc > budget) continue
      const old = best.get(nk)
      if (!old || nc < old.cost) { best.set(nk, { cost: nc, prev: ck, h: n }); open.push(nk) }
    }
  }
  const out = new Map<string, Reach>()
  for (const [k, v] of best) {
    if (k === startK || friendAt.has(k)) continue
    const path: Hex[] = []
    let cur: string | null = k
    while (cur) { const e = best.get(cur) as { prev: string | null; h: Hex }; path.unshift(e.h); cur = e.prev }
    out.set(k, { cost: v.cost, path })
  }
  return out
}

export function fatigueCost(u: BUnit, base: number): number { return Math.max(1, base - Math.floor(u.vigour / 40)) }
export function addFatigue(u: BUnit, cause: string, base: number): void {
  const n = fatigueCost(u, base)
  u.fatigue = clamp(0, 100, u.fatigue + n)
  u.fatigueLog.push({ cause, n })
}
export const addMorale = (u: BUnit, d: number): void => { u.morale = clamp(0, 100, u.morale + d) }

export interface Factor { name: string; pct: number; after: number }
export interface Chain { value: number; factors: Factor[] }

/** W-9. `counter` skips the pincer step; the caller supplies the action%. */
export function dmgChain(b: BattleState, att: BUnit, def: BUnit, actionPct: number, melee: boolean, counter = false): Chain {
  const factors: Factor[] = []
  let x = 40 + Math.floor(att.might / 2) + Math.floor(att.men / 10)
  factors.push({ name: 'base', pct: 100, after: x })
  const step = (name: string, m: number): void => { x = pct(x, m); factors.push({ name, pct: m, after: x }) }
  step('fatigue', 100 - Math.floor(att.fatigue / 2))
  let tr = att.training
  if (active(b, att.side).some((f) => f.id !== att.id && hasSkill(f, 'drillmaster') && hexDistance(f.pos, att.pos) === 1)) tr = Math.min(100, tr + 10)
  step('training', 80 + Math.floor(tr / 5))
  const armed = hasSkill(att, 'smith') ? Math.max(att.armed, 80) : att.armed
  step('arms', 60 + Math.floor((40 * armed) / 100))
  const ta = terrAt(b, att.pos) ?? 'plain', td = terrAt(b, def.pos) ?? 'plain'
  let boats = 0
  if (att.kind === 'boats') boats = ta === 'water' || ta === 'marsh' || ta === 'reed' ? 10 : -10
  step('height', 100 + 10 * clamp(-1, 1, TERR[ta].height - TERR[td].height) + boats)
  step('action', actionPct)
  if (att.counsel) step('counsel', 110)
  if (melee && !counter) {
    let pin = 100
    const d = dirTo(def.pos, att.pos)
    if (d >= 0) {
      const opp = unitAt(b, neighbor(def.pos, d + 3))
      if (opp && opp.side === att.side && opp.id !== att.id) pin = 125
    }
    step('pincer', pin)
  }
  step('terrain', TERR[td].def)
  if (b.walled && def.side === 'd' && hasSkill(def, 'builder')) step('builder', 90)
  step('command', 100 - Math.floor(def.command / 4))
  return { value: x, factors }
}
export const finalDamage = (x: number, def: BUnit, variance: number): number => Math.min(def.men, Math.max(1, pct(x, 100 + variance)))

export function actionPctMelee(u: BUnit): number { return u.kind === 'archers' ? 70 : 100 }
export function counterPct(u: BUnit, brace: boolean): number { return brace ? 100 : u.kind === 'archers' ? 40 : 60 }

export function routedByRule(u: BUnit): boolean {
  const thr = u.hero === GAO_QIU ? 30 : 10
  return u.morale <= 20 || u.men <= Math.floor((u.maxMen * thr) / 100)
}

export function cornered(c: Ctx, b: BattleState, u: BUnit): boolean {
  if (active(b, u.side).length <= 1) return true
  if (u.hero === GAO_QIU) return openLinks(c, b.target).length === 0
  return false
}
/** G-8: links of a prefecture whose far end is not player-owned. */
export function openLinks(c: Ctx, pref: string): string[] {
  return (c.x.adj[pref] ?? []).filter((n) => c.s.prefectures[n.to]?.owner !== 'player').map((n) => n.to).sort()
}

/** W-19 capture odds shown on the unit card. */
export function captureOdds(b: BattleState, u: BUnit): number | null {
  const foes = active(b, other(u.side)).filter((e) => hexDistance(e.pos, u.pos) <= 2)
  if (!foes.length || u.hero.startsWith('cap-')) return null
  const best = Math.max(...foes.map((e) => e.might))
  let p = clamp(15, 85, 50 + Math.floor((best - u.might) / 2))
  if (hasSkill(u, 'runner')) p -= 20
  return Math.max(5, p)
}

/** Removes a unit from the fight: capture roll when an enemy is near, morale shocks, commander loss. */
export function routUnit(c: Ctx, b: BattleState, u: BUnit, why: string): void {
  if (u.state !== 'active') return
  const foes = active(b, other(u.side)).filter((e) => hexDistance(e.pos, u.pos) <= 2)
  u.hidden = false
  let captured = false
  if (u.hero === GAO_QIU) {
    captured = u.men <= 0 && foes.length > 0
  } else if (foes.length && !u.hero.startsWith('cap-')) {
    const p = captureOdds(b, u) as number
    captured = roll(c.s, 100) < p
    emit(c, captured ? 'captured' : 'escaped', 'W-19', `${heroName(c, u.hero)} ${captured ? 'is captured' : 'escapes'} (${p}%, ${why})`)
  }
  if (captured) { u.state = 'captured'; u.capturedBy = other(u.side) } else u.state = 'routed'
  emit(c, 'routed', 'W-20', `${unitName(c, u)} ${captured ? 'falls' : 'routs'} (${why})`)
  for (const a of active(b, u.side)) if (hexDistance(a.pos, u.pos) <= 3) addMorale(a, -10)
  if (u.commander) for (const a of active(b, u.side)) addMorale(a, -30)
  const killer = foes.sort((p, q) => hexDistance(p.pos, u.pos) - hexDistance(q.pos, u.pos))[0]
  if (killer) addMorale(killer, 10)
}
export const unitName = (c: Ctx, u: BUnit): string => (u.hero.startsWith('cap-') ? 'Garrison captain' : heroName(c, u.hero))

/** Rout check after damage or at dusk. */
export function checkRout(c: Ctx, b: BattleState, u: BUnit): void {
  if (u.state !== 'active') return
  if (u.men <= 0) routUnit(c, b, u, 'destroyed')
  else if (routedByRule(u)) routUnit(c, b, u, 'broken')
}
