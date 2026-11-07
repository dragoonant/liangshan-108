// query.*: every number the UI shows (Arch). Pure reads; never mutate the state they are given.
import type { Action, GameState, Hex } from '../types'
import type { Reject } from '../ctx'
import { mkCtx, hs, ps, heroName, prefName, rec, abil, chieftainId, rank, isNorth, snowedIn } from '../ctx'
import { defaultBundle } from '../data'
import type { DataBundle } from '../../data'
import { label, monthOf, season, lastT, edictBy } from '../calendar'
import { runway as runwayOf } from '../strategic/economy'
import { isReject, runCommand } from '../strategic/commands'
import type { Preview } from '../strategic/commands'
import { loyaltyLabel, oathStatus, restingLevel } from '../strategic/heroes'
import { persuadeOdds, recruitOdds } from '../strategic/recruit'
import { host } from '../strategic/court'
import { waveInfo } from '../battle/wave'
import { allyOdds, campView, followOdds, joinOdds } from '../strategic/camps'
import { renownInfo } from './renown'
import { dmgChain, finalDamage, getUnit, moveRange as bMoveRange, captureOdds as bCapture, counterPct, openLinks, cornered } from '../battle/core'
import { duelAccept, duelWin, duelLegal } from '../battle/actions'
import { hexDistance, parseKey } from '../battle/hex'
import { legalActions } from '../legal'
import { GAO_QIU } from '../ctx'

const BANNERS = [1, 3, 6, 12, 24]
export interface Hint { rule: string; text: string; command?: string }

export const query = {
  preview(s: GameState, a: Action, data: DataBundle = defaultBundle): Preview | Reject {
    return runCommand(mkCtx(s, data), a, 'player', true)
  },
  why(s: GameState, a: Action, data: DataBundle = defaultBundle): Reject | null {
    if (s.phase === 'result') return { code: 'game-over', message: 'X-5: the game is over' }
    if (s.pending && a.t !== 'choose') return { code: 'pending-decision', message: 'Arch: answer the open decision first' }
    if (!('pref' in a)) return null
    const r = runCommand(mkCtx(s, data), a, 'player', true)
    return isReject(r) ? r : null
  },
  runway(s: GameState, pref: string, data: DataBundle = defaultBundle): number { return runwayOf(mkCtx(s, data), pref) },
  renown(s: GameState) { return renownInfo(s) },
  deadline(s: GameState) {
    const left = lastT(s) - s.t
    const banner = BANNERS.find((b) => left <= b) ?? null
    const info = renownInfo(s)
    return { monthsLeft: left, lastLabel: label(lastT(s)), edictBy: edictBy(s), edictByLabel: label(edictBy(s)), banner, status: info.status }
  },
  forecast(s: GameState, data: DataBundle = defaultBundle) {
    const c = mkCtx(s, data)
    const snow = (t: number): string[] => c.x.d.map.links.filter((l) => snowedIn(c, l.a, l.b, t)).map((l) => `${l.a}-${l.b}`)
    const sorcerer = Object.keys(s.heroes).some((h) => hs(c, h).faction === 'player' && hs(c, h).loc && rec(c, h).skills.includes('sorcerer') && hs(c, h).status !== 'captive' && hs(c, h).status !== 'free' && hs(c, h).status !== 'dormant')
    return {
      now: { season: season(s.t), snowedIn: snow(s.t) },
      events: s.scheduled.filter((e) => e.fireT === s.t).map((e) => ({ ...e, text: `${e.id} at ${prefName(c, e.pref)}: ${e.effect}` })),
      next: { season: season(s.t + 1), label: label(s.t + 1), snowedIn: snow(s.t + 1) },
      ahead: sorcerer ? { season: season(s.t + 2), label: label(s.t + 2), snowedIn: snow(s.t + 2) } : null,
    }
  },
  loyalty(s: GameState, hero: string, data: DataBundle = defaultBundle) {
    const c = mkCtx(s, data)
    const h = hs(c, hero)
    const lab = loyaltyLabel(c, hero)
    return { loyalty: h.loyalty, resting: restingLevel(c, hero), label: lab, monthsToDesertion: h.status !== 'ordinary' || h.loyalty > 25 ? null : h.wavering ? 1 : 2 }
  },
  oath(s: GameState, hero: string, data: DataBundle = defaultBundle) { return oathStatus(mkCtx(s, data), hero) },
  recruitOdds(s: GameState, actor: string, target: string, method: 'invite' | 'persuade' = 'invite', data: DataBundle = defaultBundle) {
    const c = mkCtx(s, data)
    return method === 'invite' ? recruitOdds(c, 'player', actor, target) : persuadeOdds(c, 'player', actor, target)
  },
  /** K-8: every camp with its chief, heroes, men, alliance state and the three odds (K-5, K-6, K-7). */
  camps(s: GameState, data: DataBundle = defaultBundle) {
    const c = mkCtx(s, data)
    const ch = chieftainId(c)
    const actor = ch && hs(c, ch).loc ? ch : undefined
    return c.x.camps.map((k) => campView(c, k.id, actor))
  },
  /** W-32: reinforcement waves at the capital: arrival days, what has arrived, what would be sent now. */
  wave(s: GameState, data: DataBundle = defaultBundle) { return waveInfo(mkCtx(s, data)) },
  campOdds(s: GameState, camp: string, actor: string, data: DataBundle = defaultBundle): { ally: number; join: number } | null {
    const c = mkCtx(s, data)
    if (!c.x.campOf[camp] || !s.factions[camp]) return null
    return { ally: allyOdds(c, camp, actor), join: joinOdds(c, camp) }
  },
  followOdds(s: GameState, member: string, data: DataBundle = defaultBundle): number { return followOdds(mkCtx(s, data), member) },
  attackPreview(s: GameState, unit: string, target: string) {
    const b = s.battle
    const u = b && getUnit(b, unit), t = b && getUnit(b, target)
    if (!b || !u || !t) return null
    const melee = hexDistance(u.pos, t.pos) === 1
    const pct = melee ? (u.kind === 'archers' ? 70 : 100) : 70
    const ch = dmgChain(b, u, t, pct, melee)
    const back = melee ? dmgChain(b, t, u, counterPct(t, false), true, true) : null
    return {
      min: finalDamage(ch.value, t, -10), max: finalDamage(ch.value, t, 10), base: ch.value, factors: ch.factors,
      counter: back ? { min: finalDamage(back.value, u, -10), max: finalDamage(back.value, u, 10) } : null,
    }
  },
  moveRange(s: GameState, unit: string): { to: Hex; cost: number }[] {
    const b = s.battle
    const u = b && getUnit(b, unit)
    if (!b || !u) return []
    return [...bMoveRange(b, u)].map(([k, v]) => ({ to: parseKey(k), cost: v.cost }))
  },
  duelOdds(s: GameState, unit: string, target: string, stake: 'honour' | 'capture', data: DataBundle = defaultBundle) {
    const b = s.battle
    const u = b && getUnit(b, unit), t = b && getUnit(b, target)
    if (!b || !u || !t) return null
    const c = mkCtx(s, data)
    return { accept: duelAccept(c, b, u, t, stake), win: duelWin(u, t).win, legal: duelLegal(b, u, t, stake) }
  },
  captureOdds(s: GameState, unit: string): number | null {
    const b = s.battle
    const u = b && getUnit(b, unit)
    return b && u ? bCapture(b, u) : null
  },
  fatigue(s: GameState, unit: string) {
    const u = s.battle && getUnit(s.battle, unit)
    return u ? { value: u.fatigue, causes: u.fatigueLog } : null
  },
  battleClock(s: GameState, data: DataBundle = defaultBundle) {
    const b = s.battle
    if (!b) return null
    const c = mkCtx(s, data)
    return { day: b.day, days: 20, daysLeft: 20 - b.day, lastDays: b.day >= 18, foodAttacker: ps(c, b.origin).food, foodDefender: ps(c, b.target).food, hungry: b.hungry }
  },
  escapeRoutes(s: GameState, data: DataBundle = defaultBundle) {
    const c = mkCtx(s, data)
    const at = hs(c, GAO_QIU).loc ?? c.x.capital
    return { at, flights: hs(c, GAO_QIU).flights, links: (c.x.adj[at] ?? []).map((n) => ({ to: n.to, state: ps(c, n.to).owner === 'player' ? 'cut' : 'open' })).sort((a, b) => (a.to < b.to ? -1 : 1)) }
  },
  campaign(s: GameState, data: DataBundle = defaultBundle) {
    const c = mkCtx(s, data)
    const cp = s.factions['court']!.campaign
    return {
      announced: !!cp, staging: cp?.staging ?? null, objective: cp?.objective ?? null, hostSize: Math.floor(host(s.t) / 2),
      marchesIn: cp ? Math.max(0, cp.announcedT + 1 - s.t) : null, next: s.factions['court']!.nextCampaign,
      text: cp ? `The court musters at ${prefName(c, cp.staging)} to march on ${prefName(c, cp.objective)} next month` : null,
    }
  },
  advice(s: GameState, data: DataBundle = defaultBundle): { pinned: boolean; hints: Hint[] } {
    const c = mkCtx(s, data)
    const out: Hint[] = []
    const r = renownInfo(s)
    if (!r.granted && r.status !== 'green' && r.status !== 'measuring') out.push({ rule: 'R-8', text: `Edict pace is ${r.status}: you need ${r.required.toFixed(1)} Renown a month and earn ${r.rate.toFixed(1)}. Relieve, hunt bandits and win battles.`, command: 'relieve' })
    for (const id of c.x.order) {
      const p = ps(c, id)
      if (p.owner !== 'player') continue
      const rw = runwayOf(c, id)
      if (rw < 2) out.push({ rule: 'E-9', text: `Food lasts ${rw.toFixed(1)} months in ${prefName(c, id)}: trade gold for food (E-9)`, command: 'trade' })
      if (p.unrest) out.push({ rule: 'H-16', text: `${prefName(c, id)} may revolt: support ${p.support} (raise it above 15)`, command: 'relieve' })
    }
    for (const h of Object.keys(s.heroes)) {
      const x = s.heroes[h]!
      if (x.faction === 'player' && x.status === 'ordinary' && x.loc) {
        if (x.loyalty <= 25) out.push({ rule: 'H-14', text: `${heroName(c, h)} is wavering (loyalty ${x.loyalty}): feast, or win a battle`, command: 'rest' })
        else if (oathStatus(c, h).ok) out.push({ rule: 'B-1', text: `${heroName(c, h)} is ready to swear brotherhood`, command: 'swear' })
      }
    }
    const cp = s.factions['court']!.campaign
    if (cp) out.push({ rule: 'G-6', text: `The court marches on ${prefName(c, cp.objective)} next month`, command: 'attack' })
    const idle = Object.entries(s.commandsLeft).filter(([id]) => s.prefectures[id]?.owner === 'player').reduce((a, [, n]) => a + n, 0) // only the player's own prefectures
    if (idle > 0 && s.phase === 'strategic') out.push({ rule: 'T-3', text: `${idle} command(s) unused this month` })
    return { pinned: s.t < 3, hints: out.slice(0, 3) }
  },
  legal(s: GameState, data: DataBundle = defaultBundle): Action[] { return legalActions(s, data) },
}
void abil; void chieftainId; void rank; void isNorth; void monthOf; void openLinks; void cornered
