import { describe, expect, test } from 'vitest'
import { createGame, step, query } from '../../src/engine'
import { monthBundle, ok, kinds } from './helpers'

function fixture() {
  const d = monthBundle()
  const s = createGame({ startHero: 'song-jiang', difficulty: 2, seed: 1 }, d, { forcedRolls: [57] })
  s.t = 9
  const p = s.prefectures['yunzhou']!
  Object.assign(p, { pop: 150000, gold: 1000, food: 1200, men: 1000, arms: 700, training: 40, support: 50, land: 60, dyke: 50, bandits: 40 })
  const f = s.factions['player']!
  f.renown = 30; f.renownStart = 30; f.renownHistory = Array(9).fill(30)
  s.commandsLeft['yunzhou'] = 2
  return { s, d }
}

describe('13-golden A: October 1101 at Yunzhou', () => {
  test('golden A: levy, relieve, end phase reproduce every printed number', () => {
    const { s, d } = fixture()
    const a1 = ok(s, { t: 'levy', pref: 'yunzhou', actor: 'song-jiang' }, d)
    const p1 = a1.state.prefectures['yunzhou']!
    expect([p1.gold, p1.pop, p1.men, p1.support, a1.state.commandsLeft['yunzhou']]).toEqual([204, 149204, 1796, 47, 1])
    const a2 = ok(a1.state, { t: 'relieve', pref: 'yunzhou', actor: 'song-jiang' }, d)
    const p2 = a2.state.prefectures['yunzhou']!
    expect([p2.food, p2.support, a2.state.factions['player']!.renown, a2.state.commandsLeft['yunzhou']]).toEqual([900, 57, 34, 0])
    expect(a2.state.factions['player']!.ledger.at(-1)).toMatchObject({ amount: 4, rule: 'R-2', column: 'relief' })
    const a3 = ok(a2.state, { t: 'endPhase' }, d)
    const e = a3.state
    const p = e.prefectures['yunzhou']!
    expect(e.t).toBe(10)
    expect({ pop: p.pop, gold: p.gold, food: p.food, men: p.men, arms: p.arms, training: p.training, support: p.support, land: p.land, dyke: p.dyke, bandits: p.bandits }).toEqual({ pop: 149353, gold: 346, food: 2899, men: 1796, arms: 700, training: 40, support: 59, land: 60, dyke: 49, bandits: 40 })
    expect(e.heroes['wu-yong']!.loyalty).toBe(62)
    expect(e.factions['player']!.renown).toBe(34)
    expect(e.commandsLeft['yunzhou']).toBe(2)
    expect([e.rng.draws, e.rng.forced.length, e.pending]).toEqual([1, 0, null])
    const order = ['levy', 'relief', 'tax', 'harvest', 'upkeep', 'support', 'loyalty', 'noPlague', 'month']
    const got = [...kinds(a1.events), ...kinds(a2.events), ...kinds(a3.events)].filter((k) => order.includes(k))
    expect(got).toEqual(order)
    expect(query.runway(e, 'yunzhou', d)).toBe(23)
    const oath = query.oath(e, 'wu-yong', d)
    expect([oath.loyalty, oath.needLoyalty - oath.loyalty, oath.compat, oath.compat >= oath.needCompat]).toEqual([62, 18, 58, true])
    const r = query.renown(e)
    expect([r.status, r.projectedLabel, r.required.toFixed(1), r.rate.toFixed(1)]).toEqual(['red', 'after the deadline', '2.3', '0.7'])
    expect(query.deadline(e)).toMatchObject({ monthsLeft: 133, banner: null })
    const adv = query.advice(e, d)
    expect(adv.hints.length).toBeLessThanOrEqual(3)
    expect(adv.hints[0]!.rule).toBe('R-8')
  })
  test('golden A: replaying the same actions gives the same state', () => {
    const { s, d } = fixture()
    const acts = [{ t: 'levy', pref: 'yunzhou', actor: 'song-jiang' }, { t: 'relieve', pref: 'yunzhou', actor: 'song-jiang' }, { t: 'endPhase' }] as const
    const run = () => { let x = fixture().s; for (const a of acts) x = ok(x, a as never, d).state; return x }
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
    void s; void step
  })
})
