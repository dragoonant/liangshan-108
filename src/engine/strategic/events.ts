// V rules: rolling, scheduling and firing events; tiger, inspection, convoy decisions.
import { monthOf } from '../calendar'
import type { Ctx } from '../ctx'
import { abil, emit, has, heroName, hs, isNorth, prefName, ps, anyHas, graftOf, GAO_QIU } from '../ctx'
import { roll } from '../rng'
import { clamp, pct } from '../util'
import { addLoyalty } from './heroes'
import { addRenown } from './renown'
import type { Pending } from '../types'

const FLOOD_TERRAIN = ['river-delta', 'marsh', 'plains', 'coast']

/** V-0 step 8: roll next month's events in map order, then table order. */
export function rollEvents(c: Ctx): void {
  const s = c.s
  const fireT = s.t + 1
  const fm = monthOf(fireT)
  const prevPlague = new Set(c.x.order.filter((p) => ps(c, p).plague))
  for (const p of c.x.order) ps(c, p).plague = false
  for (const id of c.x.order) {
    const p = ps(c, id)
    const rec0 = c.x.pref[id]!
    // V-1 flood (lead 1)
    if (fm >= 6 && fm <= 8 && FLOOD_TERRAIN.includes(rec0.terrain)) {
      const chance = Math.floor(Math.max(0, 70 - p.dyke) / 5)
      if (chance > 0 && roll(s, 100) < chance) {
        const bad = p.dyke < 50
        s.scheduled.push({ id: 'flood', pref: id, fireT, effect: bad ? 'land -15, population -3%, food -25%' : 'land -5' })
      }
    }
    // V-2 drought (lead 1)
    if (fm >= 6 && fm <= 8 && roll(s, 100) < 4) s.scheduled.push({ id: 'drought', pref: id, fireT, effect: 'the next harvest is cut by 40%' })
    // V-3 locusts (lead 1)
    if ((fm === 8 || fm === 9) && (rec0.terrain === 'plains' || rec0.terrain === 'hills') && roll(s, 100) < 3) s.scheduled.push({ id: 'locusts', pref: id, fireT, effect: 'food -30%' })
    // V-4 plague (lead 0)
    if (p.pop >= 100000) {
      const linked = c.x.adj[id]!.some((n) => prevPlague.has(n.to))
      if (roll(s, 100) < (linked ? 30 : 2)) firePlague(c, id)
      else if (p.owner === 'player') emit(c, 'noPlague', 'V-4', `${prefName(c, id)}: no plague`, id)
    }
    // V-5 snowstorm (lead 1)
    if ((fm === 12 || fm <= 2) && isNorth(c, id) && roll(s, 100) < 20) {
      s.scheduled.push({ id: 'snowstorm', pref: id, fireT, effect: 'every link touching it is blocked for the month; upkeep food +25%' })
      p.stormT = fireT
    }
    // V-6 tiger (lead 0)
    if ((rec0.terrain === 'hills' || rec0.terrain === 'mountains') && p.tiger === null && roll(s, 100) < 3) {
      p.tiger = s.t
      emit(c, 'tiger', 'V-6', `A man-eating tiger is abroad near ${rec0.name}: population -200 and support -2 a month until slain`, id)
      if (p.owner === 'player') raiseTiger(c, id, true)
    }
  }
  // V-7 imperial inspection (lead 1, each March)
  if (fm === 3 && s.factions['player']!.renown >= 100) {
    const mine = c.x.order.filter((q) => ps(c, q).owner === 'player').sort((a, b) => ps(c, b).pop - ps(c, a).pop)
    if (mine[0]) s.scheduled.push({ id: 'inspection', pref: mine[0], fireT, effect: 'an inspector visits: bribe 300 gold, or refuse and the next campaign comes 2 months sooner' })
  }
}

function firePlague(c: Ctx, id: string): void {
  const p = ps(c, id)
  const half = anyHas(c, id, 'physician')
  const f = (x: number): number => (half ? Math.floor(x / 2) : x)
  const dpop = f(pct(p.pop, 5)), dmen = f(pct(p.men, 10)), dsup = f(3)
  p.pop -= dpop; p.men -= dmen; p.support = clamp(0, 100, p.support - dsup)
  p.plague = true; p.disasterT = c.s.t; p.famineT = c.s.t
  emit(c, 'plague', 'V-4', `Plague in ${prefName(c, id)}: population -${dpop}, men -${dmen}, support -${dsup}${half ? ' (a physician halved it)' : ''}`, id)
}

/** V-0 step 4: scheduled events whose month it is. */
export function fireScheduled(c: Ctx): void {
  const s = c.s
  const now = s.scheduled.filter((e) => e.fireT === s.t)
  s.scheduled = s.scheduled.filter((e) => e.fireT > s.t)
  for (const e of now) {
    const p = ps(c, e.pref)
    const n = prefName(c, e.pref)
    if (e.id === 'flood') {
      const half = anyHas(c, e.pref, 'builder')
      const g = (x: number): number => (half ? Math.floor(x / 2) : x)
      if (p.dyke < 50) {
        const fl = g(Math.floor((p.food * 25) / 100)), dp = g(pct(p.pop, 3))
        p.land = Math.max(0, p.land - g(15)); p.pop -= dp; p.food -= fl
        emit(c, 'flood', 'V-1', `Flood in ${n}: land -${g(15)}, population -${dp}, food -${fl}`, e.pref)
      } else {
        p.land = Math.max(0, p.land - g(5))
        emit(c, 'flood', 'V-1', `Flood in ${n}: land -${g(5)} (the dykes held)`, e.pref)
      }
      p.disasterT = s.t; p.famineT = s.t
    } else if (e.id === 'drought') {
      p.drought = true; p.disasterT = s.t; p.famineT = s.t
      emit(c, 'drought', 'V-2', `Drought in ${n}: the next harvest is cut by 40%`, e.pref)
    } else if (e.id === 'locusts') {
      const loss = pct(p.food, 30)
      p.food -= loss; p.disasterT = s.t; p.famineT = s.t
      emit(c, 'locusts', 'V-3', `Locusts in ${n}: food -${loss}`, e.pref)
    } else if (e.id === 'snowstorm') {
      p.disasterT = s.t
      emit(c, 'snowstorm', 'V-5', `Snowstorm over ${n}: links blocked, upkeep +25%`, e.pref)
    } else if (e.id === 'inspection') {
      if (p.owner !== 'player') continue
      const options = p.gold >= 300 ? ['bribe', 'refuse'] : ['refuse']
      emit(c, 'inspection', 'V-7', `An imperial inspector arrives at ${n}: bribe 300 gold, or refuse (next campaign 2 months sooner)`, e.pref)
      if (!setPending(c, { kind: 'inspection', options, data: { pref: e.pref } })) resolveInspection(c, e.pref, options.includes('bribe') ? 'bribe' : 'refuse')
    }
  }
}

/** Only one pending decision at a time (Arch); false when one is already open. */
export function setPending(c: Ctx, p: Pending): boolean {
  if (c.s.pending) return false
  c.s.pending = p
  return true
}

export function resolveInspection(c: Ctx, pref: string, option: string): void {
  const p = ps(c, pref)
  if (option === 'bribe' && p.gold >= 300) { p.gold -= 300; emit(c, 'bribe', 'V-7', 'The inspector is bribed: 300 gold', pref); return }
  c.s.factions['court']!.nextCampaign -= 2
  c.s.factions['court']!.inspectionAdvance += 2
  emit(c, 'refused', 'V-7', 'The inspector is turned away: the next campaign is advanced by 2 months', pref)
  if (graftOf(c, GAO_QIU) >= 60) addRenown(c, 2, pref, 'V-7', 'justice', 'refused a corrupt inspector')
}

/** V-6 */
export function tigerHeroes(c: Ctx, pref: string): string[] {
  return ps(c, pref).heroes.filter((h) => hs(c, h).faction === 'player' && hs(c, h).wounded <= c.s.t && hs(c, h).status !== 'captive' && (abil(c, h).might >= 75 || has(c, h, 'beast-slayer')))
}
export function tigerOdds(c: Ctx, hero: string): number {
  return clamp(10, 95, 30 + Math.floor(abil(c, hero).might / 2) + (has(c, hero, 'beast-slayer') ? 30 : 0) + (has(c, hero, 'archer') ? 10 : 0))
}
export function raiseTiger(c: Ctx, pref: string, quiet = false): void {
  const options = [...tigerHeroes(c, pref), 'ignore']
  if (!quiet) emit(c, 'tiger', 'V-6', `A man-eating tiger is abroad near ${prefName(c, pref)}`, pref)
  if (!setPending(c, { kind: 'tiger', options, data: { pref } })) emit(c, 'tigerIgnored', 'V-6', 'Another decision was open: the tiger is left for now', pref)
}
export function resolveTiger(c: Ctx, pref: string, option: string): void {
  const p = ps(c, pref)
  if (option === 'ignore') { emit(c, 'tigerIgnored', 'V-6', 'You leave the tiger be', pref); return }
  const P = tigerOdds(c, option)
  if (roll(c.s, 100) < P) {
    p.tiger = null; p.support = clamp(0, 100, p.support + 5)
    addRenown(c, 4, pref, 'R-2', 'beasts', `${heroName(c, option)} slew the tiger`)
    addLoyalty(c, option, 3)
    emit(c, 'tigerSlain', 'V-6', `${heroName(c, option)} slays the tiger (${P}%): support +5`, pref)
  } else {
    hs(c, option).wounded = c.s.t + 2
    emit(c, 'tigerWon', 'V-6', `${heroName(c, option)} is wounded by the tiger (${P}%) and cannot act for 2 months`, pref)
  }
}

/** Monthly tiger damage (V-6). */
export function tigerMonth(c: Ctx): void {
  for (const id of c.x.order) {
    const p = ps(c, id)
    if (p.tiger === null) continue
    if (c.s.t - p.tiger >= 6) { p.tiger = null; emit(c, 'tigerGone', 'V-6', `The tiger near ${prefName(c, id)} has moved on`, id); continue }
    p.pop = Math.max(0, p.pop - 200); p.support = clamp(0, 100, p.support - 2); p.disasterT = c.s.t
  }
}

/** V-8 story events, checked at dawn of each month. At most one decision is raised. */
export function storyEvents(c: Ctx): void {
  const s = c.s
  const renown = s.factions['player']!.renown
  if (!s.fired.includes('convoy') && renown >= 150) {
    const thief = Object.keys(s.heroes).find((h) => hs(c, h).faction === 'player' && hs(c, h).loc && has(c, h, 'thief') && ['chieftain', 'sworn', 'ordinary'].includes(hs(c, h).status))
    if (thief) {
      const pref = hs(c, thief).loc as string
      if (setPending(c, { kind: 'convoy', options: ['take', 'ignore'], data: { pref } })) {
        s.fired.push('convoy')
        emit(c, 'convoy', 'V-8', `The birthday convoy crosses ${prefName(c, pref)}: take its 3,000 gold, or let it pass`, pref)
      }
    }
  }
  if (!s.fired.includes('wronged') && renown >= 50) {
    const hits = Object.keys(s.heroes).filter((h) => c.x.kindOf[h] === 'star' && hs(c, h).faction === 'court' && hs(c, h).loc && ps(c, hs(c, h).loc as string).governor && graftOf(c, ps(c, hs(c, h).loc as string).governor as string) >= 70)
    if (hits.length) {
      s.fired.push('wronged')
      for (const h of hits) hs(c, h).bonus = 30
      emit(c, 'wronged', 'V-8', `Officers under corrupt governors (${hits.map((h) => heroName(c, h)).slice(0, 3).join(', ')}) will listen to an invitation: odds +30`)
    }
  }
}
export function resolveConvoy(c: Ctx, pref: string, option: string): void {
  if (option !== 'take') { emit(c, 'convoyPassed', 'V-8', 'The convoy passes unmolested', pref); return }
  ps(c, pref).gold += 3000
  emit(c, 'convoyTaken', 'V-8', 'The convoy is taken: gold +3000', pref)
  if (graftOf(c, GAO_QIU) >= 60) addRenown(c, 3, pref, 'V-8', 'justice', 'took a corrupt minister\'s convoy')
}
