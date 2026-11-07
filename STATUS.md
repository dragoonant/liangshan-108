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
- Stage 4: targets missed by a wide margin (0 wins in 576 games); no knob changed; a design change is proposed in 70-sim-results.md and logged in PLAN. Decide before M3.
- Not done: the KB entry `liangshan-108.md` (outside this repo's paths) was not updated.
