// A rules: the greedy decider. Strategic choices come from legalFor (so only legal commands), foreign numbers
// from perceive (Z-5 bands), battle choices from legalForUnit. Deterministic given the state (A-9).
import type { Action, BUnit, GameState, Hex } from '../engine/types'
import type { Ctx } from '../engine/ctx'
import { mkCtx, ps, hs, abil, EMPEROR } from '../engine/ctx'
import { monthOf, AI_RATIO } from '../engine/calendar'
import { defaultBundle } from '../engine/data'
import type { DataBundle } from '../data'
import { isReject, legalFor, runCommand } from '../engine/strategic/commands'
import { runway, levyAmount } from '../engine/strategic/economy'
import { duelAccept, duelWin, legalForUnit } from '../engine/battle/actions'
import { active, getUnit, other, visibleEnemies } from '../engine/battle/core'
import { hexDistance, fromOffset, key } from '../engine/battle/hex'

export interface Seen { pop: number; gold: number; food: number; men: number; arms: number; heroes: number; exact: boolean }
const band = (v: number): number => {
  if (v < 100) return v
  const m = Math.pow(10, Math.floor(Math.log10(v)) - 1)
  return Math.round(v / m) * m
}
/** Z-5: what `faction` sees of a prefecture. */
export function perceive(c: Ctx, faction: string, pref: string): Seen {
  const p = ps(c, pref)
  const heroes = p.heroes.filter((h) => h !== EMPEROR && hs(c, h).faction === p.owner).length
  if (p.owner === faction || (faction === 'player' && p.spyT >= c.s.t - 3)) return { pop: p.pop, gold: p.gold, food: p.food, men: p.men, arms: p.arms, heroes, exact: true }
  return { pop: band(p.pop), gold: band(p.gold), food: band(p.food), men: band(p.men), arms: band(p.arms), heroes, exact: false }
}
const powerOf = (v: { men: number; arms: number; heroes: number }): number => v.men + 500 * v.heroes + v.arms / 4

type Cmd = Exclude<Action, { t: 'endPhase' } | { t: 'choose' }>

export function decideStrategic(c: Ctx, faction: string, pref: string): Action | null {
  const p = ps(c, pref)
  const acts = legalFor(c, faction, pref)
  if (!acts.length) return null
  const first = <T extends Action['t']>(t: T, pred?: (a: (Action & { t: T })) => boolean): (Action & { t: T }) | undefined =>
    acts.find((a) => a.t === t && (!pred || pred(a as (Action & { t: T })))) as (Action & { t: T }) | undefined
  const best = <T extends Action['t']>(t: T, score: (a: (Action & { t: T })) => number): (Action & { t: T }) | undefined => {
    let b: (Action & { t: T }) | undefined
    let bs = -Infinity
    for (const a of acts) if (a.t === t) { const sc = score(a as (Action & { t: T })); if (sc > bs) { bs = sc; b = a as (Action & { t: T }) } }
    return b
  }
  const player = faction === 'player'
  const own = (): { men: number; arms: number; heroes: number } => ({ men: p.men, arms: p.arms, heroes: p.heroes.filter((h) => h !== EMPEROR && hs(c, h).faction === faction).length })
  if (player) {
    const sw = first('swear')
    if (sw) return sw
  }
  // (1) food
  let noFood = false
  if (runway(c, pref) < 2) {
    const buy = best('trade', (a) => (a.dir === 'buyFood' ? a.amount : -1))
    if (buy && buy.dir === 'buyFood') return buy
    noFood = true
  }
  // (2) support
  if (p.support < 40 && !noFood) { const r = first('relieve'); if (r) return r }
  // (3) an enemy of equal strength is linked
  const me = powerOf(own())
  const threatened = (c.x.adj[pref] ?? []).some((n) => { const o = ps(c, n.to).owner; return o !== faction && o !== 'free' && powerOf(perceive(c, faction, n.to)) >= 0.8 * me })
  if (threatened) {
    if (p.training < 70) { const t = best('train', (a) => abil(c, a.actor).command); if (t) return t }
    if (!noFood && p.men < Math.floor(p.pop / 20) * 0.7) { const l = best('levy', (a) => levyAmount(c, pref, a.actor)); if (l) return l }
    if (p.arms < p.men) { const f = first('forge'); if (f) return f }
  }
  // (4) dykes before the rains
  const m = monthOf(c.s.t)
  if ((m === 4 || m === 5) && p.dyke < 50) { const d = first('dykes'); if (d) return d }
  // (5) attack
  if (faction !== 'court') {
    const k = AI_RATIO[c.s.setup.difficulty]
    let target = ''
    let bv = -1
    for (const n of c.x.adj[pref] ?? []) {
      if (ps(c, n.to).owner === faction) continue
      const v = perceive(c, faction, n.to)
      if (powerOf(v) * k > me) continue
      const val = v.pop / 1000 + v.gold / 100 + 50 * v.heroes
      if (val > bv && acts.some((a) => a.t === 'attack' && a.target === n.to)) { bv = val; target = n.to }
    }
    if (target && p.men > 0) {
      const home = Math.floor(p.men * 0.7)
      const a = first('attack', (x) => x.target === target && x.men === home) ?? first('attack', (x) => x.target === target)
      if (a) return a
    }
  }
  // (6) bandits
  if (p.bandits >= 100) { const h = best('hunt', (a) => a.party.length); if (h) return h }
  // (7) recruit
  let rb: Action | null = null
  let rp = 39
  for (const a of acts) {
    if (a.t !== 'recruit') continue
    const pv = runCommand(c, a, faction, true)
    if (!isReject(pv) && (pv.pct ?? 0) > rp) { rp = pv.pct ?? 0; rb = a }
  }
  if (rb) return rb
  // (8) train, (9) rest
  if (p.training < 100) { const t = best('train', (a) => abil(c, a.actor).command); if (t) return t }
  if (player && p.gold > 600) { const t = best('forge', () => 1); if (t && p.arms < p.men) return t }
  return first('rest') ?? null
}

/** A-9 battle decider: one action for the side to act. */
export function aiBattleAction(c: Ctx): Action {
  const b = c.s.battle!
  const side = b.toAct
  const units = active(b, side).sort((p, q) => (p.id < q.id ? -1 : 1))
  const cmd = b.units.find((u) => u.side === side && u.commander)
  for (const u of units) {
    if (u.acted) continue
    const acts = legalForUnit(c, u)
    const foes = visibleEnemies(b, side)
    // duel
    let bd: Action | null = null
    let bp = 20
    for (const a of acts) {
      if (a.t !== 'bDuel') continue
      const t = getUnit(b, a.target)
      if (!t) continue
      const prod = (duelWin(u, t).win * duelAccept(c, b, u, t, a.stake)) / 100
      if (prod >= bp) { bp = prod; bd = a }
    }
    if (bd) return bd
    const lowest = (as: Action[]): Action | null => {
      let best: Action | null = null
      let bm = Infinity
      for (const a of as) { const t = getUnit(b, (a as { target: string }).target); if (t && t.men < bm) { bm = t.men; best = a } }
      return best
    }
    const ch = lowest(acts.filter((a) => a.t === 'bCharge'))
    if (ch) return ch
    const vo = lowest(acts.filter((a) => a.t === 'bVolley'))
    if (vo) return vo
    const at = lowest(acts.filter((a) => a.t === 'bAttack' || a.t === 'bAmbush'))
    if (at) return at
    const moves = acts.filter((a): a is Extract<Action, { t: 'bMove' }> => a.t === 'bMove')
    const wait: Action = { t: 'bWait', unit: u.id }
    if (moves.length) {
      const hurt = u.men * 100 < u.maxMen * 30
      let goal: Hex | null = null
      if (hurt && cmd && cmd.id !== u.id) goal = cmd.pos
      else if (foes.length) {
        const nearest = [...foes].sort((p, q) => hexDistance(u.pos, p.pos) - hexDistance(u.pos, q.pos) || (p.id < q.id ? -1 : 1))[0] as BUnit
        // defenders hold their ground until an enemy is close
        if (side === 'd' && hexDistance(u.pos, nearest.pos) > 7) goal = null
        else goal = nearest.pos
      } else if (side === 'a') goal = fromOffset(b.w - 2, Math.floor(b.h / 2))
      if (goal) {
        const here = hexDistance(u.pos, goal)
        let pick: Extract<Action, { t: 'bMove' }> | null = null
        let pd = here
        for (const m of moves) {
          const d = hexDistance(m.to, goal)
          if (d < pd || (d === pd && pick && key(m.to) < key(pick.to))) { pd = d; pick = m }
        }
        if (pick) return pick
      }
    }
    return wait
  }
  return { t: 'bEndSide' }
}

/** What the greedy decider answers to a pending decision. */
export function greedyChoose(c: Ctx): Action {
  const pd = c.s.pending!
  const o = pd.options
  if (pd.kind === 'captive') {
    const cap = (pd.data as { captive: string }).captive
    void cap
    return { t: 'choose', option: o.includes('persuade') && hs(c, (pd.data as { captive: string }).captive).persuadedT !== c.s.t ? 'persuade' : 'hold' }
  }
  if (pd.kind === 'tiger') return { t: 'choose', option: o.find((x) => x !== 'ignore') ?? 'ignore' }
  if (pd.kind === 'inspection') return { t: 'choose', option: o.includes('bribe') ? 'bribe' : 'refuse' }
  if (pd.kind === 'convoy') return { t: 'choose', option: 'take' }
  if (pd.kind === 'duelOffer') return { t: 'choose', option: 'accept' }
  return { t: 'choose', option: o[0] as string }
}

/** The decider usable for any seat in sims: always returns an action from the legal set. */
export function greedyAction(state: GameState, data: DataBundle = defaultBundle): Action {
  const c = mkCtx(state, data)
  const s = state
  if (s.pending) return greedyChoose(c)
  if (s.phase === 'battle') return s.battle && s.battle.human && !s.battle.auto[s.battle.human] ? { t: 'bAuto' } : { t: 'bEndSide' }
  for (const id of c.x.order) {
    if (ps(c, id).owner !== 'player' || (s.commandsLeft[id] ?? 0) <= 0) continue
    const a = decideStrategic(c, 'player', id)
    if (a) return a
  }
  return { t: 'endPhase' }
}
void other
