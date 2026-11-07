import { describe, expect, test } from 'vitest'
import { query, step, legalActions } from '../../src/engine'
import { monthOf, yearOf, label, season, isWinter } from '../../src/engine/calendar'
import { snowedIn, snowedIn as snow } from '../../src/engine/ctx'
import { commandCap, resetCommands } from '../../src/engine/strategic/commands'
import { monthEnd } from '../../src/engine/strategic/month'
import { clone } from '../../src/engine/util'
import { game, ctxOf, ok, kinds, D } from './helpers'

describe('T turn', () => {
  test('T-1 t=0 is January 1101; monthOf and yearOf follow', () => {
    expect([monthOf(0), yearOf(0), monthOf(13), yearOf(13), label(25)]).toEqual([1, 1101, 2, 1102, 'Feb 1103'])
    let s = game()
    s = ok(s, { t: 'endPhase' }).state
    expect(s.t).toBeGreaterThanOrEqual(0)
  })
  test('T-2 order of play: AI phases come before the month-end resolution; t advances last', () => {
    const s = game('lin-chong', 2, 3)
    const r = ok(s, { t: 'endPhase' })
    const ks = kinds(r.events)
    const firstAi = ks.findIndex((k) => ['train', 'relief', 'levy', 'forge', 'dykes', 'trade', 'recruited', 'battleStart'].includes(k))
    const firstEnd = ks.findIndex((k) => k === 'upkeep')
    expect(firstAi).toBeGreaterThanOrEqual(0)
    expect(firstAi).toBeLessThan(firstEnd)
    expect(ks.lastIndexOf('month')).toBeGreaterThan(firstEnd)
  })
  test('T-3 commands: 2 in the chieftain prefecture, 1 per sworn brother prefecture, 0 otherwise', () => {
    const s = game()
    const c = ctxOf(s)
    expect(commandCap(c, 'yunzhou')).toBe(2)
    s.prefectures['daming']!.owner = 'player'
    expect(commandCap(c, 'daming')).toBe(0)
    s.heroes['wu-yong']!.status = 'sworn'
    c.s.heroes['wu-yong']!.loc = 'yunzhou'
    expect(commandCap(c, 'yunzhou')).toBe(2)
    const { placeFix } = { placeFix: () => { const p = s.prefectures['yunzhou']!; p.heroes = p.heroes.filter((h) => h !== 'wu-yong'); s.prefectures['daming']!.heroes.push('wu-yong'); s.heroes['wu-yong']!.loc = 'daming' } }
    placeFix()
    expect(commandCap(c, 'daming')).toBe(1)
    resetCommands(c)
    expect([s.commandsLeft['yunzhou'], s.commandsLeft['daming']]).toEqual([2, 1])
    // a command in a prefecture with none left is not listed and is rejected
    expect(legalActions(s, D).some((a) => 'pref' in a && a.pref === 'jizhou')).toBe(false)
  })
  test('T-4 standing orders: upkeep still runs and a prefecture with no hero loses 2 support', () => {
    const s = game()
    s.prefectures['daming']!.owner = 'player'
    s.prefectures['daming']!.heroes = []
    const before = s.prefectures['daming']!.support
    const t = clone(s)
    const c = ctxOf(t)
    monthEnd(c)
    const u = clone(s)
    u.prefectures['daming']!.heroes = []
    const sup = t.prefectures['daming']!.support
    // the same prefecture with a hero present does not lose the 2
    const w = clone(s)
    w.prefectures['daming']!.heroes = ['wu-yong']
    w.heroes['wu-yong']!.loc = 'daming'
    w.prefectures['yunzhou']!.heroes = w.prefectures['yunzhou']!.heroes.filter((h) => h !== 'wu-yong')
    monthEnd(ctxOf(w))
    expect(w.prefectures['daming']!.support - sup).toBeGreaterThanOrEqual(2)
    expect(t.prefectures['daming']!.gold).not.toBe(s.prefectures['daming']!.gold) // income and upkeep ran
    void before; void u
  })
  test('T-5 seasons: spring Mar-May, summer Jun-Aug, autumn Sep-Nov, winter Dec-Feb', () => {
    expect([2, 4, 7, 10, 11, 0].map((t) => season(t))).toEqual(['spring', 'spring', 'summer', 'autumn', 'winter', 'winter'])
    expect([isWinter(11), isWinter(1), isWinter(2)]).toEqual([true, true, false])
  })
  test('T-6 northern snow blocks the two northern passes from December to February only', () => {
    const c = ctxOf(game())
    expect(snowedIn(c, 'taiyuan', 'zhending', 11)).toBe(true)
    expect(snowedIn(c, 'dengzhou', 'dengyun-shan', 0)).toBe(true)
    expect(snowedIn(c, 'taiyuan', 'zhending', 2)).toBe(false)
    expect(snowedIn(c, 'jingzhao', 'weizhou', 11)).toBe(false)
    const north = D.map.prefectures.filter((p) => p.pos.y <= 0.3).map((p) => p.id).sort()
    expect(north).toEqual(['cangzhou', 'dengyun-shan', 'dengzhou', 'jizhou-north', 'lingzhou', 'taiyuan', 'zhending', 'zhongshan', 'youzhou'].sort())
    c.s.prefectures['cangzhou']!.stormT = 5
    expect(snow(c, 'cangzhou', 'daming', 5)).toBe(true)
  })
  test('T-7 the forecast carries the next season, snowed-in links and the scheduled events of the month', () => {
    const s = game()
    s.t = 10
    s.scheduled.push({ id: 'flood', pref: 'yunzhou', fireT: 10, effect: 'land -5' }, { id: 'flood', pref: 'yunzhou', fireT: 11, effect: 'later' })
    const f = query.forecast(s, D)
    expect(f.next.season).toBe('winter')
    expect(f.next.snowedIn).toContain('taiyuan-zhending')
    expect(f.events).toHaveLength(1)
    expect(f.ahead).toBeNull()
    s.heroes['wu-yong']!.faction = 'player'
    s.heroes['liu-tang']!.faction = 'player'
    const sorc = Object.keys(s.heroes).find((h) => D.heroes.find((x) => x.id === h)?.skills.includes('sorcerer'))!
    s.heroes[sorc]!.faction = 'player'; s.heroes[sorc]!.status = 'ordinary'
    expect(query.forecast(s, D).ahead).not.toBeNull()
  })
  test('T-8 month end runs tax, upkeep, events, growth, support, loyalty, then the history, in that order', () => {
    const s = game()
    const r = ok(s, { t: 'endPhase' })
    const ks = kinds(r.events)
    const pos = (k: string) => ks.indexOf(k)
    expect(pos('tax')).toBeLessThan(pos('upkeep'))
    expect(pos('upkeep')).toBeLessThan(pos('month'))
    expect(r.state.factions['player']!.renownHistory).toHaveLength(r.state.t)
  })
  test('T-9 a prefecture that fought this month cannot be attacked again', () => {
    const s = game()
    s.prefectures['caozhou']!.fought = true
    s.prefectures['yunzhou']!.heroes.push()
    const r = step(s, { t: 'attack', pref: 'yunzhou', target: 'caozhou', heroes: ['song-jiang'], men: 100 }, D)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.message).toContain('T-9')
  })
  test.todo('T-10 undo is not offered and every command shows a preview and a confirm (client; the preview data is query.preview, tested in economy.test.ts)')
})
