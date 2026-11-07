import { describe, expect, test } from 'vitest'
import { clientQuery, createGame, START_HEROES, query, step, legalActions } from '../../src/engine'

describe('client queries (M3)', () => {
  test('S-1 startInfo: six starts with numbers, neighbours and hints', () => {
    for (const h of START_HEROES) {
      const i = clientQuery.startInfo(h)!
      expect(i.gold).toBeGreaterThan(0)
      expect(i.neighbours.length).toBeGreaterThan(0)
      expect(i.prefectureName.length).toBeGreaterThan(0)
    }
    expect(clientQuery.startInfo('nobody')).toBeNull()
  })
  test('S-3 S-5 difficulties: deadline months and Edict-by date per difficulty', () => {
    const d = clientQuery.difficulties()
    expect(d.map((x) => x.months)).toEqual([180, 144, 108, 84])
    expect(d[1]!.lastLabel).toBe('Dec 1112')
    expect(d[1]!.edictByLabel).toBe('Jul 1111')
  })
  test('R-4 ledger: five columns, totals equal the entries', () => {
    let s = createGame({ startHero: 'song-jiang', difficulty: 2, seed: 3 })
    for (let i = 0; i < 6; i++) {
      const hunt = legalActions(s).find((a) => a.t === 'relieve') ?? { t: 'endPhase' as const }
      const r = step(s, hunt)
      if (r.ok) s = r.state
      const e = step(s, { t: 'endPhase' })
      if (e.ok) s = e.state
    }
    const cols = clientQuery.ledger(s)
    expect(cols.map((c) => c.column)).toEqual(['justice', 'relief', 'beasts', 'battles', 'heroes'])
    for (const c of cols) expect(c.total).toBe(c.entries.reduce((n, e) => n + e.amount, 0))
    expect(query.renown(s).renown).toBeGreaterThanOrEqual(0)
  })
  test('D19 triggerText: every late joiner has a plain-words trigger', () => {
    expect(clientQuery.triggerText('tang-long')).toMatch(/Renown/)
    expect(clientQuery.triggerText('song-jiang')).toBeNull()
  })
  test('W-6 terrain: forest costs infantry 2', () => {
    expect(clientQuery.terrain('forest').move.infantry).toBe(2)
  })
  test('V-6 pendingInfo: the tiger decision names each hunter with his odds', () => {
    const s = createGame({ startHero: 'wu-song', difficulty: 2, seed: 7 })
    const p = clientQuery.pendingInfo(s)!
    expect(p.kind).toBe('tiger')
    expect(p.ask).toMatch(/Decide who hunts/)
    const hunter = p.options.find((o) => o.id === 'wu-song')!
    expect(hunter.pct).toBeGreaterThan(0)
    expect(p.options.find((o) => o.id === 'ignore')!.pct).toBeUndefined()
    expect(clientQuery.pendingInfo(createGame({ startHero: 'song-jiang', difficulty: 2, seed: 7 }))).toBeNull()
  })
})
