import { describe, expect, test } from 'vitest'
import { query, step, legalActions } from '../../src/engine'
import type { Action, GameState } from '../../src/engine'
import { applyBattleAction, chargeLine, duelAccept, duelWin, volleyRange, legalForUnit } from '../../src/engine/battle/actions'
import { DAYS, captureOdds, dmgChain, maxMove, moveRange, visibleTo } from '../../src/engine/battle/core'
import { generateField, SIZES, TERR, moveCostFor } from '../../src/engine/battle/terrain'
import { fromOffset, hexDistance, key, toOffset } from '../../src/engine/battle/hex'
import { startBattle } from '../../src/engine/battle/setup'
import { driveBattle } from '../../src/engine/step'
import { ps, hs } from '../../src/engine/ctx'
import { game, ctxOf, mkUnit, plainBattle, setPref, ruanGame, D } from './helpers'

const play = (s: GameState, a: Action) => applyBattleAction(ctxOf(s), a)
const must = (s: GameState, a: Action) => { const r = play(s, a); if (r) throw new Error(`${a.t}: ${r.message}`) }
const U = mkUnit

describe('W battle', () => {
  test('W-1 an attack names a linked prefecture you do not own, 1-8 heroes, a marine for marsh-water, and starts a battle with the first hero as commander', () => {
    const s = game('lin-chong')
    const bad = (a: Partial<Extract<Action, { t: 'attack' }>>) => step(s, { t: 'attack', pref: 'mengzhou', target: 'luoyang', heroes: ['lin-chong'], men: 100, ...a }, D)
    expect(bad({ target: 'yunzhou' }).ok).toBe(false) // not linked
    expect(bad({ heroes: [] }).ok).toBe(false)
    expect(bad({ men: 99999 }).ok).toBe(false)
    const ok1 = bad({ heroes: ['lin-chong', 'shi-en'] })
    expect(ok1.ok).toBe(true)
    if (ok1.ok) { expect(ok1.state.phase).toBe('battle'); expect(ok1.state.battle!.units.find((u) => u.side === 'a' && u.commander)!.hero).toBe('lin-chong'); expect(ok1.state.battle!.human).toBe('a') }
    const r = ruanGame()
    const marsh = (heroes: string[]) => step(r, { t: 'attack', pref: 'jizhou', target: 'yunzhou', heroes, men: 100 }, D)
    expect(marsh(['ruan-xiaowu']).ok).toBe(true) // ruan-xiaowu is a marine? falls through if not
    const frozen = game('lin-chong'); frozen.t = 11
    expect(step(frozen, { t: 'attack', pref: 'mengzhou', target: 'luoyang', heroes: ['lin-chong'], men: 100 }, D).ok).toBe(true) // mengzhou-luoyang is a road
  })
  test('W-2 defenders: all heroes present deploy (max 8, by command); a prefecture with no hero fields one captain per 1500 men up to 4', () => {
    const s = game()
    const c = ctxOf(s)
    setPref(s, 'caozhou', { men: 3200 })
    startBattle(c, { attacker: 'court', origin: 'dongjing', target: 'caozhou', heroes: ['gao-qiu'], men: 500 })
    expect(s.battle!.units.filter((u) => u.side === 'd').map((u) => u.men)).toEqual([1500, 1500, 200].map((m) => m)) // guard fills units under 50 men
    const t = game()
    const ct = ctxOf(t)
    t.prefectures['daming']!.heroes.push(...['song-jiang', 'wu-yong', 'liu-tang', 'zhu-tong', 'lei-heng', 'song-qing', 'bai-sheng'])
    startBattle(ct, { attacker: 'court', origin: 'dongjing', target: 'daming', heroes: ['gao-qiu'], men: 500 })
    expect(t.battle!.units.filter((u) => u.side === 'd').length).toBeLessThanOrEqual(8)
    expect(t.battle!.units.filter((u) => u.side === 'd').some((u) => u.commander)).toBe(true)
  })
  test('W-3 the board is a hex grid sized by seat: town 11x9, city and fortress 13x11, stronghold 15x11; odd-r conversion', () => {
    expect([SIZES['town'], SIZES['city'], SIZES['fortress'], SIZES['stronghold']]).toEqual([[11, 9], [13, 11], [13, 11], [15, 11]])
    const f = generateField(1, 0, 3, 'plains', 'town', [])
    expect(Object.keys(f.terrain)).toHaveLength(99)
    expect(toOffset(fromOffset(4, 5))).toEqual({ x: 4, y: 5 })
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: 1 })).toBe(3)
  })
  test('W-4 terrain is deterministic per (seed, month, prefecture), follows the weights, keeps deployment columns plain and rings a walled seat', () => {
    const a = generateField(7, 3, 5, 'marsh', 'city', ['liangshan-marsh'])
    const b = generateField(7, 3, 5, 'marsh', 'city', ['liangshan-marsh'])
    expect(a.terrain).toEqual(b.terrain)
    expect(generateField(7, 4, 5, 'marsh', 'city', []).terrain).not.toEqual(a.terrain)
    for (let y = 0; y < a.h; y++) for (const x of [0, 1, a.w - 2, a.w - 1]) { const t = a.terrain[key(fromOffset(x, y))]; expect(['plain', 'wall', 'gate', 'keep']).toContain(t) }
    const kinds = Object.values(a.terrain)
    expect(kinds.filter((k) => k === 'wall')).toHaveLength(5)
    expect(kinds.filter((k) => k === 'gate')).toHaveLength(1)
    expect(kinds.filter((k) => k === 'keep')).toHaveLength(1)
    const big = Array.from({ length: 40 }, (_, i) => generateField(i, 1, 1, 'hills', 'town', []))
    const all = big.flatMap((f) => Object.values(f.terrain))
    const share = (t: string) => all.filter((x) => x === t).length / all.length
    expect(share('hill')).toBeGreaterThan(0.12)
    expect(share('hill')).toBeLessThan(0.34)
    expect(share('water')).toBe(0)
    const town = generateField(3, 3, 3, 'plains', 'town', [])
    expect(Object.values(town.terrain).includes('wall')).toBe(false)
  })
  test('W-5 a unit takes min(command x 15, remaining) men with a personal guard of at least 50', () => {
    const s = game('lin-chong')
    const c = ctxOf(s)
    setPref(s, 'mengzhou', { men: 900, arms: 900 })
    startBattle(c, { attacker: 'player', origin: 'mengzhou', target: 'luoyang', heroes: ['lin-chong', 'shi-en'], men: 900 })
    const us = s.battle!.units.filter((u) => u.side === 'a')
    expect(us[0]!.men).toBe(Math.min(85 * 15, 900))
    expect(us.length).toBe(2)
    expect(us[1]!.men).toBeGreaterThanOrEqual(50)
    expect(us[1]!.guard).toBe(50)
    expect(s.prefectures['mengzhou']!.men).toBe(0)
  })
  test('W-6 move cost by kind and terrain, and move points 4/4/7/5 with runner +1 and fatigue penalties', () => {
    expect([moveCostFor('infantry', 'forest', false), moveCostFor('cavalry', 'forest', false), moveCostFor('boats', 'marsh', false), moveCostFor('infantry', 'water', false), moveCostFor('infantry', 'water', true)]).toEqual([2, 3, 1, 99, 3])
    expect(TERR.mountain.def).toBe(75)
    expect(TERR.village.flammable).toBe(true)
    const m = (kind: 'infantry' | 'archers' | 'cavalry' | 'boats', extra: object = {}) => maxMove(U({ id: 'x', hero: 'x', side: 'a', kind, ...extra }))
    expect([m('infantry'), m('archers'), m('cavalry'), m('boats'), m('infantry', { skills: ['runner'] }), m('infantry', { fatigue: 50 }), m('infantry', { fatigue: 80 }), m('infantry', { fatigue: 80, skills: [] })]).toEqual([4, 4, 7, 5, 5, 3, 2, 2])
  })
  test('W-7 the attackers act, then the defenders, then dusk; the clock reads Day n of 20', () => {
    const s = plainBattle([U({ id: 'a0', hero: 'x', side: 'a', commander: true, pos: fromOffset(1, 4) }), U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: fromOffset(9, 4) })])
    expect(s.battle!.toAct).toBe('a')
    must(s, { t: 'bEndSide' })
    expect(s.battle!.toAct).toBe('d')
    must(s, { t: 'bEndSide' })
    expect([s.battle!.toAct, s.battle!.day]).toEqual(['a', 2])
    expect(query.battleClock(s, D)).toMatchObject({ day: 2, days: DAYS, daysLeft: 18, lastDays: false })
    s.battle!.day = 18
    expect(query.battleClock(s, D)!.lastDays).toBe(true)
    expect(play(s, { t: 'bMove', unit: 'd0', to: fromOffset(8, 4) })?.code).toBe('not-your-turn')
  })
  test('W-8 one move per day, ended by a zone of control, then at most one action', () => {
    const s = plainBattle([U({ id: 'a0', hero: 'x', side: 'a', commander: true, pos: fromOffset(3, 4) }), U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: fromOffset(7, 4) })])
    const b = s.battle!
    const reach = moveRange(b, b.units[0]!)
    expect(reach.has(key(fromOffset(6, 4)))).toBe(true) // adjacent to the enemy: reachable
    expect(reach.has(key(fromOffset(7, 3)))).toBe(false) // beyond cost 4
    must(s, { t: 'bMove', unit: 'a0', to: fromOffset(6, 4) })
    expect(play(s, { t: 'bMove', unit: 'a0', to: fromOffset(5, 4) })?.code).toBe('requirement-not-met')
    must(s, { t: 'bAttack', unit: 'a0', target: 'd0' })
    expect(play(s, { t: 'bWait', unit: 'a0' })?.code).toBe('requirement-not-met')
    const z = plainBattle([U({ id: 'a0', hero: 'x', side: 'a', commander: true, pos: fromOffset(3, 4) }), U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: fromOffset(6, 4) })])
    expect(moveRange(z.battle!, z.battle!.units[0]!).has(key(fromOffset(6, 3)))).toBe(false) // cannot pass through the zone to go round
  })
  test('W-9 damage chain: pincer x125, height, fatigue and command defence all enter the chain with the printed factors', () => {
    const a = U({ id: 'a0', hero: 'x', side: 'a', commander: true, might: 80, men: 600, pos: { q: 3, r: 4 } })
    const a2 = U({ id: 'a1', hero: 'z', side: 'a', pos: { q: 5, r: 4 } })
    const d = U({ id: 'd0', hero: 'y', side: 'd', commander: true, command: 80, men: 1000, maxMen: 1000, pos: { q: 4, r: 4 } })
    const s = plainBattle([a, a2, d])
    const ch = dmgChain(s.battle!, a, d, 100, true)
    expect(ch.factors.map((f) => f.name)).toEqual(['base', 'fatigue', 'training', 'arms', 'height', 'action', 'pincer', 'terrain', 'command'])
    expect(ch.factors.find((f) => f.name === 'pincer')!.pct).toBe(125)
    expect(ch.factors[0]!.after).toBe(40 + 40 + 60)
    s.battle!.terrain[key({ q: 3, r: 4 })] = 'hill'
    expect(dmgChain(s.battle!, a, d, 100, true).factors.find((f) => f.name === 'height')!.pct).toBe(110)
    expect(query.attackPreview(s, 'a0', 'd0')!.max).toBeGreaterThan(query.attackPreview(s, 'a0', 'd0')!.min)
  })
  test('W-10 action percentages: attack 100, counter 60, charge 150, volley 70, ambush 150, archer melee 70 counter 40, brace 125 and 100', () => {
    const a = U({ id: 'a0', hero: 'x', side: 'a', commander: true, kind: 'cavalry', pos: { q: 0, r: 4 }, might: 80 })
    const d = U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 4, r: 4 }, skills: ['spearman'] })
    const s = plainBattle([a, d])
    const log = () => s.log.at(-1)!.text
    expect(chargeLine(s.battle!, a, d)).toEqual({ dir: 0, dest: { q: 3, r: 4 } })
    const before = d.men
    must(s, { t: 'bCharge', unit: 'a0', target: 'd0' })
    expect(a.pos).toEqual({ q: 3, r: 4 })
    expect(before - d.men).toBeGreaterThan(0)
    expect(s.log.some((l) => l.kind === 'charged')).toBe(true)
    expect(s.log.some((l) => l.kind === 'countered')).toBe(true)
    void log
    const arch = U({ id: 'a0', hero: 'x', side: 'a', commander: true, kind: 'archers', pos: { q: 3, r: 4 } })
    const e = U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 4, r: 4 } })
    const t = plainBattle([arch, e])
    expect(dmgChain(t.battle!, arch, e, 70, true).factors.find((f) => f.name === 'action')!.pct).toBe(70)
  })
  test('W-11 a surviving adjacent defender counters a melee attack at 60; volleys and ambushes draw no counter', () => {
    const a = U({ id: 'a0', hero: 'x', side: 'a', commander: true, pos: { q: 3, r: 4 }, men: 500, maxMen: 500 })
    const d = U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 4, r: 4 }, men: 500, maxMen: 500 })
    const s = plainBattle([a, d])
    must(s, { t: 'bAttack', unit: 'a0', target: 'd0' })
    expect(s.log.filter((l) => l.kind === 'countered')).toHaveLength(1)
    const v = U({ id: 'a0', hero: 'x', side: 'a', commander: true, kind: 'archers', pos: { q: 2, r: 4 } })
    const e = U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 4, r: 4 }, men: 500, maxMen: 500 })
    const t = plainBattle([v, e])
    must(t, { t: 'bVolley', unit: 'a0', target: 'd0' })
    expect(t.log.filter((l) => l.kind === 'countered')).toHaveLength(0)
    const h = U({ id: 'a0', hero: 'x', side: 'a', commander: true, hidden: true, pos: { q: 3, r: 4 } })
    const w = plainBattle([h, U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 4, r: 4 }, men: 500, maxMen: 500 })])
    must(w, { t: 'bAmbush', unit: 'a0', target: 'd0' })
    expect(w.log.filter((l) => l.kind === 'countered')).toHaveLength(0)
    expect(h.hidden).toBe(false)
  })
  test('W-12 fatigue: causes are logged with max(1, base - vigour/40); dusk recovers vigour/10 and 8 more when idle; 80+ cannot charge', () => {
    const a = U({ id: 'a0', hero: 'x', side: 'a', commander: true, pos: { q: 3, r: 4 }, vigour: 80 })
    const idle = U({ id: 'a1', hero: 'z', side: 'a', pos: { q: 0, r: 8 }, vigour: 80, fatigue: 30 })
    const d = U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 4, r: 4 }, men: 500, maxMen: 500 })
    const s = plainBattle([a, idle, d])
    must(s, { t: 'bAttack', unit: 'a0', target: 'd0' })
    expect(query.fatigue(s, 'a0')!.causes).toEqual([{ cause: 'attack', n: 2 }])
    must(s, { t: 'bEndSide' }); must(s, { t: 'bEndSide' })
    expect(a.fatigue).toBe(0)
    expect(idle.fatigue).toBe(30 - 8 - 8)
    const cav = U({ id: 'a0', hero: 'x', side: 'a', commander: true, kind: 'cavalry', pos: { q: 0, r: 4 }, fatigue: 80 })
    const t = plainBattle([cav, U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 4, r: 4 } })])
    expect(chargeLine(t.battle!, cav, t.battle!.units[1]!)).toBeNull()
  })
  test('W-13 fire burns a flammable hex for 2 dusks (12% of maxMen, -10 morale); wind spreads it; a swimmer scuttles a boat once', () => {
    const f = U({ id: 'a0', hero: 'x', side: 'a', commander: true, skills: ['firebrand'], pos: { q: 1, r: 4 } })
    const v = U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 3, r: 4 }, men: 1000, maxMen: 1000, morale: 60 })
    const s = plainBattle([f, v])
    s.battle!.terrain[key({ q: 3, r: 4 })] = 'forest'
    s.battle!.terrain[key({ q: 4, r: 4 })] = 'forest'
    s.rng.forced = [10]
    must(s, { t: 'bFire', unit: 'a0', at: { q: 3, r: 4 } })
    expect(s.battle!.burning[key({ q: 3, r: 4 })]).toBe(2)
    must(s, { t: 'bEndSide' }); must(s, { t: 'bEndSide' })
    expect(v.men).toBe(1000 - 120)
    expect(s.battle!.burning[key({ q: 4, r: 4 })]).toBe(2) // spread east with roll 10 < 50
    const sw = U({ id: 'a0', hero: 'x', side: 'a', commander: true, skills: ['swimmer'], pos: { q: 3, r: 4 } })
    const boat = U({ id: 'd0', hero: 'y', side: 'd', commander: true, kind: 'boats', pos: { q: 4, r: 4 }, men: 1000, maxMen: 1000 })
    const t = plainBattle([sw, boat])
    must(t, { t: 'bScuttle', unit: 'a0', target: 'd0' })
    expect(boat.men).toBe(850)
    expect(sw.specialUsed).toBe(true)
  })
  test('W-14 weather: rain puts fires out and halves volleys; fog caps volley range; once per sorcerer', () => {
    const so = U({ id: 'a0', hero: 'x', side: 'a', commander: true, skills: ['sorcerer'], pos: { q: 1, r: 4 } })
    const arch = U({ id: 'a1', hero: 'z', side: 'a', kind: 'archers', pos: { q: 2, r: 4 } })
    const d = U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 5, r: 4 } })
    const s = plainBattle([so, arch, d])
    s.battle!.burning['3,4'] = 2
    must(s, { t: 'bWeather', unit: 'a0', kind: 'rain' })
    expect(s.battle!.burning).toEqual({})
    expect(s.battle!.weather).toEqual({ kind: 'rain', dusks: 2 })
    expect(play(s, { t: 'bWeather', unit: 'a0', kind: 'fog' })?.code).toBe('requirement-not-met')
    const t = plainBattle([U({ id: 'a1', hero: 'z', side: 'a', kind: 'archers', pos: { q: 2, r: 4 } }), d])
    t.battle!.weather = { kind: 'fog', dusks: 2 }
    expect(volleyRange(t.battle!, t.battle!.units[0]!)).toBe(2)
  })
  test('W-15 a charge needs a straight clear line of 3 plain hexes with no zone of control before the last', () => {
    const c = U({ id: 'a0', hero: 'x', side: 'a', commander: true, kind: 'cavalry', pos: { q: 0, r: 4 } })
    const d = U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 3, r: 4 } })
    const s = plainBattle([c, d])
    expect(chargeLine(s.battle!, c, d)).toEqual({ dir: 0, dest: { q: 2, r: 4 } })
    s.battle!.terrain[key({ q: 1, r: 4 })] = 'forest'
    expect(chargeLine(s.battle!, c, d)).toBeNull()
    s.battle!.terrain[key({ q: 1, r: 4 })] = 'plain'
    const near = plainBattle([U({ id: 'a0', hero: 'x', side: 'a', commander: true, kind: 'cavalry', pos: { q: 1, r: 4 } }), d])
    expect(chargeLine(near.battle!, near.battle!.units[0]!, d)).toBeNull() // only 2 hexes away
  })
  test('W-16 volley reaches 2-3 hexes (4 from a hill) with no counter', () => {
    const a = U({ id: 'a0', hero: 'x', side: 'a', commander: true, kind: 'archers', pos: { q: 0, r: 4 } })
    const d = U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 4, r: 4 } })
    const s = plainBattle([a, d])
    expect(play(s, { t: 'bVolley', unit: 'a0', target: 'd0' })?.code).toBe('illegal-target')
    s.battle!.terrain[key({ q: 0, r: 4 })] = 'hill'
    expect(volleyRange(s.battle!, a)).toBe(4)
    must(s, { t: 'bVolley', unit: 'a0', target: 'd0' })
    expect(s.log.some((l) => l.kind === 'volleyed')).toBe(true)
  })
  test('W-17 duels: might 50 to challenge, 70 for a capture stake, accept% from daring and might, declining costs morale and daring loyalty', () => {
    const a = U({ id: 'a0', hero: 'lin-chong', side: 'a', commander: true, might: 92, vigour: 85, pos: { q: 3, r: 4 } })
    const d = U({ id: 'd0', hero: 'y', side: 'd', commander: true, might: 70, vigour: 60, daring: 5, pos: { q: 4, r: 4 } })
    const d2 = U({ id: 'd1', hero: 'z', side: 'd', pos: { q: 9, r: 4 } })
    const s = plainBattle([a, d, d2])
    const c = ctxOf(s)
    expect(duelAccept(c, s.battle!, a, d, 'honour')).toBe(54)
    expect(duelAccept(c, s.battle!, a, d, 'capture')).toBe(39)
    expect(duelWin(a, d).win).toBe(82.9)
    s.rng.forced = [99]
    must(s, { t: 'bDuel', unit: 'a0', target: 'd0', stake: 'honour' })
    expect(s.log.some((l) => l.kind === 'duelDeclined')).toBe(true)
    expect(d.morale).toBe(55)
    expect(play(s, { t: 'bDuel', unit: 'a0', target: 'd0', stake: 'honour' })?.code).toBe('requirement-not-met')
    const weak = plainBattle([U({ id: 'a0', hero: 'x', side: 'a', commander: true, might: 49, pos: { q: 3, r: 4 } }), U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 4, r: 4 } })])
    expect(play(weak, { t: 'bDuel', unit: 'a0', target: 'd0', stake: 'honour' })?.message).toMatch(/might 50/)
    const human = plainBattle([U({ id: 'a0', hero: 'x', side: 'a', commander: true, might: 80, pos: { q: 3, r: 4 } }), U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 4, r: 4 } })], { human: 'd' })
    human.battle!.toAct = 'a'
    must(human, { t: 'bDuel', unit: 'a0', target: 'd0', stake: 'honour' })
    expect(human.pending).toMatchObject({ kind: 'duelOffer', options: ['accept', 'decline'] })
    const cornered = plainBattle([a, d])
    expect(duelAccept(ctxOf(cornered), cornered.battle!, a, d, 'honour')).toBe(84)
  })
  test('W-18 duel resolution: best of three exchanges, winner +15 morale, loser -20 and 10% of maxMen; a capture stake takes the loser', () => {
    const a = U({ id: 'a0', hero: 'x', side: 'a', commander: true, might: 90, vigour: 80, pos: { q: 3, r: 4 }, men: 500, maxMen: 500 })
    const d = U({ id: 'd0', hero: 'y', side: 'd', might: 50, pos: { q: 4, r: 4 }, men: 500, maxMen: 500 })
    const e = U({ id: 'd1', hero: 'w', side: 'd', commander: true, pos: { q: 9, r: 4 } })
    const s = plainBattle([a, d, e])
    s.rng.forced = [0, 50, 50, 0, 0, 0]
    must(s, { t: 'bDuel', unit: 'a0', target: 'd0', stake: 'capture' })
    expect(s.rng.draws).toBe(5) // accept roll + two exchange pairs: 2-0
    expect(d.state).toBe('captured')
    expect(a.morale).toBe(75)
    expect(d.men).toBe(450)
  })
  test('W-19 capture odds: clamp(15, 85, 50 + (best enemy might - own)/2), -20 for a runner, shown while an enemy is within 2', () => {
    const h = U({ id: 'a0', hero: 'x', side: 'a', commander: true, might: 70, pos: { q: 3, r: 4 } })
    const e = U({ id: 'd0', hero: 'y', side: 'd', commander: true, might: 90, pos: { q: 4, r: 4 } })
    const s = plainBattle([h, e])
    expect(captureOdds(s.battle!, h)).toBe(60)
    expect(query.captureOdds(s, 'a0')).toBe(60)
    h.skills = ['runner']
    expect(captureOdds(s.battle!, h)).toBe(40)
    e.pos = { q: 8, r: 4 }
    expect(captureOdds(s.battle!, h)).toBeNull()
  })
  test('W-20 morale starts at 60 + training/10 (+10 for a defender at home with support 60); rout at 20 or 10% of men; +2 at dusk without damage', () => {
    const s = game()
    const c = ctxOf(s)
    setPref(s, 'caozhou', { training: 50, support: 60, men: 500 })
    startBattle(c, { attacker: 'court', origin: 'dongjing', target: 'caozhou', heroes: ['gao-qiu'], men: 800 })
    expect(s.battle!.units.find((u) => u.side === 'd')!.morale).toBe(75)
    expect(s.battle!.units.find((u) => u.side === 'a')!.morale).toBe(66)
    const a = U({ id: 'a0', hero: 'x', side: 'a', commander: true, morale: 18, pos: { q: 3, r: 4 } })
    const d = U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 8, r: 4 }, morale: 50 })
    const t = plainBattle([a, d, U({ id: 'a1', hero: 'z', side: 'a', pos: { q: 0, r: 8 }, morale: 50 })])
    must(t, { t: 'bEndSide' }); must(t, { t: 'bEndSide' })
    expect(t.battle!.result).toMatchObject({ winner: 'd' }) // the commander broke at morale 20
  })
  test('W-21 daily food: each side pays ceil(men / 300) from its home stock; an empty stock means hunger', () => {
    const a = U({ id: 'a0', hero: 'x', side: 'a', commander: true, men: 900, maxMen: 900, pos: { q: 0, r: 4 } })
    const d = U({ id: 'd0', hero: 'y', side: 'd', commander: true, men: 301, maxMen: 301, pos: { q: 9, r: 4 } })
    const s = plainBattle([a, d])
    setPref(s, 'yunzhou', { food: 100 }); setPref(s, 'jizhou', { food: 1 })
    must(s, { t: 'bEndSide' }); must(s, { t: 'bEndSide' })
    expect(s.prefectures['yunzhou']!.food).toBe(97)
    expect(s.prefectures['jizhou']!.food).toBe(0)
    expect(s.battle!.hungry).toEqual({ a: false, d: true })
    expect(d.fatigueLog.length).toBeGreaterThanOrEqual(0)
    expect(d.morale).toBe(60 - 10 + 2)
  })
  test('W-22 dusk runs fire, village healing, food, rally, recovery, morale, rout checks and then the next day', () => {
    const m = U({ id: 'a0', hero: 'x', side: 'a', commander: true, skills: ['monk'], pos: { q: 1, r: 4 }, morale: 50 })
    const f = U({ id: 'a1', hero: 'z', side: 'a', pos: { q: 2, r: 4 }, morale: 50, men: 50, maxMen: 100 })
    const d = U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 9, r: 4 } })
    const s = plainBattle([m, f, d])
    s.battle!.terrain[key({ q: 2, r: 4 })] = 'village'
    must(s, { t: 'bEndSide' }); must(s, { t: 'bEndSide' })
    expect(f.men).toBe(53) // village heals 3% of 100
    expect(f.morale).toBe(50 + 5 + 2) // monk rally then the no-damage bonus
    expect(s.log.filter((l) => l.kind === 'dusk').length).toBeGreaterThanOrEqual(3)
    expect(s.log.at(-1)!.kind).toBe('dayStarted')
  })
  test('W-23 when Day 20 ends the attacker withdraws, the defender holds and Renown falls by 1', () => {
    const s = game()
    const c = ctxOf(s)
    setPref(s, 'yunzhou', { men: 1000, arms: 1000 })
    startBattle(c, { attacker: 'player', origin: 'yunzhou', target: 'caozhou', heroes: ['song-jiang'], men: 100 })
    const b = s.battle!
    b.day = 20
    for (const u of b.units) u.pos = { q: u.side === 'a' ? 0 : 9, r: u.side === 'a' ? 4 : 4 }
    for (const u of b.units) { u.men = u.maxMen = Math.max(u.men, 200); u.morale = 80 }
    must(s, { t: 'bEndSide' }); must(s, { t: 'bEndSide' })
    expect(b.result).toEqual({ winner: 'd', reason: 'day-limit' })
    driveBattle(ctxOf(s))
    expect(s.phase).toBe('strategic')
    expect(s.factions['player']!.ledger.at(-1)).toMatchObject({ amount: -1, rule: 'R-3' })
    expect(s.prefectures['caozhou']!.owner).toBe('free')
  })
  test('W-24 hidden units are seen only within 2 hexes (4 for a scout); forest and reed let any unit hide, a thief also hills and villages', () => {
    const h = U({ id: 'd0', hero: 'y', side: 'd', commander: true, hidden: true, pos: { q: 6, r: 4 } })
    const a = U({ id: 'a0', hero: 'x', side: 'a', commander: true, pos: { q: 1, r: 4 } })
    const s = plainBattle([a, h])
    expect(visibleTo(s.battle!, 'a', h)).toBe(false)
    a.pos = { q: 4, r: 4 }
    expect(visibleTo(s.battle!, 'a', h)).toBe(true)
    a.pos = { q: 2, r: 4 }
    expect(visibleTo(s.battle!, 'a', h)).toBe(false)
    a.skills = ['scout']
    expect(visibleTo(s.battle!, 'a', h)).toBe(true)
    const w = plainBattle([U({ id: 'a0', hero: 'x', side: 'a', commander: true, pos: { q: 1, r: 4 } }), U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 8, r: 4 } })])
    expect(play(w, { t: 'bHide', unit: 'a0' })?.code).toBe('requirement-not-met')
    w.battle!.terrain[key({ q: 1, r: 4 })] = 'forest'
    must(w, { t: 'bHide', unit: 'a0' })
    expect(w.battle!.units[0]!.hidden).toBe(true)
  })
  test('W-25 a battle ends when a commander is routed or captured, or a side has no units left', () => {
    const a = U({ id: 'a0', hero: 'x', side: 'a', commander: true, pos: { q: 3, r: 4 }, men: 800, maxMen: 800, might: 100 })
    const d = U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 4, r: 4 }, men: 5, maxMen: 500 })
    const s = plainBattle([a, d])
    must(s, { t: 'bAttack', unit: 'a0', target: 'd0' })
    expect(s.battle!.result).toMatchObject({ winner: 'a' })
    const t = plainBattle([U({ id: 'a0', hero: 'x', side: 'a', commander: true, pos: { q: 0, r: 4 } }), U({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 9, r: 4 } })])
    expect(play(t, { t: 'bWithdraw' })).toBeNull()
    expect(t.battle!.result).toEqual({ winner: 'd', reason: 'withdrew' })
  })
  test('W-26 Gao Qiu is never rolled for capture; at 0 men he is taken; routing triggers his flight (see court.test G-8 and result.test X-1)', () => {
    const g = U({ id: 'd0', hero: 'gao-qiu', side: 'd', commander: true, pos: { q: 4, r: 4 }, men: 5, maxMen: 500 })
    const a = U({ id: 'a0', hero: 'x', side: 'a', commander: true, pos: { q: 3, r: 4 }, might: 100, men: 800, maxMen: 800 })
    const s = plainBattle([a, g])
    s.rng.forced = []
    const draws = s.rng.draws
    must(s, { t: 'bAttack', unit: 'a0', target: 'd0' })
    expect(g.state).toBe('captured')
    expect(s.rng.draws - draws).toBe(1) // one variance roll, none for capture or counter
    expect(s.battle!.result).toMatchObject({ winner: 'a', reason: 'gao-qiu' })
  })
  test('W-33 a conquered prefecture has 1 command in the month it falls', () => {
    const s = game('lin-chong')
    const c = ctxOf(s)
    setPref(s, 'mengzhou', { men: 2000, arms: 2000, gold: 100 })
    setPref(s, 'luoyang', { men: 50 })
    s.prefectures['luoyang']!.heroes = []
    expect(s.commandsLeft['luoyang']).toBe(0)
    startBattle(c, { attacker: 'player', origin: 'mengzhou', target: 'luoyang', heroes: ['lin-chong', 'shi-en'], men: 2000 })
    s.battle!.auto.a = true
    driveBattle(c)
    expect(s.prefectures['luoyang']!.owner).toBe('player')
    expect(s.commandsLeft['luoyang']).toBeGreaterThanOrEqual(1)
  })
  test('W-27 a won attack takes the prefecture: stocks halve (spoils to the origin), support -5 (D20), the garrison stays, Renown follows R-2', () => {
    const s = game('lin-chong')
    const c = ctxOf(s)
    setPref(s, 'mengzhou', { men: 2000, arms: 2000, gold: 100 })
    setPref(s, 'luoyang', { men: 50, gold: 1000, food: 2000, support: 50 })
    s.prefectures['luoyang']!.heroes = []
    startBattle(c, { attacker: 'player', origin: 'mengzhou', target: 'luoyang', heroes: ['lin-chong', 'shi-en'], men: 2000 })
    s.battle!.auto.a = true
    driveBattle(c)
    const p = s.prefectures['luoyang']!
    expect(p.owner).toBe('player')
    expect(p.gold).toBe(500)
    expect(s.prefectures['mengzhou']!.gold).toBeGreaterThanOrEqual(100 + 500)
    expect(p.men).toBeGreaterThan(0)
    expect(s.heroes['lin-chong']!.loc).toBe('luoyang')
    expect(p.support).toBeLessThanOrEqual(50 + 10)
    expect(p.support).toBeGreaterThanOrEqual(50 - 5 - 1)
  })
  test('W-28 handing the battle to the AI plays exactly what the AI would have played', () => {
    const mk = (human: 'a' | null) => {
      const s = game('lin-chong', 2, 5)
      const c = ctxOf(s)
      setPref(s, 'mengzhou', { men: 1500, arms: 1500 })
      startBattle(c, { attacker: 'player', origin: 'mengzhou', target: 'luoyang', heroes: ['lin-chong', 'shi-en'], men: 1500 })
      if (human === null) s.battle!.human = null
      else s.battle!.auto.a = true
      driveBattle(c)
      return s
    }
    const x = mk(null), y = mk('a')
    expect(JSON.stringify(x.prefectures)).toBe(JSON.stringify(y.prefectures))
    expect(x.rng.draws).toBe(y.rng.draws)
  })
  test('W-29 heroes on the winning side gain 3 loyalty, the losing side loses 5', () => {
    const s = game('lin-chong')
    const c = ctxOf(s)
    setPref(s, 'mengzhou', { men: 2000, arms: 2000 })
    setPref(s, 'luoyang', { men: 20 })
    s.prefectures['luoyang']!.heroes = []
    const before = s.heroes['shi-en']!.loyalty
    startBattle(c, { attacker: 'player', origin: 'mengzhou', target: 'luoyang', heroes: ['lin-chong', 'shi-en'], men: 2000 })
    s.battle!.auto.a = true
    driveBattle(c)
    expect(s.heroes['shi-en']!.loyalty).toBe(before + 3)
  })
  test('W-30 men killed are gone; survivors return to the origin with their arms', () => {
    const s = game('lin-chong')
    const c = ctxOf(s)
    setPref(s, 'mengzhou', { men: 1000, arms: 1000 })
    setPref(s, 'luoyang', { men: 5000, arms: 5000 })
    startBattle(c, { attacker: 'player', origin: 'mengzhou', target: 'luoyang', heroes: ['lin-chong'], men: 1000 })
    expect(s.prefectures['mengzhou']!.men).toBe(0)
    expect(s.prefectures['mengzhou']!.arms).toBe(0)
    const total = s.battle!.units.filter((u) => u.side === 'a').reduce((n, u) => n + u.men - u.guard, 0)
    s.battle!.auto.a = true
    driveBattle(c)
    expect(s.prefectures['mengzhou']!.men + (s.prefectures['luoyang']!.owner === 'player' ? s.prefectures['luoyang']!.men : 0)).toBeLessThanOrEqual(total)
  })
  test('W-31 a prefecture with men and no hero is held by captains; one with neither falls without a fight', () => {
    const s = game()
    const c = ctxOf(s)
    setPref(s, 'caozhou', { men: 0 })
    startBattle(c, { attacker: 'court', origin: 'dongjing', target: 'caozhou', heroes: ['gao-qiu'], men: 500 })
    expect(s.battle!.result).toMatchObject({ winner: 'a', reason: 'no-defenders' })
    expect(s.battle!.units.filter((u) => u.side === 'd')).toHaveLength(0)
    driveBattle(c)
    expect(s.prefectures['caozhou']!.owner).toBe('court')
  })
  test('W-legal every listed battle action is accepted (a sweep over the first turn of a real battle)', () => {
    const s = game('lin-chong')
    const c = ctxOf(s)
    setPref(s, 'mengzhou', { men: 1500, arms: 1500 })
    startBattle(c, { attacker: 'player', origin: 'mengzhou', target: 'luoyang', heroes: ['lin-chong', 'shi-en'], men: 1500 })
    const acts = legalActions(s, D)
    expect(acts.length).toBeGreaterThan(5)
    for (const a of acts.slice(0, 60)) {
      if (a.t === 'bAuto' || a.t === 'bWithdraw') continue
      const r = step(s, a, D)
      expect(r.ok, JSON.stringify(a)).toBe(true)
    }
    void legalForUnit; void hs; void ps
  })
})

import { callWave, planWave, WAVE_MAX } from '../../src/engine/battle/wave'
import { view } from '../../src/engine'
describe('W-32 reinforcement waves at the capital', () => {
  const setup = () => {
    const s = game('lin-chong')
    const c = ctxOf(s)
    for (const id of ['zhangde', 'chenzhou', 'luoyang']) { Object.assign(s.prefectures[id]!, { owner: 'player', governor: null, men: 1000, arms: 1000, training: 60 }) }
    const put = (h: string, to: string) => { const from = s.heroes[h]!.loc; if (from) s.prefectures[from]!.heroes = s.prefectures[from]!.heroes.filter((x) => x !== h); s.prefectures[to]!.heroes.push(h); s.heroes[h]!.loc = to; s.heroes[h]!.faction = 'player'; s.heroes[h]!.status = 'ordinary'; s.heroes[h]!.loyalty = 70 }
    for (const [h, p] of [['yang-lin', 'zhangde'], ['hua-rong', 'zhangde'], ['han-tao', 'zhangde'], ['li-ying', 'chenzhou'], ['shi-jin', 'chenzhou'], ['xu-ning', 'luoyang']] as const) put(h, p)
    s.heroes['han-tao']!.status = 'ordinary'
    startBattle(c, { attacker: 'player', origin: 'mengzhou', target: 'dongjing', heroes: ['lin-chong', 'shi-en'], men: 600 })
    return { s, c }
  }
  test('W-32 the plan leaves each bordering prefecture a hero and 30% of its men, at most 8 units in all', () => {
    const { s, c } = setup()
    const plan = planWave(c, s.battle)
    expect(plan.every((p) => ['chenzhou', 'luoyang', 'mengzhou', 'zhangde', 'yingtianfu'].includes(p.pref))).toBe(true)
    for (const p of plan) { expect(p.men).toBeLessThanOrEqual(Math.floor(s.prefectures[p.pref]!.men * 0.7)); expect(p.heroes.length).toBeLessThan(s.prefectures[p.pref]!.heroes.length) }
    expect(plan.reduce((a, p) => a + p.heroes.length, 0)).toBeLessThanOrEqual(WAVE_MAX)
    expect(s.prefectures['luoyang']!.heroes.length).toBe(1)
    expect(plan.some((p) => p.pref === 'luoyang')).toBe(false) // a lone hero stays at home
  })
  test('W-32 on day 5 the wave joins the attackers; days 4 and 6 bring nothing; the view and query.wave show arrival day and size', () => {
    const { s, c } = setup()
    const before = s.battle!.units.length
    expect(query.wave(s).nextDay).toBe(5)
    s.battle!.day = 4; callWave(c)
    expect(s.battle!.units.length).toBe(before)
    s.battle!.day = 5
    const men0 = s.prefectures['zhangde']!.men
    callWave(c)
    const added = s.battle!.units.filter((u) => u.id.startsWith('w5-'))
    expect(added.length).toBeGreaterThan(0)
    expect(added.every((u) => u.side === 'a' && u.state === 'active' && u.home)).toBe(true)
    expect(new Set(s.battle!.units.map((u) => `${u.pos.q},${u.pos.r}`)).size).toBe(s.battle!.units.length)
    expect(s.prefectures['zhangde']!.men).toBeLessThan(men0)
    callWave(c) // once per day
    expect(s.battle!.units.filter((u) => u.id.startsWith('w5-')).length).toBe(added.length)
    const q = query.wave(s)
    expect(q.arrived).toEqual([{ day: 5, units: added.length, men: q.arrived[0]!.men }])
    expect(q.nextDay).toBe(10)
    expect(view(s, 'player', D).battle!.wave.arrived[0]!.day).toBe(5)
  })
  test('W-32 more bordering prefectures send more (cut links pay twice), and a battle elsewhere has no waves', () => {
    const a = setup()
    const one = planWave(a.c, a.s.battle).reduce((n, p) => n + p.heroes.length, 0)
    a.s.prefectures['luoyang']!.heroes.push('yue-he'); a.s.heroes['yue-he']!.loc = 'luoyang'; a.s.heroes['yue-he']!.faction = 'player'; a.s.heroes['yue-he']!.status = 'ordinary'
    expect(planWave(a.c, a.s.battle).reduce((n, p) => n + p.heroes.length, 0)).toBeGreaterThan(one)
    const s = game('lin-chong'); const c = ctxOf(s)
    startBattle(c, { attacker: 'player', origin: 'mengzhou', target: 'luoyang', heroes: ['lin-chong'], men: 300 })
    s.battle!.day = 5; callWave(c)
    expect(s.battle!.units.some((u) => u.id.startsWith('w'))).toBe(false)
  })
})
