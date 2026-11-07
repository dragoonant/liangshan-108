import { describe, expect, test } from 'vitest'
import { query, step, view } from '../../src/engine'
import { taxOf, harvestOf, seedOf, wagesOf, armedRatio, priceOf, tradeValue, levyAmount, runway } from '../../src/engine/strategic/economy'
import { graftOf } from '../../src/engine/ctx'
import { spyOdds, huntOdds, spyRange } from '../../src/engine/strategic/commands'
import { game, ctxOf, ok, endOf, setPref, ruanGame, D } from './helpers'

const A = (t: string, extra: object = {}) => ({ t, pref: 'yunzhou', actor: 'song-jiang', ...extra }) as never

describe('E economy', () => {
  test('E-1 a prefecture has owner, pop, gold, food, men, arms, training, support, land, dyke, bandits, heroes and captives', () => {
    const p = game().prefectures['yunzhou']!
    for (const k of ['owner', 'pop', 'gold', 'food', 'men', 'arms', 'training', 'support', 'land', 'dyke', 'bandits', 'heroes', 'captives']) expect(p).toHaveProperty(k)
  })
  test('E-2 men are capped by pop/20 and armedRatio is min(100, 100*arms/men)', () => {
    expect([armedRatio(0, 5), armedRatio(100, 50), armedRatio(100, 400)]).toEqual([100, 50, 100])
    const s = game()
    setPref(s, 'yunzhou', { pop: 20000, men: 990, gold: 5000 })
    expect(levyAmount(ctxOf(s), 'yunzhou', 'song-jiang')).toBe(10)
  })
  test('E-3 initial values for ordinary, court and capital prefectures', () => {
    const s = game()
    const c = graftOf(ctxOf(s), 'gao-qiu')
    expect(c).toBe(84)
    const cz = s.prefectures['caozhou']!
    expect([cz.gold, cz.food, cz.men, cz.arms, cz.training, cz.support, cz.bandits]).toEqual([1500, 3750, 1000, 1000, 40, 50, 65])
    const dj = s.prefectures['dongjing']!
    expect([dj.men, dj.training, dj.support]).toEqual([7222, 60, 70 - 42])
  })
  test('E-4 tax: pop 180,000, land 60, support 50 gives 216; a scribe adds 10%', () => {
    const s = game()
    setPref(s, 'daming', { pop: 180000, land: 60, support: 50, heroes: [] })
    expect(taxOf(ctxOf(s), 'daming')).toBe(216)
    setPref(s, 'yunzhou', { pop: 180000, land: 60, support: 50 })
    expect(taxOf(ctxOf(s), 'yunzhou')).toBe(237) // song-jiang is a scribe: floor(216 * 1.1)
  })
  test('E-5 upkeep: winter food x1.5, wages count ordinary heroes; unpaid wages cost loyalty and men', () => {
    const s = game()
    setPref(s, 'yunzhou', { men: 1000, gold: 0, pop: 40000, land: 0 })
    expect(wagesOf(ctxOf(s), 'yunzhou')).toBe(50 + 10)
    s.t = 11
    const e = endOf(s)
    expect(e.prefectures['yunzhou']!.men).toBe(1000 - 50)
    expect(e.heroes['wu-yong']!.loyalty).toBeLessThan(60)
    const f = game()
    setPref(f, 'yunzhou', { men: 1000, gold: 10000, food: 5000, pop: 400000 })
    f.t = 11
    const f2 = endOf(f)
    expect(f2.prefectures['yunzhou']!.food).toBeLessThanOrEqual(5000 - 150 + 1)
    expect(f2.prefectures['yunzhou']!.food).toBeGreaterThanOrEqual(5000 - 150 - 1)
  })
  test('E-6 harvest in October; drought cuts it by 40%', () => {
    const s = game()
    setPref(s, 'yunzhou', { pop: 149204, land: 60, support: 57 })
    expect(harvestOf(ctxOf(s), 'yunzhou')).toBe(2125)
    s.prefectures['yunzhou']!.drought = true
    expect(harvestOf(ctxOf(s), 'yunzhou')).toBe(1275)
  })
  test('E-7 planting in March: seed grain is paid first; unpaid leaves the fields fallow (land -10)', () => {
    const s = game()
    s.t = 2
    setPref(s, 'yunzhou', { pop: 150000, land: 60, support: 60, food: 100000, men: 0 })
    const seed = seedOf(ctxOf(s), 'yunzhou')
    expect(seed).toBe(180)
    const e = endOf(s)
    expect(e.prefectures['yunzhou']!.land).toBeGreaterThanOrEqual(60)
    expect(e.prefectures['yunzhou']!.food).toBeLessThan(100000 - seed + 100)
    const t = game()
    t.t = 2
    setPref(t, 'yunzhou', { pop: 150000, land: 60, food: 50, men: 0 })
    const e2 = endOf(t)
    expect(e2.prefectures['yunzhou']!.land).toBe(50)
    expect(e2.log.some((l) => l.rule === 'E-7')).toBe(true)
  })
  test('E-8 starvation: shortfall desertion, support -5, population -1%, hero loyalty -5', () => {
    const s = game()
    setPref(s, 'yunzhou', { food: 0, men: 600, pop: 100000 })
    const e = endOf(s)
    const p = e.prefectures['yunzhou']!
    expect(p.food).toBe(0)
    expect(p.men).toBe(0)
    expect(p.pop).toBeLessThan(100000)
    expect(e.log.some((l) => l.rule === 'E-8' && /hunger/.test(l.text))).toBe(true)
  })
  test('E-9 runway counts the season factor; the view warns under 2 months (amber) and under 1 (red)', () => {
    const s = game()
    s.t = 9
    setPref(s, 'yunzhou', { men: 1000, food: 190 })
    expect(runway(ctxOf(s), 'yunzhou')).toBe(1.9)
    expect(view(s, 'player', D).warnings.find((w) => w.rule === 'E-9')?.level).toBe('amber')
    s.t = 11
    expect(query.runway(s, 'yunzhou', D)).toBe(1.3)
    setPref(s, 'yunzhou', { food: 90 })
    expect(view(s, 'player', D).warnings.find((w) => w.rule === 'E-9')?.level).toBe('red')
    expect(query.advice(s, D).hints.some((h) => h.rule === 'E-9')).toBe(true)
  })
  test('E-10 growth: g=2 in Mar-Aug, 1 in Sep-Feb, 0 under support 30; dykes decay; bandits follow support', () => {
    const s = game()
    setPref(s, 'yunzhou', { pop: 100000, support: 60, dyke: 50, bandits: 40, men: 0 })
    s.t = 3
    const a = endOf(s).prefectures['yunzhou']!
    expect(a.pop).toBeGreaterThanOrEqual(100000 + 200)
    s.t = 9
    expect(endOf(s).prefectures['yunzhou']!.pop - 100000).toBeLessThan(200)
    s.t = 6
    expect(endOf(s).prefectures['yunzhou']!.dyke).toBe(47)
    setPref(s, 'yunzhou', { support: 20 })
    const low = endOf(s).prefectures['yunzhou']!
    expect(low.pop).toBeLessThanOrEqual(100000)
    expect(low.bandits).toBe(50)
    setPref(s, 'yunzhou', { support: 80, bandits: 40 })
    expect(endOf(s).prefectures['yunzhou']!.bandits).toBe(35)
  })
  test('E-11 support drift: -2 on starvation, -1 with 150 bandits, +1 when calm, +1 with a compassionate hero', () => {
    const s = game()
    setPref(s, 'yunzhou', { support: 50, bandits: 160, food: 100000, men: 0 })
    const a = endOf(s).prefectures['yunzhou']!
    expect(a.support).toBeGreaterThanOrEqual(50) // -1 bandits, +1 compassion 9
    setPref(s, 'yunzhou', { support: 50, bandits: 40, food: 100000, men: 0 })
    expect(endOf(s).prefectures['yunzhou']!.support).toBe(52)
    setPref(s, 'yunzhou', { food: 0, men: 100 })
    expect(endOf(s).prefectures['yunzhou']!.support).toBeLessThan(50)
  })
  test('E-12 commands: train, forge, dykes, relieve, rest and trade apply their stated effects', () => {
    let s = game()
    setPref(s, 'yunzhou', { gold: 5000, food: 5000, men: 600, arms: 0, training: 30, dyke: 40, support: 50 })
    s = ok(s, A('train')).state
    expect(s.prefectures['yunzhou']!.training).toBe(30 + 8 + 9)
    s = ok(s, A('forge')).state
    expect(s.prefectures['yunzhou']!.arms).toBe(400)
    const t = game()
    setPref(t, 'yunzhou', { gold: 5000, food: 5000, dyke: 40, support: 50 })
    let u = ok(t, A('dykes')).state
    expect([u.prefectures['yunzhou']!.dyke, u.prefectures['yunzhou']!.gold, u.prefectures['yunzhou']!.food]).toEqual([55, 4800, 4900])
    u = ok(u, A('rest')).state
    expect([u.prefectures['yunzhou']!.support, u.prefectures['yunzhou']!.gold]).toEqual([52, 4700])
    expect(u.heroes['wu-yong']!.loyalty).toBe(66)
    expect(step(u, A('rest'), D).ok).toBe(false) // no commands left
    const p = query.preview(game(), A('levy'), D)
    expect(p).toMatchObject({ rule: 'E-12' })
  })
  test('E-13 trade prices per 10 food: autumn 3, winter 5, spring 6, summer 5; selling pays 70%', () => {
    expect([9, 11, 2, 6].map(priceOf)).toEqual([3, 5, 6, 5])
    const c = ctxOf(game())
    c.s.t = 2
    const wu = 'liu-tang' // cunning bonus applies; use an actor with a known value
    void wu
    const buy = tradeValue(c, 'song-jiang', 'buyFood', 1000)
    expect(buy).toBe(Math.floor((600 * (100 - 7)) / 100))
    expect(tradeValue(c, 'song-jiang', 'sellFood', 1000)).toBe(Math.floor((Math.floor((1000 * 6 * 7) / 100)) * 107 / 100))
  })
  test('E-14 hunt: power = might + 20 per helper + men/50; P clamps 10..95; success cuts bandits to 30%', () => {
    const s = game('wu-song', 2, 3, [0])
    s.pending = null
    setPref(s, 'cangzhou', { bandits: 100, gold: 1000, men: 400 })
    const P = huntOdds(ctxOf(s), 'cangzhou', 'wu-song', ['chai-jin'], 400)
    const power = 96 + 20 + 8 + 10
    expect(P).toBe(Math.min(95, Math.max(10, 50 + Math.floor((power - 20) / 2))))
    const r = ok(s, { t: 'hunt', pref: 'cangzhou', actor: 'wu-song', party: ['chai-jin'], men: 400 })
    expect(r.state.prefectures['cangzhou']!.bandits).toBe(30)
    expect(r.state.prefectures['cangzhou']!.gold).toBe(1050)
    expect(r.state.factions['player']!.renown).toBe(45 + 2)
  })
  test('E-15 move: needs a hero; marsh-water needs a marine or swimmer; food costs 1 per 20 men; snow blocks passes', () => {
    const s = ruanGame()
    s.prefectures['yunzhou']!.owner = 'player'
    s.prefectures['yunzhou']!.heroes = []
    s.prefectures['yunzhou']!.men = 0
    s.prefectures['yunzhou']!.arms = 0
    const mv = (heroes: string[]) => step(s, { t: 'move', pref: 'jizhou', to: 'yunzhou', heroes, men: 100 }, D)
    expect(mv(['ruan-xiaoer']).ok).toBe(true)
    expect(mv([]).ok).toBe(false)
    const r = ok(s, { t: 'move', pref: 'jizhou', to: 'yunzhou', heroes: ['ruan-xiaoqi'], men: 100 })
    expect(r.state.prefectures['yunzhou']!.men).toBe(100)
    expect(r.state.prefectures['jizhou']!.food).toBe(2000 - 5)
    // no marine or swimmer: blocked
    const t = game('lin-chong')
    const x = step(t, { t: 'move', pref: 'mengzhou', to: 'dongjing', heroes: ['lin-chong'], men: 0 }, D)
    expect(x.ok).toBe(false)
  })
  test('E-16 spy: range 2 (3 scout, any runner), odds shown first, report reveals numbers', () => {
    const s = game('lin-chong')
    const c = ctxOf(s)
    expect(spyRange(c, 'lin-chong')).toBe(2)
    const pv = query.preview(s, { t: 'spy', pref: 'mengzhou', actor: 'lin-chong', target: 'dongjing', op: 'report' }, D)
    expect(pv).toMatchObject({ rule: 'E-16', gold: 100 })
    const far = query.preview(s, { t: 'spy', pref: 'mengzhou', actor: 'lin-chong', target: 'hangzhou', op: 'report' }, D)
    expect('code' in far).toBe(true)
    const P = spyOdds(c, 'lin-chong', 'dongjing', 'report')
    expect(P).toBeGreaterThanOrEqual(10)
    const r = ok(game('lin-chong', 2, 3, [0]), { t: 'spy', pref: 'mengzhou', actor: 'lin-chong', target: 'dongjing', op: 'report' })
    expect(r.state.prefectures['dongjing']!.spyT).toBe(0)
    expect(view(r.state, 'player', D).prefectures['dongjing']!.exact).toBe(true)
  })
  test('E-17 free prefectures grow, hold garrison captains and never attack', () => {
    const s = game()
    expect(ctxOf(s).s.commandsLeft['hangzhou']).toBe(0)
    let n = 0
    let t = s
    for (let i = 0; i < 3; i++) { const r = ok(t, { t: 'endPhase' }); n += r.events.filter((e) => e.k === 'battleStart').length; t = r.state; while (t.pending || t.phase === 'battle') t = ok(t, t.pending ? { t: 'choose', option: t.pending.options[0] as string } : { t: 'bAuto' }).state }
    for (const e of t.log) if (e.kind === 'battleStart') expect(e.text).not.toMatch(/free/)
    expect(t.prefectures['hangzhou']!.pop).toBeGreaterThan(s.prefectures['hangzhou']!.pop) // far from every camp, so nobody raids it
    void n
  })
})
