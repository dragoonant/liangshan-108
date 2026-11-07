// Q rules: invite, persuade, captives, story triggers.
import type { Ctx } from '../ctx'
import { abil, compat, emit, has, heroName, hs, ps, rec, chieftainId, graftOf, EMPEROR, place, prefName } from '../ctx'
import { clamp } from '../util'
import { freeHero, joinHero } from './heroes'
import { addRenown } from './renown'
import { campFollow } from './camps'

export interface Term { label: string; value: number }
export interface Odds { pct: number; terms: Term[] }

/** The graft of the governor a hero started under (file order, Emperor excluded). */
export function startGovernorGraft(c: Ctx, pref: string): number {
  const g = c.x.d.court.find((h) => h.id !== EMPEROR && h.start.prefecture === pref)
  return g ? graftOf(c, g.id) : 0
}

/** Q-2 */
export function recruitOdds(c: Ctx, faction: string, actor: string, target: string): Odds {
  const t = rec(c, target)
  const pref = hs(c, actor).loc as string
  const renown = faction === 'player' ? c.s.factions['player']!.renown : 0
  const cm = faction === 'player' ? compatChief(c, target) : compat(c, actor, target)
  const terms: Term[] = [
    { label: 'base', value: 20 },
    { label: 'renown', value: Math.min(30, Math.floor(renown / 10)) },
    { label: 'match', value: Math.floor(cm / 3) },
    { label: 'cunning', value: Math.floor((abil(c, actor).cunning - 50) / 5) },
    { label: 'support', value: Math.floor((ps(c, pref).support - 50) / 5) },
  ]
  if (has(c, actor, 'innkeeper')) terms.push({ label: 'innkeeper', value: 10 })
  if (has(c, actor, 'horse-trader') && t.skills.includes('horseman')) terms.push({ label: 'horse-trader', value: 10 })
  if (has(c, actor, 'monk') && t.skills.includes('monk')) terms.push({ label: 'monk', value: 10 })
  const official = t.start.status === 'official'
  if (has(c, actor, 'forger') && official) terms.push({ label: 'forger', value: 10 })
  if (official) terms.push({ label: 'official', value: startGovernorGraft(c, t.start.prefecture) >= 60 ? 30 : -30 })
  const b = hs(c, target).bonus
  if (b) terms.push({ label: 'standing offer', value: b })
  const raw = terms.reduce((a, x) => a + x.value, 0)
  return { pct: clamp(5, 95, raw), terms }
}
function compatChief(c: Ctx, hero: string): number {
  const ch = chieftainId(c)
  return ch ? compat(c, ch, hero) : 50
}

/** Q-4 */
export function persuadeOdds(c: Ctx, faction: string, actor: string, captive: string): Odds {
  const cm = faction === 'player' ? compatChief(c, captive) : compat(c, actor, captive)
  const gov = startGovernorGraft(c, rec(c, captive).start.prefecture) >= 60 ? 15 : 0
  const terms: Term[] = [
    { label: 'base', value: 25 },
    { label: 'match', value: Math.floor(cm / 2) },
    { label: 'cunning', value: Math.floor((abil(c, actor).cunning - 50) / 4) },
  ]
  if (gov) terms.push({ label: 'corrupt former governor', value: gov })
  return { pct: clamp(5, 95, terms.reduce((a, x) => a + x.value, 0)), terms }
}
export function joinLoyalty(c: Ctx, hero: string, how: 'invite' | 'persuade' | 'rescue' | 'conquest'): number {
  if (how === 'rescue') return 80
  const base = how === 'persuade' ? 50 : 40
  return base + Math.floor(compatChief(c, hero) / 4)
}

/** Q-5: fire any story trigger whose condition now holds. Called at month end and after battles. */
export function checkTriggers(c: Ctx): void {
  const s = c.s
  const renown = s.factions['player']!.renown
  for (const id of Object.keys(s.heroes)) {
    const h = s.heroes[id]!
    if (h.status !== 'dormant') continue
    const r = rec(c, id)
    if (!r.joinsLate || c.x.kindOf[id] !== 'star') continue
    const tr = c.x.triggers[id]
    let ok = false
    if (!tr) ok = renown >= 100 + 2 * (r.star?.rank ?? 0)
    else if (tr.kind === 'renown') ok = renown >= (tr.min ?? 0)
    else if (tr.kind === 'own') ok = ps(c, tr.prefecture as string).owner === 'player'
    else if (tr.kind === 'battle-won-at') ok = s.fired.includes(`won:${tr.prefecture}`)
    else if (tr.kind === 'attacked') ok = s.fired.includes(`attacked:${tr.prefecture}`)
    else if (tr.kind === 'defeated-hero') ok = s.fired.includes(`defeated:${tr.target}`)
    else if (tr.kind === 'brother') { const t = s.heroes[tr.target as string]; ok = !!t && t.faction === 'player' && t.status !== 'dormant' && t.status !== 'captive' && t.status !== 'free' }
    else if (tr.kind === 'campaign-announced') ok = s.fired.includes('campaign')
    if (!ok) continue
    // Q-6 start semantics at the hero's start prefecture
    const loc = r.start.prefecture
    const own = ps(c, loc).owner
    h.loc = null
    h.status = 'free'
    h.faction = 'free'
    if (r.start.status === 'official' && own === 'court') { h.faction = 'court'; h.status = 'ordinary' }
    place(c, id, loc)
    emit(c, 'storyJoin', 'Q-5', `${heroName(c, id)} appears at ${prefName(c, loc)}: ${r.joinTrigger ?? 'the story moves on'}`, loc)
  }
}

export function inviteHero(c: Ctx, faction: string, actor: string, target: string, pref: string): { ok: boolean; pct: number } {
  const o = recruitOdds(c, faction, actor, target)
  const ok = rollCheck(c, o.pct)
  if (ok) {
    joinHero(c, target, faction, faction === 'player' ? joinLoyalty(c, target, 'invite') : 0, pref)
    emit(c, 'recruited', 'Q-2', `${heroName(c, target)} accepts the invitation (${o.pct}%)`, pref)
  } else {
    hs(c, target).inviteBlock = c.s.t + 1
    emit(c, 'declined', 'Q-2', `${heroName(c, target)} declines (${o.pct}%)`, pref)
  }
  return { ok, pct: o.pct }
}
import { roll } from '../rng'
export function rollCheck(c: Ctx, pct: number): boolean { return roll(c.s, 100) < pct }

/** Q-4 captive decision effects. */
export function captiveChoice(c: Ctx, hero: string, option: string, actor: string, pref: string): void {
  const h = hs(c, hero)
  const name = heroName(c, hero)
  if (option === 'persuade') {
    const o = persuadeOdds(c, 'player', actor, hero)
    h.persuadedT = c.s.t
    if (rollCheck(c, o.pct)) {
      joinHero(c, hero, 'player', joinLoyalty(c, hero, 'persuade'), pref)
      emit(c, 'persuaded', 'Q-4', `${name} is persuaded to join (${o.pct}%)`, pref)
      campFollow(c, hero, pref)
    } else emit(c, 'persuadeFailed', 'Q-4', `${name} refuses and stays captive (${o.pct}%)`, pref)
  } else if (option === 'release') {
    freeHero(c, hero, pref, 'released with honour')
    hs(c, hero).bonus = 20
    addRenown(c, 2, pref, 'Q-4', 'heroes', `released ${name}`)
    for (const id of Object.keys(c.s.heroes)) {
      const x = c.s.heroes[id]!
      if (x.faction === 'player' && x.status === 'ordinary' && rec(c, id).virtues.righteousness >= 7) x.loyalty = clamp(0, 100, x.loyalty + 3)
    }
  } else if (option === 'execute') {
    place(c, hero, null)
    const x = c.s.heroes[hero]!
    x.status = 'dormant'; x.faction = 'court'; x.heldBy = null
    addRenown(c, -3, pref, 'R-3', 'justice', `executed ${name}`)
    for (const id of Object.keys(c.s.heroes)) {
      const y = c.s.heroes[id]!
      if (y.faction === 'player' && y.status === 'ordinary' && rec(c, id).virtues.righteousness >= 7) y.loyalty = clamp(0, 100, y.loyalty - 6)
    }
    emit(c, 'executed', 'Q-4', `${name} is executed`, pref)
  } else emit(c, 'held', 'Q-4', `${name} is held in the prison`, pref)
}
