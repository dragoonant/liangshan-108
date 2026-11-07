import { describe, expect, test } from 'vitest'
import { query, step, legalActions } from '../../src/engine'
import type { Action } from '../../src/engine'
import { graftOf, prefGraft, hs, ps } from '../../src/engine/ctx'
import { host, musterCourt, maybeAnnounce } from '../../src/engine/strategic/court'
import { openLinks } from '../../src/engine/battle/core'
import { game, ctxOf, ok, endOf, setPref, settle, D } from './helpers'

describe('G court', () => {
  test('G-1 the court holds the capital and 12 more prefectures, governed by court officials', () => {
    const s = game('hu-sanniang')
    const court = Object.entries(s.prefectures).filter(([, p]) => p.owner === 'court').map(([k]) => k)
    expect(court).toContain('dongjing')
    expect(court.length).toBe(13)
    expect(s.prefectures['dongjing']!.governor).toBe('gao-qiu')
  })
  test('G-2 graft = clamp(10, 95, 95 - 9 righteousness - 2 compassion); court support starts at 70 - graft/2', () => {
    const c = ctxOf(game())
    expect(graftOf(c, 'gao-qiu')).toBe(84)
    for (const h of D.court) expect(graftOf(c, h.id)).toBe(Math.max(10, Math.min(95, 95 - 9 * h.virtues.righteousness - 2 * h.virtues.compassion)))
    expect(c.s.prefectures['dongjing']!.support).toBe(70 - Math.floor(prefGraft(c, 'dongjing') / 2))
  })
  test('G-3 muster: each court prefecture adds pop/2000 men and arms up to pop/30', () => {
    const s = game()
    setPref(s, 'daming', { men: 100, arms: 100 })
    const pop = s.prefectures['daming']!.pop
    musterCourt(ctxOf(s))
    expect(s.prefectures['daming']!.men).toBe(100 + Math.floor(pop / 2000))
    expect(s.prefectures['daming']!.arms).toBe(100 + Math.floor(pop / 2000))
    setPref(s, 'daming', { men: Math.floor(pop / 30) })
    musterCourt(ctxOf(s))
    expect(s.prefectures['daming']!.men).toBe(Math.floor(pop / 30))
  })
  test('G-4 host(t) = min(9000, 2000 + 25 t); the capital never holds fewer men than the host', () => {
    expect([host(0), host(84), host(400)]).toEqual([2000, 4100, 9000])
    const s = game()
    s.t = 400
    setPref(s, 'dongjing', { men: 100 })
    musterCourt(ctxOf(s))
    expect(s.prefectures['dongjing']!.men).toBeGreaterThanOrEqual(9000)
  })
  test('G-5 the capital cannot be attacked before the Edict: rejected and never listed; open afterwards', () => {
    const s = game('lin-chong')
    const a: Action = { t: 'attack', pref: 'mengzhou', target: 'dongjing', heroes: ['lin-chong'], men: 100 }
    const r = step(s, a, D)
    expect(!r.ok && r.code).toBe('capital-protected')
    expect(legalActions(s, D).some((x) => x.t === 'attack' && x.target === 'dongjing')).toBe(false)
    s.factions['player']!.edict = 0
    expect(legalActions(s, D).some((x) => x.t === 'attack' && x.target === 'dongjing')).toBe(true)
    expect(query.why(game('lin-chong'), a, D)?.code).toBe('capital-protected')
  })
  test('G-6 a campaign is announced a month ahead, names the staging and objective, then marches', () => {
    let s = game('lin-chong', 2, 4)
    s.factions['court']!.nextCampaign = 0
    s = endOf(s)
    const cp = s.factions['court']!.campaign
    expect(cp).not.toBeNull()
    expect(query.campaign(s, D).text).toMatch(/musters at .* to march on/)
    expect(s.fired).toContain('campaign')
    expect(s.factions['court']!.nextCampaign).toBe(0 + Math.max(3, 10 - Math.floor(10 / 100)))
    const target = cp!.target
    expect(['player', ...Object.keys(s.factions)]).toContain(target)
    // the following month it marches
    s.factions['court']!.campaign = { ...cp!, announcedT: s.t - 1 }
    const r = step(s, { t: 'endPhase' }, D)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.events.some((e) => e.k === 'campaignMarch' || e.k === 'campaignCancelled')).toBe(true)
    const cx = ctxOf(game())
    maybeAnnounce(cx)
    expect(cx.s.factions['court']!.campaign).toBeNull()
  })
  test('G-7 court heroes not governing stay in reserve at the capital', () => {
    const s = game()
    for (const h of ['cai-jing', 'tong-guan', 'yang-jian', 'gao-yanei', 'lu-qian', 'dong-chao']) expect(hs(ctxOf(s), h).loc).toBe('dongjing')
    expect(ps(ctxOf(s), 'dongjing').governor).toBe('gao-qiu')
  })
  test('G-8 refuge links are open until their far end is the player\'s, then cut', () => {
    const s = game()
    const c = ctxOf(s)
    expect(openLinks(c, 'dongjing')).toHaveLength(5)
    s.prefectures['mengzhou']!.owner = 'player'
    expect(openLinks(c, 'dongjing')).toHaveLength(4)
    const r = query.escapeRoutes(s, D)
    expect(r.links.filter((l) => l.state === 'cut')).toEqual([{ to: 'mengzhou', state: 'cut' }])
    void ok; void settle
  })
})
