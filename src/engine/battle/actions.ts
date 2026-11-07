// Battle actions W-8..W-20, duels, fire, dusk, ending (W-25).
import type { Action, BattleState, BUnit, Hex, Side } from '../types'
import type { Ctx, Reject } from '../ctx'
import { emit, rej, hs, abil, GAO_QIU } from '../ctx'
import { roll } from '../rng'
import { clamp, pct } from '../util'
import { addLoyaltyAt } from '../strategic/heroes'
import { addRenown } from '../strategic/renown'
import { DIRS, hexDistance, key, neighbor, neighbors, parseKey, same, add } from './hex'
import { TERR } from './terrain'
import {
  DAYS, active, actionPctMelee, addFatigue, addMorale, checkRout, counterPct, cornered, dmgChain, finalDamage, getUnit, hasSkill,
  humanControls, moveRange, other, routUnit, terrAt, unitAt, unitName, visibleTo,
} from './core'

const ok = null

function me(c: Ctx): BattleState { return c.s.battle as BattleState }
function isPlayerSide(b: BattleState, side: Side): boolean { return b.human === side }

/** Gao Qiu's court side loses the moment his unit routs or is captured (W-26). */
export function checkEnd(c: Ctx): void {
  const b = me(c)
  if (b.result) return
  const gao = b.units.find((u) => u.hero === GAO_QIU)
  if (gao && gao.state !== 'active') { b.result = { winner: other(gao.side), reason: 'gao-qiu' }; return }
  const ac = b.units.find((u) => u.side === 'a' && u.commander)
  const dc = b.units.find((u) => u.side === 'd' && u.commander)
  if (ac && ac.state !== 'active') { b.result = { winner: 'd', reason: 'commander' }; return }
  if (dc && dc.state !== 'active') { b.result = { winner: 'a', reason: 'commander' }; return }
  if (active(b, 'd').length === 0) { b.result = { winner: 'a', reason: 'no-defenders' }; return }
  if (active(b, 'a').length === 0) { b.result = { winner: 'd', reason: 'no-attackers' }; return }
}

function dealDamage(c: Ctx, att: BUnit, def: BUnit, dmg: number): void {
  def.men = Math.max(0, def.men - dmg)
  def.hurt = true
}

function meleeStrike(c: Ctx, b: BattleState, att: BUnit, def: BUnit, actionPct: number, kind: 'attack' | 'charge' | 'ambush', braceCounter = false): void {
  const chain = dmgChain(b, att, def, actionPct, true)
  const v = roll(c.s, 21) - 10
  const dmg = finalDamage(chain.value, def, v)
  const pincer = chain.factors.find((f) => f.name === 'pincer')
  dealDamage(c, att, def, dmg)
  if (pincer && pincer.pct === 125) addMorale(def, -5)
  if (att.counsel) att.counsel = false
  addFatigue(att, kind, kind === 'charge' ? 8 : 4)
  att.acted = true
  emit(c, kind === 'ambush' ? 'ambushed' : kind === 'charge' ? 'charged' : 'attacked', 'W-9', `${unitName(c, att)} ${kind}s ${unitName(c, def)}: ${dmg} men killed`, undefined, dmg)
  if (kind === 'ambush') { addMorale(def, -10); att.hidden = false }
  checkRout(c, b, def)
  if (def.state === 'active' && att.state === 'active' && hexDistance(att.pos, def.pos) === 1 && kind !== 'ambush') {
    const cc = dmgChain(b, def, att, counterPct(def, braceCounter), true, true)
    const cv = roll(c.s, 21) - 10
    const cd = finalDamage(cc.value, att, cv)
    dealDamage(c, def, att, cd)
    addFatigue(def, 'counter', 2)
    emit(c, 'countered', 'W-11', `${unitName(c, def)} strikes back: ${cd} men killed`, undefined, cd)
    checkRout(c, b, att)
  }
}

export function volleyRange(b: BattleState, u: BUnit): number {
  const t = terrAt(b, u.pos)
  let r = 3 + (t === 'hill' || t === 'mountain' ? 1 : 0)
  if (b.weather?.kind === 'fog') r = Math.min(r, 2)
  return r
}

/** W-15: the straight charge line for a cavalry unit at its position against a target; null when impossible. */
export function chargeLine(b: BattleState, u: BUnit, t: BUnit): { dir: number; dest: Hex } | null {
  if (u.kind !== 'cavalry' || u.fatigue >= 80) return null
  const foes = active(b, other(u.side))
  for (let d = 0; d < 6; d++) {
    for (let k = 3; k <= 8; k++) {
      let p = u.pos
      for (let i = 0; i < k; i++) p = add(p, DIRS[d] as Hex)
      if (!same(p, t.pos)) continue
      let good = true
      let cur = u.pos
      for (let i = 1; i < k; i++) {
        cur = add(cur, DIRS[d] as Hex)
        const tr = terrAt(b, cur)
        if (!tr || !(tr === 'plain' || tr === 'road' || tr === 'village') || unitAt(b, cur)) { good = false; break }
        if (i < k - 1 && foes.some((f) => hexDistance(f.pos, cur) === 1)) { good = false; break }
      }
      if (good) return { dir: d, dest: cur }
    }
  }
  return null
}

function canHide(b: BattleState, u: BUnit): boolean {
  const t = terrAt(b, u.pos)
  if (u.hidden || u.moved || u.acted) return false
  if (t === 'forest' || t === 'reed') return true
  return (hasSkill(u, 'thief') || hasSkill(u, 'scout')) && (t === 'hill' || t === 'village')
}

// ---- duels (W-17, W-18) ----
export function duelPower(u: BUnit): number { return u.might + Math.floor(u.vigour / 4) + (hasSkill(u, 'swordsman') ? 10 : 0) }
export function duelAccept(c: Ctx, b: BattleState, ch: BUnit, tg: BUnit, stake: 'honour' | 'capture'): number {
  const v = 35 + 6 * tg.daring + Math.floor((tg.might - ch.might) / 2) - (stake === 'capture' ? 15 : 0) + (cornered(c, b, tg) ? 30 : 0)
  return clamp(5, 95, v)
}
/** Exact chance the challenger wins (best of three exchanges of two roll(100)). */
export function duelWin(ch: BUnit, tg: BUnit): { exchange: number; win: number } {
  const gap = duelPower(ch) - duelPower(tg)
  let n = 0
  for (let a = 0; a < 100; a++) for (let d = 0; d < 100; d++) if (gap + a - d > 0) n++
  const p = n / 10000
  return { exchange: p, win: Math.round(p * p * (3 - 2 * p) * 1000) / 10 }
}
export function duelLegal(b: BattleState, ch: BUnit, tg: BUnit, stake: 'honour' | 'capture'): string | null {
  if (ch.state !== 'active' || tg.state !== 'active') return 'unit is out of the fight'
  if (ch.hero.startsWith('cap-')) return 'a garrison captain cannot challenge'
  if (ch.might < 50) return 'might 50 needed (H-5)'
  if (stake === 'capture' && ch.might < 70) return 'might 70 needed for a capture stake (H-5)'
  if (ch.dueled || tg.dueled) return 'a hero fights one duel a day'
  if (hexDistance(ch.pos, tg.pos) > 2) return 'target is beyond 2 hexes'
  if (!visibleTo(b, ch.side, tg)) return 'target is hidden'
  return null
}

export function resolveDuel(c: Ctx, b: BattleState, ch: BUnit, tg: BUnit, stake: 'honour' | 'capture'): void {
  const pc = duelPower(ch), pt = duelPower(tg)
  let wc = 0, wt = 0
  for (let i = 0; i < 3 && wc < 2 && wt < 2; i++) {
    const rc = roll(c.s, 100), rt = roll(c.s, 100)
    if (pc + rc > pt + rt) wc++; else wt++
    emit(c, 'duelExchange', 'W-18', `Exchange ${i + 1}: ${pc + rc} against ${pt + rt}`)
  }
  const win = wc >= 2 ? ch : tg
  const lose = win === ch ? tg : ch
  addMorale(win, 15); addFatigue(win, 'duel', 5)
  addMorale(lose, -20); addFatigue(lose, 'duel', 20)
  lose.men = Math.max(0, lose.men - pct(lose.maxMen, 10)); lose.hurt = true
  ch.dueled = true; tg.dueled = true
  emit(c, 'duelResolved', 'W-18', `${unitName(c, win)} wins the duel against ${unitName(c, lose)}`)
  if (isPlayerSide(b, win.side) && !win.hero.startsWith('cap-')) {
    const rk = c.x.hero[lose.hero]?.star?.rank
    if (rk !== undefined && rk <= 36) addRenown(c, 1, b.target, 'R-2', 'battles', `duel won against ${unitName(c, lose)}`)
  }
  if (stake === 'capture' && lose.state === 'active') {
    if (lose.hero === GAO_QIU) { lose.state = cornered(c, b, lose) ? 'captured' : 'routed'; lose.capturedBy = win.side; lose.hidden = false }
    else if (lose.hero.startsWith('cap-')) lose.state = 'routed'
    else { lose.state = 'captured'; lose.capturedBy = win.side }
    emit(c, 'captured', 'W-18', `${unitName(c, lose)} is taken in the duel`)
    for (const a of active(b, lose.side)) if (hexDistance(a.pos, lose.pos) <= 3) addMorale(a, -10)
    if (lose.commander) for (const a of active(b, lose.side)) addMorale(a, -30)
  } else checkRout(c, b, lose)
  checkEnd(c)
}
function declineDuel(c: Ctx, b: BattleState, tg: BUnit, stake: string): void {
  emit(c, 'duelDeclined', 'W-17', `${unitName(c, tg)} declines the challenge`)
  if (stake === 'honour') addMorale(tg, -5)
  if (tg.daring >= 8 && isPlayerSide(b, tg.side)) {
    const h = hs(c, tg.hero)
    if (h && h.faction === 'player' && h.status === 'ordinary') h.loyalty = clamp(0, 100, h.loyalty - 3)
  }
}
/** The human's answer to a duel offer (pending duelOffer). */
export function answerDuel(c: Ctx, option: string, data: Record<string, unknown>): void {
  const b = me(c)
  const d = data as { unit: string; target: string; stake: 'honour' | 'capture' }
  c.s.pending = null
  const ch = getUnit(b, d.unit), tg = getUnit(b, d.target)
  if (!ch || !tg) return
  if (option === 'accept') { emit(c, 'duelAccepted', 'W-17', `${unitName(c, tg)} accepts`); resolveDuel(c, b, ch, tg, d.stake) }
  else declineDuel(c, b, tg, d.stake)
  checkEnd(c)
}

function burnVillageEffects(c: Ctx, b: BattleState, u: BUnit, k: string): void {
  if (terrAt(b, parseKey(k)) !== 'village' || !isPlayerSide(b, u.side)) return
  b.burned++
  addRenown(c, -1, b.target, 'R-3', 'battles', 'a village hex was burned')
  const ch = c.s.factions['player']?.chieftain
  const pref = ch ? hs(c, ch).loc : null
  if (pref) addLoyaltyAt(c, pref, -4, (h) => (c.x.hero[h]?.virtues.compassion ?? 0) >= 7)
}

export function applyBattleAction(c: Ctx, a: Action): Reject | null {
  const b = me(c)
  if (b.result) return rej('game-over', 'W-25', 'the battle is decided')
  if (a.t === 'bEndSide') {
    if (b.toAct === 'a') { b.toAct = 'd'; emit(c, 'sideEnded', 'W-7', 'The attackers end their day') }
    else dusk(c)
    return ok
  }
  if (a.t === 'bWithdraw') {
    if (b.toAct !== 'a') return rej('not-your-turn', 'W-23', 'only the attackers may withdraw, on their own turn')
    b.result = { winner: 'd', reason: 'withdrew' }
    emit(c, 'withdrew', 'W-23', 'The attackers withdraw')
    return ok
  }
  if (a.t === 'bAuto') {
    if (!b.human) return rej('requirement-not-met', 'W-28', 'no human side to hand over')
    b.auto[b.human] = true
    emit(c, 'auto', 'W-28', 'The greedy AI plays your side to the end')
    return ok
  }
  if (!('unit' in a)) return rej('unknown-action', 'W-8', 'not a battle action')
  const u = getUnit(b, a.unit)
  if (!u || u.state !== 'active') return rej('illegal-target', 'W-8', 'no such unit in the fight')
  if (u.side !== b.toAct) return rej('not-your-turn', 'W-7', 'the other side acts now')
  const tgt = (id: string | undefined): BUnit | undefined => (id ? getUnit(b, id) : undefined)
  switch (a.t) {
    case 'bMove': {
      if (u.moved || u.acted) return rej('requirement-not-met', 'W-8', 'a unit moves once, before its action')
      const reach = moveRange(b, u).get(key(a.to))
      if (!reach) return rej('illegal-target', 'W-6', 'that hex is out of reach')
      u.pos = a.to
      u.moved = true
      u.hidden = false
      addFatigue(u, 'march', 3)
      for (const h of reach.path.slice(1)) {
        const tr = terrAt(b, h)
        if (tr === 'forest' || tr === 'hill' || tr === 'mountain' || tr === 'marsh' || tr === 'reed') addFatigue(u, 'rough ground', 1)
      }
      emit(c, 'moved', 'W-8', `${unitName(c, u)} moves (cost ${reach.cost})`)
      return ok
    }
    case 'bAttack': case 'bAmbush': {
      const t = tgt(a.target)
      if (u.acted) return rej('requirement-not-met', 'W-8', 'already acted today')
      if (!t || t.side === u.side || t.state !== 'active' || !visibleTo(b, u.side, t)) return rej('illegal-target', 'W-8', 'no visible enemy there')
      if (hexDistance(u.pos, t.pos) !== 1) return rej('illegal-target', 'W-8', 'the target is not adjacent')
      if (a.t === 'bAmbush' && !u.hidden) return rej('requirement-not-met', 'W-24', 'only a hidden unit can ambush')
      if (u.hidden || a.t === 'bAmbush') meleeStrike(c, b, u, t, 150, 'ambush')
      else meleeStrike(c, b, u, t, actionPctMelee(u), 'attack')
      checkEnd(c)
      return ok
    }
    case 'bCharge': {
      const t = tgt(a.target)
      if (u.acted || u.moved) return rej('requirement-not-met', 'W-15', 'a charge replaces the move and the action')
      if (!t || t.side === u.side || t.state !== 'active' || !visibleTo(b, u.side, t)) return rej('illegal-target', 'W-15', 'no visible enemy there')
      const line = chargeLine(b, u, t)
      if (!line) return rej('requirement-not-met', 'W-15', 'needs cavalry under fatigue 80 and a straight clear line of 3 hexes')
      u.pos = line.dest
      u.moved = true
      u.hidden = false
      const brace = hasSkill(t, 'spearman')
      meleeStrike(c, b, u, t, brace ? 125 : 150, 'charge', brace)
      checkEnd(c)
      return ok
    }
    case 'bVolley': {
      const t = tgt(a.target)
      if (u.acted || u.kind !== 'archers') return rej('requirement-not-met', 'W-16', 'only unspent archers can volley')
      if (!t || t.side === u.side || t.state !== 'active' || !visibleTo(b, u.side, t)) return rej('illegal-target', 'W-16', 'no visible enemy there')
      const d = hexDistance(u.pos, t.pos)
      if (d < 2 || d > volleyRange(b, u)) return rej('illegal-target', 'W-16', `range is 2 to ${volleyRange(b, u)}`)
      const chain = dmgChain(b, u, t, b.weather?.kind === 'rain' ? 50 : 70, false)
      const v = roll(c.s, 21) - 10
      const dmg = finalDamage(chain.value, t, v)
      dealDamage(c, u, t, dmg)
      if (u.counsel) u.counsel = false
      addFatigue(u, 'volley', 4)
      u.acted = true
      emit(c, 'volleyed', 'W-16', `${unitName(c, u)} volleys ${unitName(c, t)}: ${dmg} men killed`, undefined, dmg)
      checkRout(c, b, t)
      checkEnd(c)
      return ok
    }
    case 'bFire': {
      if (u.acted || !hasSkill(u, 'firebrand')) return rej('requirement-not-met', 'W-13', 'only an unspent firebrand can set fires')
      const k = key(a.at)
      const tr = b.terrain[k]
      if (!tr || !TERR[tr].flammable || b.burning[k]) return rej('illegal-target', 'W-13', 'that hex cannot burn')
      if (hexDistance(u.pos, a.at) > 3) return rej('illegal-target', 'W-13', 'range is 3')
      if (b.weather?.kind === 'rain') return rej('requirement-not-met', 'W-14', 'rain: no fire starts')
      b.burning[k] = 2
      u.acted = true
      u.hidden = false
      emit(c, 'fire', 'W-13', `${unitName(c, u)} sets a fire at ${k}`)
      burnVillageEffects(c, b, u, k)
      return ok
    }
    case 'bHide': {
      if (!canHide(b, u)) return rej('requirement-not-met', 'W-24', 'needs forest or reed (thief or scout: hill or village) and no move today')
      u.hidden = true; u.acted = true
      emit(c, 'hidden', 'W-24', `${unitName(c, u)} goes to ground`)
      return ok
    }
    case 'bWait': {
      if (u.acted) return rej('requirement-not-met', 'W-8', 'already acted today')
      u.acted = true; u.waited = true
      return ok
    }
    case 'bHeal': {
      const t = tgt(a.target)
      if (u.acted || !hasSkill(u, 'physician') || !t || t.side !== u.side || t.state !== 'active' || hexDistance(u.pos, t.pos) !== 1) return rej('illegal-target', 'H-7', 'heal needs a physician and an adjacent ally')
      const n = Math.min(t.maxMen - t.men, pct(t.maxMen, 5))
      t.men += n; u.acted = true
      emit(c, 'healed', 'H-7', `${unitName(c, t)} regains ${n} men`)
      return ok
    }
    case 'bScuttle': {
      const t = tgt(a.target)
      if (u.acted || u.specialUsed || !hasSkill(u, 'swimmer') || !t || t.side === u.side || t.kind !== 'boats' || t.state !== 'active' || hexDistance(u.pos, t.pos) !== 1) return rej('illegal-target', 'W-13', 'scuttle needs a swimmer, once per battle, and an adjacent enemy boat unit')
      const n = Math.min(t.men, pct(t.men, 15))
      t.men -= n; t.hurt = true; u.specialUsed = true; u.acted = true
      emit(c, 'scuttled', 'W-13', `${unitName(c, t)}'s boats are holed: ${n} men lost`)
      checkRout(c, b, t)
      checkEnd(c)
      return ok
    }
    case 'bCounsel': {
      const t = tgt(a.target)
      if (u.acted || !hasSkill(u, 'strategist') || !t || t.side !== u.side || t.state !== 'active' || t.id === u.id || hexDistance(u.pos, t.pos) > 3) return rej('illegal-target', 'H-7', 'counsel needs a strategist and an ally within 3 hexes')
      t.counsel = true; u.acted = true
      emit(c, 'counsel', 'H-7', `${unitName(c, t)} acts on counsel: +10`)
      return ok
    }
    case 'bWeather': {
      if (u.acted || u.specialUsed || !hasSkill(u, 'sorcerer')) return rej('requirement-not-met', 'W-14', 'weather needs an unspent sorcerer')
      if (a.kind === 'wind') b.wind = ((a.dir ?? 0) % 6 + 6) % 6
      else if (a.kind === 'rain') { b.weather = { kind: 'rain', dusks: 2 }; b.burning = {} }
      else b.weather = { kind: 'fog', dusks: 2 }
      u.specialUsed = true; u.acted = true
      emit(c, 'weather', 'W-14', `${unitName(c, u)} calls ${a.kind}`)
      return ok
    }
    case 'bDuel': {
      const t = tgt(a.target)
      if (!t || t.side === u.side) return rej('illegal-target', 'W-17', 'no enemy there')
      const why = duelLegal(b, u, t, a.stake)
      if (why) return rej('requirement-not-met', 'W-17', why)
      emit(c, 'duelOffered', 'W-17', `${unitName(c, u)} challenges ${unitName(c, t)} (${a.stake})`)
      if (humanControls(b, t.side)) {
        c.s.pending = { kind: 'duelOffer', options: ['accept', 'decline'], data: { unit: u.id, target: t.id, stake: a.stake } }
        return ok
      }
      const acc = duelAccept(c, b, u, t, a.stake)
      if (roll(c.s, 100) < acc) { emit(c, 'duelAccepted', 'W-17', `${unitName(c, t)} accepts (${acc}%)`); resolveDuel(c, b, u, t, a.stake) }
      else { declineDuel(c, b, t, a.stake); u.dueled = true; t.dueled = true }
      checkEnd(c)
      return ok
    }
  }
  return rej('unknown-action', 'W-8', 'unknown battle action')
}

// ---- dusk (W-22) ----
function dusk(c: Ctx): void {
  const b = me(c)
  const keys = Object.keys(b.burning).sort((p, q) => { const a = parseKey(p), z = parseKey(q); return a.r - z.r || a.q - z.q })
  const lit: string[] = []
  // 1 fire
  for (const k of keys) {
    const h = parseKey(k)
    const u = unitAt(b, h)
    if (u) {
      const n = Math.min(u.men, pct(u.maxMen, 12))
      u.men -= n; u.hurt = true; addMorale(u, -10); addFatigue(u, 'burning', 6)
      emit(c, 'dusk', 'W-13', `Fire burns ${unitName(c, u)}: ${n} men lost`)
    }
    const nb = neighbor(h, b.wind)
    const nk = key(nb)
    const nt = b.terrain[nk]
    if (b.weather?.kind !== 'rain' && nt && TERR[nt].flammable && !b.burning[nk] && !lit.includes(nk)) {
      if (roll(c.s, 100) < 50) lit.push(nk)
    }
  }
  for (const k of keys) {
    if (b.weather?.kind === 'rain') { delete b.burning[k]; continue }
    b.burning[k] = (b.burning[k] as number) - 1
    if ((b.burning[k] as number) <= 0) { delete b.burning[k]; b.terrain[k] = 'plain' }
  }
  for (const k of lit) b.burning[k] = 2
  // 2 village healing
  for (const u of active(b)) if (terrAt(b, u.pos) === 'village' && u.men < u.maxMen) u.men = Math.min(u.maxMen, u.men + pct(u.maxMen, 3))
  // 3 daily food
  for (const side of ['a', 'd'] as Side[]) {
    const men = active(b, side).reduce((s, u) => s + u.men, 0)
    const cost = Math.ceil(men / 300)
    const home = c.s.prefectures[side === 'a' ? b.origin : b.target]
    if (!home) continue
    if (home.food >= cost) { home.food -= cost; b.hungry[side] = false; emit(c, 'dusk', 'W-21', `${side === 'a' ? 'Attackers' : 'Defenders'} eat ${cost} food (${home.food} left)`, undefined, cost) }
    else {
      home.food = 0; b.hungry[side] = true
      for (const u of active(b, side)) { addFatigue(u, 'hunger', 15); addMorale(u, -10) }
      emit(c, 'dusk', 'W-21', `${side === 'a' ? 'Attackers' : 'Defenders'} go hungry`)
    }
  }
  // 4 rally
  for (const m of active(b)) if (hasSkill(m, 'monk')) for (const a of active(b, m.side)) if (a.id !== m.id && hexDistance(a.pos, m.pos) === 1) addMorale(a, 5)
  // 5 fatigue recovery, 6 morale
  for (const u of active(b)) {
    const idle = !u.moved && !u.dueled && (!u.acted || u.waited)
    const rec = Math.floor(u.vigour / 10) + (idle ? 8 : 0)
    u.fatigue = clamp(0, 100, u.fatigue - rec)
    if (!u.hurt) addMorale(u, 2)
  }
  emit(c, 'dusk', 'W-12', 'Dusk: units rest and recover')
  // 7 rout checks
  for (const u of [...active(b)]) checkRout(c, b, u)
  // 8 next day
  if (b.weather) { b.weather.dusks--; if (b.weather.dusks <= 0) b.weather = null }
  b.day++
  checkEnd(c)
  if (!b.result && b.day > DAYS) {
    b.result = { winner: 'd', reason: 'day-limit' }
    emit(c, 'dayLimit', 'W-23', 'Day 20 ends: the attackers withdraw')
    return
  }
  if (b.result) return
  b.toAct = 'a'
  for (const u of b.units) {
    u.moved = false; u.acted = false; u.waited = false; u.dueled = false; u.hurt = false; u.counsel = false
    const t = terrAt(b, u.pos)
    u.startedHidable = t === 'forest' || t === 'reed'
    u.fatigueLog = []
  }
  emit(c, 'dayStarted', 'W-7', `Day ${b.day} of ${DAYS}`, undefined, b.day)
}
void routUnit; void neighbors; void abil; void same

// ---- legal enumeration for one unit ----
export function legalForUnit(c: Ctx, u: BUnit): Action[] {
  const b = me(c)
  const out: Action[] = []
  if (u.state !== 'active' || u.side !== b.toAct) return out
  const foes = active(b, other(u.side)).filter((e) => visibleTo(b, u.side, e))
  if (!u.acted) {
    if (!u.moved) for (const [k] of moveRange(b, u)) out.push({ t: 'bMove', unit: u.id, to: parseKey(k) })
    for (const e of foes) {
      const d = hexDistance(u.pos, e.pos)
      if (d === 1) out.push(u.hidden ? { t: 'bAmbush', unit: u.id, target: e.id } : { t: 'bAttack', unit: u.id, target: e.id })
      if (u.kind === 'archers' && d >= 2 && d <= volleyRange(b, u)) out.push({ t: 'bVolley', unit: u.id, target: e.id })
      if (u.kind === 'cavalry' && !u.moved && chargeLine(b, u, e)) out.push({ t: 'bCharge', unit: u.id, target: e.id })
      if (hasSkill(u, 'firebrand') && b.weather?.kind !== 'rain') {
        for (const k of [key(e.pos), ...neighbors(e.pos).map(key)]) {
          const tr = b.terrain[k]
          if (tr && TERR[tr].flammable && !b.burning[k] && hexDistance(u.pos, parseKey(k)) <= 3 && !out.some((o) => o.t === 'bFire' && key(o.at) === k)) out.push({ t: 'bFire', unit: u.id, at: parseKey(k) })
        }
      }
      if (hasSkill(u, 'swimmer') && !u.specialUsed && e.kind === 'boats' && d === 1) out.push({ t: 'bScuttle', unit: u.id, target: e.id })
    }
    if (canHide(b, u)) out.push({ t: 'bHide', unit: u.id })
    for (const f of active(b, u.side)) {
      if (f.id === u.id) continue
      const d = hexDistance(u.pos, f.pos)
      if (hasSkill(u, 'physician') && d === 1 && f.men < f.maxMen) out.push({ t: 'bHeal', unit: u.id, target: f.id })
      if (hasSkill(u, 'strategist') && d <= 3 && !f.counsel) out.push({ t: 'bCounsel', unit: u.id, target: f.id })
    }
    if (hasSkill(u, 'sorcerer') && !u.specialUsed) {
      out.push({ t: 'bWeather', unit: u.id, kind: 'rain' }, { t: 'bWeather', unit: u.id, kind: 'fog' })
      for (let d = 0; d < 6; d++) out.push({ t: 'bWeather', unit: u.id, kind: 'wind', dir: d })
    }
    out.push({ t: 'bWait', unit: u.id })
  }
  for (const e of foes) {
    for (const stake of ['honour', 'capture'] as const) if (!duelLegal(b, u, e, stake)) out.push({ t: 'bDuel', unit: u.id, target: e.id, stake })
  }
  return out
}
