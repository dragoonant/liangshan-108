import { describe, expect, test } from 'vitest'
import { step, legalActions } from '../../src/engine'
import { checkChieftain } from '../../src/engine/strategic/result'
import { finishBattle } from '../../src/engine/battle/resolve'
import { applyBattleAction } from '../../src/engine/battle/actions'
import { startBattle } from '../../src/engine/battle/setup'
import { game, ctxOf, mkUnit, plainBattle, endOf, setPref, D } from './helpers'

function gaoWin(sworn: number) {
  const s = plainBattle([
    mkUnit({ id: 'a0', hero: 'lin-chong', side: 'a', commander: true, might: 100, men: 900, maxMen: 900, pos: { q: 3, r: 4 } }),
    mkUnit({ id: 'd0', hero: 'gao-qiu', side: 'd', commander: true, men: 5, maxMen: 500, pos: { q: 4, r: 4 } }),
  ])
  s.heroes['lin-chong'] = { ...s.heroes['lin-chong']!, faction: 'player', status: 'ordinary', loc: 'yunzhou' }
  s.prefectures['yunzhou']!.heroes.push('lin-chong')
  const ids = Object.keys(s.heroes).filter((h) => D.heroes.some((x) => x.id === h) && s.heroes[h]!.status === 'free').slice(0, sworn)
  for (const h of ids) { s.heroes[h]!.faction = 'player'; s.heroes[h]!.status = 'sworn' }
  const c = ctxOf(s)
  applyBattleAction(c, { t: 'bAttack', unit: 'a0', target: 'd0' })
  finishBattle(c)
  return s
}

describe('X victory and defeat', () => {
  test('X-1 capturing Gao Qiu is victory; the ending tier follows the sworn brothers and states date, Renown, heroes and prefectures', () => {
    const none = gaoWin(0)
    expect(none.phase).toBe('result')
    expect(none.result).toMatchObject({ outcome: 'victory', reason: 'Gao Qiu is captured' })
    expect(none.result!.ending).toMatch(/^A Bitter Victory: Jan 1101, Renown \d+, \d+ heroes gathered, \d+ prefectures held$/)
    expect(gaoWin(10).result!.ending).toMatch(/^A Few Good Men/)
    expect(gaoWin(36).result!.ending).toMatch(/^The Heavenly Thirty-Six/)
    expect(legalActions(none, D)).toEqual([])
  })
  test('X-1 the chase: a third flight, or every link cut, ends in capture and victory', () => {
    for (const mode of ['third', 'cut'] as const) {
      const s = game('lin-chong')
      const c = ctxOf(s)
      s.factions['player']!.edict = 0
      setPref(s, 'mengzhou', { men: 3000, arms: 3000 })
      startBattle(c, { attacker: 'player', origin: 'mengzhou', target: 'dongjing', heroes: ['lin-chong'], men: 3000 })
      s.battle!.units.find((u) => u.hero === 'gao-qiu')!.state = 'routed'
      s.battle!.result = { winner: 'a', reason: 'gao-qiu' }
      if (mode === 'third') s.heroes['gao-qiu']!.flights = 2
      else for (const n of ['yingtianfu', 'mengzhou', 'chenzhou', 'zhangde', 'luoyang']) s.prefectures[n]!.owner = 'player'
      finishBattle(c)
      expect(s.phase, mode).toBe('result')
      expect(s.result!.outcome).toBe('victory')
    }
  })
  test('X-2 after the Edict the capital can be taken in any month before the deadline', () => {
    const s = game('lin-chong')
    s.factions['player']!.edict = 0
    s.t = 100
    expect(legalActions(s, D).some((a) => a.t === 'attack' && a.target === 'dongjing')).toBe(true)
  })
  test('X-3 a captured chieftain is succeeded by the lowest-rank sworn brother with Renown -20%; with no brother the game is lost', () => {
    const s = game()
    s.heroes['wu-yong']!.status = 'sworn'
    s.heroes['liu-tang']!.status = 'sworn'
    s.factions['player']!.renown = 100
    s.heroes['song-jiang']!.status = 'captive'
    checkChieftain(ctxOf(s))
    expect(s.factions['player']!.chieftain).toBe('wu-yong')
    expect(s.heroes['wu-yong']!.status).toBe('chieftain')
    expect(s.factions['player']!.renown).toBe(80)
    expect(s.phase).toBe('strategic')
    const t = game()
    t.heroes['song-jiang']!.status = 'captive'
    checkChieftain(ctxOf(t))
    expect(t.phase).toBe('result')
    expect(t.result!.outcome).toBe('defeat')
  })
  test('X-4 defeat when the deadline month passes, or when you hold no prefecture', () => {
    const s = game('song-jiang', 4)
    s.t = 83
    setPref(s, 'yunzhou', { food: 100000, gold: 100000 })
    const e = endOf(s)
    expect(e.result).toMatchObject({ outcome: 'defeat', reason: "The court's patience ends" })
    const t = game()
    t.prefectures['yunzhou']!.owner = 'free'
    const f = endOf(t)
    expect(f.result?.reason).toBe('You hold no prefecture')
  })
  test('X-5 a finished game accepts no more actions (the autosave contract is in save.test.ts; clearing the save is client work)', () => {
    const s = gaoWin(0)
    expect(step(s, { t: 'endPhase' }, D)).toMatchObject({ ok: false, code: 'game-over' })
    void startBattle
  })
})
