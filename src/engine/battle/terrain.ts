// W-4 terrain generation and W-6 table.
import type { Terr, Kind, Hex } from '../types'
import { makeRoller } from '../rng'
import { fromOffset, key, neighbors, toOffset, DIRS, add } from './hex'

export interface TerrInfo { inf: number; cav: number; boat: number; def: number; height: number; flammable: boolean; hides: boolean }
const X = 99
export const TERR: Record<Terr, TerrInfo> = {
  plain: { inf: 1, cav: 1, boat: 2, def: 100, height: 0, flammable: false, hides: false },
  road: { inf: 1, cav: 1, boat: 2, def: 100, height: 0, flammable: false, hides: false },
  forest: { inf: 2, cav: 3, boat: X, def: 85, height: 0, flammable: true, hides: true },
  hill: { inf: 2, cav: 2, boat: X, def: 85, height: 1, flammable: false, hides: false },
  mountain: { inf: 3, cav: X, boat: X, def: 75, height: 2, flammable: false, hides: false },
  reed: { inf: 2, cav: 2, boat: 2, def: 100, height: 0, flammable: true, hides: true },
  marsh: { inf: 3, cav: 3, boat: 1, def: 100, height: 0, flammable: false, hides: false },
  water: { inf: X, cav: X, boat: 1, def: 100, height: 0, flammable: false, hides: false },
  village: { inf: 1, cav: 1, boat: 2, def: 90, height: 0, flammable: true, hides: false },
  wall: { inf: X, cav: X, boat: X, def: 100, height: 0, flammable: false, hides: false },
  gate: { inf: 1, cav: 1, boat: 2, def: 80, height: 0, flammable: false, hides: false },
  keep: { inf: 1, cav: 1, boat: 2, def: 70, height: 1, flammable: false, hides: false },
}
export const IMPASSABLE = X
export function moveCostFor(kind: Kind, terr: Terr, swimmer: boolean): number {
  const t = TERR[terr]
  if (kind === 'cavalry') return t.cav
  if (kind === 'boats') return t.boat
  if (terr === 'water' && swimmer) return 3
  return t.inf
}

const ORDER: Terr[] = ['plain', 'road', 'forest', 'reed', 'hill', 'mountain', 'marsh', 'water', 'village']
const WEIGHTS: Record<string, number[]> = {
  plains: [62, 8, 12, 4, 8, 0, 2, 0, 4],
  hills: [30, 4, 22, 0, 34, 8, 0, 0, 2],
  mountains: [14, 4, 24, 0, 28, 28, 0, 0, 2],
  marsh: [18, 4, 4, 24, 0, 0, 34, 14, 2],
  'river-delta': [34, 4, 4, 14, 0, 0, 22, 18, 4],
  coast: [44, 6, 6, 0, 10, 0, 8, 22, 4],
}

export const SIZES: Record<string, [number, number]> = { town: [11, 9], city: [13, 11], fortress: [13, 11], stronghold: [15, 11] }

export interface Field { w: number; h: number; terrain: Record<string, Terr>; walled: boolean; keep: Hex | null; wind: number }

/** Row-major, one roll(100) per hex against the cumulative weights, on its own stream. */
export function generateField(seed: number, t: number, prefIndex: number, terrain: string, seat: string, special: string[]): Field {
  const [w, h] = SIZES[seat] ?? [11, 9]
  const rs = (seed ^ Math.imul(t + 1, 0x9e3779b1) ^ Math.imul(prefIndex + 1, 0x85ebca6b)) >>> 0
  const rr = makeRoller(rs)
  const wt = [...(WEIGHTS[terrain] ?? (WEIGHTS['plains'] as number[]))]
  if (special.includes('liangshan-marsh')) { wt[0] = (wt[0] as number) - 10; wt[7] = (wt[7] as number) + 10 }
  const field: Record<string, Terr> = {}
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = rr(100)
      let acc = 0
      let pick: Terr = 'plain'
      for (let i = 0; i < ORDER.length; i++) { acc += wt[i] as number; if (r < acc) { pick = ORDER[i] as Terr; break } }
      if (x <= 1 || x >= w - 2) pick = 'plain'
      field[key(fromOffset(x, y))] = pick
    }
  }
  const wind = rr(6)
  const walled = seat === 'city' || seat === 'fortress' || seat === 'stronghold'
  let keep: Hex | null = null
  if (walled) {
    keep = fromOffset(w - 2, Math.floor(h / 2))
    field[key(keep)] = 'keep'
    DIRS.forEach((d, i) => { field[key(add(keep as Hex, d))] = i === 3 ? 'gate' : 'wall' })
  }
  // land bridge along the middle row when the zones are not connected (W-4)
  const mid = Math.floor(h / 2)
  const start = fromOffset(1, mid)
  const reach = new Set<string>([key(start)])
  const q: Hex[] = [start]
  for (let i = 0; i < q.length; i++) {
    for (const n of neighbors(q[i] as Hex)) {
      const k = key(n), tr = field[k]
      if (!tr || reach.has(k) || TERR[tr].inf >= X) continue
      reach.add(k); q.push(n)
    }
  }
  const target = keep ?? fromOffset(w - 2, mid)
  if (!reach.has(key(target))) {
    for (let x = 2; x < w - 2; x++) {
      const k = key(fromOffset(x, mid))
      const tr = field[k]
      if (tr === 'wall' || tr === 'gate' || tr === 'keep') continue
      field[k] = 'plain'
    }
  }
  return { w, h, terrain: field, walled, keep, wind }
}
export const inBoard = (b: { w: number; h: number }, hx: Hex): boolean => { const o = toOffset(hx); return o.x >= 0 && o.x < b.w && o.y >= 0 && o.y < b.h }
