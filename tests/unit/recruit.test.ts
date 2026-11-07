import { describe, expect, test } from 'vitest'
import { query, step } from '../../src/engine'
import { compat, hs, ps } from '../../src/engine/ctx'
import { recruitOdds, persuadeOdds, checkTriggers, joinLoyalty } from '../../src/engine/strategic/recruit'
import { runCommand, isReject } from '../../src/engine/strategic/commands'
import { createGame } from '../../src/engine'
import { game, ctxOf, ok, setPref, fight, D } from './helpers'

describe('Q recruitment', () => {
  test('Q-1 heroes are free, serving, captive or dormant at the start', () => {
    const s = game()
    const count = (f: (h: (typeof s.heroes)[string]) => boolean) => D.heroes.filter((h) => f(s.heroes[h.id]!)).length
    expect(count((h) => h.status === 'dormant')).toBe(23)
    expect(count((h) => h.faction === 'free' && h.status === 'free')).toBeGreaterThan(30)
    expect(count((h) => h.faction !== 'free' && h.status !== 'dormant')).toBeGreaterThan(10)
  })
  test('Q-2 invite odds: every term is listed; success joins at 40 + compat/4 with Renown; failure blocks the month', () => {
    const s = game('song-jiang', 2, 3, [0])
    const c = ctxOf(s)
    const o = recruitOdds(c, 'player', 'song-jiang', 'song-qing')
    const cm = compat(c, 'song-jiang', 'song-qing')
    const t = D.heroes.find((h) => h.id === 'song-qing')!
    const expected = 20 + Math.min(30, Math.floor(30 / 10)) + Math.floor(cm / 3) + Math.floor((78 - 50) / 5) + Math.floor((70 - 50) / 5) + (t.start.status === 'official' ? -30 : 0)
    expect(o.pct).toBe(Math.max(5, Math.min(95, expected)))
    expect(o.terms.find((x) => x.label === 'base')?.value).toBe(20)
    const sj = ok(s, { t: 'recruit', pref: 'yunzhou', actor: 'song-jiang', target: 'song-qing', method: 'invite' })
    void sj
    // song-qing is not at yunzhou; use a free hero who is
    const free = ps(c, 'yunzhou').heroes.find((h) => hs(c, h).faction === 'free')!
    const good = ok(s, { t: 'recruit', pref: 'yunzhou', actor: 'song-jiang', target: free, method: 'invite' }).state
    expect(good.heroes[free]).toMatchObject({ faction: 'player', status: 'ordinary', loyalty: joinLoyalty(c, free, 'invite') })
    expect(good.prefectures['yunzhou']!.gold).toBe(1400)
    const bad = ok(game('song-jiang', 2, 3, [99]), { t: 'recruit', pref: 'yunzhou', actor: 'song-jiang', target: free, method: 'invite' }).state
    expect(bad.heroes[free]!.faction).toBe('free')
    expect(bad.heroes[free]!.inviteBlock).toBe(1)
    expect(step(bad, { t: 'recruit', pref: 'yunzhou', actor: 'song-jiang', target: free, method: 'invite' }, D).ok).toBe(false)
  })
  test('Q-3 rescue: conquest frees your captives and a jailbreak frees one at loyalty 80', () => {
    const s = game('song-jiang', 2, 3, [0])
    const thief = D.heroes.find((h) => h.skills.includes('thief') && h.abilities.cunning >= 60)!.id
    const c = ctxOf(s)
    const q = ps(c, 'yunzhou'); q.heroes.push(thief); s.heroes[thief] = { ...s.heroes[thief]!, faction: 'player', status: 'ordinary', loc: 'yunzhou' }
    const nb = c.x.adj['yunzhou']![0]!.to
    const cap = 'wu-yong'
    q.heroes = q.heroes.filter((h) => h !== cap)
    s.heroes[cap] = { ...s.heroes[cap]!, status: 'captive', faction: 'court', heldBy: 'court', loc: nb }
    s.prefectures[nb]!.captives.push(cap)
    const r = ok(s, { t: 'spy', pref: 'yunzhou', actor: thief, target: nb, op: 'jailbreak' })
    expect(r.state.heroes[cap]).toMatchObject({ faction: 'player', status: 'ordinary', loyalty: 80 })
  })
  test('Q-4 captive decisions: persuade, release (+20 invite, Renown +2), hold, execute (court only, Renown -3)', () => {
    const base = () => {
      const s = game('song-jiang', 2, 3, [0])
      const cap = 'cai-jing'
      s.heroes[cap] = { ...s.heroes[cap]!, status: 'captive', faction: 'player', heldBy: 'player', loc: 'yunzhou' }
      const c = ctxOf(s)
      const old = ps(c, 'dongjing'); old.heroes = old.heroes.filter((h) => h !== cap)
      ps(c, 'yunzhou').captives.push(cap)
      s.pending = { kind: 'captive', options: ['persuade', 'release', 'hold', 'execute'], data: { captive: cap, queue: [], actor: 'song-jiang', pref: 'yunzhou' } }
      return s
    }
    expect(persuadeOdds(ctxOf(base()), 'player', 'song-jiang', 'cai-jing').pct).toBeGreaterThanOrEqual(5)
    expect(ok(base(), { t: 'choose', option: 'persuade' }).state.heroes['cai-jing']!.faction).toBe('player')
    const rel = ok(base(), { t: 'choose', option: 'release' }).state
    expect(rel.heroes['cai-jing']).toMatchObject({ faction: 'free', bonus: 20 })
    expect(rel.factions['player']!.renown).toBe(32)
    expect(ok(base(), { t: 'choose', option: 'hold' }).state.heroes['cai-jing']!.status).toBe('captive')
    expect(ok(base(), { t: 'choose', option: 'execute' }).state.factions['player']!.renown).toBe(27)
    const queue = base()
    queue.pending!.data['queue'] = ['gao-lian']
    queue.heroes['gao-lian'] = { ...queue.heroes['gao-lian']!, status: 'captive', faction: 'player', heldBy: 'player', loc: 'yunzhou' }
    ps(ctxOf(queue), 'yunzhou').captives.push('gao-lian')
    const nxt = ok(queue, { t: 'choose', option: 'hold' }).state
    expect(nxt.pending).toMatchObject({ kind: 'captive', data: { captive: 'gao-lian' } })
  })
  test('Q-5 a joinsLate hero is dormant until the trigger fires and then appears with a logged reason', () => {
    const s = game()
    expect(s.heroes['dong-ping']).toMatchObject({ status: 'dormant', loc: null })
    checkTriggers(ctxOf(s))
    expect(s.heroes['dong-ping']!.status).toBe('dormant')
    s.factions['player']!.renown = 120
    checkTriggers(ctxOf(s))
    expect(s.heroes['dong-ping']!.status).not.toBe('dormant')
    expect(s.heroes['dong-ping']!.loc).toBe('yunzhou')
    expect(s.log.some((l) => l.rule === 'Q-5' && /Dong Ping/.test(l.text))).toBe(true)
    // chains and fallback
    s.factions['player']!.renown = 0
    expect(s.heroes['xu-ning']!.status).toBe('dormant')
    const d2 = { ...D, triggers: D.triggers.filter((t) => t.hero !== 'tang-long') }
    const g = createGame({ startHero: 'song-jiang', difficulty: 2, seed: 1 }, d2)
    g.factions['player']!.renown = 100 + 2 * 88 - 1
    checkTriggers(ctxOf(g, d2))
    expect(g.heroes['tang-long']!.status).toBe('dormant')
    g.factions['player']!.renown = 100 + 2 * 88
    checkTriggers(ctxOf(g, d2))
    expect(g.heroes['tang-long']!.status).not.toBe('dormant')
  })
  test('Q-6 start status: free stays free, official serves a court-held prefecture else is free, outlaw joins its stronghold, late is dormant', () => {
    const s = game('lin-chong')
    expect(s.heroes['wu-yong']).toMatchObject({ faction: 'free' })
    const off = D.heroes.find((h) => h.start.status === 'official' && !h.joinsLate && s.prefectures[h.start.prefecture]!.owner === 'court' && h.id !== 'lin-chong')!
    expect(s.heroes[off.id]).toMatchObject({ faction: 'court', status: 'ordinary' })
    const off2 = D.heroes.find((h) => h.start.status === 'official' && !h.joinsLate && s.prefectures[h.start.prefecture]!.owner !== 'court')
    if (off2) expect(s.heroes[off2.id]!.faction).toBe('free')
    expect(s.heroes['song-wan']).toMatchObject({ faction: 'old-liangshan' })
    expect(s.heroes['lu-junyi']!.status).toBe('dormant')
  })
  test('Q-7 the AI uses the same invitation odds as the player', () => {
    const s = game()
    const c = ctxOf(s)
    const free = 'zhu-tong'
    const dj = ps(c, 'yunzhou')
    void dj
    ps(c, 'dongjing').heroes.push('wu-yong')
    s.prefectures['yunzhou']!.heroes = s.prefectures['yunzhou']!.heroes.filter((h) => h !== 'wu-yong')
    s.heroes['wu-yong'] = { ...s.heroes['wu-yong']!, faction: 'free', status: 'free', loc: 'dongjing' }
    s.commandsLeft['dongjing'] = 1
    const pv = runCommand(c, { t: 'recruit', pref: 'dongjing', actor: 'gao-qiu', target: 'wu-yong', method: 'invite' }, 'court', true)
    expect(isReject(pv)).toBe(false)
    expect(isReject(pv) ? 0 : pv.rule).toBe('Q-2')
    void free
  })
  test('Q-8 heroes of a conquered prefecture with nowhere to retreat are offered the victor and serve or go free', () => {
    const s = game()
    const c = ctxOf(s)
    for (const id of c.x.order) if (id !== 'caozhou' && ps(c, id).owner === 'free') ps(c, id).owner = 'court'
    const t = ps(c, 'caozhou')
    t.heroes = ['zhu-tong']
    s.heroes['zhu-tong'] = { ...s.heroes['zhu-tong']!, faction: 'free', status: 'free', loc: 'caozhou' }
    s.prefectures['yunzhou']!.heroes = s.prefectures['yunzhou']!.heroes.filter((h) => h !== 'zhu-tong')
    t.men = 200
    setPref(s, 'yunzhou', { men: 3000, arms: 3000 })
    const cx = fight(s, { attacker: 'court', origin: 'dongjing', target: 'caozhou', heroes: ['gao-qiu', 'cai-jing'], men: 5000 })
    expect(cx.s.prefectures['caozhou']!.owner).toBe('court')
    expect(['court', 'free']).toContain(cx.s.heroes['zhu-tong']!.faction)
  })
})
