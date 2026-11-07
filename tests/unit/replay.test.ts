import { describe, expect, test } from 'vitest'
import { createGame, step, replay, checkInvariants } from '../../src/engine'
import type { Action } from '../../src/engine'
import { greedyAction } from '../../src/ai/greedy'
import { D } from './helpers'

describe('Arch replay', () => {
  test('Arch replay(setup, actions) equals the live state for five full-length stretches', () => {
    for (const [hero, seed, diff] of [['song-jiang', 21, 1], ['lin-chong', 22, 2], ['lu-zhishen', 23, 3], ['hu-sanniang', 24, 4], ['ruan-xiaoer', 25, 2]] as const) {
      const setup = { startHero: hero, difficulty: diff, seed }
      let s = createGame(setup, D)
      const acts: Action[] = []
      for (let i = 0; i < 400 && s.phase !== 'result'; i++) { const a = greedyAction(s); const r = step(s, a); if (!r.ok) throw new Error(r.message); acts.push(a); s = r.state }
      const again = replay(setup, acts, D)
      expect(JSON.stringify(again)).toBe(JSON.stringify(s))
      expect(checkInvariants(again, D)).toEqual([])
    }
  })
  test('Arch the state is plain JSON: it survives a JSON round trip unchanged', () => {
    let s = createGame({ startHero: 'wu-song', difficulty: 2, seed: 4 }, D)
    for (let i = 0; i < 80 && s.phase !== 'result'; i++) { const r = step(s, greedyAction(s)); if (r.ok) s = r.state }
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
    expect(JSON.stringify(JSON.parse(JSON.stringify(s)))).toBe(JSON.stringify(s))
  })
})
