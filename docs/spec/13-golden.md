# 13 — Golden examples (v0.1)

Two worked examples with forced dice, for the engine agent to turn into `tests/unit/golden-month.test.ts` and `tests/unit/golden-battle.test.ts`. Every number below was recomputed by script from the formulas in `10-rules.md` on 2026-11-07. The fixtures are small hand-made states (`tests/fixtures/*.json`), not the 1101 scenario: they override prefecture numbers and use hero stats from `data/heroes.json` where named, and the stated values where marked *fixture*. Forced dice use `createGame(..., { forcedRolls })` (Arch, RNG): each `roll(n)` takes the next listed value, clamped to `0..n-1`; the variance roll is `roll(21)` and the value 10 means +0%.

## A. A worked month: October 1101, Yunzhou

**Fixture.** One prefecture only (no rivals, no court, so the AI phase is empty). `t = 9`, difficulty 2 (deadline 144, `edictBy` = 126).
- `yunzhou` (player): pop 150,000; land 60; gold 1,000; food 1,200; men 1,000; arms 700; training 40; support 50; dyke 50; bandits 40; `heroes`: `song-jiang` (chieftain; might 60, command 92, cunning 78, vigour 70; virtues R9 C9 D4; skill scribe), `wu-yong` (ordinary, loyalty 60; command 84, cunning 98; virtues R6 C5 D4; skill strategist).
- Renown 31 after the relief below (starts the month at 30); `renownHistory` for `t = 0..8` is nine entries of 30. No scheduled events. Map terrain `plains`, so no tiger.
- `commandsLeft.yunzhou = 2` (chieftain present, T-3).
- Forced rolls: `[57]` (the only draw: the plague roll for Yunzhou in step 8).

**Actions and expected results**

| # | Action | Rule | Result |
|---|---|---|---|
| 1 | `levy` actor `song-jiang` | E-12 | `N = floor(750 * 90 / 100) = 675`, then `floor(675 * 118 / 100) = 796` men. Cost 796 gold. gold 204; pop 149,204; men 1,796; support 47; `commandsLeft` 1. |
| 2 | `relieve` actor `song-jiang` | E-12 | Food -300 (900). Support `+8 +2` (compassion 9 >= 7) = 57. Renown +1 (31), ledger line "relief, Yunzhou, +1, E-12/R-2". `commandsLeft` 0. |
| 3 | `endPhase` | T-2 | AI phase skipped (no AI factions). Month end runs. |

**Month end (T-8), in order**

| Step | Computation | Result |
|---|---|---|
| 1 Tax (E-4) | `floor(149 * 60 * 107 / 5000) = 191`; scribe present +10%: `floor(191 * 110 / 100) = 210` | gold 414 |
| 2 Harvest (E-6) | `floor(149 * 60 * 107 / 450) = 2125` | food 3,025 |
| 3 Upkeep (E-5) | food `ceil(1796 / 10) = 180` (autumn, no winter factor); wages `ceil(1796 / 20) + 5 * 1 = 90 + 5 = 95` (`wu-yong` is ordinary; the chieftain is free) | food 2,845; gold 319 |
| 3b Starvation | none (food stays positive) | |
| 4 Scheduled events | none | |
| 5 Growth (E-10) | `g = 1` (Sep-Feb): `+floor(149204 / 1000) = 149`; dyke 50 -> 49; bandits stay 40 (support 57 is between 50 and 69) | pop 149,353 |
| 6 Support drift (E-11) | no famine, bandits under 150: 0; `+1` (no disaster, runway 15.8 >= 3, bandits 40 < 50); `+1` (compassion 9 hero present) | support 59 |
| 7 Loyalty (H-12) | `wu-yong`: virtue distance `|9-6| + |9-5| + |4-4| = 7`; `compat = 100 - 42 = 58`; resting level `40 + floor(58 / 2) = 69`; support 59 gives no modifier; loyalty `60 -> 62` | loyalty 62 |
| 8 Roll events for next month (V-0) | Nov: no foreseeable event is in season (V-1..V-5 windows). Sudden events: plague (V-4) is eligible (pop >= 100,000): `roll(100) = 57`, `57 >= 2`, no plague. Tiger (V-6): terrain is plains, not eligible. | draws used: 1 |
| 9 Court muster | none | |
| 10 Renown and deadline | `renownHistory[9] = 31`; trend `(31 - renownHistory[3]) / 6 = 1/6` shown as 0.2; projected Edict `10 + ceil(469 / (1/6)) = 10 + 2814 = 2824`, beyond the last month 143, shown "after the deadline"; status red; required rate `469 / (126 - 10) = 4.0` per month vs current 0.2; deadline 144 months, 133 left; no banner | `t = 10` (November 1101) |

**Final state to assert:** `t = 10`; yunzhou: pop 149,353, gold 319, food 2,845, men 1,796, arms 700, training 40, support 59, land 60, dyke 49, bandits 40; `wu-yong` loyalty 62; Renown 31; `commandsLeft.yunzhou = 2`; `rng.draws = 1` and `rng.forced = []`; `pending = null`. Oath meter for `wu-yong` (B-1): loyalty 62 of 80 (missing 18), match 58 of 55 (met). The event log contains, in order: levy, relief, tax, harvest, upkeep, support change, loyalty change, "no plague", month advance. `query.runway = 15.8`. `query.advice` returns at most 3 hints and the first is the red Edict run-rate (R-8).

## B. A worked battle round: Day 1 at a forest line

**Fixture.** A 9 x 7 board (all plain except `(4,2)`, which is forest); attacker origin prefecture food 2,000, defender prefecture food 800, defender support 50 (no home morale bonus). Axial coordinates `(q, r)`; east is `(+1, 0)`. The seat is a `town`; no walls (the fixture overrides W-4 generation). Day 1, wind east, no weather.

| Unit | Side | Hero stats | Men | Armed | Training | Morale | Fatigue | Position |
|---|---|---|---|---|---|---|---|---|
| Lin Chong, infantry (spearman) | attacker, commander | might 92, command 85, cunning 60, vigour 85 | 1000 | 100 | 80 | 68 | 0 | `(2,2)` |
| Archer captain (*fixture*), archers | attacker | might 80, command 70, cunning 50, vigour 70 | 600 | 100 | 70 | 67 | 0 | `(2,3)` |
| Captain Guan (*fixture*), infantry | defender, commander | might 70, command 60, cunning 50, vigour 60, daring 5 | 800 | 75 | 50 | 65 | 0 | `(4,2)` forest |

Start morale is `60 + floor(training / 10)` (W-20): 68, 67, 65. Lin Chong's `drillmaster` bonus applies to *adjacent allies* only, so it does not change his numbers.

**Forced rolls, in draw order:** `[40, 60, 50, 10, 90, 70, 20, 10, 10, 10]`
1. `40` duel acceptance (`roll(100)`); 2-7 the six exchange rolls (`roll(100)`), challenger then target; 8 variance for Lin Chong's attack (`roll(21)`, 10 = 0%); 9 variance for the counter; 10 variance for the volley.

**Attacker side, day 1**

| # | Action | Rule | Expected |
|---|---|---|---|
| 1 | `bMove` Lin Chong `(2,2)` to `(3,2)` | W-6, W-8 | Cost 1; enters the zone of control of Guan, movement ends. Fatigue `+max(1, 3 - floor(85/40)) = +1` (cause "march"). |
| 2 | `query.duelOdds(Lin Chong, Guan, honour)` | W-17 | `accept% = clamp(5, 95, 35 + 30 + floor((70 - 92) / 2)) = 54`. `win%`: Lin power `92 + 21 = 113`, Guan `70 + 15 = 85`; the gap is 28; the chance Lin wins an exchange is `P(28 + a - b > 0)` over two `roll(100)` = `7372 / 10000`; best of three `p^2 (3 - 2p) = 0.8291`, shown 82.9%. |
| 3 | `bDuel` Lin Chong vs Guan, stake honour | W-17, W-18 | Roll 1: `40 < 54`, accepted. Exchange 1: `113 + 60 = 173` vs `85 + 50 = 135`, Lin. Exchange 2: `113 + 10 = 123` vs `85 + 90 = 175`, Guan. Exchange 3: `113 + 70 = 183` vs `85 + 20 = 105`, Lin. Lin wins 2-1. Lin: morale `68 + 15 = 83`, fatigue `+max(1, 5 - 2) = +3` (cause "duel", total 4). Guan: morale `65 - 20 = 45`, men `800 - pct(800, 10) = 720`, fatigue `+max(1, 20 - 1) = +19`. |
| 4 | `query.attackPreview(Lin Chong, Guan)` | W-9 | Chain: base `40 + 46 + 100 = 186`; fatigue `100 - floor(4/2) = 98` -> 182; training `80 + 16 = 96` -> 174; arms `60 + 40 = 100` -> 174; height 0 -> 174; action 100 -> 174; pincer 100 (no other friendly adjacent) -> 174; forest 85 -> 147; command defence `100 - floor(60/4) = 85` -> 124. The value before variance is 124, so variance -10% and +10% give min `pct(124, 90) = 111` and max `pct(124, 110) = 136`. |
| 5 | `bAttack` Lin Chong -> Guan | W-9, W-11 | Roll 8 (variance 0): damage **124**. Guan `720 -> 596`. |
| 6 | Counter (automatic) | W-11 | Guan alive, adjacent. Guan's men 596, fatigue 19, training 50, armed 75, Lin on plain 100%, Lin command defence `100 - 21 = 79`. Chain: base `40 + 35 + 59 = 134`; fatigue `100 - 9 = 91` -> 121; training `80 + 10 = 90` -> 108; arms `60 + 30 = 90` -> 97; height 0 -> 97; counter 60 -> 58; terrain 100 -> 58; command 79 -> 45. Roll 9 (variance 0): damage **45**. Lin `1000 -> 955`. Fatigue: Lin attack `+max(1, 4 - 2) = +2` (total 6); Guan counter `+max(1, 2 - 1) = +1` (total 20). |
| 7 | `bVolley` Archer captain -> Guan | W-16 | Distance 2. Chain: base `40 + 40 + 60 = 140`; fatigue 0 -> 140; training `80 + 14 = 94` -> 131; arms 100 -> 131; height 0 -> 131; volley 70 -> 91; pincer skipped (volley); forest 85 -> 77; command 85 -> 65. Roll 10 (variance 0): damage **65**, no counter. Guan `596 -> 531`. Archer fatigue `+max(1, 4 - 1) = +3`. |
| 8 | `bEndSide` | W-7 | Defender side acts. |

**Defender side, day 1:** scripted: `bEndSide` (Guan waits). The AI battle rule A-9 would attack; the test sets the defender to "pass" so the numbers above hold.

**Dusk (W-22), in order**
1. Fire: none. 2. Village healing and heal skills: none. 
3. Food (W-21): attacker men on the field `955 + 600 = 1555`, `ceil(1555 / 300) = 6` from the origin: **2,000 -> 1,994**. Defender men `531`, `ceil(531 / 300) = 2`: **800 -> 798**. Nobody hungry.
4. Rally: none.
5. Fatigue recovery (W-12): recovery `floor(vigour / 10)`, +8 if idle. Lin (not idle) `6 - 8 = 0` (clamped). Archer (not idle) `3 - 7 = 0`. Guan (took part in a duel, so not idle) `20 - 6 = 14`.
6. Morale `+2` for units that took no damage today: only the archer (`67 -> 69`). Lin (hit by the counter) stays 83; Guan stays 45.
7. Rout checks: Guan morale 45 > 20 and men 531 > 80: no rout. 
8. Day counter 1 -> 2. HUD: "Day 2 of 20", 18 days left.

**Final state to assert:** Lin Chong men 955, morale 83, fatigue 0, at `(3,2)`; Archer captain men 600, morale 69, fatigue 0; Guan men 531, morale 45, fatigue 14; `rng.draws = 10` and `rng.forced = []`; day 2; attacker origin food 1,994; defender food 798; `battle.result = null`. Events in order: `moved`, `duelOffered`, `duelAccepted`, `duelExchange` x3, `duelResolved`, `attacked` (124), `countered` (45), `volleyed` (65), `dusk` (food, fatigue, morale lines), `dayStarted` (2). Replay of the 7 actions from the fixture equals the final state.

## C. Cases to keep (one-line each)
- Same actions with difficulty 1 and 4 give identical results (S-4).
- Same rolls, same terrain for a given `(seed, t, prefecture)` (W-4).
- A routed hero with an enemy within 2 hexes: capture odds `clamp(15, 85, 50 + floor((90 - 70) / 2)) = 60` shown on the card (W-19).
- Gao Qiu at 0 men with five open links vs all cut: captured only when all cut or at 0 men; otherwise flight (W-26).
