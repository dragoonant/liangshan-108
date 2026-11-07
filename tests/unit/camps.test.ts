import { describe, expect, test } from 'vitest'
import { query, step } from '../../src/engine'
import { hs, ps, compat, abil } from '../../src/engine/ctx'
import { decideStrategic } from '../../src/ai/greedy'
import { allyOdds, joinOdds, followOdds, growCamps, campMonthEnd, allied, ALLY_COST } from '../../src/engine/strategic/camps'
import { captiveChoice } from '../../src/engine/strategic/recruit'
import { game, ctxOf, ok, fight, endOf, D } from './helpers'

describe('K camps', () => {
  test('K-1 eight camps own their strongholds and seat their outlaw heroes; Yinma River has no prefecture', () => {
    const s = game('wu-song')
    expect(D.camps).toHaveLength(8)
    for (const k of D.camps) {
      expect(s.prefectures[k.stronghold]!.owner).toBe(k.id)
      expect(s.factions[k.id]!.alive).toBe(true)
      for (const m of k.members) expect(s.heroes[m]).toMatchObject({ faction: k.id, status: 'ordinary', loc: k.stronghold })
    }
    expect(s.heroes['deng-long']!.loc).toBe('erlong-shan')
    expect(D.camps.map((k) => k.id).join()).not.toMatch(/yinma/)
    for (const h of ['li-zhong', 'jiang-jing', 'pei-xuan', 'meng-kang', 'deng-fei']) expect(s.heroes[h]!.faction).not.toMatch(/band/)
  })
  test('K-2 a camp gets 1 command, attacks only from its stronghold and never an ally', () => {
    const s = game('wu-song')
    const c = ctxOf(s)
    expect(s.commandsLeft['shaohua-shan']).toBe(1)
    // a camp holding a second prefecture does not launch attacks from it
    const hz = ps(c, 'huazhou'); hz.owner = 'shaohua-band'; hz.men = 3000; hz.arms = 3000; hz.heroes = []
    s.heroes['chen-da']!.loc = null; ps(c, 'shaohua-shan').heroes = ps(c, 'shaohua-shan').heroes.filter((h) => h !== 'chen-da'); hz.heroes.push('chen-da'); s.heroes['chen-da']!.loc = 'huazhou'
    s.commandsLeft['huazhou'] = 1
    for (const n of c.x.adj['huazhou']!) { const q = ps(c, n.to); if (q.owner === 'free') { q.men = 5; q.arms = 0 } }
    const act = decideStrategic(c, 'shaohua-band', 'huazhou')
    expect(act === null || act.t !== 'attack').toBe(true)
    // from the stronghold with a weak free neighbour it attacks
    const st = ps(c, 'shaohua-shan'); st.men = 400; st.arms = 400; hz.owner = 'free'; hz.men = 5; hz.arms = 0; hz.heroes = []
    s.heroes['chen-da']!.loc = 'shaohua-shan'; st.heroes.push('chen-da')
    expect(decideStrategic(c, 'shaohua-band', 'shaohua-shan')?.t).toBe('attack')
    // but never an ally: make the neighbour the player's and ally the camp
    hz.owner = 'player'; s.factions['shaohua-band']!.allyUntil = s.t + 10
    const a2 = decideStrategic(c, 'shaohua-band', 'shaohua-shan')
    expect(a2 === null || a2.t !== 'attack').toBe(true)
  })
  test('K-3 slow growth: 5 men and arms per camp hero (cap pop/20), 15 gold, 30 food a month', () => {
    const s = game('wu-song')
    const c = ctxOf(s)
    const p = ps(c, 'shaohua-shan')
    const b = { men: p.men, arms: p.arms, gold: p.gold, food: p.food }
    growCamps(c)
    expect([p.men, p.arms, p.gold, p.food]).toEqual([b.men + 15, b.arms + 15, b.gold + 15, b.food + 30])
    p.men = Math.floor(p.pop / 20) - 2
    growCamps(c)
    expect(p.men).toBe(Math.floor(p.pop / 20))
  })
  test('K-4 a camp whose last prefecture falls is removed and its heroes follow W-27', () => {
    const s = game('wu-song')
    const c = ctxOf(s)
    s.pending = null
    const hz = ps(c, 'huazhou'); hz.owner = 'player'; hz.men = 5000; hz.arms = 5000
    const heroes = ['wu-song', 'chai-jin']
    for (const h of heroes) { s.heroes[h]!.faction = 'player'; c.s.heroes[h]!.loc = null }
    for (const h of heroes) { ps(c, 'cangzhou').heroes = ps(c, 'cangzhou').heroes.filter((x) => x !== h); hz.heroes.push(h); s.heroes[h]!.loc = 'huazhou' }
    fight(s, { attacker: 'player', origin: 'huazhou', target: 'shaohua-shan', heroes: heroes, men: 4000, imperial: false })
    expect(ps(c, 'shaohua-shan').owner).toBe('player')
    expect(s.factions['shaohua-band']!.alive).toBe(false)
  })
  test('K-5 alliance: odds shown, 200 gold, 24 months, the ally cannot be attacked', () => {
    const s = game('wu-song', 2, 3, [0])
    const c = ctxOf(s)
    s.pending = null // the scripted tiger
    // wu-song at cangzhou is not next to a camp: move the base to huazhou, which borders shaohua-shan
    const hz = ps(c, 'huazhou'); hz.owner = 'player'; hz.gold = 1000; hz.heroes = []; hz.men = 300
    s.heroes['wu-song']!.loc = null; ps(c, 'cangzhou').heroes = ps(c, 'cangzhou').heroes.filter((x) => x !== 'wu-song'); hz.heroes.push('wu-song'); s.heroes['wu-song']!.loc = 'huazhou'
    s.commandsLeft['huazhou'] = 2
    const P = allyOdds(c, 'shaohua-band', 'wu-song')
    const chief = D.camps.find((k) => k.id === 'shaohua-band')!.chief
    const want = 15 + Math.min(30, Math.floor(s.factions['player']!.renown / 10)) + Math.floor(compat(c, 'wu-song', chief) / 3) + Math.floor((abil(c, 'wu-song').cunning - 50) / 5)
    expect(P).toBe(Math.max(5, Math.min(90, want)))
    expect(query.campOdds(s, 'shaohua-band', 'wu-song')!.ally).toBe(P)
    const pv = query.preview(s, { t: 'ally', pref: 'huazhou', actor: 'wu-song', camp: 'shaohua-band' })
    expect(pv).toMatchObject({ rule: 'K-5', gold: ALLY_COST, pct: P })
    const r = ok(s, { t: 'ally', pref: 'huazhou', actor: 'wu-song', camp: 'shaohua-band' }).state
    expect(r.prefectures['huazhou']!.gold).toBe(1000 - ALLY_COST)
    expect(r.factions['shaohua-band']!.allyUntil).toBe(24)
    expect(allied(ctxOf(r), 'shaohua-band')).toBe(true)
    expect(step(r, { t: 'attack', pref: 'huazhou', target: 'shaohua-shan', heroes: ['wu-song'], men: 100 }, D)).toMatchObject({ ok: false, code: 'illegal-target' })
    const s2 = structuredClone(s); s2.rng.forced = [99]
    const refused = ok(s2, { t: 'ally', pref: 'huazhou', actor: 'wu-song', camp: 'shaohua-band' }).state
    expect(refused.factions['shaohua-band']!.allyUntil).toBe(0)
    expect(refused.prefectures['huazhou']!.gold).toBe(1000 - ALLY_COST)
    expect(step(s, { t: 'ally', pref: 'cangzhou', actor: 'wu-song', camp: 'shaohua-band' }, D).ok).toBe(false) // not bordering
    const far = endOf({ ...r, t: 24 } as typeof s)
    expect(allied(ctxOf(far), 'shaohua-band')).toBe(false) // expired
  })
  test('K-6 an allied camp (3+ months, Renown 60+) joins together at the shown odds', () => {
    const s = game('wu-song', 2, 3, [0])
    const c = ctxOf(s)
    s.t = 10
    s.factions['shaohua-band']!.allyUntil = 30; s.factions['shaohua-band']!.allySince = 5
    s.factions['player']!.renown = 59
    campMonthEnd(c)
    expect(s.factions['shaohua-band']!.alive).toBe(true) // below JOIN_RENOWN
    s.factions['player']!.renown = 100
    const p = joinOdds(c, 'shaohua-band')
    expect(p).toBe(Math.max(5, Math.min(60, 5 + 10 + Math.floor(compat(c, 'wu-song', 'zhu-wu') / 4))))
    s.factions['shaohua-band']!.allySince = 9
    campMonthEnd(c)
    expect(s.factions['shaohua-band']!.alive).toBe(true) // only one month
    s.factions['shaohua-band']!.allySince = 5
    campMonthEnd(c)
    expect(s.factions['shaohua-band']!.alive).toBe(false)
    expect(ps(c, 'shaohua-shan').owner).toBe('player')
    for (const h of ['zhu-wu', 'chen-da', 'yang-chun']) expect(hs(c, h)).toMatchObject({ faction: 'player', status: 'ordinary' })
  })
  test('K-7 a persuaded chief brings his heroes, each at the shown odds', () => {
    const s = game('wu-song', 2, 3, [0, 0, 0])
    const c = ctxOf(s)
    const hz = ps(c, 'huazhou'); hz.owner = 'player'
    const chief = 'zhu-wu'
    const h = hs(c, chief)
    ps(c, 'shaohua-shan').heroes = ps(c, 'shaohua-shan').heroes.filter((x) => x !== chief)
    h.status = 'captive'; h.faction = 'player'; h.heldBy = 'player'; h.loc = 'huazhou'; hz.captives.push(chief)
    expect(query.followOdds(s, 'chen-da')).toBe(followOdds(c, 'chen-da'))
    captiveChoice(c, chief, 'persuade', 'wu-song', 'huazhou')
    expect(hs(c, chief).faction).toBe('player')
    for (const m of ['chen-da', 'yang-chun']) { expect(hs(c, m)).toMatchObject({ faction: 'player', loc: 'huazhou' }) }
  })
  test('K-8 query.camps lists every camp with chief, heroes, men, alliance and the three odds', () => {
    const s = game('wu-song')
    const list = query.camps(s)
    expect(list).toHaveLength(8)
    const k = list.find((x) => x.id === 'qingfeng-band')!
    expect(k).toMatchObject({ chief: 'yan-shun', allied: false, stronghold: 'qingfeng-shan' })
    expect(k.heroes.sort()).toEqual(['wang-ying', 'yan-shun', 'zheng-tianshou'])
    expect(typeof k.allyOdds).toBe('number'); expect(typeof k.joinOdds).toBe('number')
    expect(Object.keys(k.followOdds).sort()).toEqual(['wang-ying', 'zheng-tianshou'])
  })
})
