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
  else if (pd.kind === 'duelOffer') answerDuel(c, option)
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
    if (!action || typeof (action as { t?: unknown }).t !== 'string') return { ok: false, code: 'unknown-action', message: 'Arch: not an action' }
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
