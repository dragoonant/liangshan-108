import { defaultBundle } from '../data'
import type { DataBundle, HeroRecord, LinkKind, PrefectureRecord, TriggerRecord } from '../data'

export { defaultBundle }
export type { DataBundle }

export interface RivalDef { id: string; name: string; stronghold: string; year: number; heroes: string[] }
export interface Idx {
  d: DataBundle
  hero: Record<string, HeroRecord>
  kindOf: Record<string, 'star' | 'court' | 'rival'>
  order: string[]
  orderIdx: Record<string, number>
  pref: Record<string, PrefectureRecord>
  adj: Record<string, { to: string; kind: LinkKind }[]>
  rivals: RivalDef[]
  triggers: Record<string, TriggerRecord>
  capital: string
  dists: Record<string, Record<string, number>>
}

const cache = new WeakMap<DataBundle, Idx>()
export const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function indexOf(d: DataBundle): Idx {
  const hit = cache.get(d)
  if (hit) return hit
  const hero: Record<string, HeroRecord> = {}
  const kindOf: Idx['kindOf'] = {}
  for (const h of d.heroes) { hero[h.id] = h; kindOf[h.id] = 'star' }
  for (const h of d.court) { hero[h.id] = h; kindOf[h.id] = 'court' }
  for (const h of d.rivals) { hero[h.id] = h; kindOf[h.id] = 'rival' }
  const order = d.map.prefectures.map((p) => p.id)
  const orderIdx: Record<string, number> = {}
  const pref: Record<string, PrefectureRecord> = {}
  const adj: Idx['adj'] = {}
  order.forEach((id, i) => { orderIdx[id] = i; adj[id] = [] })
  for (const p of d.map.prefectures) pref[p.id] = p
  for (const l of d.map.links) { adj[l.a]?.push({ to: l.b, kind: l.kind }); adj[l.b]?.push({ to: l.a, kind: l.kind }) }
  const rmap = new Map<string, RivalDef>()
  for (const r of d.rivals) {
    const id = slug(r.faction ?? r.id)
    const e = rmap.get(id) ?? { id, name: r.faction ?? r.id, stronghold: r.stronghold ?? r.start.prefecture, year: r.start.year, heroes: [] }
    e.heroes.push(r.id)
    e.year = Math.min(e.year, r.start.year)
    rmap.set(id, e)
  }
  const triggers: Record<string, TriggerRecord> = {}
  for (const t of d.triggers) triggers[t.hero] = t
  const capital = d.map.prefectures.find((p) => p.special.includes('capital'))?.id ?? 'dongjing'
  const idx: Idx = { d, hero, kindOf, order, orderIdx, pref, adj, rivals: [...rmap.values()].sort((a, b) => (a.id < b.id ? -1 : 1)), triggers, capital, dists: {} }
  cache.set(d, idx)
  return idx
}

/** Link-count distance (BFS), memoised per bundle. */
export function dist(x: Idx, a: string, b: string): number {
  let row = x.dists[a]
  if (!row) {
    row = {}
    row[a] = 0
    const q = [a]
    for (let i = 0; i < q.length; i++) {
      const cur = q[i] as string
      for (const n of x.adj[cur] ?? []) if (row[n.to] === undefined) { row[n.to] = (row[cur] as number) + 1; q.push(n.to) }
    }
    x.dists[a] = row
  }
  return row[b] ?? 999
}
