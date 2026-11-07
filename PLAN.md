# PLAN — Liangshan: 108 Stars

An original browser strategy game set in the world of *Water Margin* (*Shuihu Zhuan*, the public-domain 14th-century novel). It is a spiritual successor to Koei's *Bandit Kings of Ancient China* (1989; Japanese title *Suikoden: Tenmei no Chikai*). It is not a port and not affiliated with Koei Tecmo: the ruleset is our own (`docs/spec/10-rules.md`), so **the spec is the product**. Rules have ids, every ambiguity is a `RULING:` line, and balance changes need a sim or bench result.

## Decisions (owner, 2026-11-07, do not re-ask)
- **D1** Home: a **new repo the owner creates** (suggested `dragoonant/liangshan-108`; owner also enables Pages with Source "GitHub Actions"). Until it exists, the game is built on the orphan branch `claude/inspiring-hypatia-73p6th` of `dragoonant/three-kingdoms-tactics`, which holds only this game, so it moves over with `git push <new-remote> claude/inspiring-hypatia-73p6th:main`.
- **D2** First playable is the **full map at once**: every prefecture of the scenario map, strategic turns and 3D hex battles, vs AI.
- **D3** Presentation concept: **outlaw hideout ledger** (lantern-lit reed-marsh map on oiled paper, heroes as wanted posters with bounties, ink stamps for orders, water and reeds everywhere). Spec: `docs/spec/50-presentation.md` (written at M3). Must not look like: three-kingdoms-tactics (war-council sand table, cloth slips, wax seal), Xross Forge, or any Koei UI.
- **D4** **All 108 heroes** in the first playable (36 Heavenly Spirits + 72 Earthly Fiends), plus Gao Qiu and his officials.
- **D5** Deadline: **always visible, length set by difficulty**, with a run-rate that shows whether the player will earn the Imperial Edict in time (fixes complaint C2).
- **D6** Players: **solo vs AI** (one human chieftain against AI chieftains and Gao Qiu's court). Hot-seat may come later.
- **D7** Overnight 2026-11-07: **specs + data + engine** on the session branch, 1-2 Sonnet agents, about 2.5M tokens. Nothing on any `main`.
- **D8** Working title **Liangshan: 108 Stars**. Never use Koei's titles ("Bandit Kings", "Tenmei no Chikai").

## Defaults taken (change any by saying so)
- **D9** Stack: the sibling stack (Vite 8, React 19, three 0.186 / R3F 9 / drei 10, zustand 5, TypeScript 7 strict, Vitest 5, Playwright, tsx), config patterns from three-kingdoms-tactics.
- **D10** Battles on a **hex grid** (the original used hexes; it also keeps this game from looking like the square-grid sibling). Strategic map is a prefecture graph.
- **D11** Engine contract from the KB recipe: pure deterministic `step` (never throws), `legalActions` never empty before the result, `view(state, seat)`, `query.*` owns every number the UI shows, seeded sfc32 RNG, action log + replay, headless `sim` with invariants and a stall cap, plain-JSON state (KB rule 22).
- **D12** IP posture (KB rule 3 adapted to an original game): names of people, places and nicknames come from the public-domain novel; all prose, system names, UI and art are ours; no Koei names, art, music, UI or numbers. README and UI say "unofficial, non-commercial fan project, not affiliated with Koei Tecmo".
- **D13** Figures follow the house style (KB `rules.md` rule 7, 23). KB rules 22 (autosave + Continue), 24 (no long-press selection), 25 (tile-only picking), 26 (load before show), 27 (mouse controls) apply from the first playable.
- **D14** The knowledge base is linked as a submodule at `docs/knowledge-base/` once the new repo exists (it is private; Pages does not check out submodules).
- **D15** Every complaint fix in `docs/research/original-complaints.md` (C1-C13) is a design requirement, traced to rule ids in `10-rules.md`.

## Design pillars
1. **The outlaw fantasy, not a reskinned Romance of the Three Kingdoms** (C11): you are a wronged hero gathering sworn brothers in a marsh stronghold, fighting corrupt officials for justice, until the Emperor's Edict lets you strike Gao Qiu.
2. **Brotherhood is the core system** (what players loved): recruiting by deed and reputation, sworn brotherhood gated by loyalty and matching personality, and heroes whose stats visibly change what you can do (C6).
3. **Nothing hidden that decides your fate** (C5, C9, C1, C2): every meter shows its trend and its threshold; warnings come before a revolt, a desertion or a missed deadline; events state their effect.
4. **Battles worth watching and quick to resolve** (C7): 3D hex battles with readable fatigue, morale and a visible day limit; duels with shown odds; a final chase for Gao Qiu that the player can plan around (C4).
5. **Modern comfort** (C8, C10, C12, C13): a scrollable event log, mouse and touch, phone layout, autosave, in-game help, English text.

## Milestones
| Id | What | State |
|---|---|---|
| K0 | Kickoff: complaint research, questions, decisions | done 2026-11-07 |
| M0 | Scaffold (copied config) + specs 00/10/11/20 | overnight 2026-11-07 |
| M1 | Data: 108 heroes, Gao Qiu's court, full prefecture map, items, events; `validate:data` | overnight 2026-11-07 |
| M2 | Engine: strategic turn + hex battle, sim, tests by rule id | overnight 2026-11-07 |
| M3 | First playable on Pages: hideout-ledger skin, full map, battles, greedy AI, autosave | next |
| M4 | Utility AI in a worker, bench gate | |
| M5 | Art: 108 hero figures in the house style, portraits as wanted posters | |
| M6 | Audio | |
| M7 | Polish, phone layout, cut-ins | |

## Rulings / balance log
(none yet)
