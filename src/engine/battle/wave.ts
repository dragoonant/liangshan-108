// W-32 (D21): reinforcement waves at the capital. Pure reads (`waveInfo`) and the one mutation (`callWave`).
import type { BattleState, BUnit, Hex } from '../types'
import type { Ctx } from '../ctx'
import { abil, emit, hs, prefName, ps, rank, snowedIn, EMPEROR } from '../ctx'
import { armedRatio } from '../strategic/economy'
import { fromOffset, key } from './hex'
import { TERR } from './terrain'
import { mkUnit } from './setup'

export const WAVE_DAYS = [5, 10, 15]
export const WAVE_MAX = 8
export interface WaveSend { pref: string; heroes: string[]; men: number }
export interface WaveInfo { applies: boolean; days: number[]; nextDay: number | null; arrived: { day: number; units: number; men: number }[]; forecast: { units: number; men: number; from: WaveSend[] } }

/** Who each bordering prefecture of the player would send now (W-32). */
export function planWave(c: Ctx, b: BattleState | null): WaveSend[] {
  const out: WaveSend[] = []
  let units = 0
  const inBattle = new Set((b?.units ?? []).map((u) => u.hero))
  for (const n of [...(c.x.adj[c.x.capital] ?? [])].sort((p, q) => (p.to < q.to ? -1 : 1))) {
    const p = ps(c, n.to)
    if (p.owner !== 'player' || snowedIn(c, n.to, c.x.capital)) continue
    const pool = p.heroes.filter((h) => h !== EMPEROR && !inBattle.has(h) && hs(c, h).faction === 'player' && ['ordinary', 'sworn'].includes(hs(c, h).status) && hs(c, h).wounded <= c.s.t)
      .sort((x, y) => abil(c, y).command - abil(c, x).command || rank(c, x) - rank(c, y) || (x < y ? -1 : 1))
    const homeHeroes = p.heroes.filter((h) => h !== EMPEROR && hs(c, h).faction === 'player').length
    const spare = Math.min(pool.length, Math.max(0, homeHeroes - 1), WAVE_MAX - units)
    let budget = Math.floor(p.men * 0.7)
    const heroes: string[] = []
    let men = 0
    for (const h of pool.slice(0, spare)) {
      const take = Math.min(abil(c, h).command * 15, budget)
      if (take < 0) break
      heroes.push(h); budget -= take; men += take
    }
    if (heroes.length) { out.push({ pref: n.to, heroes, men }); units += heroes.length }
  }
  return out
}
export function waveInfo(c: Ctx): WaveInfo {
  const b = c.s.battle
  const applies = !!b && b.target === c.x.capital && b.attacker === 'player'
  const plan = applies || !b ? planWave(c, b) : []
  const waves = b?.waves ?? []
  const next = applies ? WAVE_DAYS.find((d) => d >= (b as BattleState).day && !waves.some((w) => w.day === d)) ?? null : WAVE_DAYS[0] ?? null
  return {
    applies: applies || !b, days: WAVE_DAYS, nextDay: next ?? null, arrived: waves.map((w) => ({ day: w.day, units: w.units, men: w.men })),
    forecast: { units: plan.reduce((a, x) => a + x.heroes.length, 0), men: plan.reduce((a, x) => a + x.men, 0), from: plan },
  }
}

function freeHexes(b: BattleState): Hex[] {
  const used = new Set(b.units.filter((u) => u.state === 'active').map((u) => key(u.pos)))
  const mid = Math.floor(b.h / 2)
  const out: Hex[] = []
  for (let x = 0; x < b.w; x++) for (const y of [...Array(b.h).keys()].sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid) || p - q)) {
    const h = fromOffset(x, y)
    const t = b.terrain[key(h)]
    if (t && TERR[t].inf < 99 && !used.has(key(h))) out.push(h)
  }
  return out
}

/** Called when a new day begins in a battle for the capital. */
export function callWave(c: Ctx): void {
  const b = c.s.battle
  if (!b || b.target !== c.x.capital || b.attacker !== 'player' || !WAVE_DAYS.includes(b.day)) return
  b.waves = b.waves ?? []
  if (b.waves.some((w) => w.day === b.day)) return
  const plan = planWave(c, b)
  const slots = freeHexes(b)
  let n = 0, men = 0
  const sent: string[] = []
  for (const s of plan) {
    const p = ps(c, s.pref)
    for (const h of s.heroes) {
      const take = Math.min(abil(c, h).command * 15, Math.floor(p.men * 0.7))
      const armed = armedRatio(p.men, p.arms)
      const pos = slots.shift()
      if (!pos) break
      p.men -= take; p.arms = Math.max(0, p.arms - Math.floor((take * armed) / 100))
      const u: BUnit = mkUnit(c, `w${b.day}-${n}`, 'a', h, take + Math.max(0, 50 - take), Math.max(0, 50 - take), armed, p.training, false, pos, 60 + Math.floor(p.training / 10))
      u.home = s.pref
      b.units.push(u)
      n++; men += take
    }
    sent.push(`${prefName(c, s.pref)} ${s.heroes.length}`)
  }
  b.waves.push({ day: b.day, units: n, men })
  if (n) emit(c, 'wave', 'W-32', `Reinforcements reach the field on day ${b.day}: ${n} units, ${men} men (${sent.join(', ')})`, b.target, n)
  else emit(c, 'wave', 'W-32', `No reinforcements arrive on day ${b.day}`, b.target, 0)
}
