// T-8 month-end resolution and the new month's dawn.
import { DEADLINE, isWinter, label, monthOf, lastT } from '../calendar'
import { TUNE } from '../tuning'
import type { Ctx } from '../ctx'
import { emit, foodUpkeep, hs, ps, prefName, heroName, rec, place, chieftainId } from '../ctx'
import { clamp, pct } from '../util'
import { dist } from '../data'
import { harvestOf, runway, seedOf, taxOf, wagesOf } from './economy'
import { fireScheduled, rollEvents, storyEvents, tigerMonth } from './events'
import { addLoyalty, freeHero, restingLevel } from './heroes'
import { addRenown } from './renown'
import { checkTriggers } from './recruit'
import { maybeAnnounce, musterCourt } from './court'
import { growCamps, campMonthEnd } from './camps'
import { defeat, checkNoPrefecture, checkChieftain } from './result'
import { resetCommands } from './commands'
import { renownInfo } from '../query/renown'

export function monthEnd(c: Ctx): void {
  const s = c.s
  const m = monthOf(s.t)
  const ids = c.x.order
  const pn = (id: string): string => prefName(c, id)
  // 1 tax
  for (const id of ids) { const g = taxOf(c, id); ps(c, id).gold += g; if (ps(c, id).owner === 'player') emit(c, 'tax', 'E-4', `${pn(id)}: tax ${g} gold`, id, g) }
  // 2 harvest
  if (m === 10) for (const id of ids) { const p = ps(c, id); const h = harvestOf(c, id); p.food += h; p.drought = false; if (p.owner === 'player') emit(c, 'harvest', 'E-6', `${pn(id)}: harvest ${h} food`, id, h) }
  // 3 planting, upkeep, starvation
  for (const id of ids) {
    const p = ps(c, id)
    if (m === 3) {
      const seed = seedOf(c, id)
      if (p.food >= seed) { p.food -= seed; if (p.support >= 40) p.land = Math.min(100, p.land + 2) }
      else { p.land = Math.max(0, p.land - 10); if (p.owner === 'player') emit(c, 'fallow', 'E-7', `${pn(id)}: no seed grain, fields left fallow, land -10`, id) }
    }
    const u = foodUpkeep(c, id)
    if (p.food >= u) p.food -= u
    else {
      const short = u - p.food
      p.food = 0
      const lost = Math.min(p.men, short * 10)
      p.men -= lost; p.support = clamp(0, 100, p.support - 5); p.pop -= Math.floor(p.pop / 100)
      p.starvedT = s.t; p.disasterT = s.t
      for (const h of p.heroes) if (hs(c, h).faction === 'player' && hs(c, h).status === 'ordinary') addLoyalty(c, h, -5)
      if (p.owner === 'player') emit(c, 'starvation', 'E-8', `${pn(id)}: hunger, ${lost} men desert, support -5, population -1%`, id, lost)
    }
    const w = wagesOf(c, id)
    if (p.gold >= w) p.gold -= w
    else {
      p.gold = 0
      const lost = Math.floor(p.men / 20)
      p.men -= lost
      for (const h of p.heroes) if (hs(c, h).faction === 'player' && hs(c, h).status === 'ordinary') addLoyalty(c, h, -8)
      if (p.owner === 'player') emit(c, 'unpaid', 'E-5', `${pn(id)}: wages unpaid, ${lost} men desert, loyalty -8`, id, lost)
    }
    if (p.owner === 'player') emit(c, 'upkeep', 'E-5', `${pn(id)}: upkeep ${u} food, ${w} gold`, id)
  }
  // 4 scheduled events
  fireScheduled(c)
  tigerMonth(c)
  // 5 growth
  for (const id of ids) {
    const p = ps(c, id)
    const g = p.support < 30 ? 0 : m >= 3 && m <= 8 ? 2 : 1
    p.pop += Math.floor((p.pop * g) / 1000)
    p.dyke = Math.max(0, p.dyke - (m >= 6 && m <= 8 ? 3 : 1))
    if (p.support < 50) p.bandits += 10
    else if (p.support >= 70) p.bandits = Math.max(0, p.bandits - 5)
    p.men = Math.min(p.men, Math.floor(p.pop / 20))
  }
  // 6 support drift
  for (const id of ids) {
    const p = ps(c, id)
    let d = 0
    if (p.starvedT === s.t) d -= 2
    if (p.bandits >= 150) d -= 1
    if (p.disasterT !== s.t && runway(c, id) >= 3 && p.bandits < 50) d += 1
    if (p.heroes.some((h) => rec(c, h).virtues.compassion >= 8)) d += 1
    if (p.owner === 'player' && !p.heroes.some((h) => hs(c, h).faction === 'player')) d -= 2 // T-4
    p.support = clamp(0, 100, p.support + d)
    if (d !== 0 && p.owner === 'player') emit(c, 'support', 'E-11', `${pn(id)}: support ${d > 0 ? '+' : ''}${d} (now ${p.support})`, id, d)
  }
  // 7 loyalty, warnings, desertion, revolt
  for (const hid of Object.keys(s.heroes)) {
    const h = s.heroes[hid]!
    if (h.faction !== 'player' || h.status !== 'ordinary' || !h.loc) continue
    const target = restingLevel(c, hid)
    const old = h.loyalty
    h.loyalty = old < target ? Math.min(target, old + 2) : Math.max(target, old - 2)
    if (h.loyalty !== old && ps(c, h.loc).owner === 'player') emit(c, 'loyalty', 'H-12', `${heroName(c, hid)}: loyalty ${old} to ${h.loyalty}`, h.loc)
    if (h.loyalty <= 25) {
      if (h.wavering) {
        const at = h.loc
        freeHero(c, hid, at, `loyalty ${h.loyalty}`)
        addRenown(c, -2, at, 'R-3', 'heroes', `${heroName(c, hid)} deserted`)
        emit(c, 'desert', 'H-15', `${heroName(c, hid)} leaves ${pn(at)} (loyalty ${old})`, at)
      } else h.wavering = true
    } else h.wavering = false
  }
  for (const id of ids) {
    const p = ps(c, id)
    if (p.owner !== 'player') continue
    const was = p.unrest
    if (was && p.support <= 15) {
      const ch = chieftainId(c)
      for (const h of [...p.heroes]) {
        if (h === ch) continue
        freeHero(c, h, id, 'the prefecture revolted')
      }
      p.owner = 'free'; p.governor = null
      p.men = Math.floor(p.men / 2); p.gold = Math.floor(p.gold / 2); p.food = Math.floor(p.food / 2)
      p.unrest = false
      addRenown(c, -5, id, 'R-3', 'battles', `${pn(id)} revolted`)
      emit(c, 'revolt', 'H-16', `${pn(id)} revolts and leaves your banner`, id)
      if (ch && hs(c, ch).loc === id) {
        let best = '', bd = 1e9
        for (const q of ids) if (ps(c, q).owner === 'player') { const d = dist(c.x, id, q); if (d < bd) { bd = d; best = q } }
        if (best) place(c, ch, best)
      }
    } else {
      p.unrest = p.support <= 20
      if (p.unrest) emit(c, 'unrest', 'H-16', `${pn(id)}: support ${p.support}, it will revolt next month if it falls to 15`, id)
    }
  }
  // 8 roll events for next month
  rollEvents(c)
  // 9 court muster, campaign
  musterCourt(c)
  growCamps(c)
  campMonthEnd(c)
  maybeAnnounce(c)
  // 10 renown history, Edict, deadline
  const pf = s.factions['player']!
  pf.renownHistory[s.t] = pf.renown
  checkTriggers(c)
  if (pf.edict === null && pf.renown >= TUNE.edict) {
    pf.edict = s.t
    s.factions['court']!.edictBuild = 3
    emit(c, 'edict', 'R-9', `The Emperor's Edict is granted (${label(s.t)}): the capital may now be attacked`)
  }
  checkChieftain(c)
  checkNoPrefecture(c)
  s.t += 1
  if (s.phase === 'result') return
  if (s.t > lastT(s)) { defeat(c, "The court's patience ends"); return }
  emit(c, 'month', 'T-1', `${label(s.t)} begins`)
  // statusWorst toast (R-8)
  const info = renownInfo(c.s, c.x)
  const st = info.status === 'green' ? 0 : info.status === 'amber' ? 1 : 2
  if (st > pf.statusWorst) emit(c, 'toast', 'R-8', `Edict pace is now ${info.status}: ${info.rate.toFixed(1)} a month against ${info.required.toFixed(1)} needed`)
  pf.statusWorst = st
  void DEADLINE; void isWinter; void pct
}

/** Dawn of a new month. */
export function beginMonth(c: Ctx): void {
  const s = c.s
  for (const id of c.x.order) ps(c, id).fought = false
  resetCommands(c)
  s.flow = { stage: 'commands', f: 0, queue: null }
  storyEvents(c)
}
