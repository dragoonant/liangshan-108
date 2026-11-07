import { describe, expect, test } from 'vitest'
import { createGame, step, legalActions, replay, view } from '../../src/engine'
import type { Action } from '../../src/engine'
import { decideStrategic, aiBattleAction, perceive, greedyAction } from '../../src/ai/greedy'
import { legalFor, runCommand, isReject } from '../../src/engine/strategic/commands'
import { finishBattle } from '../../src/engine/battle/resolve'
import { startBattle } from '../../src/engine/battle/setup'
import { ps, hs } from '../../src/engine/ctx'
import { game, ctxOf, mkUnit, plainBattle, setPref, ok, D } from './helpers'

const court = (s = game()) => { const c = ctxOf(s); return { s, c } }

describe('A artificial intelligence', () => {
  test('A-1 the AI sees foreign numbers only in 10% bands and picks from the legal commands', () => {
    const { s, c } = court()
    const p = perceive(c, 'court', 'yunzhou')
    expect(p.exact).toBe(false)
    expect(perceive(c, 'court', 'dongjing').exact).toBe(true)
    for (const f of ['court', 'zeng-family-fortress', 'zhu-family-village']) for (const id of c.x.order) {
      if (ps(c, id).owner !== f || (s.commandsLeft[id] ?? 0) <= 0) continue
      const a = decideStrategic(c, f, id)
      if (a) expect(isReject(runCommand(c, a, f, true))).toBe(false)
    }
  })
  test('A-2 the AI and the player use the same commands, costs and caps', () => {
    const { s, c } = court()
    s.commandsLeft['dongjing'] = 1
    const mine = runCommand(c, { t: 'train', pref: 'dongjing', actor: 'gao-qiu' }, 'court', true)
    s.heroes['gao-qiu']!.faction = 'player'
    ps(c, 'dongjing').owner = 'player'
    const theirs = runCommand(c, { t: 'train', pref: 'dongjing', actor: 'gao-qiu' }, 'player', true)
    expect(mine).toEqual(theirs)
  })
  test('A-3 greedy order: food first, then support, then threat, rains, bandits, recruiting, training', () => {
    const { s, c } = court()
    const id = 'daming'
    s.commandsLeft[id] = 1
    setPref(s, id, { support: 90, training: 90, gold: 5000, food: 100, men: 1500, bandits: 10, dyke: 90 })
    s.t = 9
    expect(decideStrategic(c, 'court', id)).toMatchObject({ t: 'trade', dir: 'buyFood' })
    setPref(s, id, { food: 100000 })
    setPref(s, id, { support: 30 })
    expect(decideStrategic(c, 'court', id)).toMatchObject({ t: 'relieve' })
    setPref(s, id, { support: 90 })
    s.t = 3
    setPref(s, id, { dyke: 20 })
    expect(decideStrategic(c, 'court', id)).toMatchObject({ t: 'dykes' })
    setPref(s, id, { dyke: 90, bandits: 120 })
    expect(decideStrategic(c, 'court', id)).toMatchObject({ t: 'hunt' })
    setPref(s, id, { bandits: 10, training: 50 })
    ps(c, id).heroes = ps(c, id).heroes.filter((h) => hs(c, h).faction === 'court')
    expect(decideStrategic(c, 'court', id)).toMatchObject({ t: 'train' })
  })
  test('A-4 rivals and the court recruit the free hero with the best odds when it is 40% or more', () => {
    const { s, c } = court()
    const id = 'dongjing'
    s.commandsLeft[id] = 1
    for (const h of ['wu-yong', 'liu-tang']) { s.heroes[h] = { ...s.heroes[h]!, faction: 'free', status: 'free', loc: id }; ps(c, id).heroes.push(h); const q = ps(c, 'yunzhou'); q.heroes = q.heroes.filter((x) => x !== h) }
    setPref(s, id, { support: 90, training: 100, food: 100000, gold: 9999, bandits: 0, dyke: 100 })
    const pcts = ['wu-yong', 'liu-tang'].map((t) => { const r = runCommand(c, { t: 'recruit', pref: id, actor: 'cai-jing', target: t, method: 'invite' }, 'court', true); return isReject(r) ? 0 : (r.pct ?? 0) })
    const a = decideStrategic(c, 'court', id)
    if (Math.max(...pcts) > 39) expect(a).toMatchObject({ t: 'recruit', target: pcts[0]! >= pcts[1]! ? 'wu-yong' : 'liu-tang' })
    else expect(a?.t).not.toBe('recruit')
  })
  test('A-5 a rival attacks the linked prefecture of highest value whose power times k fits, leaving 30% at home', () => {
    const s = game('lin-chong')
    const c = ctxOf(s)
    const r = 'zeng-family-fortress'
    const home = 'zengtou-shi'
    const nb = c.x.adj[home]!.map((n) => n.to)
    s.commandsLeft[home] = 1
    setPref(s, home, { men: 4000, arms: 4000, support: 90, training: 90, food: 100000, gold: 9999, bandits: 0, dyke: 100 })
    for (const n of nb) setPref(s, n, { men: 50, arms: 50 })
    const a = decideStrategic(c, r, home)
    expect(a?.t).toBe('attack')
    if (a?.t === 'attack') { expect(a.men).toBe(2800); expect(nb).toContain(a.target); expect(ps(c, a.target).owner).not.toBe(r) }
    for (const n of nb) setPref(s, n, { men: 90000, arms: 90000 })
    expect(decideStrategic(c, r, home)?.t).not.toBe('attack')
  })
  test('A-6 the court never attacks except by campaign', () => {
    const { s, c } = court()
    for (const id of c.x.order) if (ps(c, id).owner === 'court') { s.commandsLeft[id] = 1; const a = decideStrategic(c, 'court', id); expect(a?.t).not.toBe('attack') }
  })
  test('A-7 Gao Qiu flees along the open link whose far end holds the most court men (ties by id), at most twice', () => {
    const s = game('lin-chong')
    const c = ctxOf(s)
    s.factions['player']!.edict = 0
    setPref(s, 'mengzhou', { men: 3000, arms: 3000 })
    startBattle(c, { attacker: 'player', origin: 'mengzhou', target: 'dongjing', heroes: ['lin-chong'], men: 3000 })
    const b = s.battle!
    b.units.find((u) => u.hero === 'gao-qiu')!.state = 'routed'
    b.result = { winner: 'a', reason: 'gao-qiu' }
    for (const n of ['yingtianfu', 'chenzhou', 'zhangde', 'luoyang']) setPref(s, n, { owner: n === 'zhangde' ? 'court' : 'free', men: n === 'zhangde' ? 9999 : 10 })
    finishBattle(c)
    expect(s.heroes['gao-qiu']!.loc).toBe('zhangde')
    expect(s.heroes['gao-qiu']!.flights).toBe(1)
    expect(s.prefectures['zhangde']!.governor).toBe('gao-qiu')
    expect(s.phase).toBe('strategic')
  })
  test('A-8 a scout in service names the marches the AI intends against you; court campaigns are always announced', () => {
    const s = game('lin-chong')
    const c = ctxOf(s)
    const scout = D.heroes.find((h) => h.skills.includes('scout') && !h.joinsLate)!.id
    s.heroes[scout] = { ...s.heroes[scout]!, faction: 'player', status: 'ordinary', loc: 'mengzhou' }
    ps(c, 'mengzhou').heroes.push(scout)
    // a strong rival neighbour of the player's prefecture
    const nb = c.x.adj['mengzhou']!.map((n) => n.to).find((n) => ps(c, n).owner === 'court')!
    ps(c, nb).owner = 'zeng-family-fortress'
    s.factions['zeng-family-fortress']!.alive = true
    s.heroes['zeng-tu'] = { ...s.heroes['zeng-tu']!, loc: nb }
    ps(c, nb).heroes = ['zeng-tu']
    s.heroes['zeng-tu']!.faction = 'zeng-family-fortress'
    setPref(s, nb, { men: 20000, arms: 20000, support: 90, training: 90, food: 100000, gold: 9999, bandits: 0, dyke: 100 })
    s.commandsLeft[nb] = 1
    const warn = view(s, 'player', D).warnings.filter((w) => w.rule === 'A-8')
    expect(warn.length).toBeGreaterThan(0)
    s.heroes[scout]!.faction = 'free'
    expect(view(s, 'player', D).warnings.some((w) => w.rule === 'A-8')).toBe(false)
    s.factions['court']!.campaign = { staging: 'daming', objective: 'mengzhou', target: 'player', announcedT: 0 }
    expect(view(s, 'player', D).warnings.some((w) => w.rule === 'G-6')).toBe(true)
  })
  test('A-9 battle AI: duel when win% x accept% is 20 or more, charge, volley, strike the weakest neighbour, else advance, retreat when hurt', () => {
    const a = mkUnit({ id: 'a0', hero: 'lin-chong', side: 'a', commander: true, might: 92, vigour: 85, pos: { q: 3, r: 4 } })
    const d = mkUnit({ id: 'd0', hero: 'y', side: 'd', commander: true, might: 60, pos: { q: 4, r: 4 } })
    const s = plainBattle([a, d])
    expect(aiBattleAction(ctxOf(s)).t).toBe('bDuel')
    const weak = mkUnit({ id: 'a0', hero: 'x', side: 'a', commander: true, might: 40, pos: { q: 3, r: 4 } })
    const w = plainBattle([weak, mkUnit({ id: 'd0', hero: 'y', side: 'd', commander: true, men: 80, pos: { q: 4, r: 4 } }), mkUnit({ id: 'd1', hero: 'z', side: 'd', men: 30, pos: { q: 3, r: 3 } })])
    expect(aiBattleAction(ctxOf(w))).toMatchObject({ t: 'bAttack', target: 'd1' })
    const adv = plainBattle([mkUnit({ id: 'a0', hero: 'x', side: 'a', commander: true, might: 40, pos: { q: 0, r: 4 } }), mkUnit({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 9, r: 4 } })])
    const m = aiBattleAction(ctxOf(adv))
    expect(m.t).toBe('bMove')
    const arch = plainBattle([mkUnit({ id: 'a0', hero: 'x', side: 'a', commander: true, kind: 'archers', might: 40, pos: { q: 2, r: 4 } }), mkUnit({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 4, r: 4 } })])
    expect(aiBattleAction(ctxOf(arch)).t).toBe('bVolley')
    const cmd = mkUnit({ id: 'a0', hero: 'x', side: 'a', commander: true, pos: { q: 0, r: 4 } })
    const hurt = mkUnit({ id: 'a1', hero: 'z', side: 'a', men: 10, maxMen: 100, pos: { q: 4, r: 4 } })
    const r = plainBattle([cmd, hurt, mkUnit({ id: 'd0', hero: 'y', side: 'd', commander: true, pos: { q: 10, r: 8 } })])
    cmd.acted = true
    const back = aiBattleAction(ctxOf(r))
    expect(back).toMatchObject({ t: 'bMove', unit: 'a1' })
  })
  test('A-10 everything the AI does goes through step, so replay matches the live game', () => {
    const setup = { startHero: 'wu-song', difficulty: 2 as const, seed: 11 }
    let s = createGame(setup)
    const log: Action[] = []
    for (let i = 0; i < 120 && s.phase !== 'result'; i++) { const a = greedyAction(s); const r = step(s, a); if (!r.ok) break; log.push(a); s = r.state }
    expect(JSON.stringify(replay(setup, log))).toBe(JSON.stringify(s))
    void ok; void hs; void legalFor; void legalActions
  })
})
