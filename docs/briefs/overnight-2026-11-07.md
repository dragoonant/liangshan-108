# Overnight brief, 2026-11-07 (M0 + M1, then M2)

Shared by every agent tonight. Read `PLAN.md`, `CLAUDE.md` and `docs/research/original-complaints.md` first. Working copy: `/home/user/liangshan-108` (branch `claude/inspiring-hypatia-73p6th`, orphan, this game only). The sibling game to copy patterns from is `/home/user/three-kingdoms-tactics` (read-only for you). The KB is `/home/user/tabletop-kb` (read-only; read only `rules.md` rules 2, 3, 8, 22, 23).

## Hard constraints
- **IP:** people, places, nicknames and events come from the public-domain novel *Water Margin*. All prose, system names, UI text and numbers are ours. Do **not** look up or reproduce Koei's stat values, stat lists, event texts, map layout or UI from *Bandit Kings of Ancient China*; we answer its complaints (C1-C13), we do not copy it. Never write "Bandit Kings" or "Tenmei no Chikai" in game text, UI, specs or data; the lineage statements in `PLAN.md`, `CLAUDE.md`, the KB entry and `docs/research/` are the only exceptions (coordinator amendment, 2026-11-07).
- Never put any word from KB `rules.md` rule 23 in any file.
- Privacy: never write a real name, email or home path; credit "evilgouki". Run `grep -rniE "/home/|/root/|@gmail" -- <your paths>` before each commit (repo-relative paths in docs are fine; absolute paths are not).
- Commit only your own paths (`git commit -- <paths>`), `git pull --rebase origin claude/inspiring-hypatia-73p6th`, then `git push -u origin claude/inspiring-hypatia-73p6th` (on a network error retry up to 4 times, waiting 2, 4, 8, 16 s). Commit messages are plain sentences ending with these two lines:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_015mCNByzJHfH9N3dR7eDhdp
  ```
  Never write a model name anywhere else.
- Final report to the coordinator: 15 lines or fewer: files written, test/validator results, open `RULING:` lines, questions for the owner.

## Frozen data contract (both M0 and M1 agents build to this; change it only by noting a RULING)
All data is JSON under `data/`, one JSON Schema per file under `data/schema/`. Every record has `"source"` (where its facts come from: novel chapter numbers and/or a URL). Ids are lowercase kebab-case pinyin (`lin-chong`, `jizhou`).

### `data/heroes.json` — exactly 108 records, in star order 1-108
```jsonc
{
  "id": "lin-chong",
  "name": "Lin Chong",            // pinyin with spaces, no tones
  "nameZh": "林冲",
  "nickname": "Panther Head",     // our own English rendering of the nickname
  "nicknameZh": "豹子头",
  "star": { "rank": 6, "group": "heavenly", "nameZh": "天雄星", "name": "Heroic Star" }, // group: heavenly (1-36) | earthly (37-108)
  "abilities": { "might": 92, "command": 85, "cunning": 60, "vigour": 85 },  // 1-100, our judgement from the novel
  "virtues": { "righteousness": 8, "compassion": 6, "daring": 8 },            // 1-10, fixed for life, drive brotherhood compatibility
  "skills": ["spearman", "drillmaster"],  // from the closed list below; 0-3 per hero
  "start": { "status": "free", "prefecture": "dongjing", "year": 1101 },      // status: free | official | outlaw | captive-of-court ; year they can first appear
  "joinsLate": false,             // true for heroes who in the novel join only after a specific event; then "joinTrigger" text says which
  "rationale": "Imperial arms instructor of the 800,000 guards; framed by Gao Qiu (ch. 7-12).", // one line, our words
  "source": "Water Margin ch. 7-12; https://en.wikipedia.org/wiki/Lin_Chong"
}
```
Closed skill list (`data/skills.json` defines each with an id, a name and a one-line effect hook the rules spec fills in): `spearman, swordsman, archer, horseman, marine` (fights on and in water, crews boats), `swimmer, scout, thief, strategist, scribe, physician, smith, builder, horse-trader, innkeeper, monk, sorcerer` (novel-style weather/terrain stratagems), `drillmaster, firebrand, forger, runner` (fast messenger), `beast-slayer`.

### `data/court.json` — Gao Qiu and the imperial side
Same shape as heroes minus `star`, plus `"office"`. At least: Gao Qiu (final villain, holds the capital), Cai Jing, Tong Guan, Yang Jian, Gao Lian, Gao Yanei, and 10-20 named generals/officials from the novel who oppose Liangshan. AI rival outlaw chieftains (non-108 strongholds from the novel, e.g. Zhu Family Village, Zeng Family Fortress, Fang La's rebels are late-game only if dated) go in `data/rivals.json` with the same shape.

### `data/map.json` — the full scenario map
```jsonc
{
  "prefectures": [
    { "id": "jizhou", "name": "Jizhou", "nameZh": "济州", "circuit": "Jingdong West",
      "pos": { "x": 0.62, "y": 0.41 },            // 0-1 map space from real lon/lat of the Song seat, x east, y south
      "terrain": "marsh",                          // plains | hills | mountains | marsh | river-delta | coast
      "seat": "city",                              // city | town | fortress | stronghold
      "base": { "population": 180000, "land": 60, "flood": 40 }, // our numbers; flood = dyke state 0-100
      "special": ["liangshan-marsh"],              // free tags the rules may read
      "source": "..." }
  ],
  "links": [ { "a": "jizhou", "b": "yunzhou", "kind": "road" } ]   // road | river | marsh-water | mountain-pass ; undirected
}
```
40-55 prefectures of Northern Song China around 1101, covering the novel's settings (Dongjing/Kaifeng capital, Liangshan marsh in Jizhou/Yunzhou, Cangzhou, Daming, Qingzhou, Jiangzhou, Huazhou, Mount Shaohua, Mount Erlong, Taohua, Dengzhou, Yanzhou, Zhujiazhuang village area, etc.). The graph must be connected; the capital must be reachable only through at least two prefectures from Liangshan.

## Agent split
- **M0 agent (scaffold + specs):** scaffold copied from the sibling (package.json renamed `liangshan-108` with the sibling's scripts minus audio, tsconfig, vite.config with `base: '/liangshan-108/'`, playwright.config with `PW_PORT`, `.gitignore`, `.gitattributes`, `.github/workflows/deploy.yml` on `main` only, `index.html` + `src/main.tsx` placeholder page saying "Liangshan: 108 Stars — engine in progress" with the KB rule 24 CSS; no sibling skin, art or audio). `npm install`, `npm run typecheck` and `npm run build` must pass. Then the specs: `docs/spec/00-architecture.md`, `docs/spec/10-rules.md`, `docs/spec/11-scenario.md`, `docs/spec/12-rules-test-checklist.md`, `docs/spec/13-golden.md`. Paths: everything except `data/` and `tools/validate-data.mjs`.
- **M1 agent (data):** `data/*.json`, `data/schema/*.json`, `docs/spec/20-data-schema.md`, `tools/validate-data.mjs` (plain Node, no dependencies beyond what Node 22 ships; validates schemas, counts 108, unique ids and ranks, star groups, skill ids, map connectivity and the capital-distance rule, every `start.prefecture` exists). Research every hero's name, nickname, star and story with WebFetch (Wikipedia "List of Water Margin characters" and the individual pages; the novel's text on Wikisource or Gutenberg). Paths: `data/`, `docs/spec/20-data-schema.md`, `tools/validate-data.mjs`.
- **M2 agent (engine), after both:** builds `src/engine` from the specs. Its brief is written after review.

## M2 engine agent (added by the coordinator after M0 and M1 landed)
Owner questions are open (Chao Gai as a start, the quiet map, the 23 late joiners); keep the defaults in PLAN.md (Ruan Xiaoer is the sixth start; the map stays as `11-scenario.md` has it; 23 late joiners). Build:
1. `src/data/`: typed loaders for every `data/*.json`, plus `data/triggers.json` (+ schema + validator check) from the table in `11-scenario.md` section 5 (RULING Q-5).
2. `src/engine/` exactly per `00-architecture.md` and `10-rules.md`: rng (sfc32, forced rolls), createGame, legalActions, step (strategic commands, month end, events, court and rival AI phases, battles on the hex grid, chase, victory/defeat), view (Z-5 fog, forecast, warnings, ledger, advice), query.* for every displayed number, replay, the save envelope (KB rule 22) with a round-trip helper.
3. `src/ai/greedy.ts`: the A-rules decider answering through `legalActions`, usable for every faction and for the player seat in sims, and for `bAuto` (W-28).
4. Tests in `tests/unit/` titled by rule id: every line of `12-rules-test-checklist.md` gets a test or a `test.todo` with the reason; `13-golden.md` reproduced exactly with forced rolls; replay equals live state; `step` never throws and never mutates its input (action fuzz over random legal and illegal actions); save round trip.
5. `tools/sim.ts` (`npm run sim -- --games 200 --difficulty 2`): greedy player vs AI factions, invariants after every step (plain JSON, non-negative stocks, 108 heroes accounted for, legalActions non-empty before result, no stall over 50,000 steps), and a balance table per difficulty: win rate, month of the Edict (median, p10, p90), share of games where the Edict comes after the deadline, Gao Qiu flights, battles per game, heroes recruited. Put the table in `docs/spec/70-sim-results.md` with the date and seed range; do not tune numbers yourself, only report (balance changes are rulings for the coordinator).
Gates before each push: `npm run typecheck`, `npm test`, `npm run build`, `npm run validate:data`. Commit in stages (data loaders; strategic engine; battle engine; AI + sim) and push after each. New ambiguities: `RULING:` lines in PLAN.md as before.
