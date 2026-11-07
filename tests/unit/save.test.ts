import { describe, expect, test } from 'vitest'
import { createGame, step, buildSave, parseSave, roundTrip, replay, SAVE_KEY } from '../../src/engine'
import type { Action } from '../../src/engine'
import { greedyAction } from '../../src/ai/greedy'
import { D } from './helpers'

describe('Arch save envelope (KB rule 22)', () => {
  test('Arch the envelope round-trips: snapshot, actions and a readable summary; the action list replays to the snapshot', () => {
    const setup = { startHero: 'lin-chong', difficulty: 2 as const, seed: 5 }
    let s = createGame(setup, D)
    const acts: Action[] = []
    for (let i = 0; i < 60 && s.phase !== 'result'; i++) { const a = greedyAction(s); const r = step(s, a); if (!r.ok) break; acts.push(a); s = r.state }
    const env = buildSave(s, acts, '2026-11-07T00:00:00.000Z', D)
    expect(SAVE_KEY).toBe('liangshan108.save.v1')
    expect(env.format).toBe('liangshan-108-save')
    expect(env.summary).toMatchObject({ chieftain: 'Lin Chong', phase: s.phase })
    expect(env.summary.dateLabel).toMatch(/\d{4}$/)
    const back = roundTrip(env)
    expect(back.ok).toBe(true)
    if (back.ok) {
      expect(back.save.snapshot).toEqual(s)
      expect(JSON.stringify(replay(back.save.setup, back.save.actions, D))).toBe(JSON.stringify(back.save.snapshot))
    }
  })
  test('Arch a save the engine cannot read says why', () => {
    const bad = (t: string) => { const r = parseSave(t); return r.ok ? '' : r.reason }
    expect(bad('{oops')).toMatch(/not valid JSON/)
    expect(bad('{"format":"other"}')).toMatch(/not a Liangshan save/)
    expect(bad(JSON.stringify({ format: 'liangshan-108-save', version: 9 }))).toMatch(/version 9/)
    expect(bad(JSON.stringify({ format: 'liangshan-108-save', version: 1, snapshot: { schema: 2 } }))).toMatch(/incompatible/)
  })
})
