// Player policies for the sim (PLAN D16): blunt stand-ins for a human, each with one goal, each answering only with an action
// taken from `legalActions`. They read the same numbers a player sees (foreign prefectures in 10% bands, Z-5).
// Baselines: `greedy` (the A-rules decider) and `careless` (a random legal action).
import type { Action, GameState } from '../engine/types'
import type { Ctx } from '../engine/ctx'
import { abil, EMPEROR, GAO_QIU, hs, mkCtx, prefGraft, ps, rec } from '../engine/ctx'
import { defaultBundle } from '../engine/data'
import type { DataBundle } from '../data'
import { runway, levyAmount } from '../engine/strategic/economy'
import { foodUpkeep } from '../engine/ctx'
import { monthOf, AI_RATIO } from '../engine/calendar'
import { greedyAction, perceive } from './greedy'
import { planWave } from '../engine/battle/wave'
import { allied } from '../engine/strategic/camps'
import { renownInfo } from '../engine/query/renown'
import { oathStatus } from '../engine/strategic/heroes'

export type PolicyId = 'greedy' | 'careless' | 'justice' | 'benevolent' | 'warlord' | 'brotherhood' | 'campaign'
export const POLICIES: PolicyId[] = ['campaign', 'justice', 'benevolent', 'warlord', 'brotherhood', 'careless', 'greedy']
export const SENSIBLE: PolicyId[] = ['campaign', 'justice', 'benevolent', 'warlord', 'brotherhood']

export interface Env { s: GameState; c: Ctx; legal: Action[]; id: PolicyId; owned: string[]; edict: boolean }
type Of<T extends Action["t"]> = Action & { t: T }
const of = <T extends Action['t']>(e: Env, t: T, pred?: (a: Of<T>) => boolean): Of<T>[] => e.legal.filter((a) => a.t === t && (!pred || pred(a as Of<T>))) as Of<T>[]

const reserve = (e: Env, pref: string): number => Math.ceil(ps(e.c, pref).men / 20) * 3 + 60
const free = (e: Env, pref: string): number => ps(e.c, pref).gold - reserve(e, pref)
const heroVal = (e: Env, h: string): number => { const a = abil(e.c, h); return a.might + a.command + 100 }
const upkeep = (e: Env, pref: string): number => foodUpkeep(e.c, pref)

/** Strength of an attacking force against a perceived (banded) target, both in "men" (heroes count for their might and command). */
export function ratio(e: Env, a: Of<'attack'>): number {
  const v = perceive(e.c, 'player', a.target)
  const t = e.c.x.pref[a.target]!
  const lead = a.heroes.reduce((x, h) => x + Math.max(50, abil(e.c, h).command * 15), 0)
  const own = Math.min(a.men, lead) + a.heroes.reduce((x, h) => x + heroVal(e, h), 0)
  const foe = (v.men + v.heroes * 250 + (v.exact ? 0 : 0)) * (t.seat === 'town' ? 1 : 1.2) + 100
  return own / foe
}

function choosePending(id: PolicyId, e: Env): Action {
  const pd = e.s.pending!
  const o = pd.options
  const pick = (x: string): Action => ({ t: 'choose', option: o.includes(x) ? x : (o[0] as string) })
  if (pd.kind === 'captive') {
    const cap = (pd.data as { captive: string }).captive
    if (o.includes('persuade') && hs(e.c, cap).persuadedT !== e.s.t) return pick('persuade')
    return pick(id === 'benevolent' || id === 'brotherhood' ? 'release' : 'hold')
  }
  if (pd.kind === 'tiger') return { t: 'choose', option: o.find((x) => x !== 'ignore') ?? 'ignore' }
  if (pd.kind === 'inspection') return pick(id === 'justice' ? 'refuse' : 'bribe')
  if (pd.kind === 'convoy') return pick('take')
  if (pd.kind === 'duelOffer') return pick('accept')
  return { t: 'choose', option: o[0] as string }
}

let carelessCalls = 0 // a call counter keeps a random walk from cycling (two heroes moving back and forth would otherwise repeat the same state forever)
function careless(e: Env): Action {
  // a hash of the state and the call count picks the action: no memory, no plan
  let h = (e.s.t * 2654435761 + e.s.rng.draws * 40503 + e.legal.length * 97 + e.s.rng.s[0] + ++carelessCalls * 2246822519) >>> 0
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0
  return e.legal[((h ^ (h >>> 16)) >>> 0) % e.legal.length] as Action
}

// ---- shared housekeeping: the things every sensible player does ----
function core(e: Env): Action | null {
  for (const p of e.owned) {
    const st = ps(e.c, p)
    if ((e.s.commandsLeft[p] ?? 0) <= 0) continue
    // food runway
    if (runway(e.c, p) < 4.5) {
      const buys = of(e, 'trade', (a) => a.pref === p && a.dir === 'buyFood')
      const need = upkeep(e, p) * 8 - st.food
      const pick = [...buys].sort((a, b) => b.amount - a.amount).find((a) => a.amount <= Math.max(100, need * 1.5) && st.gold >= a.amount * 0.7 + 60)
        ?? [...buys].sort((a, b) => a.amount - b.amount).find((a) => st.gold >= a.amount * 0.7 + 60)
      if (pick) return pick
    }
    // wavering and restless heroes
    const low = st.heroes.some((h) => hs(e.c, h).faction === 'player' && hs(e.c, h).status === 'ordinary' && hs(e.c, h).loyalty < 45)
    if (low && st.gold >= 160 && !e.s.log.some((l) => l.t === e.s.t && l.kind === 'feast' && l.pref === p)) { const r = of(e, 'rest', (a) => a.pref === p)[0]; if (r) return r }
    // the people
    if (st.support < 40 && st.food >= upkeep(e, p) * 3) { const r = of(e, 'relieve', (a) => a.pref === p)[0]; if (r) return r }
  }
  const sw = of(e, 'swear')[0]
  if (sw) return sw
  // the oath drive: feast the brothers-to-be until loyalty reaches 80 (B-1)
  const ch = e.s.factions['player']!.chieftain as string
  const home = hs(e.c, ch).loc
  if (home && ps(e.c, home).owner === 'player' && (e.s.commandsLeft[home] ?? 0) > 0 && free(e, home) >= 150 && !e.s.log.some((l) => l.t === e.s.t && l.kind === 'feast' && l.pref === home)) {
    const want = ps(e.c, home).heroes.some((h) => { const x = hs(e.c, h); return x.faction === 'player' && x.status === 'ordinary' && x.loyalty < 80 && oathStatus(e.c, h).compat >= 55 })
    if (want) { const r = of(e, 'rest', (a) => a.pref === home)[0]; if (r) return r }
  }
  return null
}

function recruit(e: Env, minPct: number): Action | null {
  let best: Of<'recruit'> | null = null
  let bp = minPct - 1
  for (const a of of(e, 'recruit', (x) => x.method === 'invite')) {
    if (free(e, a.pref) < 100) continue
    const o = oddsInvite(e, a)
    if (o > bp) { bp = o; best = a }
  }
  return best
}
import { recruitOdds } from '../engine/strategic/recruit'
const oddsInvite = (e: Env, a: Of<'recruit'>): number => recruitOdds(e.c, 'player', a.actor, a.target).pct

function persuadeCaptives(e: Env): Action | null {
  return of(e, 'recruit', (a) => a.method === 'persuade' && hs(e.c, a.target).persuadedT !== e.s.t)[0] ?? null
}

function build(e: Env, o: { levyTo: number; train: number; forge: boolean; byHeroes?: boolean }): Action | null {
  for (const p of e.owned) {
    const st = ps(e.c, p)
    if (!(e.s.commandsLeft[p] ?? 0)) continue
    const cap = Math.floor(st.pop / 20)
    const lv = of(e, 'levy', (a) => a.pref === p)[0]
    const heroN = st.heroes.filter((h) => hs(e.c, h).faction === 'player').length
    if (lv && st.men < cap * o.levyTo && (!o.byHeroes || st.men < heroN * 1300 + 600)) {
      const n = levyAmount(e.c, p, lv.actor)
      if (st.gold - n >= reserve(e, p) + 100 && st.food >= Math.ceil((st.men + n) / 10) * 8 && st.support >= 35) return lv
    }
    if (st.training < o.train && st.men > 0 && free(e, p) >= Math.ceil(st.men / 20) + 50) { const t = of(e, 'train', (a) => a.pref === p)[0]; if (t) return t }
    if (o.forge && st.arms < st.men * 0.9 && free(e, p) >= 500) { const f = of(e, 'forge', (a) => a.pref === p)[0]; if (f) return f }
  }
  return null
}

// ---- the finale: after the Edict every sensible policy marches on Gao Qiu ----
function distFrom(e: Env, goal: string): Record<string, number> {
  const d: Record<string, number> = { [goal]: 0 }
  const q = [goal]
  for (let i = 0; i < q.length; i++) for (const n of e.c.x.adj[q[i] as string] ?? []) if (d[n.to] === undefined) { d[n.to] = (d[q[i] as string] as number) + 1; q.push(n.to) }
  return d
}
function finale(e: Env): Action | null {
  const gao = hs(e.c, GAO_QIU)
  const goal = gao.loc ?? e.c.x.capital
  const d = distFrom(e, goal)
  const chase = goal !== e.c.x.capital || gao.flights > 0
  // attack: the target must border one of our prefectures; take the one nearest the goal
  const atk = of(e, 'attack').filter((a) => d[a.target] !== undefined)
  let best: Of<'attack'> | null = null
  let bd = 1e9
  for (const a of atk) {
    const dd = (d[a.target] as number) * 10 - (a.men > 0 ? 0 : 5)
    if (dd < bd || (dd === bd && best && a.men > best.men)) { bd = dd; best = a }
  }
  if (best) {
    const need = best.target === goal ? (chase ? 0.7 : 1.15) : 1.1
    // use the biggest force offered to that target
    const variants = atk.filter((a) => a.target === best!.target && !a.heroes.includes(e.s.factions['player']!.chieftain as string))
    const bestV = [...(variants.length ? variants : atk.filter((a) => a.target === best!.target))].sort((a, b) => ratio(e, b) - ratio(e, a))[0] as Of<'attack'>
    // W-32: at the capital the bordering prefectures add a wave on day 5, so a smaller first force is enough
    const extra = best.target === e.c.x.capital ? planWave(e.c, null).reduce((n, w) => n + w.men + w.heroes.reduce((m, h) => m + heroVal(e, h), 0), 0) : 0
    const foe0 = ratio(e, bestV)
    const adj = best.target === e.c.x.capital ? foe0 * (1 + extra / Math.max(1, 6000)) : foe0
    if (adj >= (best.target === e.c.x.capital ? 0.9 : need) && bestV.men >= 300) return bestV
  }
  // otherwise build, gather and bring the household to the front
  const b = build(e, { levyTo: 0.95, train: 85, forge: true })
  if (b) return b
  const rc = recruit(e, 30)
  if (rc) return rc
  for (const p of e.owned) {
    if (!(e.s.commandsLeft[p] ?? 0)) continue
    const mine = d[p] as number
    const steps = of(e, 'move', (a) => a.pref === p && (d[a.to] as number) < mine && a.heroes.length >= 1 && a.men >= ps(e.c, p).men * 0.99)
    const m = [...steps].sort((a, b) => b.heroes.length - a.heroes.length)[0]
    if (m && (ps(e.c, p).men > 150 || m.heroes.length > 1)) return m
  }
  return null
}

// ---- goal layers ----
const chiefOf = (e: Env): string => e.s.factions['player']!.chieftain as string
const noChief = (e: Env, a: Of<'attack'>): boolean => !a.heroes.includes(chiefOf(e))
const freeHeroesAt = (e: Env, pref: string): number => ps(e.c, pref).heroes.filter((h) => h !== EMPEROR && hs(e.c, h).faction === 'free' && hs(e.c, h).status === 'free').length

/** The power the A-5 test compares (men + 500 per hero + arms / 4), from what we are allowed to see. */
const powerOf = (v: { men: number; arms: number; heroes: number }): number => v.men + 500 * v.heroes + v.arms / 4
/** The strongest neighbour that could march on `pref` (rivals and camps; free prefectures never attack and the court marches only by campaign, A-6). */
export function danger(e: Env, pref: string): number {
  let d = 0
  for (const n of e.c.x.adj[pref] ?? []) {
    const o = ps(e.c, n.to).owner
    if (o === 'player' || o === 'free' || o === 'court' || (e.c.x.campOf[o] && allied(e.c, o))) continue // the court marches only by campaign (A-6)
    d = Math.max(d, powerOf(perceive(e.c, 'player', n.to)))
  }
  return d
}
/** Would `pref` stay out of the AI's reach (A-5 ratio k) with `men` men and `heroes` heroes left? */
export function safeAt(e: Env, pref: string, men: number, heroes: number): boolean {
  const st = ps(e.c, pref)
  const mine = men + 500 * heroes + st.arms / 4
  const dg = danger(e, pref)
  if (dg > 0 && heroes < 2) return false // a lone hero fields at most command x 15 men (W-5)
  return mine * AI_RATIO[e.s.setup.difficulty] > dg * 0.75 // walls and heroes favour the defender: 700 men held 23 of 30 against a 1,125-man host (B1 bench)
}
interface Expand { minRatio: number; minMen: number; value: (a: Of<'attack'>) => number | null }
/** Pick the best attack that passes the policy's value and safety tests. */
function expand(e: Env, o: Expand): Action | null {
  let best: Of<'attack'> | null = null
  let bv = 0
  for (const a of of(e, 'attack', (x) => noChief(e, x))) {
    if (a.men < o.minMen || a.target === e.c.x.capital || a.men > ps(e.c, a.pref).men * 0.75) continue // the A rules keep 30% at home; so do we
    const r = ratio(e, a)
    if (r < o.minRatio) continue
    if (!a.heroes.some((h) => hs(e.c, h).status === 'sworn' || hs(e.c, h).loyalty >= 60)) continue // a conquest needs a sworn or loyal (60+) governor for its command (T-3, D20)
    const stay = ps(e.c, a.pref).heroes.filter((h) => hs(e.c, h).faction === 'player' && !a.heroes.includes(h)).length
    if (!safeAt(e, a.pref, ps(e.c, a.pref).men - a.men, stay)) continue
    const v = o.value(a)
    if (v !== null && v > bv) { bv = v; best = a }
  }
  return best
}
/** Readiness: the court's next host is about `host(t) / 2`; a prefecture on the border keeps that many men and a little more, trained and armed. */
function readiness(e: Env): Action | null {
  const hostNow = Math.min(9000, 2000 + 25 * (e.s.t + 6)) / 2
  for (const p of e.owned) {
    if (!(e.s.commandsLeft[p] ?? 0)) continue
    const st = ps(e.c, p)
    const border = (e.c.x.adj[p] ?? []).some((n) => { const o = ps(e.c, n.to).owner; return o !== 'player' && o !== 'free' })
    if (!border || !st.heroes.some((h) => hs(e.c, h).faction === 'player')) continue
    const need = danger(e, p) / AI_RATIO[e.s.setup.difficulty] * 1.3
    const want = Math.min(Math.floor(st.pop / 20) * 0.8, Math.max(hostNow * 1.3 + 300, need - 500 * st.heroes.length))
    const lv = of(e, 'levy', (a) => a.pref === p)[0]
    if (lv && st.men < want) {
      const n = levyAmount(e.c, p, lv.actor)
      if (st.gold - n >= reserve(e, p) && st.food >= Math.ceil((st.men + n) / 10) * 7 && st.support >= 35) return lv
    }
    if (st.men >= 300 && st.training < 70 && free(e, p) >= Math.ceil(st.men / 20) + 50) { const tr = of(e, 'train', (a) => a.pref === p)[0]; if (tr) return tr }
    if (st.arms < st.men * 0.8 && free(e, p) >= 500) { const f = of(e, 'forge', (a) => a.pref === p)[0]; if (f) return f }
  }
  return null
}
/** A campaign is announced against one of our prefectures: levy, train and forge there before anything else. */
function defend(e: Env): Action | null {
  const cp = e.s.factions['court']!.campaign
  if (!cp || ps(e.c, cp.objective).owner !== 'player' || (e.s.commandsLeft[cp.objective] ?? 0) <= 0) return null
  const p = cp.objective
  const st = ps(e.c, p)
  const lv = of(e, 'levy', (a) => a.pref === p)[0]
  if (lv && st.gold >= 200) return lv
  const tr = of(e, 'train', (a) => a.pref === p)[0]
  if (tr && st.training < 90) return tr
  return of(e, 'forge', (a) => a.pref === p)[0] ?? null
}
function farm(e: Env, o: { relief: boolean; hunt: number; dykes: boolean }): Action | null {
  for (const p of e.owned) {
    const st = ps(e.c, p)
    if (!(e.s.commandsLeft[p] ?? 0)) continue
    if (o.relief && st.reliefT !== e.s.t && st.food >= upkeep(e, p) * 5 + 300) { const r = of(e, 'relieve', (a) => a.pref === p)[0]; if (r) return r }
    if (st.huntT !== e.s.t && st.bandits >= o.hunt) { const h = of(e, 'hunt', (a) => a.pref === p && a.party.length > 0)[0] ?? of(e, 'hunt', (a) => a.pref === p)[0]; if (h) return h }
    if (o.dykes && st.dyke < 75 && free(e, p) >= 260 && st.food >= 400 && [3, 4, 5, 6].includes(monthOf(e.s.t))) { const d = of(e, 'dykes', (a) => a.pref === p)[0]; if (d) return d }
  }
  return null
}
function hunt(e: Env, minBandits: number): Action | null { return farm(e, { relief: false, hunt: minBandits, dykes: false }) }

function justice(e: Env): Action | null {
  const ex = of(e, 'spy', (a) => a.op === 'expose')[0]
  if (ex) return ex
  const x = expand(e, { minRatio: 1.15, minMen: 250, value: (a) => {
    const o = ps(e.c, a.target).owner
    if (o === 'court') { const g = prefGraft(e.c, a.target); return g >= 40 ? 50 + g : 10 }
    return ratio(e, a) >= 2 ? 5 : null
  } })
  if (x) return x
  return build(e, { levyTo: 0.7, train: 70, forge: true }) ?? recruit(e, 35) ?? hunt(e, 100)
}
function benevolent(e: Env): Action | null {
  const f = farm(e, { relief: true, hunt: 15, dykes: true })
  if (f) return f
  const x = expand(e, { minRatio: 1.8, minMen: 250, value: (a) => { const o = ps(e.c, a.target).owner; return e.c.x.campOf[o] || o === 'free' ? 10 + ps(e.c, a.target).pop / 10000 : null } })
  if (x) return x
  return build(e, { levyTo: 0.4, train: 60, forge: false }) ?? recruit(e, 40)
}
function warlord(e: Env): Action | null {
  const x = expand(e, { minRatio: 1.05, minMen: 250, value: (a) => { const v = perceive(e.c, 'player', a.target); return v.pop / 1000 + v.gold / 100 + 20 * v.heroes + 30 * ratio(e, a) } })
  if (x) return x
  return build(e, { levyTo: 0.9, train: 80, forge: true }) ?? recruit(e, 50) ?? hunt(e, 150)
}
function brotherhood(e: Env): Action | null {
  const rc = recruit(e, 25)
  if (rc) return rc
  const pc = persuadeCaptives(e)
  if (pc) return pc
  // alliances with the camps next door (renewed when they are about to lapse)
  for (const a of of(e, 'ally')) {
    const f = e.s.factions[a.camp]!
    if ((!allied(e.c, a.camp) || f.allyUntil - e.s.t <= 4) && free(e, a.pref) >= 260) return a
  }
  // send a spare sworn brother to a prefecture without a commander
  const orphan = e.owned.find((p) => !ps(e.c, p).heroes.some((h) => ['sworn', 'chieftain'].includes(hs(e.c, h).status)))
  if (orphan) {
    for (const p of e.owned) {
      if (!(e.s.commandsLeft[p] ?? 0)) continue
      const sworn = ps(e.c, p).heroes.filter((h) => hs(e.c, h).status === 'sworn' || hs(e.c, h).status === 'chieftain')
      if (sworn.length < 2) continue
      const m = of(e, 'move', (a) => a.pref === p && a.to === orphan && a.heroes.length === 1 && hs(e.c, a.heroes[0] as string).status === 'sworn')[0]
      if (m) return m
    }
  }
  // camps that will not be friends, and cities where free heroes wait, are taken so their people can be invited or persuaded
  const x = expand(e, { minRatio: 1.3, minMen: 250, value: (a) => {
    const o = ps(e.c, a.target).owner
    const v = 30 * freeHeroesAt(e, a.target) + (e.c.x.campOf[o] ? 40 : 0) + 10 * perceive(e.c, 'player', a.target).heroes
    return v > 0 ? v : null
  } })
  if (x) return x
  const b = build(e, { levyTo: 0.5, train: 70, forge: false })
  if (b) return b
  return farm(e, { relief: true, hunt: 60, dykes: false })
}
const LAYER: Partial<Record<PolicyId, (e: Env) => Action | null>> = { justice, benevolent, warlord, brotherhood }

/** One action for the player seat under a policy. `legal` is `legalActions(state)` (the caller already needs it for its invariants). */
export function policyAction(id: PolicyId, s: GameState, legal: Action[], data: DataBundle = defaultBundle): Action {
  if (id === 'greedy') return greedyAction(s, data)
  const c = mkCtx(s, data)
  const e: Env = { s, c, legal, id, owned: c.x.order.filter((p) => ps(c, p).owner === 'player'), edict: s.factions['player']!.edict !== null }
  if (s.pending) return choosePending(id, e)
  if (s.phase === 'battle') return legal.find((a) => a.t === 'bAuto') ?? legal.find((a) => a.t === 'bEndSide') ?? (legal[0] as Action)
  if (id === 'careless') return careless(e)
  if (id === 'campaign') return campaignChoose(e) ?? { t: 'endPhase' }
  const a = core(e) ?? defend(e) ?? readiness(e) ?? (e.edict ? finale(e) : null) ?? LAYER[id]!(e) ?? idle(e)
  return a ?? { t: 'endPhase' }
}
/** Nothing else to do: a feast keeps the brothers loyal, else rest. */
function idle(e: Env): Action | null {
  for (const p of e.owned) if (free(e, p) >= 900 && (e.s.commandsLeft[p] ?? 0) > 0 && ps(e.c, p).heroes.some((h) => hs(e.c, h).status === 'ordinary' && hs(e.c, h).faction === 'player' && hs(e.c, h).loyalty < 90)) { const r = of(e, 'rest', (a) => a.pref === p)[0]; if (r) return r }
  return null
}
void EMPEROR; void rec

// ======================= the campaign policy (D23) =======================
// A goal-directed stand-in for a good player. Phases (logged by the sim):
//   1 grow    secure the start, invite and swear heroes, ally with or take the camps next door
//   2 expand  take prefectures along the shortest route to the capital, a loyal hero (D20) in each
//   3 renown  the projected Edict date is not green: farm the cheapest Renown (relief, hunts, justice conquests, expose)
//   4 stage   Edict granted: own as many of the capital's neighbours as possible (cut links, waves from them, W-32, G-8)
//   5 assault attack the capital with the largest force, then chase Gao Qiu
// It reads only the view a player has (banded foreign numbers, Z-5) and answers with actions from `legalActions`.
export const CAMPAIGN_PHASES = ['grow', 'expand', 'renown', 'stage', 'assault'] as const
export let campaignPhaseNow = 0 // 1-based index of the phase chosen by the last call (the sim logs first arrivals)

const servingHeroes = (e: Env): number => Object.keys(e.s.heroes).filter((h) => { const x = e.s.heroes[h]!; return x.faction === 'player' && ['chieftain', 'sworn', 'ordinary'].includes(x.status) }).length
const capNeighbours = (e: Env): string[] => (e.c.x.adj[e.c.x.capital] ?? []).map((n) => n.to)

function campaignAttack(e: Env, o: { minRatio: number; value: (a: Of<'attack'>) => number | null; maxShare?: number; needGovernor?: boolean; skipSafe?: boolean }): Action | null {
  let best: Of<'attack'> | null = null
  let bv = 0
  const cap = e.c.x.capital
  for (const a of of(e, 'attack', (x) => noChief(e, x))) {
    const isCap = a.target === cap
    if (a.men < 250 || (isCap && !e.edict)) continue
    if (a.men > ps(e.c, a.pref).men * (o.maxShare ?? 0.75) + 1) continue
    let r = ratio(e, a)
    if (isCap) { const extra = planWave(e.c, null).reduce((n, w) => n + w.men + w.heroes.reduce((m, h) => m + heroVal(e, h), 0), 0); r *= 1 + extra / 6000 }
    if (r < o.minRatio) continue
    if (o.needGovernor !== false && !a.heroes.some((h) => hs(e.c, h).status === 'sworn' || hs(e.c, h).loyalty >= 60)) continue
    const stay = ps(e.c, a.pref).heroes.filter((h) => hs(e.c, h).faction === 'player' && !a.heroes.includes(h)).length
    if (!isCap && !o.skipSafe && !safeAt(e, a.pref, ps(e.c, a.pref).men - a.men, stay)) continue
    const v = o.value(a)
    if (v === null) continue
    const score = v + 8 * Math.min(r, 3)
    if (score > bv) { bv = score; best = a }
  }
  return best
}
function routeValue(e: Env, d: Record<string, number>, a: Of<'attack'>): number {
  const o = ps(e.c, a.target).owner
  const p = perceive(e.c, 'player', a.target)
  const my = Math.min(...e.owned.map((q) => d[q] ?? 99), 99)
  const gain = my - (d[a.target] ?? 99) // steps nearer the capital
  return 10 + 14 * gain + 25 * freeHeroesAt(e, a.target) + (e.c.x.campOf[o] ? 20 : 0) + p.pop / 20000 + (o === 'court' ? 5 : 0)
}
function campaignConsolidate(e: Env, d: Record<string, number>): Action | null {
  for (const p of e.owned) {
    if (!(e.s.commandsLeft[p] ?? 0)) continue
    const st = ps(e.c, p)
    if (st.men < 600 || st.heroes.some((h) => hs(e.c, h).status === 'chieftain')) continue
    const mine = d[p] ?? 99
    const borders = (e.c.x.adj[p] ?? []).some((n) => ps(e.c, n.to).owner !== 'player')
    const m = of(e, 'move', (a) => a.pref === p && (d[a.to] ?? 99) < mine && a.men >= st.men * 0.99 && a.heroes.length >= 2)[0]
    if (m && !borders) return m
  }
  return null
}

/** Heroes and men belong together (a unit leads command x 15 men): send a spare hero to a linked prefecture that has men but few heroes. */
function campaignRedistribute(e: Env): Action | null {
  const heroesAt = (p: string): number => ps(e.c, p).heroes.filter((h) => hs(e.c, h).faction === 'player' && hs(e.c, h).wounded <= e.s.t).length
  for (const p of e.owned) {
    if (!(e.s.commandsLeft[p] ?? 0)) continue
    const have = heroesAt(p)
    if (have < 3) continue
    for (const m of of(e, 'move', (a) => a.pref === p && a.heroes.length === 1 && a.men === 0)) {
      const h = m.heroes[0] as string
      if (hs(e.c, h).status === 'chieftain') continue
      const dest = ps(e.c, m.to)
      const need = Math.ceil(dest.men / 1100) - heroesAt(m.to)
      const surplus = have - Math.ceil(ps(e.c, p).men / 1100) - 1
      if (need > 0 && surplus > 0) return m
    }
  }
  return null
}
/** Rich prefectures feed the poor ones (E-12 `send`, 500 at a time): hunger and unpaid wages are how conquests are lost. */
function campaignSupply(e: Env): Action | null {
  for (const q of e.owned) {
    const st = ps(e.c, q)
    const needFood = runway(e.c, q) < 5 && st.men > 0
    const needGold = st.gold < Math.ceil(st.men / 20) * 3 + 300
    if (!needFood && !needGold) continue
    for (const a of of(e, 'send', (x) => x.to === q)) {
      const p = ps(e.c, a.pref)
      if (needFood && a.food > 0 && p.food > upkeep(e, a.pref) * 10 + 1500) return a
      if (needGold && a.gold > 0 && p.gold > reserve(e, a.pref) + 2500) return a
    }
  }
  return null
}
/** Stage and assault: the army gathers at one capital neighbour (the owned one with most men and heroes); everything else marches towards it. */
function campaignConcentrate(e: Env): Action | null {
  const nbrs = capNeighbours(e).filter((n) => ps(e.c, n).owner === 'player')
  if (!nbrs.length) return null
  const score = (p: string): number => ps(e.c, p).men + 800 * ps(e.c, p).heroes.filter((h) => hs(e.c, h).faction === 'player').length
  const S = [...nbrs].sort((a, b) => score(b) - score(a))[0] as string
  const d = distFrom(e, S)
  for (const p of e.owned) {
    if (p === S || !(e.s.commandsLeft[p] ?? 0)) continue
    const st = ps(e.c, p)
    const mine = d[p] ?? 99
    const opts = of(e, 'move', (a) => a.pref === p && (d[a.to] ?? 99) < mine && a.men >= st.men * 0.99 && a.heroes.length >= 1)
    const m = [...opts].sort((a, b) => b.heroes.length - a.heroes.length)[0]
    if (m && (st.men >= 200 || m.heroes.length > 1)) return m
  }
  return null
}
function campaignChoose(e: Env): Action | null {
  const info = renownInfo(e.s)
  const cap = e.c.x.capital
  const d = distFrom(e, cap)
  const t = e.s.t
  const gao = hs(e.c, GAO_QIU)
  const ownsNbr = capNeighbours(e).filter((n) => ps(e.c, n).owner === 'player')
  let phase: 1 | 2 | 3 | 4 | 5
  if (e.edict) phase = gao.flights > 0 || ownsNbr.length >= 2 || (ownsNbr.length >= 1 && t - (e.s.factions['player']!.edict ?? t) > 14) ? 5 : 4
  else if (servingHeroes(e) < 7 && t < 30) phase = 1
  else if (info.status !== 'green') phase = 3
  else phase = 2
  campaignPhaseNow = phase

  // the shared helpers first: wages, food, loyalty, oaths, defence
  const base = core(e) ?? defend(e) ?? campaignSupply(e) ?? readiness(e) ?? (phase >= 4 ? null : campaignRedistribute(e))
  if (base) return base

  if (phase >= 4) {
    // chase target after a flight, else the capital
    const goal = gao.flights > 0 && gao.loc ? gao.loc : cap
    const dg = distFrom(e, goal)
    const toGoal = of(e, 'attack', (x) => x.target === goal)
    if (toGoal.length) {
      const gv = { minRatio: goal === cap ? 0.7 : 0.25, maxShare: 1, skipSafe: true, value: (x: Of<'attack'>) => (x.target === goal ? 100 : null) }
      const pick = campaignAttack(e, { ...gv, needGovernor: true }) ?? campaignAttack(e, { ...gv, needGovernor: false })
      if (pick && (pick as Of<'attack'>).target === goal) return pick
    }
    // take the capital's neighbours (or the next step to Gao Qiu), most useful first
    const stage = campaignAttack(e, { minRatio: 0.85, maxShare: 0.9, needGovernor: false, skipSafe: true, value: (a) => (capNeighbours(e).includes(a.target) || goal !== cap ? 40 + 20 * ((dg[a.target] ?? 9) < (Math.min(...e.owned.map((q) => dg[q] ?? 99)) as number) ? 1 : 0) + freeHeroesAt(e, a.target) * 5 : routeValue(e, dg, a) - 20) })
    if (stage) return stage
    return campaignConcentrate(e) ?? build(e, { levyTo: 0.95, train: 90, forge: true, byHeroes: true }) ?? recruit(e, 15) ?? persuadeCaptives(e) ?? idle(e)
  }
  if (phase === 3) {
    const f = farm(e, { relief: true, hunt: 15, dykes: true })
    if (f) return f
    const ex = of(e, 'spy', (a) => a.op === 'expose')[0]
    if (ex) return ex
    const x = campaignAttack(e, { minRatio: 1.05, maxShare: 0.85, value: (a) => { const o = ps(e.c, a.target).owner; return o === 'court' ? (() => { const g = prefGraft(e.c, a.target); return g >= 40 ? 50 + g : 15 })() + routeValue(e, d, a) / 2 : routeValue(e, d, a) } })
    if (x) return x
  } else {
    const x = campaignAttack(e, { minRatio: phase === 1 ? 1.1 : 1.0, maxShare: 0.85, value: (a) => {
      if (phase === 1) { const o = ps(e.c, a.target).owner; const v = 30 * freeHeroesAt(e, a.target) + (e.c.x.campOf[o] ? 40 : 0); return v > 0 ? v + 5 : routeValue(e, d, a) / 3 }
      return routeValue(e, d, a)
    } })
    if (x) return x
  }
  // otherwise: heroes, allies, army, Renown, in that order
  const rc = recruit(e, phase === 1 ? 20 : 25)
  if (rc) return rc
  const pc = persuadeCaptives(e)
  if (pc) return pc
  for (const a of of(e, 'ally')) {
    const f = e.s.factions[a.camp]!
    if ((!allied(e.c, a.camp) || f.allyUntil - e.s.t <= 4) && free(e, a.pref) >= 260) return a
  }
  const b = build(e, { levyTo: phase === 1 ? 0.6 : 0.9, train: 85, forge: true, byHeroes: true })
  if (b) return b
  return campaignConsolidate(e, d) ?? farm(e, { relief: true, hunt: 30, dykes: false }) ?? idle(e)
}
