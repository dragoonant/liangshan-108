# 20 - Data schema (M1)

Status: frozen contract from `docs/briefs/overnight-2026-11-07.md`, with the rulings at the end. All files are JSON under `data/`; one JSON Schema (draft 2020-12) per file under `data/schema/`; `node tools/validate-data.mjs` checks schemas and cross-file rules and exits 1 on any error. Every record has `source`. All prose is ours; people, places and nicknames come from the public-domain novel *Water Margin*. Numbers are our own judgement of how the novel portrays each person.

## Shared conventions
- Ids: lowercase kebab-case pinyin, unique across heroes, court and rivals (`lin-chong`). Two heroes share the name Zhang Qing; the second is `zhang-qing-gardener`.
- `name`: pinyin with spaces, letters and apostrophes only, no tones, no umlaut (`Lyu Fang`). `nameZh`, `nicknameZh`: simplified Chinese.
- `nickname`, `rationale`: our own English wording.
- `source`: novel chapter(s) and/or URL. Hero chapter numbers are the chapter of first appearance from Wikipedia's "108 Heroes" table; other rows cite the chapters named.

## `heroes.json` (array of exactly 108, star order 1-108)
| Field | Type | Rule |
|---|---|---|
| `id`, `name`, `nameZh`, `nickname`, `nicknameZh` | string | all required for heroes |
| `star` | object | `rank` 1-108 (equals array position + 1), `group` `heavenly` (rank 1-36) or `earthly` (37-108), `nameZh` (天/地 prefix, ends 星, unique), `name` English rendering |
| `abilities` | object | `might`, `command`, `cunning`, `vigour`, integers 1-100 |
| `virtues` | object | `righteousness`, `compassion`, `daring`, integers 1-10, fixed for life |
| `skills` | string[] | 0-3 unique ids from the closed list |
| `start` | object | `status`, `prefecture` (a map id), `year` (1101 for all current records) |
| `joinsLate` | boolean | true = cannot be recruited until `joinTrigger` fires |
| `joinTrigger` | string | required iff `joinsLate`; a story event in plain words |
| `rationale` | string | one line |
| `source` | string | |

Closed lists:
- `start.status`: `free`, `official` (serves the court or a garrison; recruitable only by deeds, defection or capture), `outlaw` (already holds a hill or hideout), `captive-of-court`.
- `skills` (22, defined with effect hooks in `skills.json`): spearman, swordsman, archer, horseman, marine, swimmer, scout, thief, strategist, scribe, physician, smith, builder, horse-trader, innkeeper, monk, sorcerer, drillmaster, firebrand, forger, runner, beast-slayer.

Distribution checks (validator): each ability has standard deviation >= 12, 2-12 heroes at 90+, >= 20 distinct values; each virtue uses >= 7 of the 10 values; every skill is held by at least one hero. Of the 108, 23 are `joinsLate`.

## `court.json` (array)
As a hero without `star` and with required `office`. `nickname`, `nicknameZh` optional. Must contain gao-qiu, cai-jing, tong-guan, yang-jian, gao-lian, gao-yanei (the validator accepts 16-26 records; there are 19, including the emperor).

## `rivals.json` (array)
As court, plus required `faction` (string) and `stronghold` (a map id). Contains the Zhu Family Village and Zeng Family Fortress leaders and champions (Luan Tingyu, Shi Wengong), Wang Lun, and the late-game rebels of Tian Hu, Wang Qing and Fang La (dated 1118-1120 through `start.year`).

## `skills.json` (array of 22)
`id` (closed list), `name`, `effect` (one-line hook; the rules spec adds numbers), `source`.

## `map.json`
`{ "prefectures": [...], "links": [...] }`, 48 prefectures and 73 links.
- Prefecture: `id`, `name`, `nameZh`, `circuit` (approximate Song circuit name), `pos {x,y}`, `lon`, `lat`, `terrain` (plains | hills | mountains | marsh | river-delta | coast), `seat` (city | town | fortress | stronghold), `base {population, land 0-100, flood 0-100}` (flood = dyke state, higher is safer), `special` (free kebab tags), `note`, `source`.
- Projection: `x = (lon - 106.0) / 16.5`, `y = (41.0 - lat) / 13.5`, so x runs east and y runs south; the validator rechecks every `pos` against `lon`/`lat`.
- Tags in use: `capital` (dongjing only), `liangshan-marsh` (jizhou only, terrain marsh), plus `grand-canal`, `yellow-river-plain`, `pass`, `port`, `bandit-hills`, `liao-border`, `horse-market`, `imperial-garrison`, `fortified-villages`, `rival-seat`, `frontier`, `western-capital` and others the rules may read.
- Link kinds: `road`, `river`, `marsh-water`, `mountain-pass`; undirected, no duplicates or self-links.
- Rules checked: all ids unique, the graph is connected, and the capital is at least 3 links from the Liangshan prefecture (it is exactly 3: jizhou, caozhou, yingtianfu, dongjing).
- Many places in the novel are fictional or unlocated (Zhu Family Village, Zeng Family Fortress, the mountain camps, Qingfeng Fort, Jieyang). Their positions are approximate and say so in `note`. Song seats use the modern city's coordinates; Cangzhou's old seat moved, so its position is approximate.

## Validator (`tools/validate-data.mjs`)
Plain Node 22, no dependencies. A small schema checker covers the subset used (type, enum, const, required, properties, additionalProperties false, items, min/max items, uniqueItems, min/max, length, pattern). Cross-file checks: 108 heroes with ranks 1-108 in order, 36/72 split, unique ids, star names and Chinese names, skill ids exist, `joinTrigger` consistency, every `start.prefecture` and rival `stronghold` exists on the map, map rules above, the distribution checks above, and a hygiene scan of `data/`, this file and the validator for banned words, Koei titles and private paths.

## Known gaps
- Hero chapters come from the Wikipedia table; individual hero pages were not fetched one by one and the novel text was not read chapter by chapter, so start positions for minor heroes follow the table's origin column and well-known plot points.
- Cao Zheng's star is written 地稽星 as in Wikipedia; some editions write 地羁星.
- Yu Baosi's early story is thinly sourced; his start (qingzhou, free) is a placeholder.

## Rulings
RULING: top-level shape | heroes, court, rivals and skills are plain JSON arrays; map is an object with `prefectures` and `links` | the brief says "108 records" and gives the object form only for the map | OPEN
RULING: court/rivals nickname | `nickname` and `nicknameZh` are optional for court and rivals (most officials have none) and required for heroes | the contract says "same shape as heroes" | OPEN
RULING: rivals fields | added required `faction` and `stronghold` (a map id) to rivals | the brief asks for "their own strongholds" | OPEN
RULING: map extras | added `lon`, `lat` and `note` to prefectures | the brief asks lon/lat to be recorded | OPEN
RULING: joinsLate meaning | `joinsLate` heroes already exist at their `start` but cannot be recruited until the trigger fires; `start.year` is 1101 for all heroes, rival rebels carry 1118-1120 | keeps one scenario start date | OPEN
RULING: Lin Chong status | start status `official` (imperial instructor), not `free` as in the brief's illustrative example | he holds a court post at scenario start | OPEN
RULING: court size | the emperor Huizong is included among the 19 court records | the novel's court cannot be told without him | OPEN
RULING: name field | `Lyu Fang` for the hero written Lü Fang (id `lyu-fang`) | pinyin names are ASCII without tones | OPEN
