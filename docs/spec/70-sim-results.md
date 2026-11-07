# 70 - Sim results

Run 2026-11-07: `npm run sim -- --games 150 --difficulty all`, seeds 1000-1149, starts rotated over the six heroes, greedy decider for the player seat (A rules). Numbers are first-pass; balance changes are rulings for the coordinator (not made here).

| Difficulty | Games | Win rate | Edict reached | Edict month median | p10 | p90 | Edict after Edict-by or never | Gao Qiu flights / game | Battles / game | Heroes at end (mean) | Prefectures at end (mean) | Renown at end (mean / max) | Median last month |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 150 | 0% | 0% | - | - | - | 100% | 0.0 | 16.7 | 2.8 | 0.5 | 22.0 / 179 | 44 |
| 2 | 150 | 0% | 0% | - | - | - | 100% | 0.0 | 17.3 | 2.8 | 0.5 | 27.5 / 150 | 44 |
| 3 | 150 | 0% | 0% | - | - | - | 100% | 0.0 | 20.5 | 3.3 | 0.8 | 24.9 / 112 | 56 |
| 4 | 150 | 0% | 0% | - | - | - | 100% | 0.0 | 17.5 | 2.9 | 0.9 | 25.3 / 107 | 47 |

Invariant, stall (50,000 steps) and replay failures: 0.


## Reading the table (engine agent, no numbers changed)
- **The greedy player never earns the Edict and never wins** on any difficulty (0 of 600 games); the best Renown reached was 179 (difficulty 1), far below `EDICT = 500` (R-5). Mean Renown at the end is 22-28. By the sim's own reckoning the Edict is "never" on this decider: either R-2's sources are too small for a prefecture-by-prefecture player, or this decider is too passive (it never farms the five columns systematically). This is the balance question for the coordinator (PLAN R-5 ruling).
- **How games end** (36-game sample at difficulty 2, same seeds 1000-1035): 20 "You hold no prefecture", 10 "chieftain captured and no sworn brother can lead", 6 the deadline. Median last month is 44-56, so most games are lost in years 4-5 to the court's G-6 campaigns (first host about 1,000 men at month 10, then every 7-10 months) and to neighbouring rivals (Old Liangshan, Zhu and Zeng), against a start prefecture of 400-900 men. Gao Qiu is never reached, so the chase (G-8) is covered by unit tests only (`result.test.ts`, `ai.test.ts` A-7).
- Economy check: a start like Hu Sanniang's (pop 24,000) earns about 36 gold a month against about 40 for wages (E-5, E-12 ruling), so the purse is the first thing to fail; the decider's 600-gold floor keeps it from spending itself dry but cannot fix income.
- **Invariants:** 0 failures in 600 games (plain JSON, non-negative stocks, 108 heroes accounted for, `legalActions` non-empty before the result, no stall, `replay` equals live). Mean 780 ms per game.
- Tuning candidates, for the coordinator only: first-host size (G-4 `2000 + 25 t` against a 400-900 man start), the 500 Edict threshold against R-2 income (a heavenly joiner is +2, a won battle +1), start gold of the small starts, and AI aggression `k` (S-3).
