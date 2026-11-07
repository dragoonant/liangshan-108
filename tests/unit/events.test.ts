import { describe, expect, test } from 'vitest'
import { createGame, query, step, legalActions } from '../../src/engine'
import { snowedIn } from '../../src/engine/ctx'
import { rollEvents, storyEvents } from '../../src/engine/strategic/events'
import { monthBundle, game, ctxOf, ok, endOf, setPref, D } from './helpers'

function one(t: number, dyke: number, forced: number[], pop = 150000) {
  const d = monthBundle()
  const s = createGame({ startHero: 'song-jiang', difficulty: 2, seed: 1 }, d, { forcedRolls: forced })
  s.t = t
  Object.assign(s.prefectures['yunzhou']!, { dyke, pop })
  return { s, d }
}

describe('V events', () => {
  test('V-0 events are rolled in map then table order, one roll each, scheduled for the next month-end with a stated effect', () => {
    const { s, d } = one(4, 40, [5, 50, 50])
    rollEvents(ctxOf(s, d))
    expect(s.rng.draws).toBe(3)
    expect(s.scheduled).toEqual([{ id: 'flood', pref: 'yunzhou', fireT: 5, effect: 'land -15, population -3%, food -25%' }])
    expect(query.forecast({ ...s, t: 5 }, d).events[0]).toMatchObject({ id: 'flood' })
  })
  test('V-1 flood chance is (70 - dyke) / 5 percent: dyke 40 is 6%', () => {
    const hit = one(4, 40, [5, 50, 50]); rollEvents(ctxOf(hit.s, hit.d)); expect(hit.s.scheduled).toHaveLength(1)
    const miss = one(4, 40, [6, 50, 50]); rollEvents(ctxOf(miss.s, miss.d)); expect(miss.s.scheduled).toHaveLength(0)
    const safe = one(4, 75, [0, 50]); rollEvents(ctxOf(safe.s, safe.d)); expect(safe.s.rng.draws).toBe(2) // dyke 70+: no flood roll
    const fire = one(5, 40, []); fire.s.scheduled.push({ id: 'flood', pref: 'yunzhou', fireT: 5, effect: '' })
    const before = { ...fire.s.prefectures['yunzhou']! }
    const e = endOf(fire.s, fire.d)
    expect(e.prefectures['yunzhou']!.land).toBeLessThanOrEqual(before.land + 2 - 15 + 5)
  })
  test('V-2 drought (4%) cuts the next harvest by 40%', () => {
    const { s, d } = one(4, 60, [50, 3, 50]); rollEvents(ctxOf(s, d))
    expect(s.scheduled.map((e) => e.id)).toEqual(['drought'])
    const f = one(5, 60, []); f.s.scheduled.push({ id: 'drought', pref: 'yunzhou', fireT: 5, effect: '' })
    expect(endOf(f.s, f.d).prefectures['yunzhou']!.drought).toBe(true)
  })
  test('V-3 locusts (August-September, 3%) take 30% of the food when they fire', () => {
    const { s, d } = one(6, 60, [50, 50, 2, 50]); rollEvents(ctxOf(s, d))
    expect(s.scheduled.map((e) => e.id)).toEqual(['locusts'])
    const f = one(7, 60, []); setPref(f.s, 'yunzhou', { food: 10000, men: 0 }); f.s.scheduled.push({ id: 'locusts', pref: 'yunzhou', fireT: 7, effect: '' })
    expect(endOf(f.s, f.d).prefectures['yunzhou']!.food).toBeLessThan(7100)
  })
  test('V-4 plague (lead 0): pop -5%, men -10%, support -3 at once; a physician halves it', () => {
    const { s, d } = one(10, 60, [0])
    setPref(s, 'yunzhou', { pop: 200000, men: 1000, support: 60 })
    rollEvents(ctxOf(s, d))
    expect(s.prefectures['yunzhou']).toMatchObject({ pop: 190000, men: 900, support: 57, plague: true })
    const physRec = D.heroes.find((x) => x.skills.includes('physician') && x.id !== 'song-jiang')!
    const d2 = monthBundle(); d2.heroes.push({ ...physRec, joinsLate: false, start: { status: 'free', prefecture: 'yunzhou', year: 1101 } })
    const h = { s: createGame({ startHero: 'song-jiang', difficulty: 2, seed: 1 }, d2, { forcedRolls: [0] }), d: d2 }
    h.s.t = 10
    setPref(h.s, 'yunzhou', { pop: 200000, men: 1000, support: 60 })
    h.s.heroes[physRec.id] = { ...h.s.heroes[physRec.id]!, faction: 'player', status: 'ordinary', loc: 'yunzhou' }
    if (!h.s.prefectures['yunzhou']!.heroes.includes(physRec.id)) h.s.prefectures['yunzhou']!.heroes.push(physRec.id)
    rollEvents(ctxOf(h.s, h.d))
    expect(h.s.prefectures['yunzhou']).toMatchObject({ pop: 195000, men: 950, support: 59 })
  })
  test('V-5 a snowstorm blocks every link touching the prefecture for its month and adds 25% to upkeep', () => {
    const s = game()
    s.t = 11
    const c = ctxOf(s)
    const before = snowedIn(c, 'cangzhou', 'daming', 11)
    s.prefectures['cangzhou']!.stormT = 11
    s.scheduled.push({ id: 'snowstorm', pref: 'cangzhou', fireT: 11, effect: '' })
    expect(before).toBe(false)
    expect(snowedIn(c, 'cangzhou', 'daming', 11)).toBe(true)
    expect(query.forecast(s, D).events.some((e) => e.id === 'snowstorm')).toBe(true)
  })
  test('V-6 the man-eating tiger: Wu Song starts with the decision; success pays +4 Renown and +5 support, failure wounds', () => {
    const s = game('wu-song', 2, 3, [0])
    expect(s.pending).toMatchObject({ kind: 'tiger' })
    expect(s.pending!.options).toContain('wu-song')
    expect(step(s, { t: 'endPhase' }, D)).toMatchObject({ ok: false, code: 'pending-decision' })
    const w = ok(s, { t: 'choose', option: 'wu-song' }).state
    expect(w.pending).toBeNull()
    expect(w.prefectures['cangzhou']!.tiger).toBeNull()
    expect(w.factions['player']!.renown).toBe(45 + 4)
    expect(w.prefectures['cangzhou']!.support).toBe(65)
    const f = ok(game('wu-song', 2, 3, [99]), { t: 'choose', option: 'wu-song' }).state
    expect(f.heroes['wu-song']!.wounded).toBe(2)
    expect(f.prefectures['cangzhou']!.tiger).toBe(0)
    expect(ok(game('wu-song', 2, 3), { t: 'choose', option: 'ignore' }).state.pending).toBeNull()
  })
  test('V-7 imperial inspection in March at Renown 100: bribe 300 gold, or refuse and the campaign comes 2 months sooner', () => {
    const base = () => { const s = game(); s.t = 1; s.factions['player']!.renown = 100; setPref(s, 'yunzhou', { gold: 5000, food: 50000 }); return endOf(s) }
    const s = base()
    expect(s.scheduled.some((e) => e.id === 'inspection' && e.pref === 'yunzhou')).toBe(true)
    let t = ok(s, { t: 'endPhase' }).state
    while (t.phase === 'battle') t = ok(t, { t: 'bAuto' }).state
    expect(t.pending?.kind).toBe('inspection')
    const gold = t.prefectures['yunzhou']!.gold
    const b = ok(t, { t: 'choose', option: 'bribe' }).state
    expect(b.prefectures['yunzhou']!.gold).toBe(gold - 300)
    const nc = t.factions['court']!.nextCampaign
    expect(ok(t, { t: 'choose', option: 'refuse' }).state.factions['court']!.nextCampaign).toBe(nc - 2)
  })
  test('V-8 story events: the birthday convoy asks once, the wronged officers get an invite bonus; the famine relief event is not built', () => {
    const s = game()
    s.factions['player']!.renown = 150
    const thief = D.heroes.find((x) => x.skills.includes('thief'))!.id
    s.heroes[thief] = { ...s.heroes[thief]!, faction: 'player', status: 'ordinary', loc: 'yunzhou' }; s.prefectures['yunzhou']!.heroes.push(thief)
    storyEvents(ctxOf(s))
    expect(s.pending?.kind).toBe('convoy')
    const r = ok(s, { t: 'choose', option: 'take' }).state
    expect(r.prefectures['yunzhou']!.gold).toBe(4500)
    expect(r.factions['player']!.renown).toBe(153)
    expect(r.fired).toContain('wronged')
    const again = ctxOf(r); storyEvents(again)
    expect(r.pending).toBeNull()
  })
  test.todo('V-8 famine in a court prefecture (send relief for Renown +3) is not implemented: it needs a way to give relief to a prefecture you do not own')
  test('V-9 every fired event is in the log with its month, kind, rule id and text; the log is never cleared by a month', () => {
    let s = game()
    s = ok(s, { t: 'endPhase' }).state
    while (s.phase === 'battle' || s.pending) s = s.pending ? ok(s, { t: 'choose', option: s.pending.options[0]! }).state : ok(s, { t: 'bAuto' }).state
    const n = s.log.length
    expect(s.log.every((l) => typeof l.t === 'number' && l.kind && l.rule && l.text)).toBe(true)
    expect(n).toBeGreaterThan(5)
    expect(s.log.some((l) => l.t === 0)).toBe(true)
  })
  test('V-10 an open decision blocks every command until it is answered', () => {
    const s = game('wu-song', 2, 3)
    expect(legalActions(s, D).every((a) => a.t === 'choose')).toBe(true)
    expect(step(s, { t: 'train', pref: 'cangzhou', actor: 'wu-song' }, D)).toMatchObject({ ok: false, code: 'pending-decision' })
  })
})
