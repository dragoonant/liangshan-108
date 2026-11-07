import type { Action, GameState, Setup } from './types'
import { createGame } from './setup'
import { step } from './step'
import { defaultBundle } from './data'
import type { DataBundle } from '../data'

/** Same state as the live game that accepted `actions` (rejected actions are skipped, as the store never logs them). */
export function replay(setup: Setup, actions: Action[], data: DataBundle = defaultBundle): GameState {
  let s = createGame(setup, data)
  for (const a of actions) { const r = step(s, a, data); if (r.ok) s = r.state }
  return s
}
