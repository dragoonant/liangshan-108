// Autosave (KB rule 22): one slot, one versioned envelope, never silent.
import { buildSave, parseSave, legalActions, clientQuery } from '../../engine'
import type { Action, GameState, LogEntry, SaveEnvelope } from '../../engine'

export const SAVE_KEY = 'ls108-save'
export type SaveStatus =
  | { kind: 'none' }
  | { kind: 'ok'; env: SaveEnvelope }
  | { kind: 'corrupt'; reason: string }
  | { kind: 'blocked'; reason: string }

export function readSave(): SaveStatus {
  let text: string | null
  try { text = localStorage.getItem(SAVE_KEY) } catch (e) { return { kind: 'blocked', reason: `This browser refuses to read saved games (${(e as Error).message}).` } }
  if (text === null) return { kind: 'none' }
  const p = parseSave(text)
  if (!p.ok) return { kind: 'corrupt', reason: p.reason }
  const env = p.save
  if (!clientQuery.startInfo(env.setup.startHero)) return { kind: 'corrupt', reason: 'The save names a chieftain that is no longer in the game.' }
  try {
    const l = legalActions(env.snapshot)
    if (env.snapshot.phase !== 'result' && l.length === 0) return { kind: 'corrupt', reason: 'The saved position has no legal moves; the engine cannot read it.' }
  } catch (e) { return { kind: 'corrupt', reason: `The engine cannot read the saved position (${(e as Error).message}).` } }
  return { kind: 'ok', env }
}
/** Returns an error line when the browser refuses to store. */
export function writeSave(s: GameState, actions: Action[], log: LogEntry[]): string | null {
  try {
    // `ui.log` rides along: the engine caps its own log at 600 lines, the event log (C8) keeps everything.
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...buildSave(s, actions, new Date().toISOString()), ui: { log } }))
    return null
  } catch (e) { return `Autosave failed: this browser refused to store the game (${(e as Error).message}).` }
}
export function savedLog(env: SaveEnvelope): LogEntry[] {
  const l = (env as unknown as { ui?: { log?: LogEntry[] } }).ui?.log
  return Array.isArray(l) ? l : env.snapshot.log
}
export function clearSave(): void { try { localStorage.removeItem(SAVE_KEY) } catch { /* shown by writeSave next time */ } }
