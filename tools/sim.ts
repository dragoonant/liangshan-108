// Headless games: a player policy against the AI factions, invariants after every step, balance tables.
// npm run sim -- --games 5 --policy all --difficulty all --start all [--seed 1000] [--workers 4] [--write] [--verbose]
//   --games is per (policy, difficulty, start) cell. Seeds: seed0 + running cell index * 1000 + game index, printed in the report.
import { writeFileSync } from 'node:fs'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { cpus } from 'node:os'
import { createGame, step, legalActions, checkInvariants, replay, START_HEROES, STARTS, setTuning } from '../src/engine'
import { CAMPAIGN_K } from '../src/engine/calendar'
import type { Action, GameState, Difficulty } from '../src/engine'
import { POLICIES, policyAction } from '../src/ai/policies'
import type { PolicyId } from '../src/ai/policies'
import { DEADLINE } from '../src/engine/calendar'

export interface Job { policy: PolicyId; diff: Difficulty; start: string; seed: number }
export interface Row extends Job { reason: string; outcome: string; t: number; renown: number; maxRenown: number; prefs: number; heroes: number; battles: number; edictT: number | null; flights: number; steps: number; ms: number; fails: string[] }

function playOne(j: Job): Row {
  const t0 = Date.now()
  const setup = { startHero: j.start, difficulty: j.diff, seed: j.seed }
  let s: GameState = createGame(setup)
  const actions: Action[] = []
  const fails: string[] = []
  let steps = 0, battles = 0, flights = 0, maxRenown = 0
  const tag = `${j.policy} d${j.diff} ${j.start} seed ${j.seed}`
  while (s.phase !== 'result') {
    if (Date.now() - t0 > 120000) { fails.push(`${tag}: over 120 s wall time at t=${s.t}, step ${steps}`); break }
    if (steps++ > 50000) { fails.push(`${tag}: stall over 50,000 steps at t=${s.t}`); break }
    const legal = legalActions(s)
    if (legal.length === 0) { fails.push(`${tag}: legalActions empty at t=${s.t} phase ${s.phase}`); break }
    let a = policyAction(j.policy, s, legal)
    let r = step(s, a)
    if (!r.ok) {
      fails.push(`${tag}: ${j.policy} action ${a.t} rejected (${r.code}: ${r.message}) at t=${s.t}`)
      a = legal.find((x) => x.t === 'endPhase' || x.t === 'bEndSide') ?? (legal[0] as Action)
      r = step(s, a)
      if (!r.ok) { fails.push(`${tag}: fallback rejected too (${r.message})`); break }
    }
    for (const e of r.events) { if (e.k === 'battleStart') battles++; if (e.k === 'gaoFlees') flights++ }
    actions.push(a)
    s = r.state
    maxRenown = Math.max(maxRenown, s.factions['player']!.renown)
    const bad = checkInvariants(s)
    if (bad.length) { fails.push(`${tag}: invariant at step ${steps}, t=${s.t}: ${bad.slice(0, 3).join(' | ')}`); break }
  }
  const rp = replay(setup, actions)
  if (JSON.stringify(rp) !== JSON.stringify(s)) fails.push(`${tag}: replay differs from the live state`)
  const f = s.factions['player']!
  const prefs = Object.values(s.prefectures).filter((p) => p.owner === 'player').length
  const heroes = Object.values(s.heroes).filter((h) => h.faction === 'player' && ['chieftain', 'sworn', 'ordinary'].includes(h.status)).length
  return { ...j, reason: s.result?.reason ?? 'unfinished', outcome: s.result?.outcome ?? 'unfinished', t: s.t, renown: f.renown, maxRenown, prefs, heroes, battles, edictT: f.edict, flights, steps, ms: Date.now() - t0, fails }
}

/** An experiment: knob overrides for this run. `starts` patches S-1 rows, `campaignK` the G-6 interval per difficulty. */
export interface Experiment { tune?: Record<string, number>; starts?: Record<string, Record<string, number>>; campaignK?: Record<string, number> }
function applyExperiment(x: Experiment): void {
  setTuning((x.tune ?? {}) as never)
  for (const [h, patch] of Object.entries(x.starts ?? {})) Object.assign((STARTS as Record<string, object>)[h] as object, patch)
  for (const [d, k] of Object.entries(x.campaignK ?? {})) (CAMPAIGN_K as Record<string, number>)[d] = k
}

if (!isMainThread) {
  const { jobs, exp } = workerData as { jobs: Job[]; exp: Experiment }
  applyExperiment(exp)
  parentPort!.postMessage(jobs.map((j) => { const r = playOne(j); if (process.env['SIM_VERBOSE']) console.log(`${j.policy} d${j.diff} ${j.start} seed ${j.seed}: ${r.outcome} t=${r.t} R=${r.renown}/${r.maxRenown} prefs=${r.prefs} heroes=${r.heroes} battles=${r.battles} ${r.ms}ms`); return r }))
} else {
  main().catch((e) => { console.error(e); process.exit(2) })
}

const q = (xs: number[], p: number): number => { const a = [...xs].sort((x, y) => x - y); return a.length ? (a[Math.min(a.length - 1, Math.floor(p * a.length))] as number) : NaN }
const pc = (n: number, d: number): string => (d ? `${Math.round((100 * n) / d)}%` : '-')

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const arg = (k: string, d: string): string => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? (args[i + 1] as string) : d }
  const games = Number(arg('games', '2'))
  const polArg = arg('policy', 'all')
  const policies: PolicyId[] = polArg === 'all' ? POLICIES : (polArg.split(',') as PolicyId[])
  const diffArg = arg('difficulty', '2')
  const diffs: Difficulty[] = diffArg === 'all' ? [1, 2, 3, 4] : (diffArg.split(',').map(Number) as Difficulty[])
  const startArg = arg('start', 'all')
  const starts = startArg === 'all' ? START_HEROES : startArg.split(',')
  const seed0 = Number(arg('seed', '1000'))
  const nWorkers = Number(arg('workers', String(Math.max(1, Math.min(cpus().length, 8)))))
  const write = args.includes('--write')
  const exp: Experiment = JSON.parse(arg('exp', '{}'))
  const jobs: Job[] = []
  let cell = 0
  for (const policy of policies) for (const diff of diffs) for (const start of starts) {
    for (let g = 0; g < games; g++) jobs.push({ policy, diff, start, seed: seed0 + cell * 1000 + g })
    cell++
  }
  const t0 = Date.now()
  // interleave so every worker gets a mix of slow and fast games
  const buckets: Job[][] = Array.from({ length: nWorkers }, () => [])
  jobs.forEach((j, i) => buckets[i % nWorkers]!.push(j))
  const parts = await Promise.all(buckets.filter((b) => b.length).map((b) => new Promise<Row[]>((res, rej) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { jobs: b, exp }, execArgv: ['--import', 'tsx'] })
    w.once('message', res); w.once('error', rej)
  })))
  const rows = parts.flat()
  const failures = rows.flatMap((r) => r.fails)
  const L: string[] = []
  const sel = (p: PolicyId, d?: number, s?: string): Row[] => rows.filter((r) => r.policy === p && (d === undefined || r.diff === d) && (s === undefined || r.start === s))
  const win = (rs: Row[]): number => rs.filter((r) => r.outcome === 'victory').length

  L.push('### Win rate by policy and difficulty', '', `| Policy | ${diffs.map((d) => `d${d}`).join(' | ')} | Edict reached (d${diffs.includes(2) ? 2 : diffs[0]}) | Mean Renown (d${diffs.includes(2) ? 2 : diffs[0]}) |`, `|---|${diffs.map(() => '---').join('|')}|---|---|`)
  const dd = diffs.includes(2) ? 2 : (diffs[0] as number)
  for (const p of policies) {
    const r2 = sel(p, dd)
    L.push(`| ${p} | ${diffs.map((d) => { const rs = sel(p, d); return `${pc(win(rs), rs.length)} (${rs.length})` }).join(' | ')} | ${pc(r2.filter((r) => r.edictT !== null).length, r2.length)} | ${r2.length ? (r2.reduce((a, r) => a + r.renown, 0) / r2.length).toFixed(0) : '-'} |`)
  }
  L.push('', '### Edict timing (games with an Edict, per policy and difficulty): median month as % of the deadline (median `t`)', '', `| Policy | ${diffs.map((d) => `d${d}`).join(' | ')} |`, `|---|${diffs.map(() => '---').join('|')}|`)
  for (const p of policies) L.push(`| ${p} | ${diffs.map((d) => { const e = sel(p, d).filter((r) => r.edictT !== null).map((r) => r.edictT as number); return e.length ? `${Math.round((100 * q(e, 0.5)) / DEADLINE[d])}% (t=${q(e, 0.5)}, n=${e.length})` : '-' }).join(' | ')} |`)
  L.push('', '### Won games: Edict month (% of deadline, median) and Gao Qiu flights (mean)', '', `| Policy | ${diffs.map((d) => `d${d}`).join(' | ')} |`, `|---|${diffs.map(() => '---').join('|')}|`)
  for (const p of policies) L.push(`| ${p} | ${diffs.map((d) => { const w = sel(p, d).filter((r) => r.outcome === 'victory'); return w.length ? `${Math.round((100 * q(w.map((r) => r.edictT as number), 0.5)) / DEADLINE[d])}%, ${(w.reduce((a, r) => a + r.flights, 0) / w.length).toFixed(1)} flights (n=${w.length})` : '-' }).join(' | ')} |`)
  L.push('', `### Win rate by start hero (difficulty ${dd})`, '', `| Policy | ${starts.join(' | ')} | spread (max - mean, points) |`, `|---|${starts.map(() => '---').join('|')}|---|`)
  for (const p of policies) {
    const rates = starts.map((s) => { const rs = sel(p, dd, s); return rs.length ? (100 * win(rs)) / rs.length : 0 })
    const mean = rates.reduce((a, b) => a + b, 0) / Math.max(1, rates.length)
    L.push(`| ${p} | ${starts.map((s, i) => { const rs = sel(p, dd, s); return `${Math.round(rates[i] as number)}% (${rs.length})` }).join(' | ')} | ${(Math.max(...rates) - mean).toFixed(0)} / min ${(mean - Math.min(...rates)).toFixed(0)} |`)
  }
  L.push('', '### How games end (all difficulties)', '')
  for (const p of policies) {
    const reasons: Record<string, number> = {}
    for (const r of sel(p)) reasons[r.reason.replace(/^Gao Qiu is captured.*/, 'victory')] = (reasons[r.reason.replace(/^Gao Qiu is captured.*/, 'victory')] ?? 0) + 1
    L.push(`- ${p}: ${Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('; ')}`)
  }
  const mean = (f: (r: Row) => number): string => (rows.reduce((a, r) => a + f(r), 0) / Math.max(1, rows.length)).toFixed(1)
  L.push('', `Mean per game: ${mean((r) => r.battles)} battles, ${mean((r) => r.heroes)} heroes at the end, ${mean((r) => r.prefs)} prefectures at the end, ${mean((r) => r.ms)} ms.`)
  const out = L.join('\n')
  console.log(out)
  console.log(`\ngames ${rows.length} in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${nWorkers} workers, invariant/stall/replay failures ${failures.length}`)
  for (const f of failures.slice(0, 30)) console.log('FAIL', f)
  const outPath = arg('out', '')
  if (write) {
    const today = new Date().toISOString().slice(0, 10)
    const hdr = `# 70 - Sim results\n\nRun ${today}: \`npm run sim -- --games ${games} --policy ${polArg} --difficulty ${diffArg} --start ${startArg} --seed ${seed0}\`. ${rows.length} games; seeds are \`${seed0} + cell * 1000 + game\` where cell counts policy x difficulty x start in the order printed (so every seed is reproducible: \`createGame({ startHero, difficulty, seed })\` and the policy). Policies are in \`src/ai/policies.ts\`; \`greedy\` is the A-rules decider.\n\n`
    writeFileSync(outPath ? outPath : new URL('../docs/spec/70-sim-results.md', import.meta.url), `${hdr}${out}\n\nInvariant, stall (50,000 steps) and replay failures: ${failures.length}.\n${failures.slice(0, 20).map((f) => `- ${f}`).join('\n')}\n`)
  }
  process.exit(failures.length ? 1 : 0)
}
