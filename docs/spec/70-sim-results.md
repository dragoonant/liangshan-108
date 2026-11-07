# 70 - Sim results (B4: the D25 numbers are the defaults; the sim is a safety check, not the balance gate)

Run 2026-11-07: `npm run sim -- --games 4 --policy all --difficulty all --start all --seed 1000`. 672 games; seeds are `1000 + cell * 1000 + game` where cell counts policy x difficulty x start in the order printed (so every seed is reproducible: `createGame({ startHero, difficulty, seed })` and the policy). Policies are in `src/ai/policies.ts`; `greedy` is the A-rules decider.

### Win rate by policy and difficulty

| Policy | d1 | d2 | d3 | d4 | Edict reached (d2) | Mean Renown (d2) |
|---|---|---|---|---|---|---|
| campaign | 4% (24) | 4% (24) | 0% (24) | 0% (24) | 58% | 279 |
| justice | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 116 |
| benevolent | 4% (24) | 0% (24) | 4% (24) | 0% (24) | 63% | 363 |
| warlord | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 119 |
| brotherhood | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 42% | 286 |
| careless | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 31 |
| greedy | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 4% | 101 |

### Edict timing (games with an Edict, per policy and difficulty): median month as % of the deadline (median `t`)

| Policy | d1 | d2 | d3 | d4 |
|---|---|---|---|---|
| campaign | 40% (t=72, n=15) | 40% (t=58, n=14) | 40% (t=43, n=8) | 56% (t=47, n=7) |
| justice | 79% (t=142, n=1) | - | - | - |
| benevolent | 47% (t=85, n=19) | 53% (t=76, n=15) | 44% (t=48, n=7) | 83% (t=70, n=8) |
| warlord | 80% (t=144, n=1) | - | 81% (t=87, n=1) | 67% (t=56, n=1) |
| brotherhood | 47% (t=84, n=10) | 44% (t=63, n=10) | 53% (t=57, n=5) | 55% (t=46, n=1) |
| careless | - | - | - | - |
| greedy | 48% (t=87, n=2) | 93% (t=134, n=1) | 47% (t=51, n=3) | - |

### Won games: Edict month (% of deadline, median) and Gao Qiu flights (mean)

| Policy | d1 | d2 | d3 | d4 |
|---|---|---|---|---|
| campaign | 22%, 1.0 flights (n=1) | 27%, 1.0 flights (n=1) | - | - |
| justice | - | - | - | - |
| benevolent | 29%, 2.0 flights (n=1) | - | 44%, 2.0 flights (n=1) | - |
| warlord | - | - | - | - |
| brotherhood | - | - | - | - |
| careless | - | - | - | - |
| greedy | - | - | - | - |

### Win rate by start hero (difficulty 2)

| Policy | song-jiang | chao-gai | lin-chong | wu-song | lu-zhishen | hu-sanniang | spread (max - mean, points) |
|---|---|---|---|---|---|---|---|
| campaign | 0% (4) | 25% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 21 / min 4 |
| justice | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| benevolent | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| warlord | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| brotherhood | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| careless | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| greedy | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |

### Campaign policy: median month at which each phase is first reached (games that reach it / games)

| Phase | d1 | d2 | d3 | d4 |
|---|---|---|---|---|
| 1 grow | 0 (24/24) | 0 (24/24) | 0 (24/24) | 0 (24/24) |
| 2 expand | 30 (23/24) | 30 (23/24) | 13 (22/24) | 13 (13/24) |
| 3 renown | 30 (17/24) | 30 (21/24) | 30 (24/24) | 23 (24/24) |
| 4 stage | 73 (15/24) | 49 (13/24) | 44 (8/24) | 48 (6/24) |
| 5 assault | 95 (6/24) | 100 (4/24) | 53 (3/24) | 55 (3/24) |

### How games end (all difficulties)

- campaign: The court's patience ends 82; Your chieftain is captured and no sworn brother can lead 8; You hold no prefecture 4; victory 2
- justice: The court's patience ends 85; You hold no prefecture 8; Your chieftain is captured and no sworn brother can lead 3
- benevolent: The court's patience ends 90; Your chieftain is captured and no sworn brother can lead 3; victory 2; You hold no prefecture 1
- warlord: The court's patience ends 85; You hold no prefecture 7; Your chieftain is captured and no sworn brother can lead 4
- brotherhood: The court's patience ends 77; You hold no prefecture 10; Your chieftain is captured and no sworn brother can lead 9
- careless: Your chieftain is captured and no sworn brother can lead 90; You hold no prefecture 6
- greedy: You hold no prefecture 41; Your chieftain is captured and no sworn brother can lead 36; The court's patience ends 19

Mean per game: 25.1 battles, 5.1 heroes at the end, 1.3 prefectures at the end, 1652.8 ms.

Invariant, stall (50,000 steps) and replay failures: 0.


## B4 reading (2026-11-07)
**Adopted (D25):** Edict 300, Renown per hero/relief/hunt 4/4/5 (heavenly hero 5, famine relief 6), invite loyalty 55 (H-10), invite odds +10 (Q-2), upkeep and wages x0.7 (E-5), court host 1500 + 15t (G-4), and rule W-33 (a conquered prefecture has 1 command in the month it falls). No further tuning. **The balance targets (best sensible policy 80-95 / 55-70 / 30-45 / 10-25 % by difficulty, every sensible policy at least 10% on d1, d2 per-start spread, flights) are deferred to the human bench (D25).** For the record, the table above (4 games per start): campaign wins 4% on d1 and d2, benevolent 4% on d1 and d3, the others 0%; the Edict is reached in 58% (campaign), 63% (benevolent) and 42% (brotherhood) of d2 games at 40-53% of the deadline; careless wins 0%. Invariant, stall and replay failures: 0 in 672 games. The B3 and earlier readings follow as history.

## B3 reading (2026-11-07)
**The campaign policy** (`src/ai/policies.ts`, phases 1 grow, 2 expand, 3 renown, 4 stage, 5 assault; the sim logs the first month of each) answers only through `legalActions`, reads foreign prefectures in bands (Z-5), and adds supply (`send`), hero/men balancing, concentration at one capital neighbour, three-wave assaults and a chase of Gao Qiu. **Generous probe** (Edict 100, tax x2.5, harvest x2, wages/upkeep x0.5, host 1000 + 8t, muster cap pop/120, invite loyalty 55; 60 games on d2): the policy won **4 of 60** (song-jiang, lin-chong x2, chao-gai; months 74-94, with 3 waves and the chase), 25 of 60 reached the assault, 54 of 60 reached staging. So the rules allow a win, but the policy does not convert reliably: it is the policy (hero losses to capture, conquests without a loyal governor, men and heroes in different prefectures) and one rule gap, below.

**One rule gap found:** a conquered capital has no commands in the month after the assault (its heroes are only loyal after a feast), so the chase of Gao Qiu from the captured capital starts a month late or never; the policy now sends a loyal/sworn hero with the assault force and falls back to any force. Proposal (not made): a conquest grants the conquered prefecture 1 command in the month it is taken.

**One rule bug found and fixed (a G-3 knob):** court prefectures kept mustering to `pop/30`, so the capital swelled to 16,000-28,000 men by month 60-80 against R-9's 6,000. The cap is now `pop/60` (`musterCapDiv`, 30 to 60; rule G-3).

**Tuning (campaign counted as a sensible policy): targets still missed.** At the defaults (Edict 500, Renown 1/1/2) the Edict is not reached at all (0% on d2, mean Renown 99). The best candidate (below; **not adopted as defaults**, because twelve rule-number tests and the golden example would change for a setting that still misses the win targets) is Edict 300, Renown per hero/relief/hunt 4/4/5, invite loyalty 55 (H-10), invite odds +10 (Q-2), upkeep and wages x0.7, host 1500 + 15t:

| Target | Candidate result | Met |
|---|---|---|
| best sensible win rate d1 80-95 / d2 55-70 / d3 30-45 / d4 10-25 | benevolent 3% / 0% ; campaign 0% / 0% / 3% / 0% | no |
| every sensible policy at least 10% on d1; careless at most 5% on d2 | 0-3%; careless 0% | no / yes |
| d2 median Edict month at 50-75% of the deadline | campaign 42%, benevolent 56%, brotherhood 50% (the Edict is reached in 50% / 67% / 43% of d2 games) | benevolent and brotherhood yes, campaign early |
| d2 per-start spread of the best policy within 15 points | all 0%, spread 0 | trivially yes |
| won games average 1-2 Gao Qiu flights | 1.0-2.0 (n = 2) | yes (tiny sample) |

**Phase timings of the campaign policy, median month first reached (candidate settings, games reaching it / 30):**

| Phase | d1 | d2 | d3 | d4 |
|---|---|---|---|---|
| 1 grow | 0 (30) | 0 (30) | 0 (30) | 0 (30) |
| 2 expand | 30 (28) | 12 (29) | 12 (23) | 14 (14) |
| 3 renown | 33 (24) | 30 (28) | 30 (30) | 26 (29) |
| 4 stage | 99 (18) | 62 (15) | 41 (9) | 48 (9) |
| 5 assault | 155 (4) | 86 (5) | 45 (5) | 72 (1) |

**Measured cause of the missing wins:** the Edict is now reachable on the middle of the clock, but only about half of the games that earn it reach staging (hold or take a capital neighbour) and a tenth reach the assault: the policy holds 1-3 prefectures and 4-26 heroes; heroes are captured in the assaults and conquests revolt when the garrison hero is under loyalty 60 (D20), and the 8-unit cap with three waves is not the limit yet (4 probe wins show it can be done). **Proposal (no design change made):** (a) a conquered prefecture gets 1 command in the month it falls (helps every conquest and the chase); (b) a better governor model in the policy (feast the garrison to 60 before leaving) or a human bench (M3); (c) if the owner wants the targets reached by blunt policies, accept the candidate settings above and lower the win targets to what the bench shows.

#### Candidate settings table (campaign, benevolent, brotherhood; 5 games per start and difficulty, seeds 20000+)
#### Win rate by policy and difficulty

| Policy | d1 | d2 | d3 | d4 | Edict reached (d2) | Mean Renown (d2) |
|---|---|---|---|---|---|---|
| campaign | 0% (30) | 0% (30) | 3% (30) | 0% (30) | 50% | 257 |
| benevolent | 3% (30) | 0% (30) | 0% (30) | 0% (30) | 67% | 368 |
| brotherhood | 0% (30) | 0% (30) | 0% (30) | 0% (30) | 43% | 258 |

#### Edict timing (games with an Edict, per policy and difficulty): median month as % of the deadline (median `t`)

| Policy | d1 | d2 | d3 | d4 |
|---|---|---|---|---|
| campaign | 54% (t=98, n=18) | 42% (t=61, n=15) | 44% (t=48, n=11) | 56% (t=47, n=9) |
| benevolent | 40% (t=72, n=19) | 56% (t=81, n=20) | 49% (t=53, n=13) | 57% (t=48, n=6) |
| brotherhood | 48% (t=86, n=11) | 50% (t=72, n=13) | 44% (t=48, n=7) | 71% (t=60, n=6) |

#### Won games: Edict month (% of deadline, median) and Gao Qiu flights (mean)

| Policy | d1 | d2 | d3 | d4 |
|---|---|---|---|---|
| campaign | - | - | 35%, 1.0 flights (n=1) | - |
| benevolent | 26%, 2.0 flights (n=1) | - | - | - |
| brotherhood | - | - | - | - |

#### Win rate by start hero (difficulty 2)

| Policy | song-jiang | chao-gai | lin-chong | wu-song | lu-zhishen | hu-sanniang | spread (max - mean, points) |
|---|---|---|---|---|---|---|---|
| campaign | 0% (5) | 0% (5) | 0% (5) | 0% (5) | 0% (5) | 0% (5) | 0 / min 0 |
| benevolent | 0% (5) | 0% (5) | 0% (5) | 0% (5) | 0% (5) | 0% (5) | 0 / min 0 |
| brotherhood | 0% (5) | 0% (5) | 0% (5) | 0% (5) | 0% (5) | 0% (5) | 0 / min 0 |

#### Campaign policy: median month at which each phase is first reached (games that reach it / games)

| Phase | d1 | d2 | d3 | d4 |
|---|---|---|---|---|
| 1 grow | 0 (30/30) | 0 (30/30) | 0 (30/30) | 0 (30/30) |
| 2 expand | 30 (28/30) | 12 (29/30) | 12 (23/30) | 14 (14/30) |
| 3 renown | 33 (24/30) | 30 (28/30) | 30 (30/30) | 26 (29/30) |
| 4 stage | 99 (18/30) | 62 (15/30) | 41 (9/30) | 48 (9/30) |
| 5 assault | 155 (4/30) | 86 (5/30) | 45 (5/30) | 72 (1/30) |

#### How games end (all difficulties)

- campaign: The court's patience ends 107; You hold no prefecture 7; Your chieftain is captured and no sworn brother can lead 5; victory 1
- benevolent: The court's patience ends 110; You hold no prefecture 5; Your chieftain is captured and no sworn brother can lead 4; victory 1
- brotherhood: The court's patience ends 102; You hold no prefecture 12; Your chieftain is captured and no sworn brother can lead 6

Mean per game: 27.3 battles, 5.7 heroes at the end, 1.2 prefectures at the end, 2036.0 ms.

Invariant, stall (50,000 steps) and replay failures: 0.



## B2 reading (2026-11-07, defaults kept except the D20 rule value `conquestSupport` 15 to 5)
**Still 0 wins in 576 games; every target is missed.** D20 and D21 are in (T-3 loyal governor, W-27 support -5, W-32 waves, 12 checklist ids, tests), and the numbers move only a little: prefectures held at the end of a game 1.1 (B1: 0.9-1.0), mean Renown at the end of d2 19-83 (B1: 24-55; benevolent best at 83), conquest revolts fell from 11 of 21 lost prefectures to 3 of 9 in the 8-game sample. 0 invariant/stall/replay failures.

**Knob experiments after D20/D21** (12 games per policy on d2 unless noted, seeds 7000+; wins 0 in every row; Edict% = games reaching the run's Edict threshold):

| Setting | justice | benevolent | warlord | brotherhood | Edict median (best) |
|---|---|---|---|---|---|
| R1 Renown per hero/relief/hunt 3/3/4, Edict 500 | 0% | 0% | 0% | 0% | - |
| R2 Renown 5/5/6, Edict 500 | 0% | 17% | 0% | 8% | 99% of deadline |
| R3 R2 + upkeep x0.7, wages x0.7, tax x1.3 | 0% | 50% | 0% | 17% | 93% of deadline |
| K1 Renown 3/3/4, Edict 150, tax x1.5, wages/upkeep x0.6 | 33% | 75% | 0% | 83% | - |
| K2 Renown 3/3/4, Edict 100, tax x2.5, harvest x2, wages/upkeep x0.5, host 1000 + 8t | 50% | 100% | 42% | 100% | - |

**Measured cause (the same one, now sharper):** even in K2, where the Edict comes by month 28 and the player sits on 9,000 men and 100,000 gold, **0 of 6 games ever attacked the capital** (brotherhood, seed 7001). The policies reach 1-2 prefectures and 4-14 heroes: a force is capped by its heroes (W-5, command x 15 men a unit, 8 units), recruiting is slow (odds of 30-50% a month, heroes sit in other prefectures that must be conquered first), and the Edict is granted with the player two or three prefectures away from the capital. The rules (D20, D21) work as written; the blunt policies do not use them to snowball. Moving Renown or economy knobs can make the Edict reachable (R3: benevolent 50%, but at 93% of the deadline, not the targeted 50-75%) but cannot produce a win.

**Stop and propose (no design change made):** (a) a smarter stand-in, not another knob: a policy that spends idle gold on recruiting expeditions (move the household to conquered free-hero towns) and marches on the capital in stages; or the human bench of M3, which is what the targets are really about; (b) if the targets are to be reached by blunt policies, drop the 8-unit force cap for attacks on the capital to 12 (waves already add 8), or let the Edict also grant 2,000 free men; (c) give heroes joining by invitation a 60+ starting loyalty (so they govern at once) and the invite odds +10.

## BEFORE: B1 table (no D20/D21)

Run 2026-11-07: `npm run sim -- --games 4 --policy all --difficulty all --start all --seed 1000`. 576 games; seeds are `1000 + cell * 1000 + game` where cell counts policy x difficulty x start in the order printed (so every seed is reproducible: `createGame({ startHero, difficulty, seed })` and the policy). Policies are in `src/ai/policies.ts`; `greedy` is the A-rules decider.

#### Win rate by policy and difficulty

| Policy | d1 | d2 | d3 | d4 | Edict reached (d2) | Mean Renown (d2) |
|---|---|---|---|---|---|---|
| justice | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 41 |
| benevolent | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 55 |
| warlord | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 50 |
| brotherhood | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 51 |
| careless | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 22 |
| greedy | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 24 |

#### Edict timing (games with an Edict, per policy and difficulty): median month as % of the deadline (median `t`)

| Policy | d1 | d2 | d3 | d4 |
|---|---|---|---|---|
| justice | - | - | - | - |
| benevolent | - | - | - | - |
| warlord | - | - | - | - |
| brotherhood | - | - | - | - |
| careless | - | - | - | - |
| greedy | - | - | - | - |

#### Won games: Edict month (% of deadline, median) and Gao Qiu flights (mean)

| Policy | d1 | d2 | d3 | d4 |
|---|---|---|---|---|
| justice | - | - | - | - |
| benevolent | - | - | - | - |
| warlord | - | - | - | - |
| brotherhood | - | - | - | - |
| careless | - | - | - | - |
| greedy | - | - | - | - |

#### Win rate by start hero (difficulty 2)

| Policy | song-jiang | chao-gai | lin-chong | wu-song | lu-zhishen | hu-sanniang | spread (max - mean, points) |
|---|---|---|---|---|---|---|---|
| justice | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| benevolent | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| warlord | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| brotherhood | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| careless | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| greedy | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |

#### How games end (all difficulties)

- justice: The court's patience ends 79; You hold no prefecture 9; Your chieftain is captured and no sworn brother can lead 8
- benevolent: The court's patience ends 83; Your chieftain is captured and no sworn brother can lead 8; You hold no prefecture 5
- warlord: The court's patience ends 84; Your chieftain is captured and no sworn brother can lead 7; You hold no prefecture 5
- brotherhood: The court's patience ends 70; You hold no prefecture 17; Your chieftain is captured and no sworn brother can lead 9
- careless: Your chieftain is captured and no sworn brother can lead 81; You hold no prefecture 15
- greedy: You hold no prefecture 51; Your chieftain is captured and no sworn brother can lead 33; The court's patience ends 12

Mean per game: 22.4 battles, 4.2 heroes at the end, 0.9 prefectures at the end, 1652.8 ms.

Invariant, stall (50,000 steps) and replay failures: 0.



## B1 reading (B1 agent, 2026-11-07, no knob changed)
**Result: no policy wins a single game on any difficulty (0 of 576), and the Edict is never reached at the default numbers.** Every target of PLAN "TARGET:" is missed, by the widest possible margin (best sensible policy 0% against 80-95% on d1). Mean Renown at the end of d2 games is 24-55 against the 500 needed; games end with about one prefecture and 4 heroes. Invariants, stalls and replay: 0 failures in 576 games (a stall found in `careless` was a policy cycling between two states, fixed in the policy).

**Why (measured, not guessed):**
1. *Conquests are not held.* In 8 sample d1 games the player lost 21 prefectures: 11 by **revolt** (a conquered prefecture starts at support 35 after W-27's -15, has no command without a sworn brother (T-3), so bandits and hunger pull support under 15), 5 to the court, 4 to Old Liangshan and Zeng. A conquest force that carries a sworn brother (the policies now insist on it) did not change the picture: the mean number of prefectures at the end stayed near 1.
2. *Renown cannot reach 500 on one or two prefectures.* Relief +1 and hunt +2 are capped per prefecture per month and a hunted prefecture runs out of bandits; heroes joined are worth +1 or +2 each; so 500 needs a dozen prefectures with commanders for years (R-2's own sizing) or ~100 gathered heroes.
3. *The finale needs more army than 8 heroes can lead.* A unit leads at most `command x 15` men (W-5), so 8 heroes of command 60-80 field 7,000 men at most against the capital's 6,000 plus 6-8 hero units behind walls. With a 9,000-man start row, 20 Renown for the Edict and tripled tax and harvest (`chao-gai`, 8 games) the finale marched to a city beside the capital by month 50 and then never attacked successfully (0 of 8 wins).
4. *Early deaths were mostly the policy's own doing* (sending the whole garrison out; fixed: the policies keep 25% of the men and 2 heroes home, which also matches the bench: 700 men with walls and heroes held 23 of 30 against a 1,125-man imperial host, 1,500 held 29 of 30).

**Knob experiments** (d1, 4 sensible policies x 6 starts x 2 games = 12 games each, seeds 3000+; wins were 0 in every cell; "Edict" = games reaching the Edict threshold of that run). Not adopted: no setting gets any policy near a win.

| Setting | justice Edict | benevolent Edict | warlord Edict | brotherhood Edict | wins |
|---|---|---|---|---|---|
| A: Edict 200, Renown per hero/relief/hunt 3/3/4 | 8% | 42% | 0% | 25% | 0 / 48 |
| B: A + tax x2.5, harvest x2, wages x0.5, upkeep x0.6 | 8% | 83% | 0% | 67% | 0 / 48 |
| C: B + host 1000 + 8t, campaign interval 30 | 17% | 83% | 0% | 67% | 0 / 48 |
| D: B with the Edict at 500 | 0% | 42% | 0% | 17% | 0 / 48 |
| E: T-3 variant, any hero present gives 1 command (not committed) | - | - | - | - | 0 / 36 |

Reproduce: `npm run sim -- --games 2 --policy justice,benevolent,warlord,brotherhood --difficulty 1 --start all --seed 3000 --exp '{"tune":{...},"campaignK":{"1":30}}'` (knobs in `src/engine/tuning.ts`).

**Conclusion for stage 4:** the targets need a design change, not a nudge to the listed knobs, so tuning stopped and **the defaults were left as they are**. Proposed changes (the owner decides; none made): (a) let any hero of yours present in a prefecture give 1 command, and soften the conquest penalty (support -15 to -5 or an immunity period), so conquests can be held; (b) raise the Renown value of gathering heroes (about 3 each) and of justice conquests, or lower the Edict to about 250, so that Renown comes from the brotherhood theme instead of from farming; (c) let a force field more than 8 units or raise the 15-men-per-command cap, or lower the capital's 6,000 garrison, so that the finale is within reach of 20-30 heroes; (d) ask for a human bench (M3) before deciding, because these policies are blunt: a player gathering 30 heroes and 10 prefectures is not modelled.