# 10 — Rules (v0.1, frozen at the start of M2)

This is an **original ruleset** for a game in the world of the public-domain novel *Water Margin*. People, places and nicknames come from the novel; every system, formula, number and line of text here is ours (PLAN D12). Numbers are first-pass balance values: change them only with a sim or bench result, edit this file first, log it in `PLAN.md` "Rulings / balance log", then the code. Tests are named by rule id (`tests/unit/<area>.test.ts`, test title starts with the id).

Each rule has an id such as `T-3`; `(C4)` after a rule means it answers complaint C4 in `docs/research/original-complaints.md`. Data comes from `data/` (frozen contract in `docs/briefs/overnight-2026-11-07.md`, schema in `20-data-schema.md`).

## 0. Conventions
- **Z-1** All state numbers are integers. `pct(x, m) = floor(x * m / 100)`. A chain of percentages applies one factor at a time, flooring after each, in the order written. Anything shown as a percentage in the UI is an integer 0-100.
- **Z-2** `roll(n)` is an integer in `0..n-1` from the state's sfc32 stream (`00-architecture.md`). A "variance roll" is `roll(21) - 10` percent added to 100. Draw order is part of the contract: where a rule lists several draws, they happen in the order listed.
- **Z-3** Names: hex positions are axial coordinates `(q, r)`; "prefecture" is a node of the map graph; "link" is an edge. A *faction* is `player`, `court`, a rival id from `data/rivals.json`, a camp id from `data/camps.json` (K), or `free` (independent, passive).
- **Z-4** Open information (C5, C9): the player may always see every number the rules use for their own side, every threshold and its trend, every probability before choosing. The only hidden things are the numbers of foreign prefectures that have not been spied on (Z-5) and hidden units in battle (W-24).
- **Z-5** Foreign prefectures: without a `spy` report from the last 3 months, the view shows population, gold, food, men and arms rounded to the nearest 10% band ("about 1,500"), and no hero loyalties. Own prefectures are always exact.

## 1. Setup and difficulty (S)
- **S-1** A new game picks one **starting hero** and a difficulty. The hero becomes the **chieftain**; their prefecture becomes the player's. The six choices are in the table; each has a different pressure and a different strength. Only one start is chosen per game, so two starts may share a prefecture (Song Jiang and Chao Gai are both at `yunzhou`). Chao Gai is not one of the 108 stars: his record is in `data/heroes-extra.json` (`star: null`, PLAN D17). Prefecture ids are from `data/map.json`. A starting hero is never lent hidden stat bonuses (C3).

| Hero | Prefecture | Gold | Food | Men | Arms | Training | Support | Renown | Situation (shown on the pick screen) |
|---|---|---|---|---|---|---|---|---|---|
| Song Jiang | `yunzhou` | 1500 | 2500 | 600 | 300 | 30 | 70 | 30 | Trusted clerk: the people love him, Wu Yong and Liu Tang follow him from day one, but he has almost no arms. |
| Chao Gai | `yunzhou` | 2000 | 2500 | 700 | 500 | 45 | 60 | 20 | Wealthy headman of Dongxi Village and chief of the Seven Stars band: Wu Yong and Liu Tang are at his table from day one, the Ruan brothers fish the marsh across the water at Jizhou and Gongsun Sheng is far north; Song Jiang the clerk is a free man in the same city. A purse, a fair army and a name that is not yet famous. |
| Lin Chong | `mengzhou` | 800 | 1200 | 900 | 700 | 70 | 35 | 10 | Disgraced arms instructor: drilled troops, poor support, the capital one road away. |
| Wu Song | `cangzhou` | 600 | 1000 | 400 | 400 | 50 | 60 | 45 | Famous tiger-slayer: renown from the start, thin purse; a scripted tiger is abroad on month 1 (V-6). |
| Lu Zhishen | `weizhou` | 300 | 1800 | 700 | 600 | 60 | 50 | 15 | Fugitive officer on a far western seat with only two links (one a mountain pass): food and men, no money. |
| Hu Sanniang | `zhujiazhuang` | 2500 | 3000 | 800 | 800 | 55 | 60 | 15 | Rich estate and the best horsemen; the Zhu clan, now leaderless, waits free in the same prefecture for an invitation (S-8). |

- **S-2** Each start prefecture keeps its map `base` population, land and dykes. The start screen lists the numbers above, the neighbouring factions, and the first three advisor hints (S-6).
- **S-3** **Difficulty** (1 Easy, 2 Normal, 3 Hard, 4 Brutal) changes exactly two things, both printed on the start screen (C2, C3):

| Difficulty | Deadline (months from Jan 1101) | Last month | AI attack ratio `k` (A-6) | Court campaign interval `K` (G-6) |
|---|---|---|---|---|
| 1 | 180 | Dec 1115 | 1.6 | 14 |
| 2 | 144 | Dec 1112 | 1.3 | 10 |
| 3 | 108 | Dec 1109 | 1.1 | 7 |
| 4 | 84 | Dec 1107 | 0.9 | 5 |

- **S-4** No difficulty changes any price, yield, chance, loyalty, odds or AI information. Tests compare the same action on difficulty 1 and 4 and expect identical results (C3).
- **S-5** The **Edict by date** is the deadline's last month minus 17 (so 18 months remain to take the capital). It is shown wherever the deadline is shown (R-8).
- **S-6** **Advisor.** `query.advice(state)` returns at most 3 ranked hints, each with the rule id it teaches and the one command that follows it (e.g. "Food lasts 1.4 months: trade gold for food or relieve nobody this month (E-9)"). In months 1-3 the three first hints are pinned open. Hints use only numbers the player can see (C5).
- **S-9** **Followers.** At the start the two lowest-rank heroes (the 108 first, then non-star heroes of `data/heroes-extra.json`) whose data status is `free` and who begin in the start prefecture (not displaced ones, S-8) join at once as ordinary heroes with loyalty 60 (fewer if fewer exist; `11-scenario.md` lists them). The rest of the heroes there are free to invite (Q-2).
- **S-7** A game begins with a briefing screen that states the goal (earn the Edict, take the capital, capture Gao Qiu), the deadline, and the six systems to watch (food, support, loyalty, Renown trend, forecast, court campaign) (C5, C13).
- **S-8** **Displacement.** The start prefecture becomes the player's. Its previous owner (court or rival) loses it, and that owner's heroes there become `free` heroes in it, invitable by anyone (Q-2); the rival (if any) is removed from the game if it has no other prefecture. A displaced court governor's office stays vacant. `11-scenario.md` lists the effect for each start.

## 2. The turn (T)
- **T-1** One strategic turn is one month. Turn index `t = 0` is January 1101. `monthOf(t) = t mod 12 + 1`, `yearOf(t) = 1101 + floor(t / 12)`. The game ends in defeat when `t` reaches the deadline (X-4).
- **T-2** **Order of play inside a month:** (1) *Dawn*: forecast and warnings are computed (T-7, E-9, H-14). (2) *Player commands* (T-3), in any order, until the player ends the phase. (3) *Rivals* act in id order, then the *court* (A-1..A-7); an attack on the player pauses for the player's battle (W). (4) *Month end* resolution, steps in T-8 order. (5) `t += 1`, autosave.
- **T-3** **Commands.** A prefecture the player owns gives **commands** only while a *commanding hero* is present: the chieftain's prefecture gives **2** commands per month; a prefecture holding a sworn brother (B-2) gives **1**; a prefecture holding only ordinary heroes or none runs on **standing orders** (T-4) and gives **0**. Each command is one entry of E-12 and names an **actor** (a hero present). A brother who arrives by `move` adds 1 command to the destination at once.
- **T-4** **Standing orders** (no command): upkeep and income still happen (T-8); each skilled hero present applies its *standing* effect from the table in H-7; a prefecture with no hero present loses 2 support per month.
- **T-5** **Seasons.** Spring = Mar-May, Summer = Jun-Aug, Autumn = Sep-Nov, Winter = Dec-Feb. Effects: March is *planting* (seed grain is due, E-7); June-August are *rains* (dykes decay 3 per month, floods and droughts are rolled, V-1, V-2); October is the *harvest* (E-6); December-February is *winter* (men cost 1.5x food, E-5; northern snow, T-6).
- **T-6** **Northern snow** (C9). The *north* is every prefecture with `pos.y <= 0.30`. In December, January and February every `mountain-pass` link that has a northern end is **snowed in**: nothing may move, attack or send across it, and spies cannot use it. A *snowstorm* event (V-5) additionally blocks every link touching the stricken prefecture for one month. The map marks snowed-in links in a distinct style.
- **T-7** **Forecast** (C9). The view always carries `forecast` for the next month: its season, the list of snowed-in links, and every *scheduled event* (V-0) with prefecture, event and stated effect. A sorcerer in the player's service extends the list to two months ahead (H-7). Nothing foreseeable by rule is hidden.
- **T-8** **Month-end resolution**, for every prefecture in `data/map.json` order, each step finishing for all prefectures before the next starts: (1) tax gold (E-4); (2) harvest in October (E-6); (3) upkeep and wages (E-5), starvation (E-8); (4) scheduled events fire (V-0); (5) growth: population, land, dykes, bandits (E-10); (6) support drift (E-11); (7) loyalty drift, warnings, desertion and revolt (H-12..H-16); (8) roll events for next month (V-0); (9) court muster and rival growth (G-3); (10) Renown history, Edict check, deadline check (R-6..R-9). Then `t += 1`.
- **T-9** **One battle per prefecture per month.** A prefecture that fought a battle this month cannot be attacked again until the next month. A prefecture can launch at most one `attack` per command.
- **T-10** The player may **undo nothing**: a command is final. To protect against misclicks every command shows a preview (cost, result range, odds) from `query.preview(state, command)` and needs a confirm.

## 3. Prefecture economy (E)
- **E-1** A prefecture has: `owner`, `pop` (population), `gold`, `food`, `men` (levied, trained soldiers), `arms` (weapons stock), `training` 0-100, `support` 0-100 (the people's support), `land` 0-100 (cultivated share), `dyke` 0-100 (flood defence; initial value is the map's `base.flood`), `bandits` (men in the hills), and the lists `heroes`, `captives`. Units: gold in strings of cash, food in stones.
- **E-2** Limits: `men <= floor(pop / 20)`. `arms` has no limit but `armedRatio = min(100, floor(100 * arms / men))` (100 when `men = 0`). Gold and food are never negative (E-5 clamps them).
- **E-3** Initial values: the player's start prefecture takes the S-1 row; other prefectures: `gold = floor(pop / 100)`, `food = floor(pop / 40)`, `men = floor(pop / 150)` (court seats: `/ 90`), `arms = men`, `training = 40` (court 60), `support = 50` (court-held prefectures: `70 - floor(graft / 2)`), `bandits = 40 + floor((100 - support) / 2)`.
- **E-4** **Tax** each month: `tax = floor(floor(pop / 1000) * land * (50 + support) / 5000)`, e.g. pop 180,000, land 60, support 50 gives 216. A scribe present adds 10% (standing).
- **E-5** **Upkeep** each month: food `ceil(men / 10)`, times 3/2 (rounded up) in winter; gold wages `ceil(men / 20) + 5 * (ordinary heroes present)`. Sworn brothers and the chieftain cost nothing. If gold is short: gold becomes 0, every non-sworn hero present loses 8 loyalty, and `floor(men / 20)` men desert.
- **E-6** **Harvest** in October: `food += floor(floor(pop / 1000) * land * (50 + support) / 450)`. A drought (V-2) cuts it by 40%, locusts (V-3) by 30%, flood damage is in V-1. No harvest in other months.
- **E-7** **Planting** in March: seed grain `floor(floor(pop / 1000) * land / 50)` food is paid before anything else. If paid and `support >= 40`, `land += 2` (max 100). If not paid, `land -= 10` and the event "fields left fallow" is logged (C9).
- **E-8** **Starvation.** If food after upkeep would be negative, food becomes 0 and `shortfall` food-units were unpaid: `lost = min(men, shortfall * 10)` men desert, support falls by 5, pop by 1%, and every ordinary hero present loses 5 loyalty. The log line states each number.
- **E-9** **Food warning** (C9). `query.runway(prefectureId)` returns months of food left at the next month's upkeep including its season factor and any scheduled event. At dawn, a runway under 2.0 raises an amber warning "Food for 1.4 months"; under 1.0 a red warning that says how many men will desert next month. The same hint appears in the advisor (S-6).
- **E-10** **Growth** each month: `pop += floor(pop * g / 1000)` with `g = 2` in Mar-Aug, `1` in Sep-Feb, `0` when `support < 30`. `dyke -= 1` (3 in Jun-Aug), minimum 0. `bandits += 10` if `support < 50`; `bandits -= 5` (min 0) if `support >= 70`.
- **E-11** **Support drift** each month: `-2` if E-8 fired this month; `-1` if `bandits >= 150`; `+1` if no disaster fired, runway `>= 3` and `bandits < 50`; `+1` if a hero with `compassion >= 8` is present. Result clamped 0-100.
- **E-12** **The commands** (the same list for the AI, C3). Each shows its cost and result range before it is confirmed (T-10):

| Command | Actor effect and rule |
|---|---|
| `levy` | `N = floor(floor(pop / 200) * (40 + support) / 100)`, then `N = floor(N * (100 + floor(command / 5)) / 100)`, spearman actor x1.10. Cost 1 gold per man; `pop -= N`, `men += N` (capped so that E-2 still holds after the loss: `N <= floor((pop - 20 * men) / 21)`), support -3. Under support 30 Renown -1 (R-3). |
| `train` | `training += 8 + floor(command / 10)`, drillmaster actor +5, max 100. Cost `ceil(men / 20)` gold. |
| `forge` | `arms += 400` (smith actor or present: 600). Cost 1 gold per arm made. |
| `trade` | Convert up to 1,000 of one resource at the season's price (E-13); actor `cunning` adds `floor(cunning / 10)`%, horse-trader +20%. |
| `dykes` | `dyke += 15` (builder actor: +25), max 100. Cost 200 gold and 100 food. |
| `relieve` | Give 300 food: support +8, +2 more if the actor has `compassion >= 7`, +2 with a physician or monk present. Renown +1 once per prefecture per month (R-3). |
| `hunt` | Hunt bandits (E-14). |
| `move` | Move chosen heroes and men (arms move with the men) along one link to a prefecture you own (E-15). |
| `send` | Send gold, food or arms to a linked prefecture you own; arrives the same month. A runner actor reaches any owned prefecture within 3 links. |
| `spy` | Spy on a prefecture (E-16). Cost 100 gold. |
| `recruit` | Invite a free hero or persuade a captive (Q). Cost 100 gold gift (invite). |
| `swear` | Offer the oath to a hero present (B-1). Cost 200 gold banquet. |
| `rest` | Feast: every non-sworn hero present +6 loyalty, support +2. Cost 100 gold (innkeeper actor: 50). |
| `attack` | March on a prefecture you do not own (W-1). |

- **E-13** **Trade prices** (gold per 10 food, buying; selling pays 70%): autumn 3, winter 5, spring 6, summer 5. Buying 1,000 food in spring costs 600 gold.
- **E-14** **Hunt bandits.** The party is the actor plus up to 3 other heroes and up to 500 men (not consumed). `power = might(actor) + 20 * others + floor(men / 50)`. `P = clamp(10, 95, 50 + floor((power - floor(bandits / 5)) / 2))`, shown before confirming. One `roll(100) < P`: success sets `bandits = floor(bandits * 3 / 10)`, gold `+= floor(bandits_before / 2)`, support +2, Renown +2 once per prefecture per month (R-3). Failure: `floor(men / 10)` of the sent men are lost. Swordsman actor: power +10.
- **E-15** **Move.** Any number of heroes (at least one) and men. Travel is 1 link; a horseman in the party may go 2 links along `road` links; a marine may go 2 links along `river`/`marsh-water` links; a link across `marsh-water` needs a marine or swimmer in the party. Snowed-in links (T-6) are blocked. Men moved cost 1 food per 20 men from the origin. Heroes who arrive are not exhausted: a moved hero can still be the actor of any command in the destination (the destination's commands then come only from brothers present, T-3).
- **E-16** **Spy.** Target: any prefecture within 2 links (3 for a scout actor, any for a runner) not behind a snowed-in link. `P = clamp(10, 90, 40 + floor((cunning(actor) - cunning(best defender hero)) / 2) + 10 * matching skills)` shown first. Operations: `report` (any actor; exact numbers and loyalties for 3 months), `steal` (thief; take `min(500, floor(gold / 20))` gold), `discord` (strategist; one enemy hero -10 loyalty), `expose` (scribe; court only: the governor's graft -20 and Renown +6 once per official, R-3), `burn` (firebrand; target food -20%), `forged-order` (forger; target men -10%, once per season per prefecture), `jailbreak` (thief or forger; free one captive, Q-3). On failure the gold is lost; if `roll(100) >= 85` the actor is captured by the target owner.
- **E-17** **Free prefectures** (owner `free`) grow like any other, keep a garrison of generic captains (W-4) and defend themselves; they never attack.

## 4. Heroes and abilities (H)
- **H-1** A hero has four **abilities** (1-100) and three **virtues** (1-10, fixed for life) from `data/`, and 0-3 **skills**. A hero is at a place, belongs to a faction or is free, and has a status: `chieftain`, `sworn`, `ordinary`, `free`, `captive`.
- **H-2** **Might**: damage of the hero's unit (W-9), duel strength (W-17), hunt power (E-14), capture odds (W-19). **Command**: men the hero can lead (W-5), levy and train yield, the unit's defence (W-9). **Cunning**: spy, trade, recruit and persuade odds, seeing ambushes. **Vigour**: fatigue gain and recovery (W-12), duel exchanges.
- **H-3** **Virtues** are `righteousness`, `compassion`, `daring`. They never change. They set brotherhood compatibility (B-3) and appear in the specific rules: compassion in `relieve` and support (E-11, E-12); righteousness in the deed table (H-13); daring in duel acceptance (W-17).
- **H-4** A hero leads at most one unit. Heroes of the player's faction in a prefecture are listed with ability bars, virtue pips, skill icons and loyalty. Every ability and skill is shown with the option it opens (H-6, H-7), so the player can read what a hero is for (C6).
- **H-5** **Gating by ability** (C6): the following require a minimum and the UI greys the option with the number needed.

| Option | Requirement on the actor or hero |
|---|---|
| Lead a unit larger than 500 men | `command >= 34` (cap is 15 per command point, W-5) |
| Challenge to a duel | `might >= 50` |
| Stake "capture" in a duel | `might >= 70` |
| `expose`, `jailbreak` | `cunning >= 60` |
| Hunt a man-eating tiger (V-6) | `might >= 75` or skill `beast-slayer` |
| Chieftain's successor (X-3) | sworn brother |

- **H-6** **Combat kind** follows skills: `horseman` gives cavalry; else `archer` gives archers; else `marine` gives boats; otherwise (spearman, swordsman, or no combat skill) infantry. Kinds are defined in W-6.
- **H-7** **Skills.** Each of the 22 skills opens or improves a visible option. "Standing" means it works while the hero is present and no command is spent (T-4).

| Skill | Strategic option opened or improved | Battle option |
|---|---|---|
| spearman | Levy yield x1.10 as actor | Brace: a charge into this unit gives the charger only x125 and the unit counters at x100 (W-10) |
| swordsman | Hunt power +10 | +10 might in duels |
| archer | Beast hunt odds +10 (V-6) | Archers kind, volley range 2-3 |
| horseman | 2-link road moves (E-15) | Cavalry kind, charge |
| marine | Crosses `marsh-water` links; 2-link river moves | Boats: moves on water and marsh at cost 1, x110 attacking from water/marsh/reed, x90 on dry land |
| swimmer | Spies and moves across `river`/`marsh-water` links | Enters deep water on foot at cost 3; scuttle (W-13) |
| scout | Spy range 3; shows incoming enemy marches a month ahead (A-8) | Sees hidden units within 4 hexes |
| thief | `steal`, `jailbreak` | May hide in forest, reed, hill or village hexes (W-24) |
| strategist | `discord` | Counsel: +10 on one ally's next attack action each day |
| scribe | Tax +10% (standing); `expose` | none |
| physician | Plague losses halved (V-4, standing); `relieve` +2 support | Heal: one adjacent ally regains 5% of its deployed men per day |
| smith | `forge` yields 600 (standing: any forge command in the prefecture) | Unit armed ratio at least 80 |
| builder | `dykes` +25; floods foreseen (V-1) | In a walled seat, the defending unit takes x90 damage |
| horse-trader | `trade` +20%; invite odds +10 to a `horseman` target (Q-2) | none |
| innkeeper | Invite odds +10 for any target; `rest` costs 50 | none |
| monk | `relieve` +2 support; invite odds +10 to a monk target | Rally: at dusk adjacent allies +5 morale |
| sorcerer | Forecast two months ahead (T-7) | Weather once per battle (W-14) |
| drillmaster | `train` +5 | Adjacent allies fight with training +10 (max 100) |
| firebrand | `burn` | Fire (W-13) |
| forger | `forged-order` spy operation; invite odds +10 to an `official` target | none |
| runner | `send` reaches 3 links; spy range any | +1 move; hero's capture odds -20 (W-19) |
| beast-slayer | Beast hunts +30 (V-6); counts as qualified for tigers | none |

- **H-8** Hero **ranks** `star.rank` order heroes for ties (lowest first). Heavenly (1-36) and earthly (37-108) groups matter for Renown (R-2) and endings (X-2).

## 5. Loyalty, brotherhood, desertion (H, B)
- **H-9** Every non-chieftain hero of the player has **loyalty** 0-100. Sworn brothers have no loyalty meter: they never desert (B-5).
- **H-10** **Joining loyalty**: invited `40 + floor(compat / 4)`; persuaded `50 + floor(compat / 4)`; rescued 80; conquered garrison heroes who choose to serve `40 + floor(compat / 4)`.
- **H-11** `compat(chieftain, hero)` is B-3. A hero's loyalty has a **resting level** `L* = 40 + floor(compat / 2)` (40..90), +5 if their prefecture's support is 70 or more, -5 if under 30.
- **H-12** Each month-end loyalty moves 2 points towards `L*`. Other changes apply immediately: feast (`rest`) +6; won battle fought +3; lost battle fought -5; unpaid wages -8 (E-5); starvation -5 (E-8); deeds (H-13).
- **H-13** **Deeds** (C5): a deed that offends a hero's virtue costs that hero loyalty once. The deed table: *levy while support is under 30*: heroes with `compassion >= 7` -4; *burning a village hex in battle*: `compassion >= 7` -4; *execution of a captive* (Q-4): `righteousness >= 7` -6; *releasing a captive* : `righteousness >= 7` +3 and Renown +2; *declining a duel* (W-17): `daring >= 8` -3.
- **H-14** **Warnings** (C9). At dawn a hero with loyalty under 40 shows "restless"; at 25 or less they show "wavering: will leave next month unless loyalty rises", with the chance to fix: feast, deed, battle, or the oath (B-2). The same count appears in the advisor.
- **H-15** **Desertion.** At month-end, a hero that was *wavering* at the previous month-end and still has loyalty 25 or less **leaves**: they become a `free` hero in the prefecture they were in, with their invite cooldown reset, and the event line names the hero, the prefecture, the reason and the loyalty. Renown -2 (R-3).
- **H-16** **Revolt.** A prefecture with support 20 or less at month-end gains the *unrest* flag and a red warning ("will revolt next month"). If at the next month-end support is still 15 or less, it **revolts**: it becomes `free`, men halve, gold and food halve, every hero present is set free at that prefecture (sworn brothers included), Renown -5. If support is above 15 the flag clears. The player is shown the exact threshold and what raises support (E-11, E-12).
- **H-17** A hero that is *freed* (desertion, revolt, escape from captivity) is placed in a named prefecture and is recruitable by anyone (Q-2).

**Brotherhood (B)**
- **B-1** `swear` offers the **oath of brotherhood** to one hero present. The requirement is shown as a meter with its threshold and the missing amount (C5): loyalty at least 80 **and** `compat >= 55` (virtue distance 7 or less). The chieftain is the host. Cost 200 gold.
- **B-2** On success the hero becomes **sworn**: loyalty is no longer used; the hero can be a commanding hero (T-3), can be named an **acting governor** and can succeed the chieftain (X-3). Renown +1. Failure is impossible once the requirement is shown as met; a hero that does not meet it simply cannot be offered the oath (the button is greyed with the number needed).
- **B-3** **Compatibility.** `d = |ΔR| + |ΔC| + |ΔD|` over the three virtues, `compat = max(0, 100 - 6 * d)`. `d = 0` gives 100, `d = 7` gives 58, `d = 10` gives 40. Shown to the player as "Match 58%" with the three virtue pips side by side.
- **B-4** The oath cannot be offered to a hero who is captive, wavering (H-14) or in a prefecture the chieftain is not in; the chieftain must travel or the hero must be moved.
- **B-5** Sworn brothers do not desert and do not revolt. They are lost only by capture (Q-4) or the chieftain's defeat (X-3). Captured brothers can be rescued like any captive (Q-3).
- **B-6** A sworn brother may be set as **governor** of a prefecture; that prefecture gets 1 command per month (T-3) and the brother is the actor by default. There is no limit other than the heroes available.
- **B-7** Brotherhood is a visible source of Renown: see R-2 (sworn +1, heavenly +1 more).

## 6. Recruitment (Q)
- **Q-1** Heroes in the world are in one of four states: *free* (wandering in a named prefecture), *serving* (official, outlaw or in a faction), *captive* (held by a faction), *dormant* (joins late, Q-5).
- **Q-2** **Invite** (`recruit`, free hero present in the actor's prefecture). Odds shown first (C5):
  `P = clamp(5, 95, 20 + min(30, floor(renown / 10)) + floor(compat / 3) + floor((cunning(actor) - 50) / 5) + floor((support - 50) / 5) + skills + modifiers)`.
  *Skills:* innkeeper +10, horse-trader +10 vs a `horseman`, monk +10 vs a `monk`, forger +10 vs an `official`. *Modifiers:* target status `official` -30, but +30 instead if the prefecture's governor has `graft >= 60` (G-2); target "released with honour" +20. One `roll(100) < P`. On success the hero joins with loyalty H-10 and Renown R-2. On failure the hero stays and cannot be invited again from this prefecture for 1 month. `query.recruitOdds(state, actor, target)` returns the percentage and every term.
- **Q-3** **Rescue captives.** Captives sit in the prison of the prefecture that holds them. (a) **Conquest**: taking the prefecture frees every captive of yours and offers every captive of the enemy (Q-4). (b) **Jailbreak** (`spy` operation, E-16): success frees one captive, who joins with loyalty 80 and Renown +1 for a famous rescue (a hero of rank 1-36).
- **Q-4** **Defeat and persuade.** After a won battle, each captured hero is a *pending decision* (Arch §pending), in rank order: **persuade** (once per captive per month, odds `P = clamp(5, 95, 25 + floor(compat / 2) + floor((cunning(actor) - 50) / 4) + 15 if the captive's former governor had graft >= 60)`, shown first; on success they join with loyalty H-10, on failure they stay captive), **release** (hero becomes free in the prefecture, invite bonus +20, Renown +2), **hold**, or **execute** (Renown -3; only offered for court officers). Holding costs nothing; a held captive can be persuaded by a `recruit` command later.
- **Q-5** **Story triggers** for `joinsLate` heroes (23 in the data). A `joinsLate` hero stays *dormant* (not on the map, not recruitable by anyone) until their trigger fires. Triggers are a closed set of kinds: `renown {min}`, `own {prefecture}`, `battle-won-at {prefecture}`, `attacked {prefecture}`, `defeated-hero {hero}` (the player captured, routed or recruited that hero), `brother {hero}` (that hero serves the player), `campaign-announced` (the first G-6 campaign). The authoritative hero-to-trigger table is `11-scenario.md` section 5; M2 stores it as `data/triggers.json`. A `joinsLate` hero missing from the table falls back to `renown >= 100 + 2 * star.rank`. On firing, the hero appears in `start.prefecture` with their `start.status` semantics (Q-6) and a log line says why (C9). The data's free-text `joinTrigger` is shown as flavour in the hero card. The targets of `defeated-hero` and `brother` may be any hero id, including the non-star heroes of `data/heroes-extra.json` (e.g. `brother chao-gai`); the validator checks them against the 108 and the extras.
- **Q-6** **Start status** from `data/heroes.json` at the beginning of a game: `free`: a free hero in `start.prefecture`; `official`: serving the court at that prefecture if the court holds it, else free; `outlaw`: member of the rival or free stronghold there; `captive-of-court`: held in the prison of that prefecture if the court holds it, else free. A hero whose `start.year` is later than the current year is dormant until January of that year.
- **Q-7** Rival and court AI recruit free heroes with the same odds (A-4), so waiting costs you heroes.
- **Q-8** **Defeated prefecture's heroes**: every hero not captured and not fled when a prefecture is conquered is offered to the victor to *serve* (loyalty H-10) or is released free there.

## 7. Renown and the Edict (R)
- **R-1** **Renown** is a non-negative integer starting from the S-1 row. It is the single measure of the Emperor's attention. The player can open a ledger that lists every gain and loss of the last 24 months with its rule id (C1).
- **R-2** **Gains** (C1):

| Source | Renown |
|---|---|
| Justice: conquering a court prefecture whose governor has `graft >= 40` | `4 + floor(graft / 10)` (max 14) |
| Justice: `expose` an official (E-16) | +6 once per official |
| Relief: `relieve` command | +1 per prefecture per month; +3 if the prefecture had an active famine, flood or plague event this month |
| Beasts and bandits: `hunt` success (E-14) | +2 per prefecture per month |
| Beasts: man-eating tiger slain (V-6) | +4 |
| Battle won | +1; +3 if the enemy had more men; +8 if the enemy was an imperial army (G-6) |
| Heroes gathered | +1 per hero joined (heavenly group +2); sworn brother +1 more |
| Liberation: conquering a prefecture with support under 40 owned by the court | +2 |
| Duel won against a hero of rank 1-36 | +1 |

- **R-3** **Losses:** battle lost -3; prefecture lost -5; hero deserts -2; revolt -5; `levy` while support under 30 -1; executing a captive -3; each village hex burned in battle -1; withdrawing from a battle -1. **Per-prefecture per-month caps** are stated in the table (relief +1, hunt +2) so a single prefecture cannot be farmed.
- **R-4** The ledger groups sources into five visible columns (justice, relief, beasts and bandits, battles, heroes) so the player can see which source is lagging (C1).
- **R-5** **Edict threshold:** `EDICT = 500`, for every difficulty (S-4).
- **R-6** `renownHistory[t]` stores Renown at each month-end. **Trend** `= (renown_now - renown_{6 months ago}) / 6` using the available months when fewer than 6 (minimum 1 month), shown with one decimal.
- **R-7** **Projected Edict date** `= t_next + ceil((500 - renown) / trend)` months, where `t_next` is the new current month, when trend is positive; it is shown as a month and year, as "after the deadline" when it falls beyond the last month, and as "never at this pace" when the trend is zero or negative. It is on the main screen at all times, beside the deadline (C1, C2).
- **R-8** **Run-rate warning** (C2). Let `edictBy` be S-5. Status is **green** if the projection is at least 6 months before `edictBy`; **amber** if on or before `edictBy`; **red** if later or "never". Beside the status, the screen states the **required rate** `(500 - renown) / (edictBy - t_next)` (months counted from the new current month) in Renown per month and the current rate. A one-time toast fires when status worsens.
- **R-9** **The Edict.** At month-end, when `renown >= 500` for the first time, the Emperor's **Edict** is granted: the event is logged with the date; `dongjing` becomes attackable (G-5); the court mustering rule changes (G-4: the capital is garrisoned up to `men >= 6000`). The Edict stays even if Renown later falls.
- **R-10** Warning thresholds for the deadline: at 24, 12, 6, 3 and 1 months before the last month a banner states months left and the Edict status (C2).

## 8. The court (G)
- **G-1** The **court** holds `dongjing` (the capital) and the court-held prefectures from the scenario (`11-scenario.md`). Court officials from `data/court.json` govern them. Gao Qiu governs the capital and is the final target.
- **G-2** **Graft** (0-100) of an official: `clamp(10, 95, 95 - 9 * righteousness - 2 * compassion)`. It is shown for every court governor. High graft: invitation to the governor's `official` heroes works (Q-2), `expose` pays (R-2), and conquest gives Renown (R-2). Support in a court prefecture starts at `70 - floor(graft / 2)` (E-3).
- **G-3** **Muster.** Each month-end every court prefecture adds `floor(pop / 2000)` men and the same arms, up to `floor(pop / 30)` men.
- **G-4** **Imperial host.** The court's host size is `host(t) = min(9000, 2000 + 25 * t)` men (so 2,000 in Jan 1101, 4,100 after 7 years). The capital holds at least `min(host(t), men)`; after the Edict the capital is garrisoned to `men >= 6000` over the next 3 months.
- **G-5** **Protected capital.** `attack` on `dongjing` is illegal before the Edict (R-9); `legalActions` omits it and the map labels the capital "protected until the Edict" (C1). After the Edict nothing protects it. Court prefectures other than the capital may be attacked at any time.
- **G-6** **Imperial campaigns.** Every `K - alert` months (`K` from S-3, `alert = floor(renown / 100)`, minimum 3), the court announces a campaign at month-end: **target** = the faction (other than court) with the highest `power = men + 500 * heroes + 300 * prefectures`, ties to the player; its **objective** = the weakest (lowest `men`) prefecture of that faction linked to a court-held prefecture. The announcement ("The court musters at X to march on Y next month") is shown for a full month before it marches (C9). It marches at the following month-end with `host(t) / 2` men from the staging prefecture, led by a general from `data/court.json` plus up to 3 deputies, and fights by W as the attacker. Campaigns the player defeats give Renown +8 (R-2).
- **G-7** **Court generals.** Every court hero not governing a prefecture is *in reserve* at the capital. They lead campaigns (G-6) and the capital's defence. If a general is captured, the court may ransom nothing; the hero follows Q-4.
- **G-8** **Chase.** After the Edict, when Gao Qiu's unit loses (W-26), he retreats along strategic links (X-1). The map shows his refuge links in two states: **open** (far end not owned by the player) and **cut** (far end owned by the player). If every link is cut, he is captured (C4).

## 9. Events (V)
- **V-0** An **event** has `id`, `scope` (prefecture or whole map), `season window`, `chance`, `lead` (0 or 1 month), `effect`, `mitigation`. Events with `lead = 1` are *foreseeable*: step 8 of T-8 rolls them for next month in `data/map.json` order, then in event-table order, one `roll(100) < chance` per event per prefecture; hits are stored in `state.scheduled` with their stated effect, shown in the forecast (T-7), and fire at step 4 of the next month-end. Events with `lead = 0` are *sudden*: rolled in step 8 and fire at once, announcing their effect in the same message (C9).
- **V-1** **Flood** (`lead 1`, Jun-Aug; prefectures with terrain `river-delta`, `marsh`, `plains`, `coast`): chance `max(0, (70 - dyke)) / 5`% per month, rounded down (dyke 40 = 6%). Effect: if `dyke < 50`: land -15, pop -3%, food -25%; else land -5. A builder present shows the chance and effect a month ahead as usual; builder also halves damage. Mitigation: `dykes` (E-12).
- **V-2** **Drought** (`lead 1`, Jun-Aug, all prefectures, 4%): the next harvest is cut by 40% (E-6). Mitigation: `trade` for food, `relieve`.
- **V-3** **Locusts** (`lead 1`, Aug-Sep, plains/hills, 3%): food -30% at fire time.
- **V-4** **Plague** (`lead 0`, any month; pop at least 100,000; chance 2%, 30% in a prefecture linked to a plague prefecture of the previous month): pop -5%, men -10%, support -3. A physician present halves the losses.
- **V-5** **Snowstorm** (`lead 1`, Dec-Feb, northern prefectures, 20%): blocks every link touching the prefecture for one month and costs food +25% upkeep there.
- **V-6** **Man-eating tiger** (`lead 0`, hills or mountains, any month, 3%). Effect when it fires: until slain, each month-end pop -200 and support -2; after 6 months it leaves. It opens a *pending decision* for the player: send one hero present, or ignore. Odds shown: `P = clamp(10, 95, 30 + floor(might / 2) + 30 if beast-slayer + 10 if archer)`. Success: Renown +4, support +5, the hero gains +3 loyalty. Failure: the hero is wounded and cannot be an actor for 2 months. Heroes under H-5 requirements only.
- **V-7** **Imperial inspection** (`lead 1`, each March, the player must have Renown at least 100): an inspector from the court visits the player's largest prefecture. At fire time the player chooses: *bribe* 300 gold (nothing else happens) or *refuse*: the next campaign (G-6) is advanced by 2 months, Renown +2 if the inspector's graft is 60 or more. Both effects are stated on the choice screen.
- **V-8** **Story events**, each with a stated trigger and effect, fired once: *The birthday convoy* (when Renown is at least 150 and a thief is in service: a court convoy of 3,000 gold crosses a prefecture you own; choose to take it: gold +3,000, Renown +3 if its governor has graft 60 or more); *The wronged officer* (when an `official` hero's governor has graft 70 or more: the hero offers to serve at invite odds +30, once); *Famine in a court prefecture* (when you hold a neighbour with food over 3,000: send relief for Renown +3).
- **V-9** Every fired event is added to the **event log**: a scrollable list with the month, the prefecture, the event, the effect and the rule id; it never auto-dismisses (C8).
- **V-10** A pending event decision blocks nothing but the command phase it belongs to: the player answers before issuing the next command (Arch pending policy).

## 10. Battle (W)
- **W-1** **Starting a battle.** `attack` names an origin prefecture (yours), a target prefecture linked to it (not owned by you, not behind a snowed-in link, not `dongjing` before the Edict) and the force: heroes (1-8, including the actor, who becomes the **commander**) and men from the origin. The origin pays no cost beyond the daily food (W-21). Marsh-water links need a marine in the force, else the attack is not offered. The AI's attacks use the same rule (A-5).
- **W-2** **Defenders.** All heroes present in the target are deployed (up to 8, by `command` then rank; the extra ones flee with the rest of the reserve). If a defender has no hero, one **garrison captain** (might 40, command 40, cunning 30, vigour 40, infantry) leads each 1,500 men, up to 4 units. The defender's commander is the governor.
- **W-3** **The board is a hex grid** (axial `(q, r)`). Size by seat: `town` 11 x 9, `city` and `fortress` 13 x 11, `stronghold` 15 x 11 (columns x rows of an odd-r layout; axial `q = x - (y - (y & 1)) / 2`). Deployment: attackers in columns 0-1, defenders in the last two columns, or inside the walled ring (below). `hexDistance(a, b) = (|dq| + |dq + dr| + |dr|) / 2`. A `marsh-water` link is a moat: see W-1.
- **W-4** **Terrain from the prefecture** (seeded, C7). The battlefield is generated from the prefecture's map `terrain` in row-major order, one `roll(100)` per hex against the weights (cumulative, in the order listed); the generator uses its own sfc32 stream seeded with `(seed ^ imul(t + 1, 0x9e3779b1) ^ imul(prefectureIndex + 1, 0x85ebca6b)) >>> 0` and never touches the main stream, so the same battle always has the same board. Weights (%, in order):

| Terrain | plain | road | forest | reed | hill | mountain | marsh | water | village |
|---|---|---|---|---|---|---|---|---|---|
| plains | 62 | 8 | 12 | 4 | 8 | 0 | 2 | 0 | 4 |
| hills | 30 | 4 | 22 | 0 | 34 | 8 | 0 | 0 | 2 |
| mountains | 14 | 4 | 24 | 0 | 28 | 28 | 0 | 0 | 2 |
| marsh | 18 | 4 | 4 | 24 | 0 | 0 | 34 | 14 | 2 |
| river-delta | 34 | 4 | 4 | 14 | 0 | 0 | 22 | 18 | 4 |
| coast | 44 | 6 | 6 | 0 | 10 | 0 | 8 | 22 | 4 |

  The tag `liangshan-marsh` moves 10 points from plain to water. Deployment columns are forced to plain. A seat of `city`, `fortress` or `stronghold` adds a **wall ring** of 6 wall hexes around a keep hex in the defender's zone with one gate hex facing the attacker. If the two zones are not connected by passable hexes, a land bridge of plain hexes is carved along the middle row.
- **W-5** **Unit.** One hero plus men. Men led: the force's men are dealt out in order of `command` (then rank); each unit takes `min(command * 15, remaining)`, at least 50 (a personal guard, not drawn from the pool). `armedRatio` is the prefecture's at deployment. A unit has `men`, `maxMen` (deployed), `morale`, `fatigue`, `kind`, `position`, `hidden`, `flags`.
- **W-6** **Kinds and terrain** (move cost; `-` impassable):

| Terrain | Infantry / archers | Cavalry | Boats | Defence % | Notes |
|---|---|---|---|---|---|
| plain, road | 1 | 1 | - | 100 | |
| forest | 2 | 3 | - | 85 | hides units; flammable |
| hill | 2 | 2 | - | 85 | height 1 |
| mountain | 3 | - | - | 75 | height 2 |
| reed | 2 | 2 | 2 | 100 | hides; flammable |
| marsh | 3 | 3 | 1 | 100 | |
| water | - | - | 1 | 100 | swimmers enter at 3 |
| village | 1 | 1 | - | 90 | heals 3% of maxMen at dusk; flammable |
| wall | - | - | - | - | impassable; archers on walls: range +1 |
| gate | 1 | 1 | - | 80 | |
| keep | 1 | 1 | - | 70 | height 1 |

  Move points: infantry 4, archers 4, cavalry 7, boats 5; +1 runner; -1 at fatigue 50+, -2 at 80+, minimum 1. Boats pay 2 on dry land (x90 damage on land, x110 from water/marsh/reed).
- **W-7** **Day structure.** A battle is up to `DAYS = 20` **days** (shown at all times as "Day 7 of 20" in the HUD, C7). Each day the attacker side acts first, then the defender side, then **dusk** (W-21..W-23). A side's units act in any order, each at most once per day.
- **W-8** **A unit's day** is: an optional move (ending early when it enters a hex adjacent to an enemy, the **zone of control**; leaving is free), then at most one action: *attack*, *volley*, *charge*, *fire*, *ambush*, *heal*, *scuttle*, *counsel*, *hide*, *weather*, or *wait*. A duel (W-17) is separate and also once per hero per day. A unit that did none of move, action or duel (as challenger or target) today is *idle* (W-12).
- **W-9** **Damage in men killed**, for attack, charge, volley and ambush:
  1. `x = 40 + floor(might / 2) + floor(men / 10)` (attacker's current `men`)
  2. `x = pct(x, 100 - floor(fatigue / 2))`
  3. `x = pct(x, 80 + floor(training / 5))`
  4. `x = pct(x, 60 + floor(40 * armedRatio / 100))`
  5. `x = pct(x, 100 + 10 * clamp(heightAttacker - heightDefender, -1, 1) + boats)` where `boats` is +10 for a marine unit attacking from water, marsh or reed, -10 on dry land, else 0
  6. `x = pct(x, action%)` (W-10)
  7. `x = pct(x, pincer%)` (125 if another friendly unit is adjacent to the target on the far side, melee and charge only; else 100)
  8. `x = pct(x, defence% of the target's hex)`
  9. `x = pct(x, 100 - floor(command(target hero) / 4))`
  10. `x = max(1, pct(x, 100 + variance))`, capped at the target's `men`.
  `query.attackPreview(state, unit, target)` returns the min and max (variance -10 and +10) and every factor (C7).
- **W-10** **Action percentages:** attack 100; counter 60; charge 150; volley 70; ambush 150; an archer's melee 70 and counter 40; a charge into a unit with *brace* (spearman): charge 125 and the counter 100.
- **W-11** **Counterattack.** After a melee attack or charge, a surviving, adjacent, non-routed defender strikes back once with action% 60 (W-9 with roles swapped, using its current men, the pincer step skipped). No counter to volley or ambush.
- **W-12** **Fatigue** 0-100 (C7). Each cause adds `max(1, base - floor(vigour / 40))` and is recorded with its cause for the unit's tooltip ("march +1", "duel +3", "attack +2"): march (moved this day) 3; each rough hex entered (forest, hill, mountain, marsh, reed) 1; attack 4; counter 2; charge 8; volley 4; duel winner 5, loser 20; hunger day 15; burning at dusk 6. At dusk every unit recovers `floor(vigour / 10)`, and 8 more if it was idle. Effects: damage x(100 - floor(fatigue / 2))%; move penalty at 50 and 80 (W-6); a unit at 80+ cannot charge.
- **W-13** **Fire, scuttle.** *Fire* (firebrand, range 3): target a flammable hex (forest, reed, village); it burns for 2 dusks. A burning hex at dusk: units there lose `pct(maxMen, 12)` men, -10 morale, +6 fatigue; the **wind** (one of six hex directions, shown) carries fire: each burning hex tries its downwind neighbour if flammable: `roll(100) < 50`. Burnt hexes become plain. Burning a *village* costs the commander Renown -1 each (R-3). *Scuttle* (swimmer): once per battle, an adjacent boat unit loses `pct(men, 15)`.
- **W-14** **Weather** (sorcerer, once per battle per sorcerer): choose *wind* (set its direction now), *rain* (no fire starts or spreads, burning hexes go out; volleys x50, for 2 dusks) or *fog* (volley range max 2; hidden units stay hidden; 2 dusks). The current weather is shown.
- **W-15** **Charge.** Cavalry, fatigue under 80: needs a straight line of at least 3 hexes of plain, road or village along one hex direction ending adjacent to the target, with no zone-of-control hex entered before the last. Damage x150 (W-10).
- **W-16** **Volley.** Archers: target 2-3 hexes away (maximum range +1 from a wall or hill hex), no line-of-sight rule, no counter, x70.
- **W-17** **Duels** (C4). Any hero with `might >= 50` (H-5) may challenge a hero within 2 hexes once per day, naming a **stake**: *honour* or *capture* (capture needs `might >= 70`). The preview shows two numbers before the challenge (C4):
  `accept% = clamp(5, 95, 35 + 6 * daring(target) + floor((might(target) - might(challenger)) / 2) - 15 if stake is capture + 30 if the target is cornered)`, where *cornered* means the target is its side's last unit, or is Gao Qiu with every link cut (W-26);
  `win%` = the exact probability the challenger wins the duel (computed by `query.duelOdds` by enumerating the exchange outcomes).
  The target accepts when `roll(100) < accept%` (AI and human alike: the human target answers a *pending decision* with the same odds shown). Declining under *honour* costs the target unit -5 morale; a `daring >= 8` hero declining loses 3 loyalty (H-13).
- **W-18** **Duel resolution.** Power `p = might + floor(vigour / 4)` (+10 swordsman). Up to three **exchanges**: each rolls `roll(100)` for the challenger then `roll(100)` for the target; the challenger wins an exchange if `p_c + r_c > p_t + r_t` (ties to the target). First to 2 exchanges wins. Winner: unit morale +15, fatigue +5; loser: morale -20, loses `pct(maxMen, 10)` men, fatigue +20; under *capture* the loser's hero is captured (W-19) and their unit is routed (a captured commander ends the battle, W-25).
- **W-19** **Capture.** When a unit's men reach 0 or it routs while an enemy unit is within 2 hexes, its hero rolls: `P = clamp(15, 85, 50 + floor((might(best adjacent enemy hero) - might(hero)) / 2)) - 20 if runner`, minimum 5; the percentage is shown on the unit card at all times when an enemy is within 2 hexes (C4). A captured hero is held by the side that took them. Uncaptured routed heroes retreat: the attacker to the origin prefecture, the defender to the nearest owned prefecture by links, else captured.
- **W-20** **Morale** 0-100. Start `60 + floor(training / 10)`, +10 for a defender in its own seat if support is 60 or more. Changes: ally routed within 3 hexes -10; hit by a pincer -5; ambushed -10; duel (W-18); burning (W-13); hunger -10 per day; killing a unit +10; commander routed -30 for all of that side. At dusk +2 if the unit took no damage that day. A unit **routs** at morale 20 or less or men at 10% of `maxMen` or less (C7).
- **W-21** **Daily food** (C7). At dusk each side pays `ceil(total men on the field / 300)` food from its home stock (the defender's from the target prefecture, the attacker's from the origin). A side whose stock cannot pay is *hungry*: each of its units takes the hunger fatigue (W-12) and -10 morale, the stock stays at 0.
- **W-22** **Dusk order:** (1) fire (W-13); (2) village healing and heal skills; (3) daily food; (4) rally skills; (5) fatigue recovery (W-12); (6) morale +2 (W-20); (7) rout checks; (8) the day counter increases.
- **W-23** **Day limit.** When Day 20 ends without a result, the **attacker withdraws**: their units return to the origin prefecture, captives are kept by whoever took them, the defender holds, Renown -1 (R-3). The HUD shows "Day 17 of 20 — 3 days left" and highlights the last 3 days (C7).
- **W-24** **Hidden units.** A unit with skill `thief` or `scout`, or any unit standing on a forest or reed hex it started the day on, may **hide** (instead of acting); the opponent sees it only when an enemy unit is within 2 hexes (4 for a scout-led enemy). A hidden unit that attacks (ambush) deals x150 and the target loses 10 morale; the attacker is revealed. The view marks forest and reed hexes within 3 hexes of the opponent as "may hide" (C5).
- **W-25** **Ending a battle** (checked after every action): *attacker wins* if the defender's commander is routed or captured, or no defender unit is left; *defender wins* if the attacker's commander is routed or captured, or no attacker unit is left, or on withdrawal (W-23, `bWithdraw`). Remaining enemy units rout out; their heroes follow W-19 retreat.
- **W-26** **Gao Qiu in battle.** Gao Qiu's unit is never rolled for capture (W-19): at 0 men he is captured at once. If his unit routs or ends a day at 30% of `maxMen` or less, the court side has lost the battle and his **flight** is resolved (X-1): captured if every link of his prefecture is cut, else he flees along the open link the court AI chooses (A-7) at most twice (a third time he is captured); the player's strategic map marks cut and open links before the battle starts (C4). A duel with Gao Qiu may be offered (W-17); he is *cornered* when no link is open.
- **W-27** **After a won battle** the attacker takes the prefecture: owner changes; gold and food stocks halve (spoils go to the attacker); `support -= 15`, or `+= 10` if the previous owner was court with graft 40 or more; heroes not captured and not fled follow Q-8; captives follow Q-3; the commander's surviving men and arms stay as the garrison and the rest of the force remains in the origin. Renown follows R-2.
- **W-28** **Auto-resolve.** Either side's player may let the greedy AI play their side for the rest of the battle (action `bAuto`), for speed (C7). The result is identical to what the AI would do (A).
- **W-29** **Loyalty effects:** heroes who fought on the winning side +3 loyalty; the losing side -5 (H-12).
- **W-30** **Losses.** Men killed are gone. After the battle each side's `arms` fall by `floor(casualties * armedRatio / 100)`. Surviving men of a lost attack return to the origin; of a lost defence they flee with the retreating heroes (W-19) or are lost if there is no retreat.
- **W-31** **Unled prefectures.** A prefecture with men and no hero is defended by garrison captains (W-2); a prefecture with neither men nor heroes falls without a battle to any `attack`.

## 11. Victory and defeat (X)
- **X-1** **Victory.** Gao Qiu is captured (W-26). The game ends with *The Marsh Assembled* if at least 108 heroes serve the player, else with an ending tier by sworn brothers: 36+ *The Heavenly Thirty-Six*, 10+ *A Few Good Men*, otherwise *A Bitter Victory*. The ending also states the date, Renown, heroes gathered and prefectures held.
- **X-2** **Edict-but-no-victory.** After the Edict there is no extra condition: the capital can be taken in any month before the deadline.
- **X-3** **Chieftain lost.** If the chieftain is captured, a sworn brother with the lowest `star.rank` becomes chieftain (Renown -20%, rounded down; the oath meter of every hero is recomputed against the new chieftain's virtues) and play continues; with no sworn brother the game ends in defeat.
- **X-4** **Defeat:** the deadline month is reached (T-1) with Gao Qiu not captured ("The court's patience ends"); the player holds no prefecture; or X-3 with no sworn brother.
- **X-5** The game saves after every accepted action and on game end; a finished game clears its save (Arch save envelope).

## 12. AI (A)
- **A-1** **Information parity** (C3): every AI decides from `view(state, factionId)` only (Z-5) and picks an action from `legalActions`. No AI sees foreign numbers the player could not see with the same spy reports, and no AI gets resources, rolls or odds the player does not.
- **A-2** **Rival chieftains** (`data/rivals.json`) and the **court** play the same month phases as the player (T-2): the same commands, costs and caps (E-12), the same battles (W).
- **A-3** **Greedy order** per prefecture, first rule that applies (rival and court prefectures with any hero present get 1 command; there is no brotherhood requirement for the AI): (1) runway under 2 months: `trade` food if gold allows, else `levy` is skipped, `relieve` skipped; (2) support under 40: `relieve`; (3) enemy of equal strength linked: `train` if training under 70, else `levy`, `forge` if arms under men; (4) summer approaching (Apr, May): `dykes` if dyke under 50; (5) attack (A-5); (6) `hunt` if bandits 100 or more; (7) `recruit` a free hero if odds are 40% or more; (8) `train`; (9) `rest`.
- **A-4** Rivals and the court spend one `recruit` command per month on the free hero with the best odds, if odds are 40% or more.
- **A-5** **Attack decision.** Own `power = men + 500 * heroes + arms / 4` vs target `power`; attack the linked prefecture of highest `value = pop / 1000 + gold / 100 + 50 * heroes` among those with `power_target * k <= power_own` where `k` is the S-3 ratio; the AI never attacks across a snowed-in link, always keeps at least 30% of the origin's men at home, and attacks the player's prefectures with the same ratio as any other (no grudge) except that the court's target is chosen by G-6.
- **A-6** The court AI attacks only by G-6 campaigns and never leaves the capital under `host(t)`.
- **A-7** **Gao Qiu's flight:** he flees along the open link (W-26) whose far end holds the most court men; ties by prefecture id.
- **A-8** **Warnings the AI gives you** (C9): any march on the player's prefecture is visible at the previous month-end if a scout is in service (H-7); court campaigns are always announced (G-6).
- **A-9** **Battle AI** picks, per unit: duel if win% and accept% product is 20% or more; charge or volley if available; else attack the adjacent unit with the lowest `men`; else advance on the nearest enemy; retreat a unit under 30% men toward its commander. Deterministic given the state (ties by unit id).
- **A-10** Everything the AI does goes through `step`, so replay is exact (Arch).

## 12a. Camps (K)
A **camp** is the novel's outlaw mountain band as an AI faction (PLAN D18, `data/camps.json`). A camp is a rival of a small kind: it plays the A rules with the changes below, and it follows the same commands, costs, battles and information limits as everyone else (A-1, C3). Ids end in `-band` (`shaohua-band`). The player sees every camp's chief, heroes, odds and alliance state; foreign numbers stay in bands (Z-5).

- **K-1** **Camps at the start.** Each record names a `stronghold` (a mountain prefecture of `data/map.json`), a `chief` and `members` (heroes whose data status is `outlaw` at that stronghold, so Q-6 already seats them). The camp owns the stronghold and its members serve it. A stronghold with a court hero in file order is never a camp. Eight camps: Shaohua (Zhu Wu, Chen Da, Yang Chun), Taohua (Zhou Tong), Erlong (Deng Long, a non-star record), Qingfeng (Yan Shun, Wang Ying, Zheng Tianshou), Duiying (Lyu Fang, Guo Sheng), Mangdang (Fan Rui, Xiang Chong, Li Gun), Huangmen (Ou Peng, Ma Lin, Tao Zongwang), Dengyun (Zou Yuan, Zou Run). Heroes the data puts elsewhere stay where the data puts them (Li Zhong, Jiang Jing, Pei Xuan, Meng Kang, Deng Fei); the Yinma River camp has no prefecture on the map and does not exist.
- **K-2** **A camp's turn.** A camp prefecture with a camp hero present gets 1 command (A-2). The A-3 order applies, with these changes: a camp **attacks only from its stronghold** (so a camp never expands beyond its neighbours: what it takes it holds, but cannot launch from it) and only with the A-5 test; it **never attacks a faction it is allied with** (K-5). It defends with every hero present (W-2).
- **K-3** **Slow growth.** At month-end (after G-3) each camp prefecture gains `5` men and `5` arms per camp hero present (up to `floor(pop / 20)` men), `15` gold and `30` food (what its raiders take from the roads). Camps do not levy or forge on their own account beyond the A-3 order.
- **K-4** **Defeat.** A camp is *defeated* when its last prefecture is taken (W-27); it is then removed from the A phase. Its heroes follow W-27 and Q-8: captured heroes are pending decisions (Q-4), the rest serve the victor if the match is 40 or more, else are freed where they stood.
- **K-5** **Alliance** (`ally`, E-12 style command). The actor stands in a prefecture of yours linked to a camp prefecture; cost 200 gold (wine and silver). `P = clamp(5, 90, 15 + min(30, floor(renown / 10)) + floor(compat(chieftain, camp chief) / 3) + floor((cunning(actor) - 50) / 5))`, shown first (`query.campOdds`); one `roll(100) < P`. On success the camp is **allied for 24 months**: the camp never attacks you, and you cannot attack its prefectures (`attack` is not offered). A failed try can be repeated next month. The alliance can be renewed at any time (its 24 months restart; the 3-month clock of K-6 does not). It ends only by expiry. The court ignores alliances: its G-6 target choice sees power only.
- **K-6** **The camp joins.** At each month-end, for a camp allied for at least 3 months while your Renown is at least `JOIN_RENOWN = 60`: `P = clamp(5, 60, 5 + floor(renown / 10) + floor(compat(chieftain, camp chief) / 4))`, shown beforehand; one `roll(100) < P`. On success the whole camp **joins together**: every camp hero present serves you at loyalty `40 + floor(compat / 4)` (H-10, Renown by R-2 as for any joiner), the camp's prefectures become yours, and the camp is removed. The Renown of the heroes gathered is the only reward (no hidden bonus).
- **K-7** **Chief defeated and persuaded.** When a camp chief you hold captive is persuaded (Q-4), every other member of that camp who is free or still serving the camp is asked to follow, each with `P = clamp(10, 95, 45 + floor(compat(chieftain, member) / 3))` shown first (`query.followOdds`); those who accept join you where the chief stands, at loyalty `40 + floor(compat / 4)`. Members who are captive are decided on their own (Q-4), members held by another faction are not asked.
- **K-8** **Odds shown.** The camp card lists its chief and heroes, its men, the alliance state and expiry, `P` of K-5, `P` of K-6 and `P` of K-7 for its chief (`query.camps`).

## 13. Complaint trace (PLAN D15)
| Id | Answered by |
|---|---|
| C1 grind to Gao Qiu | R-1..R-9 (five Renown sources, ledger, trend, projected Edict date), G-5 |
| C2 hard deadline | S-3, S-5, R-7, R-8, R-10, X-4 |
| C3 difficulty and cheating | S-3, S-4, A-1 |
| C4 Gao Qiu escapes, duels never work | W-17, W-18, W-19, W-26, G-8, A-7 |
| C5 opaque systems | S-6, S-7, B-1, B-3, E-9, Z-4, T-10, Q-2 |
| C6 RPG layer barely matters | H-2, H-5, H-6, H-7, B-2, B-6 |
| C7 slow battles, opaque fatigue, tight limit | W-7, W-9 (preview), W-12, W-21, W-23, W-28 |
| C8 interface and vanishing messages | V-9, T-10 (client rules in 50-presentation.md at M3) |
| C9 surprise disasters | E-9, H-14, H-16, T-7, V-0, G-6 |
| C10 saving | X-5, Arch save envelope |
| C11 too like Three Kingdoms | Pillar 1: R-2 justice, E-16 `expose`, V-8, G-2 graft |
| C12 English | all text is English |
| C13 manual | S-7, S-6, in-game help (M3) |

## 14. Rulings that bind the engine
Open rulings are in `PLAN.md` "Rulings / balance log". The engine agent must read that log before coding: items marked OPEN default to the text above.
