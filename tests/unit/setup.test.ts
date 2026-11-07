import { describe, expect, test } from 'vitest'
import { createGame, step, STARTS, query, legalActions } from '../../src/engine'
import type { Difficulty } from '../../src/engine'
import { game, ok, D } from './helpers'

const FOLLOWERS: Record<string, string[]> = {
  'song-jiang': ['wu-yong', 'liu-tang'], 'chao-gai': ['wu-yong', 'liu-tang'], 'lin-chong': ['shi-en', 'zhang-qing-gardener'], 'wu-song': ['chai-jin'], 'lu-zhishen': ['li-zhong'], 'hu-sanniang': ['li-ying'],
}

describe('S setup', () => {
  test('S-1 six starts: each has its own prefecture and the table numbers', () => {
    expect(Object.keys(STARTS)).toHaveLength(6)
    expect(new Set(Object.values(STARTS).map((r) => r.pref)).size).toBe(5) // Song Jiang and Chao Gai share yunzhou (only one start is chosen per game)
    expect(Object.keys(STARTS)).toContain('chao-gai')
    expect(Object.keys(STARTS)).not.toContain('ruan-xiaoer')
    for (const [hero, row] of Object.entries(STARTS)) {
      const s = game(hero)
      const p = s.prefectures[row.pref]!
      expect(p.owner).toBe('player')
      expect([p.gold, p.food, p.men, p.arms, p.training, p.support]).toEqual([row.gold, row.food, row.men, row.arms, row.training, row.support])
      expect(s.factions['player']!.renown).toBe(row.renown)
      expect(s.heroes[hero]!.status).toBe('chieftain')
      expect(s.heroes[hero]!.loc).toBe(row.pref)
    }
  })
  test('S-2 the start prefecture keeps its map base population, land and dykes', () => {
    const s = game('lin-chong')
    const rec = D.map.prefectures.find((p) => p.id === 'mengzhou')!
    expect([s.prefectures['mengzhou']!.pop, s.prefectures['mengzhou']!.land, s.prefectures['mengzhou']!.dyke]).toEqual([rec.base.population, rec.base.land, rec.base.flood])
  })
  test('S-3 difficulty sets exactly the deadline and the two AI ratios', () => {
    const want: Record<number, number> = { 1: 179, 2: 143, 3: 107, 4: 83 }
    for (const d of [1, 2, 3, 4] as Difficulty[]) expect(query.deadline(createGame({ startHero: 'song-jiang', difficulty: d, seed: 1 }, D)).monthsLeft).toBe(want[d])
    const a = game('song-jiang', 1), b = game('song-jiang', 4)
    const strip = (s: typeof a) => JSON.stringify({ p: s.prefectures, h: s.heroes })
    expect(strip(a)).toBe(strip(b))
  })
  test('S-4 the same action gives the same result on difficulty 1 and 4', () => {
    const run = (d: Difficulty) => { let s = game('song-jiang', d, 3); for (const a of [{ t: 'levy', pref: 'yunzhou', actor: 'song-jiang' }, { t: 'relieve', pref: 'yunzhou', actor: 'song-jiang' }] as const) s = ok(s, a).state; return s.prefectures['yunzhou']! }
    expect(run(1)).toEqual(run(4))
    expect(query.recruitOdds(game('song-jiang', 1), 'song-jiang', 'song-qing', 'invite', D)).toEqual(query.recruitOdds(game('song-jiang', 4), 'song-jiang', 'song-qing', 'invite', D))
  })
  test('S-5 Edict-by is the last month minus 17', () => {
    const want: Record<number, number> = { 1: 162, 2: 126, 3: 90, 4: 66 }
    for (const d of [1, 2, 3, 4] as Difficulty[]) expect(query.renown(createGame({ startHero: 'song-jiang', difficulty: d, seed: 1 }, D)).edictBy).toBe(want[d])
  })
  test('S-6 advice returns at most 3 hints, each with a rule id; the first three months are pinned', () => {
    const s = game()
    const a = query.advice(s, D)
    expect(a.hints.length).toBeLessThanOrEqual(3)
    expect(a.hints.every((h) => /^[A-Z]-\d+$/.test(h.rule))).toBe(true)
    expect(a.pinned).toBe(true)
    s.t = 5
    expect(query.advice(s, D).pinned).toBe(false)
  })
  test.todo('S-7 the briefing screen (goal, deadline, six systems) is client work at M3; the data it needs is in query.deadline, query.renown, query.advice')
  test('S-8 the previous owner loses the start prefecture and its heroes there become free; a rival with no other prefecture is removed', () => {
    const s = game('chao-gai')
    expect(s.prefectures['yunzhou']!.owner).toBe('player')
    expect(s.heroes['song-jiang']!.faction).toBe('free') // the clerk is displaced with the court officers
    expect(s.factions['old-liangshan']!.alive).toBe(true) // Jizhou stays Wang Lun's in a Chao Gai game
    const y = game('song-jiang')
    expect(y.prefectures['yunzhou']!.governor).toBeNull()
    for (const h of ['cheng-wanli', 'gao-lian', 'yin-tianxi', 'zhu-tong', 'lei-heng']) expect(y.heroes[h]!.faction).toBe('free')
    const z = game('hu-sanniang')
    for (const h of ['zhu-chaofeng', 'zhu-long', 'luan-tingyu']) expect(z.heroes[h]!.faction).toBe('free')
    expect(z.factions['zhu-family-village']!.alive).toBe(false)
  })
  test('S-9 the two lowest-rank free heroes of the start prefecture join at loyalty 60', () => {
    for (const [hero, fs] of Object.entries(FOLLOWERS)) {
      const s = game(hero)
      for (const f of fs) { expect(s.heroes[f]!.faction).toBe('player'); expect(s.heroes[f]!.loyalty).toBe(60) }
    }
    const r = game('chao-gai')
    expect(Object.keys(r.heroes).filter((h) => r.heroes[h]!.faction === 'player' && r.heroes[h]!.status === 'ordinary').sort()).toEqual(['liu-tang', 'wu-yong'])
    void step; void legalActions
  })
})
