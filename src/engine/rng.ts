// sfc32 stream in state (docs/spec/00-architecture.md "RNG"). Draw order is part of the contract.
import type { GameState } from './types'

export type RngS = [number, number, number, number]

export function splitmixSeed(seed: number): RngS {
  let s = seed >>> 0
  const sm = (): number => {
    s = (s + 0x9e3779b9) >>> 0
    let z = (s ^ (s >>> 16)) >>> 0
    z = Math.imul(z, 0x21f0aaad) >>> 0
    z = (z ^ (z >>> 15)) >>> 0
    z = Math.imul(z, 0x735a2d97) >>> 0
    return (z ^ (z >>> 15)) >>> 0
  }
  const st: RngS = [sm(), sm(), sm(), sm()]
  for (let i = 0; i < 15; i++) sfc32(st)
  return st
}

/** Advances `st` in place; returns a float in [0, 1). */
export function sfc32(st: RngS): number {
  const a = st[0], b = st[1], c = st[2], d = st[3]
  const t = (((a + b) >>> 0) + d) >>> 0
  st[3] = (d + 1) >>> 0
  st[0] = (b ^ (b >>> 9)) >>> 0
  st[1] = (c + (c << 3)) >>> 0
  st[2] = (((c << 21) | (c >>> 11)) + t) >>> 0
  return t / 4294967296
}

/** roll(n): integer 0..n-1 from the main stream; a forced value (tests) wins and does not advance `s`. */
export function roll(s: GameState, n: number): number {
  s.rng.draws++
  if (s.rng.forced.length > 0) {
    const v = s.rng.forced.shift() as number
    return Math.max(0, Math.min(n - 1, v))
  }
  return Math.floor(sfc32(s.rng.s) * n)
}

/** A separate stream for battlefield generation (W-4); never touches the main stream. */
export function makeRoller(seed: number): (n: number) => number {
  const st = splitmixSeed(seed)
  return (n) => Math.floor(sfc32(st) * n)
}
