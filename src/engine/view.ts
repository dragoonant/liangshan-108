// view(state, seat): Z-5 fog, forecast, warnings, ledger, advice. Also used by the AIs (A-1) with a faction id.
import type { BUnit, GameState, LedgerEntry, Pending } from './types'
import { defaultBundle } from './data'
import type { DataBundle } from '../data'
import { mkCtx, hs, ps, heroName, prefName } from './ctx'
import { label } from './calendar'
import { query } from './query'
import { perceive, decideStrategic } from '../ai/greedy'
import { runway } from './strategic/economy'
import { visibleTo } from './battle/core'

export interface PrefView {
  id: string; owner: string; exact: boolean; pop: number; gold: number; food: number; men: number; arms: number; heroes: string[]
  training?: number; support?: number; land?: number; dyke?: number; bandits?: number; runway?: number; unrest?: boolean; tiger?: boolean; commands?: number
  protectedCapital?: boolean
}
export interface HeroView { id: string; faction: string; status: string; loc: string | null; loyalty?: number; wavering?: boolean }
export interface Warning { level: 'amber' | 'red'; rule: string; text: string; pref?: string }
export interface GameView {
  t: number; label: string; phase: GameState['phase']; pending: Pending | null
  renown: ReturnType<typeof query.renown>; deadline: ReturnType<typeof query.deadline>
  prefectures: Record<string, PrefView>; heroes: Record<string, HeroView>
  forecast: ReturnType<typeof query.forecast>; warnings: Warning[]; ledger: LedgerEntry[]; advice: ReturnType<typeof query.advice>
  battle: null | { day: number; toAct: string; human: string | null; units: BUnit[]; terrain: Record<string, string>; burning: Record<string, number>; wind: number; weather: unknown }
  result: GameState['result']; log: GameState['log']
}

export function view(s: GameState, seat: string = 'player', data: DataBundle = defaultBundle): GameView {
  const c = mkCtx(s, data)
  const faction = seat === 'observer' ? 'player' : seat
  const prefectures: Record<string, PrefView> = {}
  for (const id of c.x.order) {
    const p = ps(c, id)
    const v = perceive(c, faction, id)
    const pv: PrefView = { id, owner: p.owner, exact: v.exact, pop: v.pop, gold: v.gold, food: v.food, men: v.men, arms: v.arms, heroes: [...p.heroes] }
    if (v.exact) {
      Object.assign(pv, { training: p.training, support: p.support, land: p.land, dyke: p.dyke, bandits: p.bandits, runway: runway(c, id), unrest: p.unrest, tiger: p.tiger !== null, commands: s.commandsLeft[id] ?? 0 })
    }
    if (id === c.x.capital && s.factions['player']!.edict === null) pv.protectedCapital = true
    prefectures[id] = pv
  }
  const heroes: Record<string, HeroView> = {}
  for (const id of Object.keys(s.heroes)) {
    const h = s.heroes[id]!
    const hv: HeroView = { id, faction: h.faction, status: h.status, loc: h.loc }
    if (h.faction === faction && h.status === 'ordinary') { hv.loyalty = h.loyalty; hv.wavering = h.wavering }
    heroes[id] = hv
  }
  const warnings: Warning[] = []
  for (const id of c.x.order) {
    const p = ps(c, id)
    if (p.owner !== faction) continue
    const rw = runway(c, id)
    if (rw < 1) warnings.push({ level: 'red', rule: 'E-9', text: `${prefName(c, id)}: food runs out; about ${Math.min(p.men, Math.max(1, Math.ceil(p.men / 10) - p.food) * 10)} men will desert`, pref: id })
    else if (rw < 2) warnings.push({ level: 'amber', rule: 'E-9', text: `${prefName(c, id)}: food for ${rw.toFixed(1)} months`, pref: id })
    if (p.unrest) warnings.push({ level: 'red', rule: 'H-16', text: `${prefName(c, id)}: will revolt next month if support stays at 15 or less`, pref: id })
    else if (p.support <= 25 && faction === 'player') warnings.push({ level: 'amber', rule: 'H-16', text: `${prefName(c, id)}: support ${p.support}`, pref: id })
  }
  if (faction === 'player') {
    for (const id of Object.keys(s.heroes)) {
      const h = s.heroes[id]!
      if (h.faction !== 'player' || h.status !== 'ordinary') continue
      if (h.loyalty <= 25) warnings.push({ level: 'red', rule: 'H-14', text: `${heroName(c, id)} is wavering: will leave next month unless loyalty rises`, pref: h.loc ?? undefined })
      else if (h.loyalty < 40) warnings.push({ level: 'amber', rule: 'H-14', text: `${heroName(c, id)} is restless`, pref: h.loc ?? undefined })
    }
    // A-8: with a scout in service, the view names every march the AI intends against you this month
    const scout = Object.keys(s.heroes).some((h) => hs(c, h).faction === 'player' && hs(c, h).loc && ['chieftain', 'sworn', 'ordinary'].includes(hs(c, h).status) && data.heroes.find((x) => x.id === h)?.skills.includes('scout'))
    if (scout && s.phase === 'strategic' && s.flow.stage === 'commands') {
      for (const f of [...Object.keys(s.factions).filter((x) => x !== 'player' && x !== 'court' && s.factions[x]!.alive).sort()]) {
        for (const id of c.x.order) {
          if (ps(c, id).owner !== f || (s.commandsLeft[id] ?? 0) <= 0) continue
          const a = decideStrategic(c, f, id)
          if (a && a.t === 'attack' && ps(c, a.target).owner === 'player') warnings.push({ level: 'amber', rule: 'A-8', text: `Scouts report: ${prefName(c, id)} may march on ${prefName(c, a.target)} this month`, pref: a.target })
        }
      }
    }
    const cp = s.factions['court']!.campaign
    if (cp) warnings.push({ level: 'red', rule: 'G-6', text: `The court musters at ${prefName(c, cp.staging)} to march on ${prefName(c, cp.objective)} next month`, pref: cp.objective })
  }
  let battle: GameView['battle'] = null
  if (s.battle) {
    const b = s.battle
    const side = b.human ?? 'a'
    battle = { day: b.day, toAct: b.toAct, human: b.human, units: b.units.filter((u) => visibleTo(b, side, u)), terrain: b.terrain, burning: b.burning, wind: b.wind, weather: b.weather }
  }
  const f = s.factions['player']!
  return {
    t: s.t, label: label(s.t), phase: s.phase, pending: s.pending, renown: query.renown(s), deadline: query.deadline(s), prefectures, heroes,
    forecast: query.forecast(s, data), warnings, ledger: f.ledger.filter((e) => e.t >= s.t - 24), advice: query.advice(s, data), battle, result: s.result, log: s.log.slice(-100),
  }
}
