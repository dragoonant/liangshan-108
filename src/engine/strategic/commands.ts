// E-12 commands (T-3, T-10): one code path for validation, preview and effect, shared by the player and the AI.
import type { Action, SpyOp } from '../types'
import type { Ctx, Reject } from '../ctx'
import {
  abil, ableHeroes, anyHas, chieftainId, compat, EMPEROR, emit, has, heroName, hs, isPlayerHero, linkKind, place, prefName, ps, rec, rej, snowedIn, graftOf, prefGraft, rank,
} from '../ctx'
import { roll } from '../rng'
import { clamp } from '../util'
import { TUNE } from '../tuning'
import { dist } from '../data'
import { harvestOf, levyAmount, priceOf, trainGain, tradeValue } from './economy'
import { addLoyalty, addLoyaltyAt, oathStatus } from './heroes'
import { addRenown } from './renown'
import { inviteHero, persuadeOdds, recruitOdds, joinLoyalty, rollCheck, captiveChoice } from './recruit'
import { startBattle } from '../battle/setup'
import { joinHero } from './heroes'
import { ALLY_COST, ALLY_MONTHS, allied, allyOdds, campChief, isCamp } from './camps'

export interface Preview { rule: string; text: string; gold: number; food: number; lo?: number; hi?: number; pct?: number }
export const isReject = (x: Reject | Preview): x is Reject => 'code' in x

/** T-3 */
export const LOYAL_GOVERNOR = 60
export function commandCap(c: Ctx, pref: string): number {
  const p = ps(c, pref)
  if (p.owner === 'player') {
    const ch = chieftainId(c)
    if (ch && hs(c, ch).loc === pref) return 2
    if (p.heroes.some((h) => hs(c, h).status === 'sworn' && hs(c, h).faction === 'player')) return 1
    if (p.heroes.some((h) => hs(c, h).faction === 'player' && hs(c, h).status === 'ordinary' && hs(c, h).wounded <= c.s.t && hs(c, h).loyalty >= LOYAL_GOVERNOR)) return 1 // D20
    return 0
  }
  if (p.owner === 'free') return 0
  return ableHeroes(c, pref).some((h) => hs(c, h).faction === p.owner) ? 1 : 0
}
export function resetCommands(c: Ctx): void {
  c.s.commandsLeft = {}
  for (const id of c.x.order) c.s.commandsLeft[id] = commandCap(c, id)
}

export function spyRange(c: Ctx, actor: string): number {
  return has(c, actor, 'runner') ? 99 : has(c, actor, 'scout') ? 3 : 2
}
export function spyOdds(c: Ctx, actor: string, target: string, op: SpyOp): number {
  const def = Math.max(30, ...ps(c, target).heroes.filter((h) => h !== EMPEROR).map((h) => abil(c, h).cunning))
  const need: Record<SpyOp, string[]> = { report: ['scout'], steal: ['thief'], discord: ['strategist'], expose: ['scribe'], burn: ['firebrand'], 'forged-order': ['forger'], jailbreak: ['thief', 'forger'] }
  const match = need[op].filter((sk) => has(c, actor, sk)).length
  return clamp(10, 90, 40 + Math.floor((abil(c, actor).cunning - def) / 2) + 10 * match)
}
export function huntOdds(c: Ctx, pref: string, actor: string, party: string[], men: number): number {
  const p = ps(c, pref)
  const power = abil(c, actor).might + 20 * party.length + Math.floor(men / 50) + (has(c, actor, 'swordsman') ? 10 : 0)
  return clamp(10, 95, 50 + Math.floor((power - Math.floor(p.bandits / 5)) / 2))
}

function movePath(c: Ctx, faction: string, from: string, to: string, heroes: string[]): { ok: true; steps: number } | { ok: false; why: string } {
  const adj = c.x.adj[from] ?? []
  const direct = adj.find((n) => n.to === to)
  const marine = heroes.some((h) => has(c, h, 'marine')), swimmer = heroes.some((h) => has(c, h, 'swimmer')), horse = heroes.some((h) => has(c, h, 'horseman'))
  const okKind = (kind: string): boolean => kind !== 'marsh-water' || marine || swimmer
  if (direct) {
    if (!okKind(direct.kind)) return { ok: false, why: 'a marsh-water link needs a marine or swimmer in the party (E-15)' }
    if (snowedIn(c, from, to)) return { ok: false, why: 'the link is snowed in (T-6)' }
    return { ok: true, steps: 1 }
  }
  for (const m of adj) {
    if (ps(c, m.to).owner !== faction || !c.x.adj[m.to]?.some((n) => n.to === to)) continue
    const k2 = linkKind(c, m.to, to) as string
    const road = m.kind === 'road' && k2 === 'road' && horse
    const water = (m.kind === 'river' || m.kind === 'marsh-water') && (k2 === 'river' || k2 === 'marsh-water') && marine
    if ((road || water) && !snowedIn(c, from, m.to) && !snowedIn(c, m.to, to)) return { ok: true, steps: 2 }
  }
  return { ok: false, why: 'not reachable in one link (a horseman may go 2 road links, a marine 2 water links) (E-15)' }
}

/** Validates (and, unless `dry`, applies) one command. Returns a Preview on success, a Reject otherwise. */
export function runCommand(c: Ctx, a: Action, faction: string, dry: boolean): Reject | Preview {
  const s = c.s
  if (!('pref' in a)) return rej('unknown-action', 'E-12', 'not a strategic command')
  const p = s.prefectures[a.pref]
  if (!p || p.owner !== faction) return rej('illegal-target', 'T-3', 'that prefecture is not yours')
  if ((s.commandsLeft[a.pref] ?? 0) <= 0) return rej('no-commands-left', 'T-3', 'no commands left there this month')
  const spend = (): void => { s.commandsLeft[a.pref] = (s.commandsLeft[a.pref] ?? 1) - 1 }
  const actorOk = (id: string): boolean => {
    const h = s.heroes[id]
    return !!h && h.faction === faction && h.loc === a.pref && h.status !== 'captive' && h.wounded <= s.t && id !== EMPEROR
  }
  const player = faction === 'player'
  const name = prefName(c, a.pref)
  switch (a.t) {
    case 'levy': {
      if (!actorOk(a.actor)) return rej('requirement-not-met', 'E-12', 'actor is not available there')
      const n = levyAmount(c, a.pref, a.actor)
      if (n <= 0) return rej('not-enough-men', 'E-2', 'no one can be levied (gold, population or the men cap)')
      const pv: Preview = { rule: 'E-12', text: `Levy ${n} men for ${n} gold; support -3`, gold: n, food: 0, lo: n, hi: n }
      if (dry) return pv
      const lowSupport = p.support < 30
      p.gold -= n; p.pop -= n; p.men += n; p.support = clamp(0, 100, p.support - 3)
      spend()
      emit(c, 'levy', 'E-12', `${name}: ${n} men levied for ${n} gold`, a.pref, n)
      if (player && lowSupport) {
        addRenown(c, -1, a.pref, 'R-3', 'relief', 'levy while the people are restless')
        addLoyaltyAt(c, a.pref, -4, (h) => rec(c, h).virtues.compassion >= 7)
      }
      return pv
    }
    case 'train': {
      if (!actorOk(a.actor)) return rej('requirement-not-met', 'E-12', 'actor is not available there')
      const cost = Math.ceil(p.men / 20)
      if (p.men <= 0 || p.training >= 100) return rej('requirement-not-met', 'E-12', 'nothing to train')
      if (p.gold < cost) return rej('not-enough-gold', 'E-12', `needs ${cost} gold`)
      const g = Math.min(100 - p.training, trainGain(c, a.actor))
      const pv: Preview = { rule: 'E-12', text: `Training +${g} for ${cost} gold`, gold: cost, food: 0, lo: g, hi: g }
      if (dry) return pv
      p.gold -= cost; p.training += g; spend()
      emit(c, 'train', 'E-12', `${name}: training +${g}`, a.pref, g)
      return pv
    }
    case 'forge': {
      if (!actorOk(a.actor)) return rej('requirement-not-met', 'E-12', 'actor is not available there')
      const n = has(c, a.actor, 'smith') || anyHas(c, a.pref, 'smith') ? 600 : 400
      if (p.gold < n) return rej('not-enough-gold', 'E-12', `needs ${n} gold`)
      const pv: Preview = { rule: 'E-12', text: `Forge ${n} arms for ${n} gold`, gold: n, food: 0, lo: n, hi: n }
      if (dry) return pv
      p.gold -= n; p.arms += n; spend()
      emit(c, 'forge', 'E-12', `${name}: ${n} arms forged`, a.pref, n)
      return pv
    }
    case 'trade': {
      if (!actorOk(a.actor)) return rej('requirement-not-met', 'E-12', 'actor is not available there')
      const amt = Math.floor(a.amount)
      if (!(amt >= 1 && amt <= 1000)) return rej('requirement-not-met', 'E-12', 'trade 1 to 1000 food')
      const v = tradeValue(c, a.actor, a.dir, amt)
      if (a.dir === 'buyFood') { if (p.gold < v) return rej('not-enough-gold', 'E-13', `needs ${v} gold`) }
      else if (p.food < amt) return rej('not-enough-food', 'E-13', 'not enough food to sell')
      const pv: Preview = { rule: 'E-13', text: a.dir === 'buyFood' ? `Buy ${amt} food for ${v} gold (${priceOf(s.t)} per 10)` : `Sell ${amt} food for ${v} gold`, gold: a.dir === 'buyFood' ? v : 0, food: a.dir === 'sellFood' ? amt : 0, lo: v, hi: v }
      if (dry) return pv
      if (a.dir === 'buyFood') { p.gold -= v; p.food += amt } else { p.gold += v; p.food -= amt }
      spend()
      emit(c, 'trade', 'E-13', `${name}: ${pv.text}`, a.pref, amt)
      return pv
    }
    case 'dykes': {
      if (!actorOk(a.actor)) return rej('requirement-not-met', 'E-12', 'actor is not available there')
      if (p.dyke >= 100) return rej('requirement-not-met', 'E-12', 'dykes are complete')
      if (p.gold < 200) return rej('not-enough-gold', 'E-12', 'needs 200 gold')
      if (p.food < 100) return rej('not-enough-food', 'E-12', 'needs 100 food')
      const g = Math.min(100 - p.dyke, has(c, a.actor, 'builder') ? 25 : 15)
      const pv: Preview = { rule: 'E-12', text: `Dykes +${g} for 200 gold and 100 food`, gold: 200, food: 100, lo: g, hi: g }
      if (dry) return pv
      p.gold -= 200; p.food -= 100; p.dyke += g; spend()
      emit(c, 'dykes', 'E-12', `${name}: dykes +${g}`, a.pref, g)
      return pv
    }
    case 'relieve': {
      if (!actorOk(a.actor)) return rej('requirement-not-met', 'E-12', 'actor is not available there')
      if (p.food < 300) return rej('not-enough-food', 'E-12', 'needs 300 food')
      const g = 8 + (abil(c, a.actor) && rec(c, a.actor).virtues.compassion >= 7 ? 2 : 0) + (anyHas(c, a.pref, 'physician') || anyHas(c, a.pref, 'monk') ? 2 : 0)
      const pv: Preview = { rule: 'E-12', text: `Relief: 300 food, support +${g}`, gold: 0, food: 300, lo: g, hi: g }
      if (dry) return pv
      p.food -= 300; p.support = clamp(0, 100, p.support + g); spend()
      emit(c, 'relief', 'E-12', `${name}: relief given, support +${g}`, a.pref, g)
      if (player && p.reliefT !== s.t) {
        p.reliefT = s.t
        addRenown(c, p.famineT === s.t ? TUNE.reliefRenown + 2 : TUNE.reliefRenown, a.pref, 'R-2', 'relief', `relief in ${name}`)
      }
      return pv
    }
    case 'rest': {
      if (!actorOk(a.actor)) return rej('requirement-not-met', 'E-12', 'actor is not available there')
      const cost = has(c, a.actor, 'innkeeper') ? 50 : 100
      if (p.gold < cost) return rej('not-enough-gold', 'E-12', `needs ${cost} gold`)
      const pv: Preview = { rule: 'E-12', text: `Feast: loyalty +6 for the unsworn, support +2, ${cost} gold`, gold: cost, food: 0 }
      if (dry) return pv
      p.gold -= cost; p.support = clamp(0, 100, p.support + 2); spend()
      if (player) addLoyaltyAt(c, a.pref, 6)
      emit(c, 'feast', 'E-12', `${name}: a feast is held`, a.pref)
      return pv
    }
    case 'hunt': {
      if (!actorOk(a.actor)) return rej('requirement-not-met', 'E-12', 'actor is not available there')
      const party = a.party.filter((h) => h !== a.actor)
      if (party.length > 3 || !party.every(actorOk)) return rej('requirement-not-met', 'E-14', 'up to 3 other heroes, all present')
      const men = Math.floor(a.men)
      if (men < 0 || men > 500 || men > p.men) return rej('not-enough-men', 'E-14', 'up to 500 of the garrison')
      if (p.bandits <= 0) return rej('requirement-not-met', 'E-14', 'no bandits to hunt')
      const P = huntOdds(c, a.pref, a.actor, party, men)
      const pv: Preview = { rule: 'E-14', text: `Hunt bandits: ${P}% to break them (bandits ${p.bandits} to ${Math.floor((p.bandits * 3) / 10)})`, gold: 0, food: 0, pct: P }
      if (dry) return pv
      spend()
      if (roll(s, 100) < P) {
        const before = p.bandits
        p.bandits = Math.floor((before * 3) / 10); p.gold += Math.floor(before / 2); p.support = clamp(0, 100, p.support + 2)
        emit(c, 'hunt', 'E-14', `${name}: the bandits are broken (${P}%), gold +${Math.floor(before / 2)}`, a.pref)
        if (player && p.huntT !== s.t) { p.huntT = s.t; addRenown(c, TUNE.huntRenown, a.pref, 'R-2', 'beasts', `bandits broken in ${name}`) }
      } else {
        const lost = Math.floor(men / 10)
        p.men = Math.max(0, p.men - lost)
        emit(c, 'huntFailed', 'E-14', `${name}: the hunt fails (${P}%), ${lost} men lost`, a.pref)
      }
      return pv
    }
    case 'move': {
      if (!a.heroes.length || !a.heroes.every(actorOk)) return rej('requirement-not-met', 'E-15', 'move needs at least one hero of yours present')
      const men = Math.floor(a.men)
      if (men < 0 || men > p.men) return rej('not-enough-men', 'E-15', 'not that many men there')
      const dest = s.prefectures[a.to]
      if (!dest || dest.owner !== faction || a.to === a.pref) return rej('illegal-target', 'E-15', 'destination must be another prefecture of yours')
      const path = movePath(c, faction, a.pref, a.to, a.heroes)
      if (!path.ok) return rej('blocked-link', 'E-15', path.why)
      const food = Math.floor(men / 20)
      if (p.food < food) return rej('not-enough-food', 'E-15', `needs ${food} food`)
      if (dest.men + men > Math.floor(dest.pop / 20)) return rej('requirement-not-met', 'E-2', 'the destination cannot hold that many men')
      const pv: Preview = { rule: 'E-15', text: `Move ${a.heroes.length} hero(es) and ${men} men to ${prefName(c, a.to)}, food ${food}`, gold: 0, food }
      if (dry) return pv
      const arms = p.men > 0 ? Math.floor((p.arms * men) / p.men) : 0
      p.men -= men; p.arms -= arms; p.food -= food
      dest.men += men; dest.arms += arms
      spend()
      let brother = false
      for (const h of a.heroes) { place(c, h, a.to); if (hs(c, h).status === 'sworn' || hs(c, h).status === 'chieftain' || (hs(c, h).status === 'ordinary' && hs(c, h).loyalty >= LOYAL_GOVERNOR)) brother = true }
      if (player) {
        s.commandsLeft[a.pref] = Math.min(s.commandsLeft[a.pref] ?? 0, commandCap(c, a.pref))
        if (brother) s.commandsLeft[a.to] = Math.min(commandCap(c, a.to), (s.commandsLeft[a.to] ?? 0) + 1)
      }
      emit(c, 'moved', 'E-15', `${name}: ${a.heroes.map((h) => heroName(c, h)).join(', ')} and ${men} men move to ${prefName(c, a.to)}`, a.pref)
      return pv
    }
    case 'send': {
      if (!actorOk(a.actor)) return rej('requirement-not-met', 'E-12', 'actor is not available there')
      const dest = s.prefectures[a.to]
      if (!dest || dest.owner !== faction || a.to === a.pref) return rej('illegal-target', 'E-12', 'destination must be another prefecture of yours')
      const linked = !!linkKind(c, a.pref, a.to) && !snowedIn(c, a.pref, a.to)
      const runner = has(c, a.actor, 'runner') && dist(c.x, a.pref, a.to) <= 3
      if (!linked && !runner) return rej('blocked-link', 'E-12', 'only a linked prefecture, or within 3 links with a runner')
      const g = Math.floor(a.gold), f = Math.floor(a.food), r = Math.floor(a.arms)
      if (g < 0 || f < 0 || r < 0 || g + f + r <= 0) return rej('requirement-not-met', 'E-12', 'send something')
      if (p.gold < g) return rej('not-enough-gold', 'E-12', 'not enough gold')
      if (p.food < f) return rej('not-enough-food', 'E-12', 'not enough food')
      if (p.arms < r) return rej('not-enough-arms', 'E-12', 'not enough arms')
      const pv: Preview = { rule: 'E-12', text: `Send ${g} gold, ${f} food, ${r} arms to ${prefName(c, a.to)}`, gold: g, food: f }
      if (dry) return pv
      p.gold -= g; p.food -= f; p.arms -= r
      dest.gold += g; dest.food += f; dest.arms += r
      spend()
      emit(c, 'send', 'E-12', `${name}: ${pv.text}`, a.pref)
      return pv
    }
    case 'spy': {
      if (!actorOk(a.actor)) return rej('requirement-not-met', 'E-12', 'actor is not available there')
      const tp = s.prefectures[a.target]
      if (!tp || a.target === a.pref) return rej('illegal-target', 'E-16', 'no such target')
      if (dist(c.x, a.pref, a.target) > spyRange(c, a.actor)) return rej('illegal-target', 'E-16', 'out of spy range')
      if (linkKind(c, a.pref, a.target) && snowedIn(c, a.pref, a.target)) return rej('blocked-link', 'T-6', 'spies cannot use a snowed-in link')
      if (p.gold < 100) return rej('not-enough-gold', 'E-16', 'needs 100 gold')
      const op = a.op
      if (op === 'steal' && !has(c, a.actor, 'thief')) return rej('requirement-not-met', 'E-16', 'steal needs a thief')
      if (op === 'discord' && !has(c, a.actor, 'strategist')) return rej('requirement-not-met', 'E-16', 'discord needs a strategist')
      if (op === 'expose' && (!has(c, a.actor, 'scribe') || abil(c, a.actor).cunning < 60 || tp.owner !== 'court' || !tp.governor || s.fired.includes(`expose:${tp.governor}`))) return rej('requirement-not-met', 'H-5', 'expose needs a scribe with cunning 60 and an unexposed court governor')
      if (op === 'burn' && !has(c, a.actor, 'firebrand')) return rej('requirement-not-met', 'E-16', 'burn needs a firebrand')
      if (op === 'forged-order' && (!has(c, a.actor, 'forger') || s.t - tp.forgedT < 3)) return rej('requirement-not-met', 'E-16', 'forged order needs a forger and a quiet season')
      if (op === 'jailbreak' && ((!has(c, a.actor, 'thief') && !has(c, a.actor, 'forger')) || abil(c, a.actor).cunning < 60 || !tp.captives.length)) return rej('requirement-not-met', 'H-5', 'jailbreak needs a thief or forger with cunning 60 and a captive there')
      const P = spyOdds(c, a.actor, a.target, op)
      const pv: Preview = { rule: 'E-16', text: `Spy (${op}) on ${prefName(c, a.target)}: ${P}%`, gold: 100, food: 0, pct: P }
      if (dry) return pv
      p.gold -= 100; spend()
      const win = roll(s, 100) < P
      if (win) {
        emit(c, 'spy', 'E-16', `${name}: the ${op} succeeds (${P}%)`, a.pref)
        tp.spyT = s.t
        if (op === 'steal') { const n = Math.min(500, Math.floor(tp.gold / 20)); tp.gold -= n; p.gold += n }
        else if (op === 'discord') { const h = ps(c, a.target).heroes.filter((x) => x !== EMPEROR)[0]; if (h) addLoyalty(c, h, -10) }
        else if (op === 'expose') { tp.graftMod += 20; s.fired.push(`expose:${tp.governor}`); if (player) addRenown(c, 6, a.target, 'R-2', 'justice', `exposed the governor of ${prefName(c, a.target)}`) }
        else if (op === 'burn') tp.food -= Math.floor(tp.food / 5)
        else if (op === 'forged-order') { tp.men -= Math.floor(tp.men / 10); tp.forgedT = s.t }
        else if (op === 'jailbreak') {
          const cap = [...tp.captives].sort((x, y) => rank(c, x) - rank(c, y))[0] as string
          joinHero(c, cap, faction, 80, a.pref)
          if (player && (rec(c, cap).star?.rank ?? 99) <= 36) addRenown(c, 1, a.pref, 'Q-3', 'heroes', `a famous rescue: ${heroName(c, cap)}`)
        }
      } else {
        emit(c, 'spyFailed', 'E-16', `${name}: the ${op} fails (${P}%), 100 gold lost`, a.pref)
        if (roll(s, 100) >= 85) {
          hs(c, a.actor).status = 'captive'; hs(c, a.actor).heldBy = tp.owner
          const ownerF = tp.owner
          hs(c, a.actor).faction = ownerF
          place(c, a.actor, a.target)
          emit(c, 'spyCaught', 'E-16', `${heroName(c, a.actor)} is caught and held at ${prefName(c, a.target)}`, a.target)
        }
      }
      return pv
    }
    case 'recruit': {
      if (!actorOk(a.actor)) return rej('requirement-not-met', 'E-12', 'actor is not available there')
      const t = s.heroes[a.target]
      if (!t || t.loc !== a.pref) return rej('illegal-target', 'Q-2', 'that hero is not here')
      if (a.method === 'invite') {
        if (t.faction !== 'free' || t.status !== 'free') return rej('illegal-target', 'Q-2', 'only a free hero can be invited')
        if (t.inviteBlock > s.t) return rej('requirement-not-met', 'Q-2', 'declined recently: try next month')
        if (p.gold < 100) return rej('not-enough-gold', 'Q-2', 'needs a 100 gold gift')
        const o = recruitOdds(c, faction, a.actor, a.target)
        const pv: Preview = { rule: 'Q-2', text: `Invite ${heroName(c, a.target)}: ${o.pct}%`, gold: 100, food: 0, pct: o.pct }
        if (dry) return pv
        p.gold -= 100; spend()
        inviteHero(c, faction, a.actor, a.target, a.pref)
        return pv
      }
      if (t.status !== 'captive' || t.heldBy !== faction) return rej('illegal-target', 'Q-4', 'not your captive')
      if (t.persuadedT === s.t) return rej('requirement-not-met', 'Q-4', 'tried this month already')
      const o = persuadeOdds(c, faction, a.actor, a.target)
      const pv: Preview = { rule: 'Q-4', text: `Persuade ${heroName(c, a.target)}: ${o.pct}%`, gold: 0, food: 0, pct: o.pct }
      if (dry) return pv
      spend()
      captiveChoice(c, a.target, 'persuade', a.actor, a.pref)
      return pv
    }
    case 'swear': {
      if (!player) return rej('requirement-not-met', 'B-1', 'only the player swears oaths')
      const ch = chieftainId(c)
      const h = s.heroes[a.hero]
      if (!ch || !h || hs(c, ch).loc !== a.pref || h.loc !== a.pref) return rej('requirement-not-met', 'B-4', 'the chieftain and the hero must be together')
      const o = oathStatus(c, a.hero)
      if (!o.ok) return rej('requirement-not-met', 'B-1', o.missing.join('; '))
      if (p.gold < 200) return rej('not-enough-gold', 'B-1', 'needs a 200 gold banquet')
      const pv: Preview = { rule: 'B-1', text: `Swear brotherhood with ${heroName(c, a.hero)} (200 gold)`, gold: 200, food: 0 }
      if (dry) return pv
      p.gold -= 200; spend()
      h.status = 'sworn'; h.loyalty = 100; h.wavering = false
      s.commandsLeft[a.pref] = Math.min(commandCap(c, a.pref), (s.commandsLeft[a.pref] ?? 0) + 0)
      addRenown(c, 1, a.pref, 'B-2', 'heroes', `${heroName(c, a.hero)} swears brotherhood`)
      emit(c, 'swear', 'B-2', `${heroName(c, a.hero)} becomes your sworn brother`, a.pref)
      return pv
    }
    case 'attack': {
      const t = s.prefectures[a.target]
      if (!t || t.owner === faction) return rej('illegal-target', 'W-1', 'choose a prefecture that is not yours')
      const link = c.x.adj[a.pref]?.find((n) => n.to === a.target)
      if (!link) return rej('illegal-target', 'W-1', 'the target is not linked')
      if (snowedIn(c, a.pref, a.target)) return rej('blocked-link', 'T-6', 'the link is snowed in')
      if (a.target === c.x.capital && s.factions['player']!.edict === null) return rej('capital-protected', 'G-5', 'the capital is protected until the Edict')
      if (faction === 'player' && isCamp(c, t.owner) && allied(c, t.owner)) return rej('illegal-target', 'K-5', 'that camp is your ally')
      if (t.fought) return rej('illegal-target', 'T-9', 'that prefecture already fought a battle this month')
      if (!a.heroes.length || a.heroes.length > 8 || !a.heroes.every(actorOk)) return rej('requirement-not-met', 'W-1', '1 to 8 heroes of yours, present and fit')
      if (new Set(a.heroes).size !== a.heroes.length) return rej('requirement-not-met', 'W-1', 'a hero is listed twice')
      const men = Math.floor(a.men)
      if (men < 0 || men > p.men) return rej('not-enough-men', 'W-1', 'not that many men')
      if (link.kind === 'marsh-water' && !a.heroes.some((h) => has(c, h, 'marine'))) return rej('requirement-not-met', 'W-1', 'a marsh-water link needs a marine in the force')
      const pv: Preview = { rule: 'W-1', text: `March on ${prefName(c, a.target)} with ${a.heroes.length} hero(es) and ${men} men`, gold: 0, food: 0 }
      if (dry) return pv
      spend()
      startBattle(c, { attacker: faction, origin: a.pref, target: a.target, heroes: a.heroes, men, imperial: faction === 'court' })
      return pv
    }
    case 'ally': {
      if (!player) return rej('requirement-not-met', 'K-5', 'only the player offers alliances')
      if (!actorOk(a.actor)) return rej('requirement-not-met', 'E-12', 'actor is not available there')
      const k = c.x.campOf[a.camp]
      const cf = s.factions[a.camp]
      if (!k || !cf || !cf.alive) return rej('illegal-target', 'K-5', 'no such camp')
      if (!c.x.adj[a.pref]?.some((n) => ps(c, n.to).owner === a.camp && !snowedIn(c, a.pref, n.to))) return rej('illegal-target', 'K-5', 'the camp must border this prefecture')
      if (p.gold < ALLY_COST) return rej('not-enough-gold', 'K-5', `needs ${ALLY_COST} gold`)
      const P = allyOdds(c, a.camp, a.actor)
      const chief = campChief(c, a.camp)
      const pv: Preview = { rule: 'K-5', text: `Offer ${k.name} an alliance (${chief ? heroName(c, chief) : 'its chief'}): ${P}%, ${ALLY_COST} gold, ${ALLY_MONTHS} months`, gold: ALLY_COST, food: 0, pct: P }
      if (dry) return pv
      p.gold -= ALLY_COST; spend()
      if (roll(s, 100) < P) {
        const renew = cf.allyUntil > s.t
        cf.allyUntil = s.t + ALLY_MONTHS
        if (!renew) cf.allySince = s.t
        emit(c, 'ally', 'K-5', `${k.name} agrees to an alliance (${P}%) until month ${cf.allyUntil}`, a.pref)
      } else emit(c, 'allyRefused', 'K-5', `${k.name} refuses an alliance (${P}%)`, a.pref)
      return pv
    }
  }
  return rej('unknown-action', 'E-12', 'unknown command')
}

/** Representative legal commands for one prefecture (Arch "Legal-action rules"). */
export function legalFor(c: Ctx, faction: string, pref: string): Action[] {
  const p = c.s.prefectures[pref]
  if (!p || p.owner !== faction || (c.s.commandsLeft[pref] ?? 0) <= 0) return []
  const able = ableHeroes(c, pref).filter((h) => hs(c, h).faction === faction && hs(c, h).status !== 'captive')
  if (!able.length) return []
  const pri = (h: string): number => (hs(c, h).status === 'chieftain' ? 0 : hs(c, h).status === 'sworn' ? 1 : 2)
  const actors = [...able].sort((x, y) => pri(x) - pri(y) || rank(c, x) - rank(c, y)).slice(0, 6)
  const bySkill = (sk: string): string | undefined => able.find((h) => has(c, h, sk))
  const cand: Action[] = []
  const best = [...able].sort((x, y) => abil(c, y).cunning - abil(c, x).cunning || (x < y ? -1 : 1))[0] as string
  for (const actor of actors) {
    for (const t of ['levy', 'train', 'forge', 'dykes', 'relieve', 'rest'] as const) cand.push({ t, pref, actor })
  }
  for (const actor of new Set([best, bySkill('horse-trader')].filter(Boolean) as string[])) {
    for (const amount of [100, 500, 1000]) { cand.push({ t: 'trade', pref, actor, dir: 'buyFood', amount }); cand.push({ t: 'trade', pref, actor, dir: 'sellFood', amount }) }
  }
  const m = Math.min(500, p.men)
  const strong = [...able].sort((x, y) => abil(c, y).might - abil(c, x).might)
  cand.push({ t: 'hunt', pref, actor: strong[0] as string, party: strong.slice(1, 4), men: m })
  cand.push({ t: 'hunt', pref, actor: strong[0] as string, party: [], men: 0 })
  const free = p.heroes.filter((h) => hs(c, h).faction === 'free' && hs(c, h).status === 'free')
  for (const f of free) cand.push({ t: 'recruit', pref, actor: best, target: f, method: 'invite' })
  for (const f of p.captives) if (hs(c, f).heldBy === faction) cand.push({ t: 'recruit', pref, actor: best, target: f, method: 'persuade' })
  if (faction === 'player') for (const h of able) if (hs(c, h).status === 'ordinary') cand.push({ t: 'swear', pref, hero: h })
  const nbrs = c.x.adj[pref] ?? []
  for (const n of nbrs) {
    const q = c.s.prefectures[n.to]
    if (!q) continue
    if (q.owner === faction) {
      for (const h of actors) for (const f of [0, 0.5, 1]) cand.push({ t: 'move', pref, to: n.to, heroes: [h], men: Math.floor(p.men * f) })
      if (able.length > 1) {
        // marching the whole household: every able hero but the chieftain (the chieftain stays to keep the command), and every hero
        const allBut = able.filter((h) => hs(c, h).status !== 'chieftain')
        if (allBut.length > 1) cand.push({ t: 'move', pref, to: n.to, heroes: allBut, men: p.men })
        cand.push({ t: 'move', pref, to: n.to, heroes: [...able], men: p.men })
      }
      cand.push({ t: 'send', pref, to: n.to, gold: 500, food: 0, arms: 0, actor: best }, { t: 'send', pref, to: n.to, gold: 0, food: 500, arms: 0, actor: best }, { t: 'send', pref, to: n.to, gold: 0, food: 0, arms: 200, actor: best })
    } else {
      if (faction === 'player' && isCamp(c, q.owner)) {
        cand.push({ t: 'ally', pref, actor: best, camp: q.owner })
      }
      const ch = faction === 'player' ? chieftainId(c) : null
      const byCmd = [...able].sort((x, y) => abil(c, y).command - abil(c, x).command || rank(c, x) - rank(c, y))
      const forces: string[][] = []
      const noChief = byCmd.filter((h) => h !== ch).slice(0, 8)
      for (const k of new Set([Math.min(2, noChief.length), Math.min(4, noChief.length), noChief.length])) if (k > 0) forces.push(noChief.slice(0, k))
      // a sworn brother goes with the force so that the conquest has a commander to hold it (T-3)
      for (const sw of noChief.filter((h) => hs(c, h).status === 'sworn').slice(0, 3)) {
        forces.push([sw, ...noChief.filter((h) => h !== sw).slice(0, 1)])
        forces.push([sw, ...noChief.filter((h) => h !== sw).slice(0, 3)])
      }
      if (ch && able.includes(ch)) forces.push([...noChief.slice(0, 7), ch])
      for (const force of forces) {
        cand.push({ t: 'attack', pref, target: n.to, heroes: force, men: Math.floor(p.men * 0.7) })
        cand.push({ t: 'attack', pref, target: n.to, heroes: force, men: p.men })
      }
    }
  }
  const spyT = c.x.order.filter((o) => o !== pref && dist(c.x, pref, o) <= spyRange(c, best))
  for (const tpf of spyT) {
    cand.push({ t: 'spy', pref, actor: best, target: tpf, op: 'report' })
    const skOf: Record<string, string> = { steal: 'thief', discord: 'strategist', expose: 'scribe', burn: 'firebrand', 'forged-order': 'forger', jailbreak: 'thief' }
    for (const op of ['steal', 'discord', 'expose', 'burn', 'forged-order', 'jailbreak'] as SpyOp[]) {
      const who = bySkill(skOf[op] as string)
      if (who) cand.push({ t: 'spy', pref, actor: who, target: tpf, op })
    }
  }
  return cand.filter((a) => !isReject(runCommand(c, a, faction, true)))
}
void compat; void graftOf; void prefGraft; void isPlayerHero; void harvestOf; void joinLoyalty; void rollCheck
