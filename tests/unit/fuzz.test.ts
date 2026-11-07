import { describe, expect, test } from 'vitest'
import { createGame, step, legalActions, checkInvariants } from '../../src/engine'
import type { Action, GameState } from '../../src/engine'
import { D } from './helpers'

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const JUNK: unknown[] = [null, undefined, 5, 'x', [], {}, { t: 'zzz' }, { t: 'levy' }, { t: 'levy', pref: 3, actor: 'x' }, { t: 'move', pref: 'yunzhou', to: 'jizhou', heroes: 'song-jiang', men: NaN },
  { t: 'trade', pref: 'yunzhou', actor: 'song-jiang', dir: 'buyFood', amount: Infinity }, { t: 'bMove', unit: 'a0', to: { q: 'a', r: 1 } }, { t: 'attack', pref: 'yunzhou', target: 'nowhere', heroes: ['nobody'], men: -4 }]

function mutate(a: Action, r: () => number): unknown {
  const o: Record<string, unknown> = { ...a }
  const keys = Object.keys(o).filter((k) => k !== 't')
  if (!keys.length) return o
  const k = keys[Math.floor(r() * keys.length)] as string
  const v = o[k]
  const pick = r()
  if (typeof v === 'number') o[k] = pick < 0.3 ? -v - 1 : pick < 0.6 ? v * 1000 + 7 : pick < 0.8 ? 0 : 1.5
  else if (typeof v === 'string') o[k] = pick < 0.5 ? 'nobody' : ['yunzhou', 'jizhou', 'song-jiang', 'wu-yong', 'dongjing'][Math.floor(r() * 5)]
  else if (Array.isArray(v)) o[k] = pick < 0.5 ? [] : [...v, 'wu-yong', 'wu-yong']
  else if (v && typeof v === 'object') o[k] = { q: Math.floor(r() * 30) - 5, r: Math.floor(r() * 30) - 5 }
  return o
}

describe('Arch fuzz: step never throws, never mutates its input, never breaks an invariant', () => {
  test('Arch fuzz over random legal, mutated and junk actions on 6 games', () => {
    let accepted = 0, rejected = 0
    for (const [hero, seed] of [['song-jiang', 3], ['wu-song', 4], ['lin-chong', 5], ['chao-gai', 12], ['hu-sanniang', 13], ['lu-zhishen', 14]] as const) {
      const r = rng(seed * 99)
      let s: GameState = createGame({ startHero: hero, difficulty: 2, seed }, D)
      for (let i = 0; i < 400 && s.phase !== 'result'; i++) {
        const legal = legalActions(s, D)
        expect(legal.length).toBeGreaterThan(0)
        const roll = r()
        const base = legal[Math.floor(r() * legal.length)] as Action
        const a: unknown = roll < 0.5 ? base : roll < 0.8 ? mutate(base, r) : JUNK[Math.floor(r() * JUNK.length)]
        const before = JSON.stringify(s)
        let res: ReturnType<typeof step> | undefined
        expect(() => { res = step(s, a as Action, D) }).not.toThrow()
        expect(JSON.stringify(s)).toBe(before)
        if (res!.ok) { accepted++; s = res!.state; expect(checkInvariants(s, D), `after ${JSON.stringify(a)}`).toEqual([]) }
        else { rejected++; expect(res!.message).not.toMatch(/internal error/); expect(res!.message.length).toBeGreaterThan(3) }
        if (s.phase === 'battle' && r() < 0.15) { const e = step(s, { t: 'bAuto' }, D); if (e.ok) s = e.state }
      }
    }
    expect(accepted).toBeGreaterThan(200)
    expect(rejected).toBeGreaterThan(100)
  })
  test('Arch legalActions is never empty before the result and every listed action is accepted', () => {
    const r = rng(77)
    let s = createGame({ startHero: 'hu-sanniang', difficulty: 3, seed: 8 }, D)
    for (let i = 0; i < 150 && s.phase !== 'result'; i++) {
      const legal = legalActions(s, D)
      expect(legal.length).toBeGreaterThan(0)
      const a = legal[Math.floor(r() * legal.length)] as Action
      const res = step(s, a, D)
      expect(res.ok, JSON.stringify(a) + (res.ok ? '' : res.message)).toBe(true)
      if (res.ok) s = res.state
    }
  })
})
