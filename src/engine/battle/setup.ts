// W-1..W-5: building a battle from an attack.
import type { BattleState, BUnit, Faction, Hex, Side } from '../types'
import type { Ctx } from '../ctx'
import { abil, combatKind, emit, EMPEROR, hs, prefName, ps, rank, rec, virt } from '../ctx'
import { armedRatio } from '../strategic/economy'
import { generateField, TERR } from './terrain'
import { fromOffset, key, neighbors } from './hex'
import { DAYS } from './core'
import { checkEnd } from './actions'

export interface Launch { attacker: Faction; origin: string; target: string; heroes: string[]; men: number; imperial?: boolean }

function mkUnit(c: Ctx, id: string, side: Side, hero: string, men: number, guard: number, armed: number, training: number, commander: boolean, pos: Hex, morale: number): BUnit {
  const cap = hero.startsWith('cap-')
  const a = cap ? { might: 40, command: 40, cunning: 30, vigour: 40 } : abil(c, hero)
  const skills = cap ? [] : (rec(c, hero).skills as string[])
  return {
    id, hero, side, kind: cap ? 'infantry' : combatKind(c, hero), skills, ...a, daring: cap ? 5 : virt(c, hero).daring,
    men, maxMen: men, guard, armed, training, morale, fatigue: 0, pos, hidden: false, state: 'active', commander,
    moved: false, acted: false, waited: false, dueled: false, hurt: false, startedHidable: false, counsel: false, fatigueLog: [], specialUsed: false, capturedBy: null,
  }
}

export function startBattle(c: Ctx, L: Launch): void {
  const s = c.s
  const org = ps(c, L.origin), tgt = ps(c, L.target)
  const defFaction = tgt.owner
  const human: Side | null = L.attacker === 'player' ? 'a' : defFaction === 'player' ? 'd' : null
  const rec0 = c.x.pref[L.target]!
  const f = generateField(s.setup.seed, s.t, c.x.orderIdx[L.target] as number, rec0.terrain, rec0.seat, rec0.special)
  const mid = Math.floor(f.h / 2)
  const byCommand = (ids: string[]): string[] => [...ids].sort((p, q) => abil(c, q).command - abil(c, p).command || rank(c, p) - rank(c, q) || (p < q ? -1 : 1))

  // attackers (W-5)
  const men = Math.max(0, Math.min(L.men, org.men))
  const armedA = armedRatio(org.men, org.arms)
  const cmdr = L.heroes[0] as string
  const orderA = [cmdr, ...byCommand(L.heroes.filter((h) => h !== cmdr)).slice(0, 7)]
  const units: BUnit[] = []
  let rem = men
  const slotsA: Hex[] = []
  for (const x of [1, 0]) for (const y of [...Array(f.h).keys()].sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid) || p - q)) slotsA.push(fromOffset(x, y))
  const dealOrder = [cmdr, ...byCommand(orderA.slice(1))]
  let taken = 0
  dealOrder.forEach((h, i) => {
    const take = Math.min(abil(c, h).command * 15, rem)
    rem -= take; taken += take
    units.push(mkUnit(c, `a${i}`, 'a', h, take + Math.max(0, 50 - take), Math.max(0, 50 - take), armedA, org.training, h === cmdr, slotsA[i] as Hex, 60 + Math.floor(org.training / 10)))
  })
  org.men -= taken
  org.arms = Math.max(0, org.arms - Math.floor((taken * armedA) / 100))

  // defenders (W-2)
  const armedD = armedRatio(tgt.men, tgt.arms)
  const present = tgt.heroes.filter((h) => h !== EMPEROR)
  const defHeroes = byCommand(present).slice(0, 8)
  const dnames: string[] = []
  let remD = tgt.men
  const defMorale = 60 + Math.floor(tgt.training / 10) + (tgt.support >= 60 ? 10 : 0)
  const orderD: string[] = defHeroes.length ? defHeroes : []
  if (!orderD.length) { const n = Math.min(4, Math.ceil(tgt.men / 1500)); for (let i = 0; i < n; i++) dnames.push(`cap-${L.target}-${i}`) }
  const names = orderD.length ? orderD : dnames
  const gov = tgt.governor && names.includes(tgt.governor) ? tgt.governor : names[0]
  const slotsD: Hex[] = []
  const rows = [...Array(f.h).keys()].sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid) || p - q)
  if (f.walled && f.keep) slotsD.push(f.keep)
  for (const x of [f.w - 2, f.w - 1]) for (const y of rows) { const h = fromOffset(x, y); if (f.terrain[key(h)] === 'plain') slotsD.push(h) }
  const placeOrder = [gov as string, ...names.filter((n) => n !== gov)]
  let takenD = 0
  names.forEach((h, i) => {
    const cap = h.startsWith('cap-')
    const take = Math.min(cap ? 1500 : abil(c, h).command * 15, remD)
    remD -= take; takenD += take
    const idx = placeOrder.indexOf(h)
    units.push(mkUnit(c, `d${i}`, 'd', h, take + Math.max(0, 50 - take), Math.max(0, 50 - take), armedD, tgt.training, h === gov, slotsD[Math.min(idx, slotsD.length - 1)] as Hex, defMorale))
  })
  tgt.men -= takenD
  tgt.arms = Math.max(0, tgt.arms - Math.floor((takenD * armedD) / 100))
  // keep unit positions unique
  const used = new Set<string>()
  for (const u of units) {
    let k = key(u.pos)
    if (used.has(k)) {
      const pool = u.side === 'a' ? slotsA : slotsD
      const free = pool.find((h) => !used.has(key(h)))
      if (free) { u.pos = free; k = key(free) }
    }
    used.add(k)
    const t = f.terrain[k]
    u.startedHidable = t === 'forest' || t === 'reed'
  }
  void TERR; void neighbors
  const b: BattleState = {
    w: f.w, h: f.h, terrain: f.terrain, burning: {}, weather: null, wind: f.wind, day: 1, toAct: 'a', units,
    origin: L.origin, target: L.target, human, auto: { a: false, d: false }, attacker: L.attacker, defender: defFaction,
    imperial: !!L.imperial, walled: f.walled, hungry: { a: false, d: false }, hunters: [], result: null, burned: 0, force: [...L.heroes],
  }
  s.battle = b
  s.phase = 'battle'
  tgt.fought = true
  if (L.attacker === 'player' && !s.fired.includes(`attacked:${L.target}`)) s.fired.push(`attacked:${L.target}`)
  emit(c, 'battleStart', 'W-1', `Battle at ${prefName(c, L.target)}: ${units.filter((u) => u.side === 'a').length} attacking units against ${units.filter((u) => u.side === 'd').length}`, L.target)
  checkEnd(c)
  void DAYS; void hs
}
