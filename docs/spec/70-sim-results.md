# 70 - Sim results

Run 2026-11-07: `npm run sim -- --games 4 --policy all --difficulty all --start all --seed 1000`. 576 games; seeds are `1000 + cell * 1000 + game` where cell counts policy x difficulty x start in the order printed (so every seed is reproducible: `createGame({ startHero, difficulty, seed })` and the policy). Policies are in `src/ai/policies.ts`; `greedy` is the A-rules decider.

### Win rate by policy and difficulty

| Policy | d1 | d2 | d3 | d4 | Edict reached (d2) | Mean Renown (d2) |
|---|---|---|---|---|---|---|
| justice | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 41 |
| benevolent | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 55 |
| warlord | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 50 |
| brotherhood | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 51 |
| careless | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 22 |
| greedy | 0% (24) | 0% (24) | 0% (24) | 0% (24) | 0% | 24 |

### Edict timing (games with an Edict, per policy and difficulty): median month as % of the deadline (median `t`)

| Policy | d1 | d2 | d3 | d4 |
|---|---|---|---|---|
| justice | - | - | - | - |
| benevolent | - | - | - | - |
| warlord | - | - | - | - |
| brotherhood | - | - | - | - |
| careless | - | - | - | - |
| greedy | - | - | - | - |

### Won games: Edict month (% of deadline, median) and Gao Qiu flights (mean)

| Policy | d1 | d2 | d3 | d4 |
|---|---|---|---|---|
| justice | - | - | - | - |
| benevolent | - | - | - | - |
| warlord | - | - | - | - |
| brotherhood | - | - | - | - |
| careless | - | - | - | - |
| greedy | - | - | - | - |

### Win rate by start hero (difficulty 2)

| Policy | song-jiang | chao-gai | lin-chong | wu-song | lu-zhishen | hu-sanniang | spread (max - mean, points) |
|---|---|---|---|---|---|---|---|
| justice | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| benevolent | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| warlord | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| brotherhood | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| careless | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |
| greedy | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0% (4) | 0 / min 0 |

### How games end (all difficulties)

- justice: The court's patience ends 79; You hold no prefecture 9; Your chieftain is captured and no sworn brother can lead 8
- benevolent: The court's patience ends 83; Your chieftain is captured and no sworn brother can lead 8; You hold no prefecture 5
- warlord: The court's patience ends 84; Your chieftain is captured and no sworn brother can lead 7; You hold no prefecture 5
- brotherhood: The court's patience ends 70; You hold no prefecture 17; Your chieftain is captured and no sworn brother can lead 9
- careless: Your chieftain is captured and no sworn brother can lead 81; You hold no prefecture 15
- greedy: You hold no prefecture 51; Your chieftain is captured and no sworn brother can lead 33; The court's patience ends 12

Mean per game: 22.4 battles, 4.2 heroes at the end, 0.9 prefectures at the end, 1652.8 ms.

Invariant, stall (50,000 steps) and replay failures: 0.


## Reading the table (B1 agent, 2026-11-07, no knob changed)
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
