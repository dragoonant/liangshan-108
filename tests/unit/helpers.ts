import { createGame, step, legalActions, defaultBundle } from '../../src/engine'
import type { Action, GameState, Difficulty } from '../../src/engine'
import type { DataBundle } from '../../src/data'
import { mkCtx } from '../../src/engine/ctx'

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
    court: [], rivals: [], triggers: [],
  }
}
