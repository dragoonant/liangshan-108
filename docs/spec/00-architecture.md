# 00 — Architecture and frozen contracts (v0.1, frozen at the start of M2)

Patterns follow the owner's build recipe (D11): a pure deterministic engine, a store that is the only caller of `step`, a client that never does rules maths. This game has its own rules (`10-rules.md`) and skin. Changes to this file go in the change log at the end and in `PLAN.md` "Rulings / balance log".

## Layers
```
src/engine/   pure TypeScript rules. No DOM, React, three, timers, Date.now or Math.random.
src/data/     typed loaders over data/*.json (validated by tools/validate-data.mjs); engine takes the bundle as an argument.
src/ai/       deciders that answer through legalActions (A rules); run in a Web Worker from M4.
src/client/   React + R3F: store (sole caller of step), presentation director, hex board, HUD, ledger.
tools/        validate-data.mjs (M1), sim.ts (headless games + invariants), bench.ts (AI bench, M4).
tests/unit    Vitest, titles start with the rule id ("W-9 damage chain ...").
tests/e2e     Playwright, one full month + one battle by clicks.
```

## Engine contract
```ts
type Faction = 'player' | 'court' | 'free' | RivalId          // RivalId = slug of rivals.json faction, e.g. 'zhu-family-village'
type Seat = 'player' | 'observer'                              // v1 has one human; AIs act inside step
type Difficulty = 1 | 2 | 3 | 4

interface Setup { startHero: string; difficulty: Difficulty; seed: number }   // startHero in S-1
createGame(setup: Setup, data?: DataBundle, opts?: { forcedRolls?: number[] }): GameState
legalActions(state: GameState): Action[]       // never empty while phase !== 'result'
step(state: GameState, action: Action): { ok: true; state: GameState; events: GameEvent[] }
                                      | { ok: false; code: RejectCode; message: string }   // never throws; input state is never mutated
view(state: GameState, seat: Seat): GameView  // Z-5 fog applied; includes forecast, warnings, ledger, advice
replay(setup: Setup, actions: Action[], data?: DataBundle): GameState   // same state as the live one
```
`step` also runs the AI phases and the month end (T-2) after the player's `endPhase`, stopping at the first **pending decision** or the next command phase. The returned `events` are all the events of that call, in order.

### State (plain JSON: no class instances, Maps, Sets, functions, undefined, NaN)
```ts
interface GameState {
  schema: 1; setup: Setup; t: number                           // t = 0 is Jan 1101
  phase: 'strategic' | 'battle' | 'result'
  pending: Pending | null                                      // the one decision step is waiting for
  rng: { s: [number, number, number, number]; forced: number[]; draws: number }
  prefectures: Record<string, PrefectureState>                 // owner, pop, gold, food, men, arms, training, support, land, dyke, bandits, unrest, heroes[], captives[]
  heroes: Record<string, HeroState>                            // location, status, loyalty, wounded, cooldowns, sworn
  factions: Record<string, FactionState>                       // player: renown, renownHistory[], ledger[], edict; court: alert, nextCampaign
  scheduled: ScheduledEvent[]                                  // V-0 foreseen events with their stated effects
  commandsLeft: Record<string, number>                         // per prefecture, this month (T-3)
  battle: BattleState | null                                   // present while phase === 'battle'
  log: LogEntry[]                                              // scrollable event log (V-9); each has t, kind, text template id + args
  result: null | { outcome: 'victory' | 'defeat'; reason: string; ending: string }
}
interface Pending { kind: 'captive' | 'tiger' | 'inspection' | 'convoy' | 'duelOffer' | 'succession' | 'flightChoice'; options: string[]; data: unknown }
```
- **Hex coordinates** are axial `{ q, r }` in `BattleState`; the odd-r offset layout is only used when the battlefield is generated (W-3).
- **No derived data in state**: ids refer to `data/` records; names and text are looked up by the client.

### Action union (outline; one `t` discriminator, all payload fields plain JSON)
```ts
type Action =
  // strategic (the player's command phase)
  | { t: 'levy' | 'train' | 'forge' | 'dykes' | 'relieve' | 'rest'; pref: string; actor: string }
  | { t: 'trade'; pref: string; actor: string; dir: 'buyFood' | 'sellFood'; amount: number }
  | { t: 'hunt'; pref: string; actor: string; party: string[]; men: number }
  | { t: 'move'; pref: string; to: string; heroes: string[]; men: number }
  | { t: 'send'; pref: string; to: string; gold: number; food: number; arms: number; actor: string }
  | { t: 'spy'; pref: string; actor: string; target: string; op: SpyOp }
  | { t: 'recruit'; pref: string; actor: string; target: string; method: 'invite' | 'persuade' }
  | { t: 'swear'; pref: string; hero: string }
  | { t: 'attack'; pref: string; target: string; heroes: string[]; men: number }
  | { t: 'endPhase' }                                          // ends the player's command phase; always legal in a command phase
  // answers to a pending decision
  | { t: 'choose'; option: string }                            // option ids come from state.pending.options
  // battle (the seat to act is state.battle.toAct)
  | { t: 'bMove'; unit: string; to: Hex }
  | { t: 'bAttack' | 'bVolley' | 'bCharge'; unit: string; target: string }
  | { t: 'bFire'; unit: string; at: Hex }
  | { t: 'bHide' | 'bWait' | 'bAmbush' | 'bHeal' | 'bScuttle' | 'bCounsel'; unit: string; target?: string }
  | { t: 'bWeather'; unit: string; kind: 'wind' | 'rain' | 'fog'; dir?: number }
  | { t: 'bDuel'; unit: string; target: string; stake: 'honour' | 'capture' }
  | { t: 'bEndSide' }                                          // ends the acting side's day; always legal in a battle
  | { t: 'bWithdraw' } | { t: 'bAuto' }                        // W-23, W-28
```
`RejectCode`: `not-your-turn`, `pending-decision`, `no-commands-left`, `not-enough-<resource>`, `illegal-target`, `blocked-link`, `capital-protected`, `requirement-not-met`, `unknown-action`. Every reject carries a message that names the rule id.

### One pending decision at a time
At most one `state.pending` exists. While it is set, `legalActions` returns exactly the `choose` actions for its options (plus nothing else), and any other action is rejected with `pending-decision`. Decisions never queue: a step that would raise a second one resolves it by a deterministic default recorded in the log, or defers it (captives are asked one at a time in rank order; Q-4). Duel offers to the human are a pending decision; duel offers to the AI are answered in-step by `roll(100) < accept%`.

### Legal-action rules
- `legalActions` lists every currently legal action once, with parameters enumerated where finite (commands per actor and target; battle moves per reachable hex) and a representative set for numeric payloads (`trade` amounts 100/500/1000, `move` men 25/50/100% of the garrison). `step` accepts any value in the legal range, not only the representatives.
- Illegal because of a rule (a command with no commands left, the capital before the Edict) is never listed; the client greys the button using `query.why(state, action)`, which returns the rule id and the number needed.
- In a command phase `endPhase` is always legal; in a battle `bEndSide` is always legal; so `legalActions` is never empty before the result.

## `query.*` owns every number the UI shows
```ts
query.preview(state, command)           // cost, result range, odds, rule ids (T-10)
query.runway(state, prefId)             // months of food (E-9)
query.forecast(state)                   // next month: season, snowed-in links, scheduled events; two months with a sorcerer (T-7)
query.renown(state)                     // renown, trend, projected Edict month, edictBy, required rate, status (R-6..R-8)
query.deadline(state)                   // months left, last month label, banner level (R-10)
query.loyalty(state, heroId)            // loyalty, resting level, status label, months to desertion (H-14)
query.oath(state, heroId)               // loyalty, compat, requirements met/missing (B-1..B-3)
query.recruitOdds(state, actor, target, method)   // percent and every term (Q-2, Q-4)
query.attackPreview(state, unit, target)          // min/max men killed, counter range, every factor (W-9)
query.moveRange(state, unit)            // reachable hexes with cost (W-6)
query.duelOdds(state, unit, target, stake)        // accept% and win% (W-17, W-18)
query.captureOdds(state, unit)          // W-19
query.fatigue(state, unit)              // value and causes (W-12)
query.battleClock(state)                // day, days left, food stocks (W-7, W-21)
query.escapeRoutes(state)               // Gao Qiu's links: open or cut (G-8)
query.campaign(state)                   // announced court campaign, host size, ETA (G-6)
query.advice(state)                     // up to 3 hints (S-6)
query.why(state, action)                // reason an action is not legal
```
The client never does rules maths. A unit test lists every field displayed in `src/client` and fails if it does not come from `query.*` or `view`.

## RNG (sfc32)
- State: `rng.s = [a, b, c, d]` four uint32. Seeding from `setup.seed`: `splitmix32` four times (`s += 0x9e3779b9; z = s ^ (s >>> 16); z = imul(z, 0x21f0aaad); z ^= z >>> 15; z = imul(z, 0x735a2d97); z ^= z >>> 15`), take the four outputs as `a..d`, then discard 15 draws.
- `next()`: standard sfc32 returning `(t >>> 0) / 4294967296`. `roll(n) = floor(next() * n)`, an integer in `0..n-1`. `rng.draws` counts every call.
- **Forced rolls** (tests only): if `rng.forced` is non-empty, `roll(n)` takes the first entry `v`, removes it and returns `clamp(v, 0, n - 1)` without advancing `s`. Golden tests (`13-golden.md`) set it through `createGame(..., { forcedRolls })`.
- **Draw order is contract.** The order is fixed by the rules text (Z-2) and recorded in each rule: events by prefecture in `data/map.json` order then event-table order (V-0); battle terrain on its own stream (W-4); duel acceptance before exchanges (W-17, W-18); AI phases in faction id order (T-2). Adding a draw anywhere changes every later outcome, so it needs a change-log entry.

## Action log, replay, save
- `state` is immutable per step; the store keeps `actions: Action[]` (every accepted action, including `bAuto` and `endPhase`). `replay(setup, actions)` equals the live state (checked by sim after every game and in `tests/unit/replay.test.ts`).
- **Save envelope** (KB rule 22), one slot under the storage key `liangshan108.save.v1` (own key: every Pages game shares one origin):
```ts
interface SaveEnvelope {
  format: 'liangshan-108-save'; version: 1; savedAt: string        // ISO time from the client
  setup: Setup; seed: number; actions: Action[]; snapshot: GameState
  summary: { dateLabel: string; chieftain: string; prefectures: number; heroes: number; renown: number; edictStatus: string; phase: string; whoseTurn: string }
}
```
  Autosave after every accepted action and when a game starts. The snapshot is what reopens (same spot after a rules update); the action list rides along for bug reports. Continue names what it reopens (`summary`), "New game" asks once before replacing it, a finished game clears its save, a save the engine cannot read says why and offers to discard it. Never silent.
- **Versioning:** `GameState.schema` and `SaveEnvelope.version` bump on any state shape change; a loader for an older version either migrates or refuses with a visible reason.

## Module layout (`src/engine/`)
```
index.ts            re-exports createGame, step, legalActions, view, replay, query
types.ts            State, Action, GameEvent, Pending, RejectCode (this file's types)
rng.ts              sfc32, splitmix32, roll, forced rolls
calendar.ts         monthOf, yearOf, season, label(t), isSnowedIn(link, t)
data.ts             DataBundle type and the default bundle (imports data/*.json)
setup.ts            createGame: S-1 start, S-8 displacement, Q-6 hero placement
strategic/
  commands.ts       E-12 commands, T-3 command counting, previews
  month.ts          T-2 month driver and T-8 month-end steps
  economy.ts        E-4..E-11 formulas
  heroes.ts         loyalty, brotherhood, desertion, revolt (H, B)
  recruit.ts        Q rules, triggers
  renown.ts         ledger, trend, projection, Edict (R)
  court.ts          graft, muster, host, campaigns (G)
  events.ts         V rules, scheduling and forecast
  spy.ts            E-16
battle/
  hex.ts            axial maths, neighbours, distance, odd-r conversion
  terrain.ts        W-4 generation, W-6 table
  units.ts          W-5 deployment
  actions.ts        W-8 actions, W-9..W-16 damage, fire, weather
  duel.ts           W-17, W-18
  fatigue.ts        W-12; morale.ts W-20; dusk.ts W-21, W-22
  capture.ts        W-19, W-26, W-27
legal.ts            legalActions for both phases
step.ts             dispatcher, pending handling, AI driver
view.ts             Z-5 fog, forecast, warnings
query/              one file per query.*
save.ts             envelope build/parse/validate
invariants.ts       invariant checks used by sim and tests
src/ai/             rival.ts, court.ts, battle.ts (A rules), shared scoring.ts
```

## Invariants (checked by `tools/sim.ts` after every step, and in unit tests)
No NaN or non-integer in state; `0 <= support, training, land, dyke <= 100`; `gold, food, men, arms, pop >= 0`; `men <= floor(pop / 20)` unless a rule overrides (conquest garrison); every hero is in exactly one place (a prefecture's `heroes`, `captives`, or a battle unit) and each prefecture id exists; each prefecture has exactly one owner; at most one `pending`; `legalActions` non-empty until `result`; in battle: at most one unit per hex, no unit on an impassable hex, `0 <= men <= maxMen`, exactly one commander per side, `morale` and `fatigue` in 0-100, day in 1-20; Renown never negative; `dongjing` owned by the court until the Edict; the state round-trips through `JSON.parse(JSON.stringify(state))` unchanged; `replay` equals live state; every game ends by the deadline (stall cap 2 x deadline steps per month).

## sim contract (`tools/sim.ts`)
`npm run sim -- --games 50 --difficulty 2 --start song-jiang` plays headless games with the greedy AI as the player, checks the invariants after every step, prints per-game: outcome, month reached, Renown at end, prefectures, heroes, battles, and a summary table. Exit code 1 on any invariant failure, stall or replay mismatch.

## Change log
- 2026-11-07 v0.1 written at M0.
