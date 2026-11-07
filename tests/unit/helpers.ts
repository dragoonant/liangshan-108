import { createGame, step, legalActions, defaultBundle } from '../../src/engine'
import type { Action, GameState, Difficulty } from '../../src/engine'
import type { DataBundle } from '../../src/data'
import { mkCtx, place } from '../../src/engine/ctx'

export const D = defaultBundle
export const game = (start = 'song-jiang', difficulty: Difficulty = 2, seed = 7, forced?: number[]): GameState =>
  createGame({ startHero: start, difficulty, seed }, D, forced ? { forcedRolls: forced } : undefined)
export const ctxOf = (s: GameState, d: DataBundle = D) => mkCtx(s, d)

/** step that must succeed */
export function ok(s: GameState, a: Action, d: DataBundle = D): { state: GameState; events: ReturnType<typeof step> extends infer R ? (R extends { ok: true; events: infer E } ? E : never) : never } {
  const r = step(s, a, d)
  if (!r.ok) throw new Error(`rejected ${JSON.stringify(a)}: ${r.code} ${r.message}`)
  return { state: r.state, events: r.events as never }
}
export const kinds = (ev: { k: string }[]): string[] => ev.map((e) => e.k)

/** Answer any open decision with the first option, then end the phase until the next command phase of month t. */
export function toMonth(s0: GameState, t: number, d: DataBundle = D): GameState {
  let s = s0
  let n = 0
  while (s.t < t && s.phase !== 'result' && n++ < 400) {
    const legal = legalActions(s, d)
    const a = s.pending ? ({ t: 'choose', option: s.pending.options[s.pending.options.length - 1] as string } as Action) : s.phase === 'battle' ? ({ t: 'bAuto' } as Action) : ({ t: 'endPhase' } as Action)
    void legal
    s = ok(s, a, d).state
  }
  return s
}

/** One-prefecture bundle for the golden month (13-golden.md A). */
export function monthBundle(): DataBundle {
  const yz = D.map.prefectures.find((p) => p.id === 'yunzhou')!
  return {
    ...D,
    map: { prefectures: [{ ...yz, terrain: 'plains', special: ['capital'], base: { population: 150000, land: 60, flood: 50 } }], links: [] },
    heroes: D.heroes.filter((h) => h.id === 'song-jiang' || h.id === 'wu-yong').map((h) => ({ ...h })),
    extra: [], court: [], rivals: [], triggers: [],
  }
}

/** Answer decisions (last option) and auto-play battles until a command phase is open. */
export function settle(s0: GameState, d: DataBundle = D): GameState {
  let s = s0
  let n = 0
  while (s.phase !== 'result' && n++ < 200) {
    if (s.pending) s = ok(s, { t: 'choose', option: s.pending.options[s.pending.options.length - 1] as string }, d).state
    else if (s.phase === 'battle') s = ok(s, { t: 'bAuto' }, d).state
    else break
  }
  return s
}
/** End the command phase and play on to the next command phase. */
export function passMonth(s: GameState, d: DataBundle = D): GameState { return settle(ok(settle(s, d), { t: 'endPhase' }, d).state, d) }

import { greedyAction } from '../../src/ai/greedy'
/** Let the greedy decider play the player seat for `months` months (or to the result). */
export function playGreedy(s0: GameState, months: number, each?: (s: GameState) => void, d: DataBundle = D): GameState {
  let s = s0
  const end = s.t + months
  let n = 0
  while (s.phase !== 'result' && s.t < end && n++ < 4000) { s = ok(s, greedyAction(s, d), d).state; each?.(s) }
  return s
}

import { clone } from '../../src/engine/util'
import { monthEnd } from '../../src/engine/strategic/month'
/** Run the month-end resolution on a copy and return it (t advanced). */
export function endOf(s: GameState, d: DataBundle = D): GameState { const t = clone(s); monthEnd(mkCtx(t, d)); return t }
export const setPref = (s: GameState, id: string, patch: Partial<GameState['prefectures'][string]>): void => { Object.assign(s.prefectures[id]!, patch) }

import type { BUnit, BattleState } from '../../src/engine'
import { fromOffset, key } from '../../src/engine/battle/hex'
import { startBattle } from '../../src/engine/battle/setup'
import type { Launch } from '../../src/engine/battle/setup'
import { driveBattle } from '../../src/engine/step'
export function mkUnit(p: Partial<BUnit> & { id: string; hero: string; side: 'a' | 'd' }): BUnit {
  return {
    kind: 'infantry', skills: [], might: 40, command: 40, cunning: 40, vigour: 40, daring: 5, men: 100, maxMen: 100, guard: 0, armed: 100, training: 50, morale: 60, fatigue: 0,
    pos: { q: 0, r: 0 }, hidden: false, state: 'active', commander: false, moved: false, acted: false, waited: false, dueled: false, hurt: false, startedHidable: false,
    counsel: false, fatigueLog: [], specialUsed: false, capturedBy: null, ...p,
  }
}
/** Hand-made battle on an all-plain w x h board between the player's yunzhou and jizhou. */
export function plainBattle(units: BUnit[], opts: Partial<BattleState> = {}): GameState {
  const s = game('song-jiang', 2, 1)
  const terrain: Record<string, string> = {}
  for (let y = 0; y < 9; y++) for (let x = 0; x < 11; x++) terrain[key(fromOffset(x, y))] = 'plain'
  s.battle = {
    w: 11, h: 9, terrain: terrain as never, burning: {}, weather: null, wind: 0, day: 1, toAct: 'a', units, origin: 'yunzhou', target: 'jizhou', human: 'a', auto: { a: false, d: false },
    attacker: 'player', defender: 'free', imperial: false, walled: false, hungry: { a: false, d: false }, hunters: [], result: null, burned: 0, force: [], ...opts,
  }
  s.phase = 'battle'
  return s
}
/** Launch a battle between two AI sides from the real map and play it out; returns the context. */
export function fight(s: GameState, L: Launch, human: 'a' | 'd' | null = null) {
  const c = mkCtx(s, D)
  startBattle(c, L)
  if (human === null && s.battle) s.battle.human = null
  driveBattle(c)
  return c
}

/** The old Ruan Xiaoer start (no longer an S-1 row): a chao-gai game with Jizhou handed to the player and the three Ruan brothers in service. */
export function ruanGame(): GameState {
  const s = game('chao-gai')
  const c = ctxOf(s)
  const p = s.prefectures['jizhou']!
  Object.assign(p, { owner: 'player', governor: null, gold: 2000, food: 2000, men: 500, arms: 400, training: 40, support: 45 })
  for (const h of ['ruan-xiaoer', 'ruan-xiaowu', 'ruan-xiaoqi']) { const x = s.heroes[h]!; x.faction = 'player'; x.status = 'ordinary'; x.loyalty = 60 }
  s.factions['old-liangshan']!.alive = false
  place(c, 'chao-gai', 'jizhou')
  for (const h of ['wu-yong', 'liu-tang']) place(c, h, 'jizhou')
  Object.assign(s.prefectures['yunzhou']!, { owner: 'court', governor: 'gao-lian' })
  s.commandsLeft['jizhou'] = 2
  void c
  return s
}
