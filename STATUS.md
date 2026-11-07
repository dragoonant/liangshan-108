# STATUS

2026-11-07: kickoff done (PLAN D1-D15, complaint research C1-C13). Overnight on branch `claude/inspiring-hypatia-73p6th`: M0 specs, M1 data and **M2 engine** are in.

## M2 engine (this branch)
- `src/data/` typed loaders + `data/triggers.json` (23 story triggers, validated).
- `src/engine/` per `docs/spec/00-architecture.md` and `10-rules.md`: strategic month, hex battles, court and rival phases, view/query, replay, save envelope, invariants.
- `src/ai/greedy.ts` the A-rules decider (all factions, player seat in sims, `bAuto`).
- `tests/unit/` titled by rule id (`checklist.test.ts` fails if a rule id of `12-rules-test-checklist.md` has no test or `test.todo`), golden month and battle, fuzz, replay, save.
- `tools/sim.ts` and `docs/spec/70-sim-results.md` (balance table; read it before touching numbers).
- Open items: see the `RULING` lines in `PLAN.md` and `test.todo` in `tests/unit` (client-only rules, the famine story event).

Moved to `dragoonant/liangshan-108` on 2026-11-07 (D1). Next: the owner picks balance-first or playable-first (see the sim table).

## B1 balance pass (2026-11-07)
- Chao Gai (`data/heroes-extra.json`, start `yunzhou`) replaces Ruan Xiaoer as a start (D17). Eight mountain camps (`data/camps.json`, rules K-1..K-8: raids from their stronghold, slow growth, alliance, joining together, persuaded chiefs) give the map active neighbours (D18).
- `src/ai/policies.ts` and the worker-thread `tools/sim.ts`: justice, benevolent, warlord, brotherhood, careless and greedy by difficulty and start; the table is in `docs/spec/70-sim-results.md`. Balance knobs live in `src/engine/tuning.ts`.
- Stage 4 (B1) and B2: D20 (loyal governors, conquest support -5) and D21 (capital waves, W-32) are in; targets still missed (0 wins in 576 games); see 70-sim-results.md.
- B3: the `campaign` policy (phases grow, expand, renown, stage, assault) is in the sim; G-3 muster cap is now pop/60; targets still missed (see 70-sim-results.md and the B3 RULING lines).
- Not done: the KB entry `liangshan-108.md` (outside this repo's paths) was not updated.

## M3 first playable (2026-11-07, branch m3-playable)
- `docs/spec/50-presentation.md`: the outlaw hideout ledger (tokens, fonts, stamps, layouts, must-not-look-like list).
- `src/client/`: title (Continue names what it reopens, corrupt-save message, discard confirm), start picker (six chieftains, difficulty deadlines), SVG strategic map (48 prefectures, links by kind, protected capital, open/cut refuge links), prefecture panel with prompts and `query.preview` odds, 128-hero roster of posters with late-joiner triggers, HUD (month, deadline, Renown trend, Edict projection and status), warnings and advisor, full event log, five-column Renown ledger, help, settings (speed incl. Instant), autosave under `ls108-save`.
- 3D hex battle (R3F): engine terrain, procedural figures, tile-only picking, hover/unit cards with odds and fatigue causes, "Day N of 20" with last 3 days lit, capital reinforcement waves, auto-resolve, withdraw, mouse (wheel, right rotate, middle pan, left pan until a middle press) and touch (pan, twist, pinch) camera.
- New engine file `src/engine/query/client.ts` (`clientQuery`: startInfo, difficulties, ledger, triggerText, terrain, pendingInfo) with `tests/unit/client-queries.test.ts`.
- e2e (`npm run e2e`, 14 tests, desktop and 390x844): two months and a battle by clicks, autosave then Continue in a persistent profile, corrupt save, tap behind a figure, rule 24, mouse controls, post-Edict map. Screenshots: `docs/screenshots/m3/` (set `M3_SHOTS=1` to rewrite), side by side with three-kingdoms-tactics in `compare-three-kingdoms-tactics.png`.
- Not done: audio, GLB figures, no per-move playback of AI-only battles, KB entry `liangshan-108.md` not updated (outside this repo), hot-seat. The sim is untouched.
