# PLAN — Liangshan: 108 Stars

An original browser strategy game set in the world of *Water Margin* (*Shuihu Zhuan*, the public-domain 14th-century novel). It is a spiritual successor to Koei's *Bandit Kings of Ancient China* (1989; Japanese title *Suikoden: Tenmei no Chikai*). It is not a port and not affiliated with Koei Tecmo: the ruleset is our own (`docs/spec/10-rules.md`), so **the spec is the product**. Rules have ids, every ambiguity is a `RULING:` line, and balance changes need a sim or bench result.

## Decisions (owner, 2026-11-07, do not re-ask)
- **D1** Home: **`dragoonant/liangshan-108`** (created by the owner 2026-11-07; moved there the same day). Push to `main` after each stage; Pages deploys every push. Originally: a **new repo the owner creates** (suggested `dragoonant/liangshan-108`; owner also enables Pages with Source "GitHub Actions"). Until it exists, the game is built on the orphan branch `claude/inspiring-hypatia-73p6th` of `dragoonant/three-kingdoms-tactics`, which holds only this game, so it moves over with `git push <new-remote> claude/inspiring-hypatia-73p6th:main`.
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

## Decisions (owner, 2026-11-07 morning, do not re-ask)
- **D16** Next step is **balance first**: simulate several blunt player strategies, tune only what every sensible one agrees on, then build the first playable (M3).
- **D17** **Chao Gai** is added as a non-star hero (a 109th record outside the 108) and a starting chieftain, replacing Ruan Xiaoer as a start; Ruan Xiaoer goes back to being recruitable.
- **D18** **More rivals:** the novel's mountain camps get their own active chiefs, so the early game has neighbours to fight, ally with and recruit from.
- **D19** **Keep the 23 story-locked heroes**; the hero ledger shows each trigger.
- Pages: the first deploy (2026-11-07) built cleanly and stopped at `configure-pages` because Pages is not enabled yet; the owner turns it on (Settings, Pages, Source "GitHub Actions"), then any push deploys.

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
| B1 | Balance pass: player policies in the sim, Chao Gai, mountain-camp rivals (D16-D18) | 2026-11-07 |
| M3 | First playable on Pages: hideout-ledger skin, full map, battles, greedy AI, autosave | next |
| M4 | Utility AI in a worker, bench gate | |
| M5 | Art: 108 hero figures in the house style, portraits as wanted posters | |
| M6 | Audio | |
| M7 | Polish, phone layout, cut-ins | |

## Rulings / balance log
RULING: S-1 | Chao Gai is not in `data/heroes.json` (he is not one of the 108 stars), so the sixth start is Ruan Xiaoer at `jizhou`; the other five are Song Jiang, Lin Chong, Wu Song, Lu Zhishen, Hu Sanniang | the start must be a record the engine can load; the brief listed Chao Gai only as an example | OPEN (owner: add Chao Gai as a 109th non-star record, or keep Ruan Xiaoer)
RULING: S-1 | Lin Chong starts at `mengzhou` (data says `dongjing`, the protected capital) and Wu Song at `cangzhou` (data), so the six starts are in six different prefectures | a chieftain cannot start in the court capital | OPEN
RULING: S-8 | The start prefecture is taken from its owner; that owner's heroes there become free heroes; a rival with no other prefecture is removed | the data puts rival strongholds (`jizhou`, `zhujiazhuang`) and court heroes at the starts | OPEN
RULING: S-9 | Two followers join at once (the two lowest-rank `free` heroes of the start prefecture, loyalty 60) | with 2 commands a month and no followers the first season is only invites; this gives a first sworn-brother candidate | OPEN (balance)
RULING: T-3 | Commands: 2 in the chieftain's prefecture, 1 per sworn brother's prefecture, 0 (standing orders) otherwise | the brief says one command per prefecture where chieftain or a sworn brother is present; the extra command for the chieftain keeps month 1-6 playable | OPEN (balance)
RULING: T-6 | Northern snow is `pos.y <= 0.30`; with the current map only `taiyuan`-`zhending` and `dengzhou`-`dengyun-shan` passes are snowed in Dec-Feb | brief says "northern snow that blocks movement"; the map has few northern passes | OPEN (raise to 0.35 or add a road-snow rule after the sim)
RULING: B-1 | Oath needs loyalty 80 and virtue match 55 (distance 7 or less) | gives Song Jiang and Wu Yong a possible oath (distance 7) while rejecting opposites | OPEN (balance)
RULING: Q-5 | `joinTrigger` is free text, so the 23 triggers are a structured table in `11-scenario.md` section 5 (renown, own, battle-won-at, attacked, defeated-hero, brother, campaign-announced); M2 writes `data/triggers.json` | the data contract has no structured trigger | OPEN
RULING: R-5 | Edict threshold is 500 Renown for all difficulties; deadlines are 180/144/108/84 months | no sim exists yet; sources of Renown (R-2) were sized so that about a dozen prefectures give 25-35 a month | OPEN (balance: tune with the first sim)
RULING: R-9 | After the Edict the capital is garrisoned to 6,000 men over 3 months | gives the finale weight without a hidden bonus; shown in the forecast | OPEN (balance)
RULING: G-8 | Gao Qiu flees along an open link at most twice, and a link is cut only if its far end is player-owned; a non-court far end becomes court-held when he arrives | the capital has 5 links (`yingtianfu`, `mengzhou`, `chenzhou`, `zhangde`, `luoyang`); the cap guarantees the chase ends (C4) | OPEN
RULING: E-3 | At start the court holds 13 prefectures and 32 are free and passive (`11-scenario.md` section 2) | the data names court heroes in only 7 prefectures; rival/free filler avoids a 30-prefecture court | OPEN (balance: free prefectures never attack, so the map is quiet)
RULING: E-12 | Economy numbers (tax, harvest, levy, upkeep) are first-pass; Hu Sanniang's `zhujiazhuang` has population 24,000 so her tax is about 36 gold a month | the data's base population; her start gold (2,500) must carry her to her first conquest | OPEN (balance)
RULING: Z-5 | Foreign prefecture numbers are shown in 10% bands until spied on | the brief's pillar "nothing hidden that decides your fate" concerns the player's own meters; the AI obeys the same view (A-1) | OPEN
RULING: X-3 | If the chieftain is captured a sworn brother succeeds (Renown -20%); no brother means defeat | keeps one lost battle from ending a long game (C3) | OPEN
RULING: G-6 | The court hosts grow `min(9000, 2000 + 25 t)` and campaign every `K - floor(renown / 100)` months (min 3), `K` = 14/10/7/5 by difficulty | answers C3 (difficulty = AI behaviour only) and gives visible cause and effect for Renown | OPEN (balance)
RULING: W-4 | Battlefield weights are by prefecture terrain, 15x11 for strongholds down to 11x9 for towns, walls for city, fortress and stronghold | the brief asks for terrain-seeded templates; sizes keep a battle to 20 days of about 8 units a side | OPEN
RULING: W-7 | Day limit is 20 for every battle and the attacker withdraws when it runs out | brief asks for a visible number; 20 is below the 30 the first game was criticised for being too tight at, to be raised if the sim shows too many time-outs | OPEN (balance)
RULING: W-12 | Fatigue gains are `max(1, base - floor(vigour / 40))` and recoveries `floor(vigour / 10)` (+8 idle) | makes vigour matter without a second stat; numbers are first-pass | OPEN (balance)
RULING: H-7 | The 22 skill effects are defined in `10-rules.md` H-7; the one-line `effect` hooks in `data/skills.json` are flavour only | rules own numbers | OPEN
RULING: G-1 | Emperor Huizong (`data/court.json`) is a figure in the capital, never a governor, general or unit | he is the Edict's giver, not a combatant | OPEN
RULING: Arch | `createGame(..., { forcedRolls })` adds a plain-JSON `rng.forced` list used only by tests | golden tests need fixed dice and the draw order is contract | OPEN
RULING: Late rivals | Tian Hu, Wang Qing and Fang La (1118-1120) never appear in v1 because the longest deadline ends Dec 1115 | their records stay in the data for a longer mode | OPEN
RULING: Arch | `GameState` also carries `flow` (`{stage, f, queue}`: where the AI phase of the month is, so a battle against the player can pause it and resume) and `fired` (story-event and trigger memo); `PrefectureState` carries bookkeeping fields (`reliefT`, `huntT`, `disasterT`, `stormT`, `spyT`, `graftMod` ...) | the Arch outline lists only the main fields and `step` must stop and resume mid-month | OPEN
RULING: T-7/V-0 | An event rolled at month-end `t` fires at month-end `t+1`. `query.forecast` lists the events firing at the end of the current month; a sorcerer adds the season and snowed-in links two months ahead (events are rolled one month ahead, so they cannot be shown earlier) | the text promises a two-month forecast but rolls only one month ahead | OPEN
RULING: V-5/T-6 | A snowstorm rolled for month `m` is active during month `m` (it blocks links in that month's command phase and its +25% upkeep falls in the same month-end) | "blocks every link for one month" needs a month; this gives the player the warning for the whole command phase | OPEN
RULING: E-3 | A court prefecture with no named governor uses graft 50 for its starting support (45) | the formula needs a governor | OPEN
RULING: G-7 | Court heroes stay in the prefecture they start in (after the scenario relocation); only campaign generals are drawn from the capital's reserve | the scenario lists governors "with" other heroes in their prefectures | OPEN
RULING: G-6 | The court marches in its own phase of the month after the announcement; the staging prefecture is the court neighbour of the objective with most men; generals are the 4 highest-command court heroes in the staging prefecture or capital (Gao Qiu never marches); the host is `min(host/2, staging men)` and the campaign is called off below 300 men | the rule does not say who leads or what a thin host does | OPEN
RULING: W-5 | A unit has a personal guard (up to 50 men) that is not drawn from the pool; survivors return as `max(0, men - guard)` | keeps men conserved while honouring "at least 50, not drawn from the pool" | OPEN
RULING: W-27 | Attacking heroes who survive occupy the conquered prefecture; the other half of the spoils goes to the origin; defenders retreat to the nearest owned prefecture (ties by map order); with no retreat each is offered the victor (serves if match is 40 or more, else freed there, Q-8) | the text leaves hero movement open | OPEN
RULING: H-16 | Unrest and revolt apply to the player's prefectures only; the chieftain is never freed by a revolt (moves to the nearest prefecture of yours) | AI prefectures have no support management beyond A-3; the chieftain's loss is X-3's job | OPEN
RULING: 12-golden B | The fixture adds a second defender unit (69 men, 5 hexes away) so Guan is not "the side's last unit" (W-17 would add +30, giving 84 instead of the printed 54), and Lin Chong carries only `spearman` (with `drillmaster` the archer beside him fights at training 80 and the volley is 67, not 65) | the printed numbers contradict W-17 and H-7 for the fixture as drawn | OPEN
RULING: Arch | `legalActions` for `attack` offers force variants without the chieftain first and with the chieftain second; `move` offers each hero alone with 0, 50 and 100% of the men | keeps the list finite; the greedy decider never risks the chieftain (X-3) | OPEN
RULING: V-8 | The wronged officer is a standing +30 invite bonus on court-held star heroes under a governor with graft 70 or more (fires once at Renown 50); the famine relief story event is not implemented (`test.todo`) | the effect needs a stated trigger the data cannot supply cheaply | OPEN
RULING: A-8 | With a scout in service `view` lists, during the command phase, every march an AI faction currently intends against your prefectures (from the same decider it will use); campaigns are always announced (G-6) | rival marches are not scheduled a month ahead, so "visible at the previous month-end" is built as "visible before it happens, this month" | OPEN
RULING: A-3 | The decider for the player seat (sims, `bAuto` of the AI, tests) is the A-3 order plus: swear first, hunt and relieve for Renown while gold allows, no training or feasts below 600 gold, attacks never include the chieftain unless nobody else is fit | A-3 as written bankrupts a small prefecture (36 gold a month against 40 for wages) | OPEN (balance: see 70-sim-results.md)
RULING: V-6 | Wu Song's scripted tiger sits in `cangzhou` although its terrain is coast | S-1 says "a scripted tiger is abroad on month 1" and V-6 only picks hills and mountains for random tigers | OPEN
RULING: Q-4 | An executed court officer leaves the game (stored as dormant with faction court) | the text gives no later fate | OPEN
RULING: X-3 | The heir's Renown loss is `floor(renown / 5)` and is logged in the ledger under battles | "Renown -20%, rounded down" | OPEN
RULING: W-26 | Gao Qiu's flight is resolved after the battle: his unit routs at 30% of maxMen or less; he is captured when he flees a third time, when no link is open, or when taken at 0 men or in a capture duel with every link cut; otherwise he moves to the open link whose far end holds most court men, becomes its governor and the prefecture turns court | W-26, G-8 and A-7 leave the order of these checks open | OPEN
RULING: Arch | An action with a missing or mistyped field, an unknown value (stake, op, dir ...) or an unknown `t` is rejected as `unknown-action` with a message starting "Arch:" | step must never throw on junk (fuzz test) | OPEN
RULING: G-4 | Every month-end the capital is topped up to `min(host(t), pop/20)` men with matching arms (free of cost), and after the Edict to 6,000 over 3 months | "never leaves the capital under host(t)" needs a mechanism | OPEN
RULING: E-16 | `discord` lowers the loyalty of the first hero present at the target; only the player's heroes have a loyalty meter, so against an AI faction it only appears in the log | H-9 gives loyalty to the player's heroes only | OPEN
RULING: W-8 | A unit that already moved cannot charge (the charge is its move); `bWait` counts as idle for fatigue recovery; a hidden unit that moves is revealed | the text does not say | OPEN
