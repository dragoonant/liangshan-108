// Save envelope (KB rule 22; Arch "Action log, replay, save").
import type { Action, GameState, Setup } from './types'
import { defaultBundle } from './data'
import type { DataBundle } from '../data'
import { mkCtx, heroName } from './ctx'
import { label } from './calendar'
import { query } from './query'

export const SAVE_KEY = 'liangshan108.save.v1'
export interface SaveSummary { dateLabel: string; chieftain: string; prefectures: number; heroes: number; renown: number; edictStatus: string; phase: string; whoseTurn: string }
export interface SaveEnvelope { format: 'liangshan-108-save'; version: 1; savedAt: string; setup: Setup; seed: number; actions: Action[]; snapshot: GameState; summary: SaveSummary }

export function buildSave(s: GameState, actions: Action[], savedAt: string, data: DataBundle = defaultBundle): SaveEnvelope {
  const c = mkCtx(s, data)
  const mine = c.x.order.filter((id) => s.prefectures[id]!.owner === 'player').length
  const heroes = Object.keys(s.heroes).filter((h) => s.heroes[h]!.faction === 'player' && ['chieftain', 'sworn', 'ordinary'].includes(s.heroes[h]!.status)).length
  const ch = s.factions['player']!.chieftain
  return {
    format: 'liangshan-108-save', version: 1, savedAt, setup: s.setup, seed: s.setup.seed, actions: [...actions], snapshot: s,
    summary: { dateLabel: label(s.t), chieftain: ch ? heroName(c, ch) : '', prefectures: mine, heroes, renown: s.factions['player']!.renown, edictStatus: query.renown(s).status, phase: s.phase, whoseTurn: s.phase === 'battle' ? (s.battle?.toAct === 'a' ? 'attackers' : 'defenders') : 'you' },
  }
}
export type ParseResult = { ok: true; save: SaveEnvelope } | { ok: false; reason: string }
export function parseSave(text: string): ParseResult {
  let v: unknown
  try { v = JSON.parse(text) } catch { return { ok: false, reason: 'The save is not valid JSON.' } }
  const e = v as Partial<SaveEnvelope> | null
  if (!e || e.format !== 'liangshan-108-save') return { ok: false, reason: 'This is not a Liangshan save.' }
  if (e.version !== 1) return { ok: false, reason: `Save version ${String(e.version)} cannot be read by this build.` }
  if (!e.snapshot || e.snapshot.schema !== 1) return { ok: false, reason: 'The saved game state is from an incompatible rules version.' }
  if (!e.setup || !Array.isArray(e.actions)) return { ok: false, reason: 'The save is missing its setup or action list.' }
  return { ok: true, save: e as SaveEnvelope }
}
/** Serialise and read back: the helper the tests use. */
export function roundTrip(env: SaveEnvelope): ParseResult { return parseSave(JSON.stringify(env)) }
