// Axial hex maths (W-3). East is (+1, 0).
import type { Hex } from '../types'

export const DIRS: Hex[] = [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }]
export const key = (h: Hex): string => `${h.q},${h.r}`
export const parseKey = (k: string): Hex => { const [q, r] = k.split(',').map(Number); return { q: q as number, r: r as number } }
export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r })
export const neighbors = (h: Hex): Hex[] => DIRS.map((d) => add(h, d))
export const neighbor = (h: Hex, dir: number): Hex => add(h, DIRS[((dir % 6) + 6) % 6] as Hex)
export const hexDistance = (a: Hex, b: Hex): number => (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
export const same = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r
/** odd-r offset (x column, y row) to axial: q = x - (y - (y & 1)) / 2 */
export const fromOffset = (x: number, y: number): Hex => ({ q: x - (y - (y & 1)) / 2, r: y })
export const toOffset = (h: Hex): { x: number; y: number } => ({ x: h.q + (h.r - (h.r & 1)) / 2, y: h.r })
export const dirTo = (a: Hex, b: Hex): number => DIRS.findIndex((d) => a.q + d.q === b.q && a.r + d.r === b.r)
