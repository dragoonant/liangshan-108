// step: the only mutator. Runs the player's action, then the AI phases and month end until the next decision.
import type { Action, GameEvent, GameState, StepResult } from './types'
import { defaultBundle } from './data'
import type { DataBundle } from '../data'
import { mkCtx, rej, hs, ps, chieftainId } from './ctx'
import type { Ctx, Reject } from './ctx'
import { clone } from './util'
import { isReject, runCommand } from './strategic/commands'
import { applyBattleAction, answerDuel } from './battle/actions'
import { finishBattle } from './battle/resolve'
import { humanControls } from './battle/core'
import { beginMonth, monthEnd } from './strategic/month'
import { marchCampaign } from './strategic/court'
import { captiveChoice } from './strategic/recruit'
import { resolveConvoy, resolveInspection, resolveTiger } from './strategic/events'
import { aiBattleAction, decideStrategic } from '../ai/greedy'
import { rank } from './ctx'

const REQ: Record<string, string[]> = {
  levy: ['pref', 'actor'], train: ['pref', 'actor'], forge: ['pref', 'actor'], dykes: ['pref', 'actor'], relieve: ['pref', 'actor'], rest: ['pref', 'actor'],
  trade: ['pref', 'actor', 'dir', 'amount'], hunt: ['pref', 'actor', 'party', 'men'], move: ['pref', 'to', 'heroes', 'men'], send: ['pref', 'to', 'gold', 'food', 'arms', 'actor'],
  spy: ['pref', 'actor', 'target', 'op'], recruit: ['pref', 'actor', 'target', 'method'], swear: ['pref', 'hero'], attack: ['pref', 'target', 'heroes', 'men'], ally: ['pref', 'actor', 'camp'],
  endPhase: [], choose: ['option'], bMove: ['unit', 'to'], bAttack: ['unit', 'target'], bVolley: ['unit', 'target'], bCharge: ['unit', 'target'], bFire: ['unit', 'at'],
  bHide: ['unit'], bWait: ['unit'], bAmbush: ['unit'], bHeal: ['unit'], bScuttle: ['unit'], bCounsel: ['unit'], bWeather: ['unit', 'kind'], bDuel: ['unit', 'target', 'stake'],
  bEndSide: [], bWithdraw: [], bAuto: [],
}
const STRS = ['pref', 'actor', 'target', 'hero', 'unit', 'option', 'camp']
const NUMS = ['men', 'amount', 'gold', 'food', 'arms']
const ENUMS: Record<string, string[]> = { dir: ['buyFood', 'sellFood'], op: ['report', 'steal', 'discord', 'expose', 'burn', 'forged-order', 'jailbreak'], method: ['invite', 'persuade'], stake: ['honour', 'capture'], kind: ['wind', 'rain', 'fog'] }
/** Arch: an action with the wrong shape is rejected, never thrown on. */
function shapeError(a: unknown): string | null {
  if (typeof a !== 'object' || a === null || Array.isArray(a)) return 'not an action'
  const o = a as Record<string, unknown>
  const need = typeof o['t'] === 'string' ? REQ[o['t'] as string] : undefined
  if (!need) return 'unknown action type'
  for (const k of need) if (!(k in o)) return `missing field ${k}`
  for (const k of STRS) if (k in o && typeof o[k] !== 'string') return `${k} must be text`
  for (const k of NUMS) if (k in o && !(typeof o[k] === 'number' && Number.isFinite(o[k]))) return `${k} must be a number`
  for (const k of ['heroes', 'party']) if (k in o && !(Array.isArray(o[k]) && (o[k] as unknown[]).every((x) => typeof x === 'string'))) return `${k} must be a list of ids`
  for (const [k, vs] of Object.entries(ENUMS)) if (k in o && !(k === 'dir' && o['t'] === 'bWeather') && !vs.includes(o[k] as string)) return `${k} is not a known value`
  if ('to' in o && o['t'] === 'move' && typeof o['to'] !== 'string') return 'to must be a prefecture id'
  for (const k of o['t'] === 'bMove' ? ['to'] : o['t'] === 'bFire' ? ['at'] : []) {
    const h = o[k] as Record<string, unknown> | null
    if (!h || typeof h !== 'object' || !Number.isInteger(h['q']) || !Number.isInteger(h['r'])) return `${k} must be a hex`
  }
  if ('dir' in o && o['t'] === 'bWeather' && !(typeof o['dir'] === 'number' && Number.isFinite(o['dir']))) return 'dir must be a number'
  return null
}

function aiOrder(c: Ctx): string[] {
  return [...Object.keys(c.s.factions).filter((f) => f !== 'player' && f !== 'court' && c.s.factions[f]!.alive).sort(), 'court']
}

/** Plays AI sides of the current battle until a human must act, a decision opens, or it ends. */
export function driveBattle(c: Ctx): void {
  const s = c.s
  let guard = 0
  while (s.battle && !s.battle.result && !s.pending) {
    if (humanControls(s.battle, s.battle.toAct)) break
    if (guard++ > 4000) { s.battle.result = { winner: 'd', reason: 'day-limit' }; break }
    const a = aiBattleAction(c)
    const r = applyBattleAction(c, a)
    if (r) { const r2 = applyBattleAction(c, { t: 'bEndSide' }); if (r2) { s.battle.result = { winner: 'd', reason: 'day-limit' } } }
  }
  if (s.battle && s.battle.result) finishBattle(c)
}

export function advance(c: Ctx): void {
  const s = c.s
  let guard = 0
  while (guard++ < 5000) {
    if (s.phase === 'battle') { driveBattle(c); if (s.phase === 'battle') return }
    if (s.phase !== 'strategic' || s.pending) return
    if (s.flow.stage === 'commands') return
    if (s.flow.stage === 'end') { monthEnd(c); if ((s.phase as string) === 'result') return; beginMonth(c); return }
    const facs = aiOrder(c)
    if (s.flow.f >= facs.length) { s.flow.stage = 'end'; continue }
    const f = facs[s.flow.f] as string
    if (s.flow.queue === null) {
      s.flow.queue = c.x.order.filter((id) => ps(c, id).owner === f)
      if (f === 'court') marchCampaign(c)
      continue
    }
    const id = s.flow.queue.shift()
    if (id === undefined) { s.flow.f++; s.flow.queue = null; continue }
    if (ps(c, id).owner !== f || (s.commandsLeft[id] ?? 0) <= 0) continue
    const a = decideStrategic(c, f, id)
    if (a) runCommand(c, a, f, false)
  }
}

function answer(c: Ctx, option: string): Reject | null {
  const s = c.s
  const pd = s.pending!
  if (!pd.options.includes(option)) return rej('illegal-target', 'Arch', 'that option is not on offer')
  s.pending = null
  const d = pd.data as Record<string, unknown>
  if (pd.kind === 'captive') {
    const cap = d['captive'] as string
    let actor = d['actor'] as string
    const ah = s.heroes[actor]
    if (!ah || ah.faction !== 'player' || ah.status === 'captive') actor = chieftainId(c) as string
    captiveChoice(c, cap, option, actor, d['pref'] as string)
    const queue = d['queue'] as string[]
    if (queue.length && s.phase === 'strategic') {
      const next = queue[0] as string
      const court = c.x.kindOf[next] === 'court'
      s.pending = { kind: 'captive', options: court ? ['persuade', 'release', 'hold', 'execute'] : ['persuade', 'release', 'hold'], data: { captive: next, queue: queue.slice(1), actor, pref: hs(c, next).loc } }
    }
  } else if (pd.kind === 'tiger') resolveTiger(c, d['pref'] as string, option)
  else if (pd.kind === 'inspection') resolveInspection(c, d['pref'] as string, option)
  else if (pd.kind === 'convoy') resolveConvoy(c, d['pref'] as string, option)
  else if (pd.kind === 'duelOffer') answerDuel(c, option, d)
  return null
}

function apply(c: Ctx, a: Action): Reject | null {
  const s = c.s
  if (s.phase === 'result') return rej('game-over', 'X-5', 'the game is over')
  if (s.pending) {
    if (a.t !== 'choose') return rej('pending-decision', 'Arch', 'answer the open decision first')
    const r = answer(c, a.option)
    if (r) return r
    advance(c)
    return null
  }
  if (a.t === 'choose') return rej('illegal-target', 'Arch', 'no decision is open')
  if (s.phase === 'battle') {
    const b = s.battle
    if (!b) return rej('unknown-action', 'W-7', 'no battle')
    if (!a.t.startsWith('b')) return rej('not-your-turn', 'W-7', 'a battle is under way')
    if (a.t !== 'bAuto' && !humanControls(b, b.toAct)) return rej('not-your-turn', 'W-7', 'the other side acts now')
    const r = applyBattleAction(c, a)
    if (r) return r
    advance(c)
    return null
  }
  if (a.t.startsWith('b')) return rej('unknown-action', 'W-7', 'no battle is under way')
  if (s.flow.stage !== 'commands') return rej('not-your-turn', 'T-2', 'the AI phase is running')
  if (a.t === 'endPhase') {
    s.flow = { stage: 'ai', f: 0, queue: null }
    advance(c)
    return null
  }
  const r = runCommand(c, a, 'player', false)
  if (isReject(r)) return r
  advance(c)
  return null
}

export function step(state: GameState, action: Action, data: DataBundle = defaultBundle): StepResult {
  try {
    const bad = shapeError(action)
    if (bad) return { ok: false, code: 'unknown-action', message: `Arch: ${bad}` }
    const s = clone(state)
    const c = mkCtx(s, data)
    const r = apply(c, action)
    if (r) return { ok: false, code: r.code, message: r.message }
    return { ok: true, state: s, events: c.ev as GameEvent[] }
  } catch (e) {
    return { ok: false, code: 'unknown-action', message: `internal error: ${(e as Error).message}` }
  }
}
void rank
