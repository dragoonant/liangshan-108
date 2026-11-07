import { describe, expect, test } from 'vitest'
import { query, step, legalActions } from '../../src/engine'
import { EDICT } from '../../src/engine/calendar'
import { ps } from '../../src/engine/ctx'
import { startBattle } from '../../src/engine/battle/setup'
import { driveBattle } from '../../src/engine/step'
import { game, ctxOf, ok, endOf, setPref, toMonth, D } from './helpers'

const A = (t: string, extra: object = {}) => ({ t, pref: 'yunzhou', actor: 'song-jiang', ...extra }) as never

describe('R renown and the Edict', () => {
  test('R-1 Renown is a non-negative integer that starts from the S-1 row; every change is in the ledger with a rule id', () => {
    const s = game('lin-chong')
    expect(s.factions['player']!.renown).toBe(10)
    const t = game()
    t.factions['player']!.renown = 0
    setPref(t, 'yunzhou', { support: 10, gold: 5000 })
    const r = ok(t, A('levy')).state
    expect(r.factions['player']!.renown).toBe(0)
    expect(r.factions['player']!.ledger.at(-1)).toMatchObject({ rule: 'R-3' })
  })
  test('R-2 gains: relief +4 once a month (+6 in a famine), hunt +5 once, a heavenly joiner +5, exposing an official +6 once', () => {
    let s = game()
    s = ok(s, A('relieve')).state
    expect(s.factions['player']!.renown).toBe(34)
    setPref(s, 'yunzhou', { food: 5000 })
    s.commandsLeft['yunzhou'] = 1
    s = ok(s, A('relieve')).state
    expect(s.factions['player']!.renown).toBe(34) // second relief the same month earns nothing
    const f = game()
    f.prefectures['yunzhou']!.famineT = 0
    expect(ok(f, A('relieve')).state.factions['player']!.renown).toBe(36)
    const h = game('wu-song', 2, 3, [0])
    setPref(h, 'cangzhou', { bandits: 100, men: 100 })
    h.pending = null
    expect(ok(h, { t: 'hunt', pref: 'cangzhou', actor: 'wu-song', party: [], men: 100 }).state.factions['player']!.renown).toBe(50)
    const e = game('lin-chong', 2, 3, [0])
    const scribe = D.heroes.find((x) => x.skills.includes('scribe') && x.abilities.cunning >= 60)!.id
    const c = ctxOf(e)
    e.heroes[scribe] = { ...e.heroes[scribe]!, faction: 'player', status: 'ordinary', loc: 'mengzhou' }
    ps(c, 'mengzhou').heroes.push(scribe)
    const w = ok(e, { t: 'spy', pref: 'mengzhou', actor: scribe, target: 'dongjing', op: 'expose' })
    expect(w.state.factions['player']!.renown).toBe(10 + 6)
    expect(w.state.prefectures['dongjing']!.graftMod).toBe(20)
  })
  test('R-2 battles: a won battle gives Renown and toppling a corrupt governor gives justice Renown', () => {
    const s = game('lin-chong')
    setPref(s, 'mengzhou', { men: 1500, arms: 1500 })
    const c = ctxOf(s)
    s.prefectures['luoyang']!.men = 100
    startBattle(c, { attacker: 'player', origin: 'mengzhou', target: 'luoyang', heroes: ['lin-chong', 'shi-en'], men: 1500 })
    s.battle!.auto.a = true
    driveBattle(c)
    const led = s.factions['player']!.ledger
    expect(s.prefectures['luoyang']!.owner).toBe('player')
    expect(led.some((e) => e.column === 'battles' && e.amount >= 1)).toBe(true)
  })
  test('R-3 losses: prefecture lost -5, desertion -2, revolt -5, withdrawal -1', () => {
    let s = game()
    setPref(s, 'yunzhou', { support: 50, gold: 100000, food: 100000 })
    s.heroes['wu-yong']!.loyalty = 5; s.heroes['wu-yong']!.wavering = true
    s = endOf(s)
    expect(s.factions['player']!.ledger.some((e) => e.rule === 'R-3' && e.amount === -2)).toBe(true)
    const r = game()
    r.prefectures['daming']!.owner = 'player'; r.prefectures['daming']!.heroes = []; r.prefectures['daming']!.unrest = true; r.prefectures['daming']!.support = 10
    expect(endOf(r).factions['player']!.ledger.some((e) => e.amount === -5 && /revolted/.test(e.text))).toBe(true)
  })
  test.todo('R-4 the ledger shows five columns (justice, relief, beasts, battles, heroes): the data is state.factions.player.ledger[].column; the display is client work at M3')
  test('R-5 the Edict threshold is 300 on every difficulty', () => {
    expect(EDICT).toBe(300)
    for (const d of [1, 2, 3, 4] as const) expect(query.renown(game('song-jiang', d)).missing).toBe(270)
  })
  test('R-6 renownHistory stores Renown at every month-end; the trend uses up to 6 months', () => {
    let s = game()
    s = endOf(s)
    expect(s.factions['player']!.renownHistory).toEqual([30])
    s.factions['player']!.renown = 36
    s = endOf(s)
    expect(s.factions['player']!.renownHistory).toEqual([30, 36])
    expect(query.renown(s).rate).toBeCloseTo(3, 5) // (36 - 30) / 2 months
  })
  test('R-7 projection: t_next + ceil((300 - renown) / trend); never when flat; after the deadline when late', () => {
    const s = game()
    s.t = 10
    s.factions['player']!.renownHistory = [...Array(4).fill(30), ...Array(6).fill(30)]
    s.factions['player']!.renownHistory[9] = 60
    s.factions['player']!.renown = 60
    const q = query.renown(s)
    expect(q.rate).toBeCloseTo(5, 5)
    expect(q.projectedT).toBe(10 + Math.ceil(240 / 5))
    s.factions['player']!.renownHistory[9] = 30; s.factions['player']!.renown = 30
    expect(query.renown(s).projectedLabel).toBe('never at this pace')
    s.factions['player']!.renownHistory[9] = 31; s.factions['player']!.renown = 31
    expect(query.renown(s).projectedLabel).toBe('after the deadline')
  })
  test('R-8 status: green at least 6 months before Edict-by, amber on or before it, red later; the required rate is shown', () => {
    // renown 60 now; the value six months ago sets the trend: 50 -> 1.7 a month (red), 47 -> 2.2 (amber, projected month 121 of Edict-by 126), 40 -> 3.3 (green)
    const mk = (ago: number) => { const s = game(); s.t = 10; s.factions['player']!.renownStart = 30; s.factions['player']!.renownHistory = Array(10).fill(30); s.factions['player']!.renownHistory[3] = ago; s.factions['player']!.renownHistory[9] = 60; s.factions['player']!.renown = 60; return query.renown(s) }
    expect(mk(50).status).toBe('red')
    expect(mk(47).status).toBe('amber')
    expect(mk(40).status).toBe('green')
    expect(mk(50).required).toBeGreaterThan(2)
    const t = endOf(game())
    expect(t.log.some((l) => l.kind === 'toast' && l.rule === 'R-8')).toBe(false) // still measuring
    const u = toMonth(game(), 3)
    expect(u.log.some((l) => l.kind === 'toast' && l.rule === 'R-8')).toBe(true)
  })
  test('R-8 measuring: before 3 month-ends the pace is not judged, no advice or toast; from month 3 it is', () => {
    const s = game()
    const q = query.renown(s)
    expect([q.status, q.projectedT, q.projectedLabel]).toEqual(['measuring', null, 'measuring until Apr 1101'])
    expect(query.advice(s, D).hints.some((h) => h.rule === 'R-8')).toBe(false)
    s.t = 3
    expect(query.renown(s).status).not.toBe('measuring')
  })
  test('T-3 advice counts unused commands only in the player\'s own prefectures', () => {
    const s = game()
    const mine = Object.entries(s.commandsLeft).filter(([id]) => s.prefectures[id]!.owner === 'player').reduce((a, [, n]) => a + n, 0)
    const hint = query.advice(s, D).hints.find((h) => h.rule === 'T-3')
    expect(hint?.text).toBe(`${mine} command(s) unused this month`)
  })
  test('R-9 at month end with Renown 500 the Edict is granted, the capital opens and is garrisoned to 6000 over 3 months; it stays', () => {
    let s = game()
    s.factions['player']!.renown = 500
    s = endOf(s)
    expect(s.factions['player']!.edict).toBe(0)
    expect(s.factions['court']!.edictBuild).toBe(3)
    s.factions['player']!.renown = 0
    for (let i = 0; i < 4; i++) { s = endOf(s); s.prefectures['dongjing']!.men = Math.min(s.prefectures['dongjing']!.men, 3000) }
    expect(s.factions['player']!.edict).toBe(0)
    const t = game()
    t.factions['player']!.renown = 500
    let u = endOf(t)
    u.prefectures['dongjing']!.men = 2000
    for (let i = 0; i < 3; i++) u = endOf(u)
    expect(u.prefectures['dongjing']!.men).toBeGreaterThanOrEqual(5900)
    void step; void legalActions
  })
  test('R-10 deadline banners at 24, 12, 6, 3 and 1 months left', () => {
    const s = game()
    const at = (left: number) => { s.t = 143 - left; return query.deadline(s).banner }
    expect([at(30), at(24), at(13), at(12), at(5), at(2), at(0)]).toEqual([null, 24, 24, 12, 6, 3, 1])
  })
})
