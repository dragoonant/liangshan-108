// Headless games: greedy player vs AI factions, invariants after every step, balance table.
// npm run sim -- --games 200 --difficulty 2 [--start song-jiang] [--seed 1] [--write]
import { writeFileSync } from 'node:fs'
import { createGame, step, legalActions, checkInvariants, replay, START_HEROES, defaultBundle } from '../src/engine'
import type { Action, GameState, Difficulty } from '../src/engine'
import { greedyAction } from '../src/ai/greedy'
import { DEADLINE } from '../src/engine/calendar'

const args = process.argv.slice(2)
const arg = (k: string, d: string): string => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? (args[i + 1] as string) : d }
const games = Number(arg('games', '20'))
const diffArg = arg('difficulty', '2')
const diffs: Difficulty[] = diffArg === 'all' ? [1, 2, 3, 4] : [Number(diffArg) as Difficulty]
const startArg = arg('start', 'all')
const seed0 = Number(arg('seed', '1'))
const write = args.includes('--write')
const verbose = args.includes('--verbose')

interface Row { reason: string; maxRenown: number; diff: number; start: string; seed: number; outcome: string; t: number; renown: number; prefs: number; heroes: number; battles: number; edictT: number | null; flights: number; steps: number; ms: number }
const failures: string[] = []
const rows: Row[] = []

function playOne(diff: Difficulty, start: string, seed: number): Row {
  const t0 = Date.now()
  const setup = { startHero: start, difficulty: diff, seed }
  let s: GameState = createGame(setup)
  const actions: Action[] = []
  let steps = 0, battles = 0, flights = 0, maxRenown = 0
  const tag = `d${diff} ${start} seed ${seed}`
  while (s.phase !== 'result') {
    if (steps++ > 50000) { failures.push(`${tag}: stall over 50,000 steps at t=${s.t}`); break }
    const legal = legalActions(s)
    if (legal.length === 0) { failures.push(`${tag}: legalActions empty at t=${s.t} phase ${s.phase}`); break }
    let a = greedyAction(s)
    let r = step(s, a)
    if (!r.ok) {
      const alt = legal.find((x) => x.t === 'endPhase' || x.t === 'bEndSide') ?? legal[0] as Action
      failures.push(`${tag}: greedy action ${a.t} rejected (${r.code}: ${r.message}) at t=${s.t}`)
      a = alt
      r = step(s, a)
      if (!r.ok) { failures.push(`${tag}: fallback rejected too (${r.message})`); break }
    }
    for (const e of r.events) { if (e.k === 'battleStart') battles++; if (e.k === 'gaoFlees') flights++;}
    actions.push(a)
    s = r.state
    maxRenown = Math.max(maxRenown, s.factions['player']!.renown)
    const bad = checkInvariants(s)
    if (bad.length) { failures.push(`${tag}: invariant at step ${steps}, t=${s.t}: ${bad.slice(0, 3).join(' | ')}`); break }
  }
  const rp = replay(setup, actions)
  if (JSON.stringify(rp) !== JSON.stringify(s)) failures.push(`${tag}: replay differs from the live state`)
  const f = s.factions['player']!
  const prefs = Object.values(s.prefectures).filter((p) => p.owner === 'player').length
  const heroes = Object.values(s.heroes).filter((h) => h.faction === 'player' && ['chieftain', 'sworn', 'ordinary'].includes(h.status)).length
  return { reason: s.result?.reason ?? 'unfinished', maxRenown, diff, start, seed, outcome: s.result?.outcome ?? 'unfinished', t: s.t, renown: f.renown, prefs, heroes, battles, edictT: f.edict, flights, steps, ms: Date.now() - t0 }
}

for (const diff of diffs) {
  for (let g = 0; g < games; g++) {
    const start = startArg === 'all' ? (START_HEROES[g % START_HEROES.length] as string) : startArg
    const row = playOne(diff, start, seed0 + g)
    rows.push(row)
    if (verbose) console.log(`d${diff} ${start.padEnd(12)} seed ${row.seed} ${row.outcome.padEnd(8)} t=${row.t} renown ${row.renown} prefs ${row.prefs} heroes ${row.heroes} battles ${row.battles} edict ${row.edictT ?? '-'} (${row.ms}ms)`)
  }
}

const q = (xs: number[], p: number): number | string => { if (!xs.length) return '-'; const a = [...xs].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))] as number }
const label = (t: number | string): string => (typeof t === 'number' ? `${1101 + Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')} (t=${t})` : t)
const lines: string[] = []
lines.push('| Difficulty | Games | Win rate | Edict reached | Edict month median | p10 | p90 | Edict after Edict-by or never | Gao Qiu flights / game | Battles / game | Heroes at end (mean) | Prefectures at end (mean) | Renown at end (mean / max) | Median last month |')
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for (const d of diffs) {
  const rs = rows.filter((r) => r.diff === d)
  if (!rs.length) continue
  const ed = rs.filter((r) => r.edictT !== null).map((r) => r.edictT as number)
  const late = rs.filter((r) => r.edictT === null || (r.edictT as number) > DEADLINE[d] - 18).length
  const mean = (f: (r: Row) => number): string => (rs.reduce((a, r) => a + f(r), 0) / rs.length).toFixed(1)
  lines.push(`| ${d} | ${rs.length} | ${((100 * rs.filter((r) => r.outcome === 'victory').length) / rs.length).toFixed(0)}% | ${((100 * ed.length) / rs.length).toFixed(0)}% | ${label(q(ed, 0.5))} | ${label(q(ed, 0.1))} | ${label(q(ed, 0.9))} | ${((100 * late) / rs.length).toFixed(0)}% | ${mean((r) => r.flights)} | ${mean((r) => r.battles)} | ${mean((r) => r.heroes)} | ${mean((r) => r.prefs)} | ${mean((r) => r.renown)} / ${Math.max(...rs.map((r) => r.maxRenown))} | ${q(rs.map((r) => r.t), 0.5)} |`)
}
const reasons: Record<string, number> = {}
for (const r of rows) reasons[`d${r.diff}: ${r.reason}`] = (reasons[`d${r.diff}: ${r.reason}`] ?? 0) + 1
lines.push('', 'Results by reason:', ...Object.entries(reasons).sort().map(([k, v]) => `- ${k}: ${v}`))
console.log(lines.join('\n'))
console.log(`\ngames ${rows.length}, invariant/stall/replay failures ${failures.length}, mean ${(rows.reduce((a, r) => a + r.ms, 0) / Math.max(1, rows.length)).toFixed(0)} ms/game`)
for (const f of failures.slice(0, 30)) console.log('FAIL', f)
if (write) {
  const today = new Date().toISOString().slice(0, 10)
  const body = `# 70 - Sim results\n\nRun ${today}: \`npm run sim -- --games ${games} --difficulty ${diffArg}\`, seeds ${seed0}-${seed0 + games - 1}, starts rotated over the six heroes, greedy decider for the player seat (A rules). Numbers are first-pass; balance changes are rulings for the coordinator (not made here).\n\n${lines.join('\n')}\n\nInvariant, stall (50,000 steps) and replay failures: ${failures.length}.\n${failures.slice(0, 20).map((f) => `- ${f}`).join('\n')}\n`
  writeFileSync(new URL('../docs/spec/70-sim-results.md', import.meta.url), body)
}
void defaultBundle
process.exit(failures.length ? 1 : 0)
