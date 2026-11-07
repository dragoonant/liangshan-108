import { describe, expect, test } from 'vitest'
import { query } from '../../src/engine'
import { applyBattleAction } from '../../src/engine/battle/actions'
import type { Action, BUnit, BattleState } from '../../src/engine'
import { fromOffset, key } from '../../src/engine/battle/hex'
import { game, ctxOf, D } from './helpers'

const FORCED = [40, 60, 50, 10, 90, 70, 20, 10, 10, 10]

function unit(p: Partial<BUnit> & { id: string; hero: string; side: 'a' | 'd' }): BUnit {
  return {
    kind: 'infantry', skills: [], might: 40, command: 40, cunning: 40, vigour: 40, daring: 5, men: 100, maxMen: 100, guard: 0, armed: 100, training: 50, morale: 60, fatigue: 0,
    pos: { q: 0, r: 0 }, hidden: false, state: 'active', commander: false, moved: false, acted: false, waited: false, dueled: false, hurt: false, startedHidable: false,
    counsel: false, fatigueLog: [], specialUsed: false, capturedBy: null, ...p,
  }
}
function fixture() {
  const s = game('song-jiang', 2, 1, FORCED)
  const terrain: Record<string, never> = {} as never
  for (let y = 0; y < 7; y++) for (let x = 0; x < 9; x++) (terrain as Record<string, string>)[key(fromOffset(x, y))] = 'plain'
  ;(terrain as Record<string, string>)[key({ q: 4, r: 2 })] = 'forest'
  const b: BattleState = {
    w: 9, h: 7, terrain: terrain as never, burning: {}, weather: null, wind: 0, day: 1, toAct: 'a', origin: 'yunzhou', target: 'jizhou', human: 'a', auto: { a: false, d: false },
    attacker: 'player', defender: 'free', imperial: false, walled: false, hungry: { a: false, d: false }, hunters: [], result: null, burned: 0, force: ['lin-chong'],
    units: [
      unit({ id: 'a0', hero: 'lin-chong', side: 'a', skills: ['spearman'], might: 92, command: 85, cunning: 60, vigour: 85, daring: 8, men: 1000, maxMen: 1000, training: 80, morale: 68, pos: { q: 2, r: 2 }, commander: true }),
      unit({ id: 'a1', hero: 'cap-test-archer', side: 'a', kind: 'archers', might: 80, command: 70, cunning: 50, vigour: 70, men: 600, maxMen: 600, training: 70, morale: 67, pos: { q: 2, r: 3 } }),
      unit({ id: 'd1', hero: 'cap-test-reserve', side: 'd', men: 69, maxMen: 69, pos: { q: 5, r: 5 } }),
      unit({ id: 'd0', hero: 'cap-test-guan', side: 'd', might: 70, command: 60, cunning: 50, vigour: 60, daring: 5, men: 800, maxMen: 800, armed: 75, training: 50, morale: 65, pos: { q: 4, r: 2 }, commander: true }),
    ],
  }
  s.battle = b; s.phase = 'battle'
  s.prefectures['yunzhou']!.food = 2000; s.prefectures['jizhou']!.food = 800; s.prefectures['jizhou']!.support = 50
  return s
}
const play = (s: ReturnType<typeof fixture>, a: Action) => { const r = applyBattleAction(ctxOf(s), a); if (r) throw new Error(r.message) }

describe('13-golden B: Day 1 at a forest line', () => {
  test('golden B: every printed number of the battle round', () => {
    const s = fixture()
    const c = ctxOf(s)
    const b = s.battle!
    const lin = b.units[0]!, arc = b.units[1]!, guan = b.units[3]!
    play(s, { t: 'bMove', unit: 'a0', to: { q: 3, r: 2 } })
    expect([lin.pos, lin.fatigue]).toEqual([{ q: 3, r: 2 }, 1])
    expect(query.duelOdds(s, 'a0', 'd0', 'honour', D)).toMatchObject({ accept: 54, win: 82.9 })
    play(s, { t: 'bDuel', unit: 'a0', target: 'd0', stake: 'honour' })
    expect([lin.morale, lin.fatigue, guan.morale, guan.men, guan.fatigue]).toEqual([83, 4, 45, 720, 19])
    const pv = query.attackPreview(s, 'a0', 'd0')!
    expect([pv.base, pv.min, pv.max]).toEqual([124, 111, 136])
    play(s, { t: 'bAttack', unit: 'a0', target: 'd0' })
    expect([guan.men, lin.men, lin.fatigue, guan.fatigue]).toEqual([596, 955, 6, 20])
    play(s, { t: 'bVolley', unit: 'a1', target: 'd0' })
    expect([guan.men, arc.fatigue]).toEqual([531, 3])
    play(s, { t: 'bEndSide' })
    play(s, { t: 'bEndSide' })
    expect([lin.men, lin.morale, lin.fatigue, lin.pos]).toEqual([955, 83, 0, { q: 3, r: 2 }])
    expect([arc.men, arc.morale, arc.fatigue]).toEqual([600, 69, 0])
    expect([guan.men, guan.morale, guan.fatigue]).toEqual([531, 45, 14])
    expect([s.rng.draws, s.rng.forced.length, b.day, b.result]).toEqual([10, 0, 2, null])
    expect([s.prefectures['yunzhou']!.food, s.prefectures['jizhou']!.food]).toEqual([1994, 798])
    expect(query.battleClock(s, D)).toMatchObject({ day: 2, daysLeft: 18 })
    const ks = s.log.map((e) => e.kind).filter((k) => ['moved', 'duelOffered', 'duelAccepted', 'duelExchange', 'duelResolved', 'attacked', 'countered', 'volleyed', 'dusk', 'dayStarted'].includes(k))
    expect(ks.slice(0, 10)).toEqual(['moved', 'duelOffered', 'duelAccepted', 'duelExchange', 'duelExchange', 'duelExchange', 'duelResolved', 'attacked', 'countered', 'volleyed'])
    expect(ks.at(-1)).toBe('dayStarted')
    void c
  })
  test('golden B: damage numbers 124, 45, 65 appear in the log', () => {
    const s = fixture()
    for (const a of [{ t: 'bMove', unit: 'a0', to: { q: 3, r: 2 } }, { t: 'bDuel', unit: 'a0', target: 'd0', stake: 'honour' }, { t: 'bAttack', unit: 'a0', target: 'd0' }, { t: 'bVolley', unit: 'a1', target: 'd0' }] as Action[]) play(s, a)
    expect(s.log.filter((e) => ['attacked', 'countered', 'volleyed'].includes(e.kind)).map((e) => e.text.match(/(\d+) men killed/)![1])).toEqual(['124', '45', '65'])
  })
})
