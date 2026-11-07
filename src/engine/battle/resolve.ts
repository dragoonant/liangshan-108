// W-23..W-30, Q-8, X-1: the aftermath of a battle.
import type { BUnit, Faction } from '../types'
import type { Ctx } from '../ctx'
import { emit, EMPEROR, GAO_QIU, heroName, hs, place, prefGraft, prefName, ps, rank, compat, rec, chieftainId } from '../ctx'
import { clamp } from '../util'
import { dist } from '../data'
import { armedRatio } from '../strategic/economy'
import { addLoyalty, joinHero, freeHero } from '../strategic/heroes'
import { addRenown } from '../strategic/renown'
import { checkTriggers, joinLoyalty } from '../strategic/recruit'
import { checkChieftain, checkNoPrefecture, victory } from '../strategic/result'
import { openLinks } from './core'

function retreatPref(c: Ctx, faction: Faction, from: string): string | null {
  let best: string | null = null
  let bd = 1e9
  for (const id of c.x.order) {
    if (id === from || ps(c, id).owner !== faction) continue
    const d = dist(c.x, from, id)
    if (d < bd) { bd = d; best = id }
  }
  return best
}
function addMen(c: Ctx, pref: string, men: number, armed: number): void {
  const p = ps(c, pref)
  const room = Math.max(0, Math.floor(p.pop / 20) - p.men)
  const n = Math.min(men, room)
  p.men += n
  p.arms += Math.floor((n * armed) / 100)
}
const ret = (u: BUnit): number => (u.state === 'captured' ? 0 : Math.max(0, u.men - u.guard))
const isReal = (u: BUnit): boolean => !u.hero.startsWith('cap-')

export function finishBattle(c: Ctx): void {
  const s = c.s
  const b = s.battle
  if (!b || !b.result) return
  const aw = b.result.winner === 'a'
  const tgt = ps(c, b.target), org = ps(c, b.origin)
  const defFaction = b.defender
  const attFaction = b.attacker
  const humanSide = b.human
  const playerWon = humanSide !== null && humanSide === b.result.winner
  const prevGraft = defFaction === 'court' ? prefGraft(c, b.target) : 0
  const prevSupport = tgt.support
  const unitsA = b.units.filter((u) => u.side === 'a')
  const unitsD = b.units.filter((u) => u.side === 'd')
  const startMen = (us: BUnit[]): number => us.reduce((n, u) => n + u.maxMen, 0)
  const enemyBigger = humanSide ? startMen(humanSide === 'a' ? unitsD : unitsA) > startMen(humanSide === 'a' ? unitsA : unitsD) : false
  const retreat = aw ? retreatPref(c, defFaction, b.target) : null
  const captors: string[] = []
  const armedOf = (u: BUnit): number => u.armed

  // heroes: captives first
  const captiveHeroes: { hero: string; captorSide: 'a' | 'd' }[] = []
  for (const u of b.units) {
    if (!isReal(u) || u.state !== 'captured') continue
    captiveHeroes.push({ hero: u.hero, captorSide: u.capturedBy ?? (u.side === 'a' ? 'd' : 'a') })
  }
  // Gao Qiu's flight (W-26)
  const gao = b.units.find((u) => u.hero === GAO_QIU)
  let gaoFlee = false
  if (gao && gao.state === 'routed') {
    const g = hs(c, GAO_QIU)
    const far = openLinks(c, b.target).filter((p) => p !== b.origin || ps(c, p).owner !== 'player')
    // owner of the target is updated below; links toward player-held prefectures are cut either way
    gaoFlee = g.flights < 2 && far.length > 0
    if (!gaoFlee) {
      gao.state = 'captured'; gao.capturedBy = gao.side === 'a' ? 'd' : 'a'
      captiveHeroes.push({ hero: GAO_QIU, captorSide: gao.capturedBy })
    }
  }

  // casualties and survivors
  let garrison = 0, garrisonArms = 0
  for (const u of unitsA) {
    const r = ret(u)
    if (aw && u.commander && u.state !== 'captured') { garrison = r; garrisonArms = Math.floor((r * armedOf(u)) / 100) }
    else addMen(c, b.origin, r, armedOf(u))
  }
  if (!aw) for (const u of unitsD) addMen(c, b.target, ret(u), armedOf(u))
  const fled: { hero: string; pref: string | null }[] = []
  if (aw) {
    for (const u of unitsD) {
      if (!isReal(u) || u.state === 'captured') continue
      if (u.hero === GAO_QIU && gaoFlee) continue
      if (retreat) addMen(c, retreat, ret(u), armedOf(u))
      fled.push({ hero: u.hero, pref: retreat })
    }
  }
  void captors

  // conquest
  if (aw) {
    const goldHalf = Math.floor(tgt.gold / 2), foodHalf = Math.floor(tgt.food / 2)
    org.gold += tgt.gold - goldHalf; org.food += tgt.food - foodHalf
    tgt.gold = goldHalf; tgt.food = foodHalf
    const reserve = tgt.heroes.filter((h) => h !== EMPEROR && !b.units.some((u) => u.hero === h))
    tgt.owner = attFaction
    tgt.governor = attFaction === 'player' ? null : (b.units.find((u) => u.side === 'a' && u.commander)?.hero ?? null)
    tgt.men = Math.min(garrison, Math.floor(tgt.pop / 20)); tgt.arms = garrisonArms
    tgt.support = clamp(0, 100, tgt.support + (defFaction === 'court' && prevGraft >= 40 ? 10 : -15))
    tgt.unrest = false; tgt.tiger = tgt.tiger
    // attacking heroes occupy the prefecture
    for (const u of unitsA) if (isReal(u) && u.state !== 'captured') place(c, u.hero, b.target)
    const defenders = [...fled.map((f) => f.hero), ...reserve]
    for (const h of defenders) {
      if (h === GAO_QIU && gaoFlee) continue
      const dest = retreat
      if (dest) { place(c, h, dest); if (hs(c, h).faction === defFaction) { /* stays with its faction */ } }
      else {
        // Q-8: offered to the victor
        const cm = attFaction === 'player' ? (chieftainId(c) ? compat(c, chieftainId(c) as string, h) : 50) : 60
        if (cm >= 40) { joinHero(c, h, attFaction, attFaction === 'player' ? joinLoyalty(c, h, 'conquest') : 0, b.target) }
        else freeHero(c, h, b.target, 'refused to serve the conqueror')
      }
    }
    for (const f of Object.values(s.factions)) void f
    if (defFaction !== 'free' && defFaction !== 'court' && defFaction !== 'player' && !c.x.order.some((p) => ps(c, p).owner === defFaction)) { const rf = s.factions[defFaction]; if (rf) rf.alive = false }
    emit(c, 'conquered', 'W-27', `${prefName(c, b.target)} falls to ${attFaction === 'player' ? 'you' : attFaction}`, b.target)
    // captured defenders sit in the new prison; captured attackers in the defender's retreat or are freed
    // (handled with captives below)
  } else {
    emit(c, 'repulsed', 'W-25', `${prefName(c, b.target)} holds${b.result.reason === 'day-limit' ? ' (day limit)' : ''}`, b.target)
  }

  // captives
  const queue: string[] = []
  for (const cp of captiveHeroes) {
    const captorFaction: Faction = cp.captorSide === 'a' ? attFaction : defFaction
    const prisonPref = cp.captorSide === 'a' ? (aw ? b.target : b.origin) : (aw ? retreat ?? b.target : b.target)
    const h = hs(c, cp.hero)
    const wasPlayer = h.faction === 'player'
    h.status = 'captive'; h.faction = captorFaction; h.heldBy = captorFaction; h.loyalty = 0; h.wavering = false
    place(c, cp.hero, prisonPref)
    if (captorFaction === 'player') queue.push(cp.hero)
    if (wasPlayer) emit(c, 'captured', 'W-19', `${heroName(c, cp.hero)} is held in ${prefName(c, prisonPref)}`, prisonPref)
    if (cp.hero === GAO_QIU && captorFaction === 'player') { checkChieftain(c); victory(c); s.battle = null; return }
  }
  // Gao Qiu flees
  if (gaoFlee && gao) {
    const far = openLinks(c, b.target)
    let pick = far[0] as string
    let bm = -1
    for (const p of far) { const m = ps(c, p).owner === 'court' ? ps(c, p).men : 0; if (m > bm) { bm = m; pick = p } }
    const g = hs(c, GAO_QIU)
    g.flights++
    const p = ps(c, pick)
    if (p.owner !== 'court') { p.owner = 'court'; p.governor = null }
    place(c, GAO_QIU, pick)
    p.governor = GAO_QIU
    addMen(c, pick, ret(gao), armedOf(gao))
    emit(c, 'gaoFlees', 'W-26', `Gao Qiu flees to ${prefName(c, pick)} (flight ${g.flights} of 2)`, pick)
  }

  // renown and loyalty (player side only)
  if (humanSide) {
    const mine = humanSide === 'a' ? unitsA : unitsD
    if (playerWon) {
      let n = 1
      if (enemyBigger) n += 3
      if (b.imperial) n += 8
      addRenown(c, n, b.target, 'R-2', 'battles', `battle won at ${prefName(c, b.target)}`)
      if (humanSide === 'a' && defFaction === 'court' && prevGraft >= 40) addRenown(c, Math.min(14, 4 + Math.floor(prevGraft / 10)), b.target, 'R-2', 'justice', `a corrupt governor of ${prefName(c, b.target)} is toppled`)
      if (humanSide === 'a' && defFaction === 'court' && prevSupport < 40) addRenown(c, 2, b.target, 'R-2', 'justice', `${prefName(c, b.target)} is liberated`)
      s.fired.push(`won:${b.target}`)
      for (const u of (humanSide === 'a' ? unitsD : unitsA)) if (isReal(u) && u.state !== 'active') s.fired.push(`defeated:${u.hero}`)
    } else if (b.result.reason === 'day-limit' || b.result.reason === 'withdrew') {
      addRenown(c, -1, b.target, 'R-3', 'battles', 'withdrew from a battle')
    } else addRenown(c, -3, b.target, 'R-3', 'battles', `battle lost at ${prefName(c, b.target)}`)
    if (humanSide === 'd' && aw) addRenown(c, -5, b.target, 'R-3', 'battles', `${prefName(c, b.target)} lost`)
    for (const u of mine) if (isReal(u)) addLoyalty(c, u.hero, playerWon ? 3 : -5)
  }
  s.battle = null
  s.phase = 'strategic'
  checkTriggers(c)
  checkChieftain(c)
  checkNoPrefecture(c)
  if (s.phase === 'strategic' && queue.length && !s.pending) {
    const sorted = queue.sort((x, y) => rank(c, x) - rank(c, y))
    const actor = (b.units.find((u) => u.side === humanSide && u.commander)?.hero ?? chieftainId(c)) as string
    const first = sorted[0] as string
    const court = c.x.kindOf[first] === 'court'
    s.pending = { kind: 'captive', options: court ? ['persuade', 'release', 'hold', 'execute'] : ['persuade', 'release', 'hold'], data: { captive: first, queue: sorted.slice(1), actor, pref: hs(c, first).loc } }
  }
}
