# STATUS

2026-11-07: kickoff done (PLAN D1-D15, complaint research C1-C13). Overnight on branch `claude/inspiring-hypatia-73p6th`: M0 specs, M1 data and **M2 engine** are in.

## M2 engine (this branch)
- `src/data/` typed loaders + `data/triggers.json` (23 story triggers, validated).
- `src/engine/` per `docs/spec/00-architecture.md` and `10-rules.md`: strategic month, hex battles, court and rival phases, view/query, replay, save envelope, invariants.
- `src/ai/greedy.ts` the A-rules decider (all factions, player seat in sims, `bAuto`).
- `tests/unit/` titled by rule id (`checklist.test.ts` fails if a rule id of `12-rules-test-checklist.md` has no test or `test.todo`), golden month and battle, fuzz, replay, save.
- `tools/sim.ts` and `docs/spec/70-sim-results.md` (balance table; read it before touching numbers).
- Open items: see the `RULING` lines in `PLAN.md` and `test.todo` in `tests/unit` (client-only rules, the famine story event).

Waiting on the owner to create the new repo and enable Pages (D1).
