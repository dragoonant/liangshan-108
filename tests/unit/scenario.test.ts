import { describe, expect, test } from 'vitest'
import { createGame } from '../../src/engine'
import { checkInvariants } from '../../src/engine'
import { D } from './helpers'

describe('11-scenario facts (flag any drift between the data and the spec)', () => {
  const own = (hero: string) => { const s = createGame({ startHero: hero, difficulty: 2, seed: 1 }, D); return s }
  test('scenario 2: before the player takes a start, 13 prefectures are court, 3 rival, 32 free', () => {
    // use a start whose prefecture is free (Wu Song at cangzhou): then court stays 13, rival 3, free 31 + the player's 1
    const s = own('wu-song')
    const count = (o: string) => Object.values(s.prefectures).filter((p) => p.owner === o).length
    expect([count('court'), count('zhu-family-village'), count('zeng-family-fortress'), count('old-liangshan'), count('free'), count('player')]).toEqual([13, 1, 1, 1, 31, 1])
  })
  test('scenario 3: court governors, the capital reserve and followers', () => {
    const s = own('wu-song')
    const gov = (p: string) => s.prefectures[p]!.governor
    expect([gov('dongjing'), gov('yunzhou'), gov('daming'), gov('jiangzhou'), gov('qingfeng-zhai'), gov('qingzhou'), gov('mengzhou')]).toEqual(['gao-qiu', 'gao-lian', 'liang-shijie', 'cai-jiu', 'liu-gao', 'murong-yanda', 'zhang-dutian'])
    expect(s.heroes['chai-jin']!.faction).toBe('player')
    expect(s.heroes['gao-lian']!.loc).toBe('yunzhou')
  })
  test('scenario 4-6: map facts, starting numbers, the capital begins with 7,222 men, invariants hold for every start', () => {
    const links = D.map.links
    expect([D.map.prefectures.length, links.length, links.filter((l) => l.kind === 'road').length, links.filter((l) => l.kind === 'mountain-pass').length, links.filter((l) => l.kind === 'river').length, links.filter((l) => l.kind === 'marsh-water').length]).toEqual([48, 73, 45, 16, 10, 2])
    for (const h of ['song-jiang', 'ruan-xiaoer', 'lin-chong', 'wu-song', 'lu-zhishen', 'hu-sanniang']) {
      const s = createGame({ startHero: h, difficulty: 2, seed: 1 }, D)
      expect(checkInvariants(s, D)).toEqual([])
      expect(s.prefectures['dongjing']!.men).toBe(7222)
    }
  })
})
