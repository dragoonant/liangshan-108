import { describe, expect, test } from 'vitest'
import { checkInvariants, view } from '../../src/engine'
import { roll, splitmixSeed, sfc32 } from '../../src/engine/rng'
import { pct } from '../../src/engine/util'
import { hexDistance, neighbors, fromOffset, toOffset } from '../../src/engine/battle/hex'
import { game, playGreedy, D } from './helpers'

describe('Z conventions', () => {
  test('Z-1 all state numbers are integers and pct floors', () => {
    expect(pct(7, 50)).toBe(3)
    expect(pct(1999, 99)).toBe(1979)
    playGreedy(game(), 6, (s) => expect(checkInvariants(s, D)).toEqual([]))
  })
  test('Z-2 roll(n) is an integer in 0..n-1, deterministic per seed, forced rolls clamp and skip the stream', () => {
    const s = game('song-jiang', 2, 5)
    const t = game('song-jiang', 2, 5)
    const a = Array.from({ length: 50 }, () => roll(s, 21))
    const b = Array.from({ length: 50 }, () => roll(t, 21))
    expect(a).toEqual(b)
    expect(a.every((v) => Number.isInteger(v) && v >= 0 && v <= 20)).toBe(true)
    const f = game('song-jiang', 2, 5, [99, -3, 7])
    const before = [...f.rng.s]
    expect([roll(f, 10), roll(f, 10), roll(f, 100)]).toEqual([9, 0, 7])
    expect(f.rng.s).toEqual(before)
    expect(f.rng.draws).toBe(3)
    const st = splitmixSeed(1)
    const x = sfc32(st)
    expect(x >= 0 && x < 1).toBe(true)
  })
  test('Z-3 hex positions are axial (q, r); offset conversion round-trips', () => {
    const h = fromOffset(5, 3)
    expect(toOffset(h)).toEqual({ x: 5, y: 3 })
    expect(neighbors(h)).toHaveLength(6)
    expect(neighbors(h).every((n) => hexDistance(h, n) === 1)).toBe(true)
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -3 })).toBe(3)
  })
  test.todo('Z-4 open information: the UI shows every number and probability (client-level check at M3; query.* returns each of them)')
  test('Z-5 foreign prefectures show 10% bands without a report and exact numbers with one', () => {
    const s = game()
    const v = view(s, 'player', D)
    const own = v.prefectures['yunzhou']!
    expect(own.exact).toBe(true)
    expect(own.gold).toBe(1500)
    const far = v.prefectures['dongjing']!
    expect(far.exact).toBe(false)
    const trueMen = s.prefectures['dongjing']!.men
    expect(Math.abs(far.men - trueMen) / trueMen).toBeLessThanOrEqual(0.1)
    expect(far.support).toBeUndefined()
    expect(Object.values(v.heroes).some((h) => h.loyalty !== undefined && h.faction !== 'player')).toBe(false)
    s.prefectures['dongjing']!.spyT = 0
    expect(view(s, 'player', D).prefectures['dongjing']!.men).toBe(trueMen)
  })
})
