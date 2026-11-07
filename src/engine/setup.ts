// createGame: S-1 start, S-8 displacement, Q-6 hero placement (docs/spec/11-scenario.md section 7).
import type { DataBundle } from '../data'
import { defaultBundle, dist } from './data'
import { CAMPAIGN_K } from './calendar'
import { mkCtx, ps, hs, place, EMPEROR } from './ctx'
import type { Ctx } from './ctx'
import { splitmixSeed } from './rng'
import type { FactionState, GameState, HeroState, PrefectureState, Setup } from './types'
import { resetCommands } from './strategic/commands'
import { raiseTiger } from './strategic/events'

interface StartRow { pref: string; gold: number; food: number; men: number; arms: number; training: number; support: number; renown: number }
export const STARTS: Record<string, StartRow> = {
  'song-jiang': { pref: 'yunzhou', gold: 1500, food: 2500, men: 600, arms: 300, training: 30, support: 70, renown: 30 },
  'chao-gai': { pref: 'yunzhou', gold: 2000, food: 2500, men: 700, arms: 500, training: 45, support: 60, renown: 20 },
  'lin-chong': { pref: 'mengzhou', gold: 800, food: 1200, men: 900, arms: 700, training: 70, support: 35, renown: 10 },
  'wu-song': { pref: 'cangzhou', gold: 600, food: 1000, men: 400, arms: 400, training: 50, support: 60, renown: 45 },
  'lu-zhishen': { pref: 'weizhou', gold: 300, food: 1800, men: 700, arms: 600, training: 60, support: 50, renown: 15 },
  'hu-sanniang': { pref: 'zhujiazhuang', gold: 2500, food: 3000, men: 800, arms: 800, training: 55, support: 60, renown: 15 },
}
export const START_HEROES = Object.keys(STARTS)

const newHero = (faction: string, status: HeroState['status'], loc: string | null): HeroState => ({
  faction, status, loc, loyalty: 0, wounded: 0, inviteBlock: 0, wavering: false, flights: 0, bonus: 0, persuadedT: -99, heldBy: null,
})

export function createGame(setup: Setup, data: DataBundle = defaultBundle, opts?: { forcedRolls?: number[] }): GameState {
  const row = STARTS[setup.startHero]
  const s: GameState = {
    schema: 1, setup: { startHero: setup.startHero, difficulty: setup.difficulty, seed: setup.seed }, t: 0, phase: 'strategic', pending: null,
    rng: { s: splitmixSeed(setup.seed), forced: [...(opts?.forcedRolls ?? [])], draws: 0 },
    prefectures: {}, heroes: {}, factions: {}, scheduled: [], commandsLeft: {}, battle: null,
    flow: { stage: "commands", f: 0, queue: null }, fired: [], log: [], result: null,
  }
  const c = mkCtx(s, data)
  const x = c.x
  if (!row) {
    // Unknown start hero: fall back to the first of the six so createGame never throws.
    s.setup.startHero = 'song-jiang'
  }
  const start = STARTS[s.setup.startHero] as StartRow

  // 1. prefectures (E-3 numbers filled after owners and governors are known)
  const ownerOf: Record<string, string> = {}
  const courtHero = data.court
  const courtSpecial = ['capital', 'imperial-garrison', 'western-capital']
  const rivalOwner: Record<string, string> = {}
  for (const r of x.rivals) if (r.year <= 1101) rivalOwner[r.stronghold] = r.id
  for (const k of x.camps) rivalOwner[k.stronghold] = k.id
  for (const id of x.order) {
    const rec = x.pref[id]!
    if (rivalOwner[id]) ownerOf[id] = rivalOwner[id]!
    else if (courtHero.some((h) => h.start.prefecture === id) || rec.special.some((t) => courtSpecial.includes(t))) ownerOf[id] = 'court'
    else ownerOf[id] = 'free'
  }
  const courtPrefs = x.order.filter((id) => ownerOf[id] === 'court')
  // court heroes relocate to the nearest court prefecture when theirs is not court-held (scenario section 3)
  const courtLoc: Record<string, string> = {}
  for (const h of courtHero) {
    let at = h.start.prefecture
    if (ownerOf[at] !== 'court') {
      let best = ''; let bd = 1e9
      for (const p of [...courtPrefs].sort()) { const d = dist(x, at, p); if (d < bd) { bd = d; best = p } }
      at = best
    }
    courtLoc[h.id] = at
  }
  const governor: Record<string, string | null> = {}
  for (const id of courtPrefs) governor[id] = courtHero.find((h) => h.id !== EMPEROR && courtLoc[h.id] === id)?.id ?? null
  for (const id of x.order) {
    const rec = x.pref[id]!
    const pop = rec.base.population
    const owner = ownerOf[id] as string
    const isCourt = owner === 'court'
    const gov = isCourt ? governor[id] ?? null : null
    const graft = gov ? Math.max(10, Math.min(95, 95 - 9 * (x.hero[gov]!.virtues.righteousness) - 2 * (x.hero[gov]!.virtues.compassion))) : 50
    const men = Math.floor(pop / (isCourt ? 90 : 150))
    const support = isCourt ? 70 - Math.floor(graft / 2) : 50
    const p: PrefectureState = {
      owner, pop, gold: Math.floor(pop / 100), food: Math.floor(pop / 40), men, arms: men, training: isCourt ? 60 : 40, support,
      land: rec.base.land, dyke: rec.base.flood, bandits: 40 + Math.floor((100 - support) / 2), unrest: false, heroes: [], captives: [],
      governor: gov, fought: false, tiger: null, plague: false, disasterT: -99, drought: false, famineT: -99, reliefT: -99, huntT: -99, forgedT: -99,
      graftMod: 0, spyT: -99, stormT: -99, starvedT: -99,
    }
    s.prefectures[id] = p
  }

  // 2. factions
  const mkF = (): FactionState => ({ alive: true, renown: 0, renownStart: 0, renownHistory: [], ledger: [], edict: null, edictBuild: 0, chieftain: null, statusWorst: 0, nextCampaign: 0, campaign: null, inspectionAdvance: 0, allyUntil: 0, allySince: 0 })
  s.factions['player'] = { ...mkF(), renown: start.renown, renownStart: start.renown, chieftain: s.setup.startHero }
  s.factions['court'] = { ...mkF(), nextCampaign: CAMPAIGN_K[s.setup.difficulty] - 1 }
  for (const r of x.rivals) s.factions[r.id] = { ...mkF(), alive: r.year <= 1101 }
  for (const k of x.camps) s.factions[k.id] = { ...mkF(), chieftain: k.chief }

  // 3. hero placement (Q-6)
  const prevOwner = ownerOf[start.pref] as string
  for (const h of [...data.heroes, ...data.extra]) {
    if (h.id === s.setup.startHero) continue
    const hsx = newHero('free', 'free', h.start.prefecture)
    if (h.joinsLate) { hsx.status = 'dormant'; hsx.loc = null; s.heroes[h.id] = hsx; continue }
    const own = ownerOf[h.start.prefecture]
    if (h.start.status === 'official' && own === 'court') hsx.faction = 'court', hsx.status = 'ordinary'
    else if (h.start.status === 'outlaw' && own && own !== 'court' && own !== 'free') hsx.faction = own, hsx.status = 'ordinary'
    else if (h.start.status === 'captive-of-court' && own === 'court') hsx.faction = 'court', hsx.status = 'captive', hsx.heldBy = 'court'
    s.heroes[h.id] = hsx
  }
  s.heroes[s.setup.startHero] = newHero('player', 'chieftain', start.pref)
  s.heroes[s.setup.startHero]!.loyalty = 100
  for (const h of courtHero) s.heroes[h.id] = newHero('court', 'ordinary', courtLoc[h.id] ?? null)
  for (const h of data.rivals) {
    const fid = x.rivals.find((r) => r.heroes.includes(h.id))?.id ?? 'free'
    s.heroes[h.id] = h.start.year <= 1101 ? newHero(fid, 'ordinary', h.start.prefecture) : { ...newHero(fid, 'dormant', null) }
  }
  for (const id of Object.keys(s.heroes)) {
    const h = s.heroes[id] as HeroState
    const loc = h.loc
    h.loc = null
    if (loc) place(c, id, loc)
  }
  for (const id of courtPrefs) ps(c, id).governor = governor[id] ?? null

  // 4. start prefecture goes to the player; displacement (S-8)
  const sp = ps(c, start.pref)
  const displaced = [...sp.heroes]
  for (const id of displaced) {
    const h = hs(c, id)
    if (id !== s.setup.startHero && (h.faction === prevOwner)) { h.faction = 'free'; h.status = 'free' }
  }
  for (const id of [...sp.captives]) { const h = hs(c, id); h.faction = 'free'; h.status = 'free'; h.heldBy = null; sp.captives = sp.captives.filter((q) => q !== id); sp.heroes.push(id) }
  if (!sp.heroes.includes(s.setup.startHero)) place(c, s.setup.startHero, start.pref)
  sp.owner = 'player'; sp.governor = null
  sp.gold = start.gold; sp.food = start.food; sp.men = start.men; sp.arms = start.arms; sp.training = start.training; sp.support = start.support
  sp.bandits = 40 + Math.floor((100 - sp.support) / 2)
  const pf = s.factions[prevOwner]
  if (pf && prevOwner !== 'court' && prevOwner !== 'free') {
    if (!x.order.some((id) => ps(c, id).owner === prevOwner)) pf.alive = false
  }

  // 5. followers (S-9): two lowest-rank free heroes whose data start is this prefecture
  const followers = [...data.heroes, ...data.extra]
    .filter((h) => !h.joinsLate && h.start.status === 'free' && h.start.prefecture === start.pref && h.id !== s.setup.startHero)
    .sort((a, b) => (a.star?.rank ?? 999) - (b.star?.rank ?? 999))
    .slice(0, 2)
  for (const h of followers) { const st = hs(c, h.id); st.faction = 'player'; st.status = 'ordinary'; st.loyalty = 60 }

  // governors keep their place; graft-based support was fixed above. Commands (T-3) and the scripted tiger (V-6).
  resetCommands(c)
  if (s.setup.startHero === 'wu-song') {
    ps(c, start.pref).tiger = 0
    raiseTiger(c, start.pref)
  }
  return s
}

export type { Ctx }
