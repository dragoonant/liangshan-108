// Invariants checked after every step by tools/sim.ts and the unit tests (Arch "Invariants").
import type { GameState } from './types'
import { defaultBundle, indexOf } from './data'
import type { DataBundle } from '../data'
import { hexDistance, key } from './battle/hex'
import { TERR } from './battle/terrain'
import { EMPEROR } from './ctx'

function plain(v: unknown, path: string, out: string[]): void {
  if (v === undefined) { out.push(`${path}: undefined`); return }
  if (typeof v === 'number') { if (!Number.isFinite(v)) out.push(`${path}: not finite`) ; return }
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return
  if (Array.isArray(v)) { v.forEach((x, i) => plain(x, `${path}[${i}]`, out)); return }
  if (typeof v === 'object') { for (const [k, x] of Object.entries(v as object)) plain(x, `${path}.${k}`, out); return }
  out.push(`${path}: bad type`)
}

export function checkInvariants(s: GameState, data: DataBundle = defaultBundle): string[] {
  const out: string[] = []
  const x = indexOf(data)
  plain(s, 'state', out)
  if (out.length) return out.slice(0, 5)
  for (const id of x.order) {
    const p = s.prefectures[id]
    if (!p) { out.push(`${id}: missing`); continue }
    for (const k of ['pop', 'gold', 'food', 'men', 'arms'] as const) if (p[k] < 0 || !Number.isInteger(p[k])) out.push(`${id}.${k} = ${p[k]}`)
    for (const k of ['support', 'training', 'land', 'dyke'] as const) if (p[k] < 0 || p[k] > 100 || !Number.isInteger(p[k])) out.push(`${id}.${k} = ${p[k]}`)
    if (p.men > Math.floor(p.pop / 20) && !s.battle) out.push(`${id}: men ${p.men} above pop/20`)
    if (!p.owner) out.push(`${id}: no owner`)
  }
  const where = new Map<string, number>()
  for (const id of x.order) {
    const p = s.prefectures[id]!
    for (const h of [...p.heroes, ...p.captives]) {
      where.set(h, (where.get(h) ?? 0) + 1)
      if (s.heroes[h]?.loc !== id) out.push(`${h}: listed at ${id} but loc ${s.heroes[h]?.loc}`)
    }
  }
  let accounted = 0
  for (const h of data.heroes) {
    const hs = s.heroes[h.id]
    if (!hs) { out.push(`${h.id}: missing hero`); continue }
    const n = where.get(h.id) ?? 0
    if (hs.status === 'dormant') { if (n !== 0 || hs.loc !== null) out.push(`${h.id}: dormant but placed`); else accounted++ }
    else if (n !== 1) out.push(`${h.id}: in ${n} places`)
    else accounted++
  }
  if (accounted !== 108) out.push(`heroes accounted ${accounted}`)
  for (const h of [...data.extra, ...data.court, ...data.rivals]) {
    const n = where.get(h.id) ?? 0
    const hs = s.heroes[h.id]
    if (!hs) { out.push(`${h.id}: missing`); continue }
    if (n > 1) out.push(`${h.id}: in ${n} places`)
    if (n === 0 && hs.status !== 'dormant') out.push(`${h.id}: nowhere`)
  }
  if (where.get(EMPEROR) !== 1) out.push('emperor not in one place')
  const fe = s.factions['player']!
  if (fe.renown < 0) out.push('renown negative')
  if (fe.edict === null && s.prefectures[x.capital]!.owner !== 'court' && s.phase !== 'result') out.push('capital not court-held before the Edict')
  if (s.setup.difficulty < 1 || s.setup.difficulty > 4) out.push('difficulty')
  if (s.phase === 'battle') {
    const b = s.battle
    if (!b) out.push('battle phase without battle')
    else {
      const seen = new Set<string>()
      for (const u of b.units) {
        if (u.state !== 'active') continue
        const k = key(u.pos)
        if (seen.has(k)) out.push(`two units on ${k}`)
        seen.add(k)
        const t = b.terrain[k]
        if (!t) out.push(`unit off the board at ${k}`)
        else if (TERR[t].inf >= 99 && u.kind !== 'boats' && !u.skills.includes('swimmer')) out.push(`unit ${u.id} on impassable ${t}`)
        if (u.men < 0 || u.men > u.maxMen) out.push(`unit ${u.id} men ${u.men}/${u.maxMen}`)
        if (u.morale < 0 || u.morale > 100 || u.fatigue < 0 || u.fatigue > 100) out.push(`unit ${u.id} morale/fatigue`)
      }
      for (const side of ['a', 'd'] as const) {
        const n = b.units.filter((u) => u.side === side && u.commander).length
        if (n !== 1 && b.units.some((u) => u.side === side)) out.push(`side ${side} has ${n} commanders`)
      }
      if (b.day < 1 || b.day > 20) out.push(`day ${b.day}`)
    }
  } else if (s.battle) out.push('battle present outside the battle phase')
  if (s.pending && s.phase === 'result') out.push('pending after result')
  void hexDistance
  return out
}
