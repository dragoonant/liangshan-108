import { describe, expect, test } from 'vitest'
import { query, step, view } from '../../src/engine'
import { combatKind, compat, rank, sortHeroes } from '../../src/engine/ctx'
import { huntOdds, commandCap } from '../../src/engine/strategic/commands'
import { restingLevel, joinHero } from '../../src/engine/strategic/heroes'
import { joinLoyalty } from '../../src/engine/strategic/recruit'
import { duelLegal } from '../../src/engine/battle/actions'
import { game, ctxOf, ok, endOf, setPref, playGreedy, D } from './helpers'

const A = (t: string, extra: object = {}) => ({ t, pref: 'yunzhou', actor: 'song-jiang', ...extra }) as never

describe('H heroes and loyalty', () => {
  test('H-1 every hero has four abilities (1-100), three virtues (1-10) and at most 3 skills', () => {
    for (const h of D.heroes) {
      expect(Object.values(h.abilities).every((v) => v >= 1 && v <= 100)).toBe(true)
      expect(Object.values(h.virtues).every((v) => v >= 1 && v <= 10)).toBe(true)
      expect(h.skills.length).toBeLessThanOrEqual(3)
    }
  })
  test('H-2 might drives hunt power, capture odds and duel power', () => {
    const c = ctxOf(game('wu-song', 2, 3))
    const strong = huntOdds(c, 'cangzhou', 'wu-song', [], 0)
    c.s.heroes['chai-jin']!.faction = 'player'
    expect(strong).toBeGreaterThanOrEqual(huntOdds(c, 'cangzhou', 'chai-jin', [], 0))
  })
  test('H-3 compatibility uses all three virtues', () => {
    const c = ctxOf(game())
    const a = 'song-jiang', b = 'wu-yong'
    const va = D.heroes.find((h) => h.id === a)!.virtues, vb = D.heroes.find((h) => h.id === b)!.virtues
    const d = Math.abs(va.righteousness - vb.righteousness) + Math.abs(va.compassion - vb.compassion) + Math.abs(va.daring - vb.daring)
    expect(compat(c, a, b)).toBe(100 - 6 * d)
  })
  test.todo('H-4 hero cards (ability bars, virtue pips, skill icons, loyalty) are client work at M3; the data comes from view().heroes and query.loyalty')
  test('H-5 gating: duel might 50/70, expose and jailbreak cunning 60, tigers might 75 or beast-slayer, unit size 15 per command point', () => {
    const s = game('wu-song', 2, 3)
    expect(query.preview(s, { t: 'spy', pref: 'cangzhou', actor: 'wu-song', target: 'cangzhou', op: 'jailbreak' }, D)).toHaveProperty('code')
    const weak = { might: 49, side: 'a', hero: 'x', state: 'active', dueled: false, pos: { q: 0, r: 0 } } as never
    const tgt = { state: 'active', dueled: false, pos: { q: 1, r: 0 }, hidden: false, side: 'd' } as never
    expect(duelLegal({ units: [] } as never, weak, tgt, 'honour')).toMatch(/might 50/)
    expect(duelLegal({ units: [] } as never, { ...(weak as object), might: 60 } as never, tgt, 'capture')).toMatch(/might 70/)
    expect(Object.keys(s.heroes)).toContain('wu-song')
  })
  test('H-6 combat kind follows skills: horseman, archer, marine, else infantry', () => {
    const c = ctxOf(game())
    const pick = (skill: string) => D.heroes.find((h) => h.skills.includes(skill as never) && !h.skills.includes('horseman' as never))!.id
    expect(combatKind(c, D.heroes.find((h) => h.skills.includes('horseman'))!.id)).toBe('cavalry')
    expect(combatKind(c, D.heroes.find((h) => h.skills.includes('archer') && !h.skills.includes('horseman'))!.id)).toBe('archers')
    expect(combatKind(c, D.heroes.find((h) => h.skills.includes('marine') && !h.skills.includes('horseman') && !h.skills.includes('archer'))!.id)).toBe('boats')
    expect(combatKind(c, pick('spearman'))).toBe('infantry')
  })
  test('H-7 skills open their strategic options (forge 600, dykes +25, relieve +2, rest 50, train +5, levy x1.10)', () => {
    expect(D.skills).toHaveLength(22)
    const find = (sk: string) => D.heroes.find((h) => h.skills.includes(sk as never))!.id
    const run = (skill: string, cmd: string, setup: (s: ReturnType<typeof game>, h: string) => void, read: (s: ReturnType<typeof game>) => number) => {
      const s = game()
      const h = find(skill)
      s.heroes[h]!.faction = 'player'; s.heroes[h]!.status = 'ordinary'
      const old = s.heroes[h]!.loc
      if (old) { const q = s.prefectures[old]!; q.heroes = q.heroes.filter((x) => x !== h) }
      s.heroes[h]!.loc = 'yunzhou'; s.prefectures['yunzhou']!.heroes.push(h)
      setPref(s, 'yunzhou', { gold: 5000, food: 5000, dyke: 10, support: 40, men: 500, arms: 0 })
      setup(s, h)
      const r = ok(s, { t: cmd, pref: 'yunzhou', actor: h } as never)
      return read(r.state)
    }
    expect(run('smith', 'forge', () => {}, (s) => s.prefectures['yunzhou']!.arms)).toBe(600)
    expect(run('builder', 'dykes', () => {}, (s) => s.prefectures['yunzhou']!.dyke)).toBe(35)
    expect(run('innkeeper', 'rest', () => {}, (s) => 5000 - s.prefectures['yunzhou']!.gold)).toBe(50)
    expect(run('drillmaster', 'train', () => {}, (s) => s.prefectures['yunzhou']!.training)).toBeGreaterThanOrEqual(30 + 5 + 8)
    expect(run('physician', 'relieve', () => {}, (s) => s.prefectures['yunzhou']!.support - 40)).toBeGreaterThanOrEqual(10)
  })
  test('H-8 ties between heroes go to the lower star rank', () => {
    const c = ctxOf(game())
    expect(sortHeroes(c, ['wu-yong', 'song-jiang', 'liu-tang'])).toEqual(['song-jiang', 'wu-yong', 'liu-tang'])
    expect(rank(c, 'song-jiang')).toBe(1)
  })
  test('H-9 loyalty stays within 0-100 for the player heroes through a long game', () => {
    playGreedy(game('lin-chong', 2, 9), 18, (s) => { for (const h of Object.values(s.heroes)) if (h.faction === 'player') expect(h.loyalty >= 0 && h.loyalty <= 100).toBe(true) })
  })
  test('H-10 joining loyalty: invited 55 + compat/4, persuaded 50 + compat/4, rescued 80', () => {
    const c = ctxOf(game())
    const cm = compat(c, 'song-jiang', 'song-qing')
    expect(joinLoyalty(c, 'song-qing', 'invite')).toBe(55 + Math.floor(cm / 4))
    expect(joinLoyalty(c, 'song-qing', 'persuade')).toBe(50 + Math.floor(cm / 4))
    expect(joinLoyalty(c, 'song-qing', 'rescue')).toBe(80)
    joinHero(c, 'song-qing', 'player', 77, 'yunzhou')
    expect(c.s.heroes['song-qing']!.loyalty).toBe(77)
  })
  test('H-11 resting level is 40 + compat/2, plus 5 at support 70 and minus 5 under 30', () => {
    const s = game()
    const c = ctxOf(s)
    const base = 40 + Math.floor(compat(c, 'song-jiang', 'wu-yong') / 2)
    setPref(s, 'yunzhou', { support: 50 })
    expect(restingLevel(c, 'wu-yong')).toBe(base)
    setPref(s, 'yunzhou', { support: 75 })
    expect(restingLevel(c, 'wu-yong')).toBe(base + 5)
    setPref(s, 'yunzhou', { support: 20 })
    expect(restingLevel(c, 'wu-yong')).toBe(base - 5)
  })
  test('H-12 each month-end loyalty moves 2 points towards the resting level, from above or below', () => {
    const s = game()
    setPref(s, 'yunzhou', { support: 50, gold: 100000, food: 100000 })
    const rest = restingLevel(ctxOf(s), 'wu-yong')
    s.heroes['wu-yong']!.loyalty = rest + 10
    expect(endOf(s).heroes['wu-yong']!.loyalty).toBe(rest + 8)
    s.heroes['wu-yong']!.loyalty = rest - 10
    expect(endOf(s).heroes['wu-yong']!.loyalty).toBe(rest - 8)
    s.heroes['wu-yong']!.loyalty = rest + 1
    expect(endOf(s).heroes['wu-yong']!.loyalty).toBe(rest)
  })
  test('H-13 deeds: levy under support 30 costs compassionate heroes 4 loyalty; releasing a captive earns righteous ones 3', () => {
    const s = game()
    setPref(s, 'yunzhou', { support: 20, gold: 5000 })
    const before = s.heroes['wu-yong']!.loyalty
    const r = ok(s, A('levy'))
    const comp = D.heroes.find((h) => h.id === 'wu-yong')!.virtues.compassion
    expect(r.state.heroes['wu-yong']!.loyalty).toBe(comp >= 7 ? before - 4 : before)
    expect(r.state.factions['player']!.renown).toBe(30 - 1)
  })
  test('H-14 loyalty under 40 is restless, 25 or less is wavering (view warning and query)', () => {
    const s = game()
    s.heroes['wu-yong']!.loyalty = 35
    expect(view(s, 'player', D).warnings.find((w) => w.rule === 'H-14')?.level).toBe('amber')
    expect(query.loyalty(s, 'wu-yong', D).label).toBe('restless')
    s.heroes['wu-yong']!.loyalty = 20
    expect(view(s, 'player', D).warnings.find((w) => w.rule === 'H-14')?.level).toBe('red')
    expect(query.loyalty(s, 'wu-yong', D)).toMatchObject({ label: 'wavering', monthsToDesertion: 2 })
  })
  test('H-15 a hero wavering at one month-end and still at 25 or less at the next leaves, free where they stood', () => {
    let s = game()
    setPref(s, 'yunzhou', { support: 50, gold: 100000, food: 100000 })
    s.heroes['wu-yong']!.loyalty = 5
    s = endOf(s)
    expect(s.heroes['wu-yong']!.wavering).toBe(true)
    expect(s.heroes['wu-yong']!.faction).toBe('player')
    s.heroes['wu-yong']!.loyalty = 5
    s = endOf(s)
    expect(s.heroes['wu-yong']!.faction).toBe('free')
    expect(s.heroes['wu-yong']!.loc).toBe('yunzhou')
    expect(s.log.some((l) => l.kind === 'desert' && /Wu Yong/.test(l.text))).toBe(true)
  })
  test('H-16 revolt: support 20 or less flags unrest; still 15 or less next month-end it revolts; above 15 clears', () => {
    const s = game()
    s.prefectures['daming']!.owner = 'player'
    s.prefectures['daming']!.heroes = []
    setPref(s, 'daming', { support: 18, food: 100000, gold: 100000 })
    const a = endOf(s)
    expect(a.prefectures['daming']!.unrest).toBe(true)
    expect(a.prefectures['daming']!.owner).toBe('player')
    setPref(a, 'daming', { support: 14 })
    const b = endOf(a)
    expect(b.prefectures['daming']!.owner).toBe('free')
    setPref(a, 'daming', { support: 40 })
    expect(endOf(a).prefectures['daming']!.unrest).toBe(false)
  })
  test('H-17 a freed hero is placed in a named prefecture and can be invited by anyone', () => {
    let s = game()
    setPref(s, 'yunzhou', { support: 50, gold: 100000, food: 100000 })
    s.heroes['wu-yong']!.loyalty = 5; s.heroes['wu-yong']!.wavering = true
    s = endOf(s)
    expect(s.heroes['wu-yong']).toMatchObject({ faction: 'free', status: 'free', loc: 'yunzhou' })
    expect(s.prefectures['yunzhou']!.heroes).toContain('wu-yong')
    expect(query.recruitOdds(s, 'song-jiang', 'wu-yong', 'invite', D).pct).toBeGreaterThanOrEqual(5)
  })
})

describe('B brotherhood', () => {
  const ready = () => { const s = game(); s.heroes['wu-yong']!.loyalty = 90; setPref(s, 'yunzhou', { gold: 1000 }); return s }
  test('B-1 the oath needs loyalty 80 and match 55 and shows the missing amount', () => {
    const s = game()
    const o = query.oath(s, 'wu-yong', D)
    expect([o.loyalty, o.needLoyalty, o.needCompat, o.ok]).toEqual([60, 80, 55, false])
    expect(o.missing.join(' ')).toMatch(/loyalty 20 more/)
    expect(step(s, { t: 'swear', pref: 'yunzhou', hero: 'wu-yong' }, D).ok).toBe(false)
  })
  test('B-2 a sworn brother needs no loyalty, adds a command where he stands and Renown +1; cost 200 gold', () => {
    const r = ok(ready(), { t: 'swear', pref: 'yunzhou', hero: 'wu-yong' })
    expect(r.state.heroes['wu-yong']!.status).toBe('sworn')
    expect(r.state.prefectures['yunzhou']!.gold).toBe(800)
    expect(r.state.factions['player']!.renown).toBe(31)
    expect(commandCap(ctxOf(r.state), 'yunzhou')).toBe(2)
  })
  test('B-3 compatibility: d=0 gives 100, d=7 gives 58, d=10 gives 40', () => {
    const c = ctxOf(game())
    expect(compat(c, 'song-jiang', 'song-jiang')).toBe(100)
    expect(compat(c, 'song-jiang', 'wu-yong')).toBe(58)
    const mk = (d: number) => Math.max(0, 100 - 6 * d)
    expect([mk(0), mk(7), mk(10), mk(20)]).toEqual([100, 58, 40, 0])
  })
  test('B-4 no oath for a captive, a wavering hero or a hero away from the chieftain', () => {
    const s = ready()
    s.heroes['wu-yong']!.wavering = true
    expect(step(s, { t: 'swear', pref: 'yunzhou', hero: 'wu-yong' }, D).ok).toBe(false)
    const t = ready()
    const q = t.prefectures['yunzhou']!
    q.heroes = q.heroes.filter((h) => h !== 'wu-yong'); t.heroes['wu-yong']!.loc = 'daming'; t.prefectures['daming']!.heroes.push('wu-yong')
    expect(query.oath(t, 'wu-yong', D).missing.join(' ')).toMatch(/elsewhere/)
    const u = ready()
    u.heroes['wu-yong']!.status = 'captive'
    expect(query.oath(u, 'wu-yong', D).ok).toBe(false)
  })
  test('B-5 sworn brothers do not desert, whatever the numbers', () => {
    let s = ready()
    s = ok(s, { t: 'swear', pref: 'yunzhou', hero: 'wu-yong' }).state
    s.heroes['wu-yong']!.loyalty = 0
    setPref(s, 'yunzhou', { gold: 0, food: 0 })
    s = endOf(s)
    expect(s.heroes['wu-yong']!.faction).toBe('player')
    expect(s.heroes['wu-yong']!.status).toBe('sworn')
  })
  test('B-6 a sworn brother in another prefecture gives it one command, and is the default actor', () => {
    const s = ready()
    s.heroes['wu-yong']!.status = 'sworn'
    const q = s.prefectures['yunzhou']!
    q.heroes = q.heroes.filter((h) => h !== 'wu-yong')
    s.heroes['wu-yong']!.loc = 'jizhou'; s.prefectures['jizhou']!.heroes.push('wu-yong'); s.prefectures['jizhou']!.owner = 'player'
    const c = ctxOf(s)
    expect(commandCap(c, 'jizhou')).toBe(1)
    s.commandsLeft['jizhou'] = 1
    setPref(s, 'jizhou', { gold: 1000, men: 100 })
    expect(step(s, { t: 'train', pref: 'jizhou', actor: 'wu-yong' }, D).ok).toBe(true)
  })
  test('B-7 brotherhood and recruits are visible Renown sources (sworn +1, heavenly joiner +5)', () => {
    const r = ok(ready(), { t: 'swear', pref: 'yunzhou', hero: 'wu-yong' })
    expect(r.state.factions['player']!.ledger.at(-1)).toMatchObject({ amount: 1, rule: 'B-2', column: 'heroes' })
    const c = ctxOf(game())
    joinHero(c, 'lu-junyi', 'player', 50, 'yunzhou')
    expect(c.s.factions['player']!.ledger.at(-1)).toMatchObject({ amount: 5, column: 'heroes' })
  })
})
