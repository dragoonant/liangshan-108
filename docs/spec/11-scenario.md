# 11 — The 1101 scenario (v0.1)

The one scenario of v1: January 1101, the outlaws are scattered, Gao Qiu's court holds the capital. Everything here is derived from `data/` by rule, so the engine builds the world with code, not by hand. This file lists the result (checked against `data/` on 2026-11-07; if `data/` changes, `tools/validate-data.mjs` and `tests/unit/scenario.test.ts` flag the differences).

## 1. Calendar and deadline
`t = 0` is January 1101 (T-1). Deadline, last month and the Edict-by month per difficulty (S-3, S-5):

| Difficulty | Months | Last month (`t`) | Edict by (`t`) | AI ratio `k` | Campaign interval `K` |
|---|---|---|---|---|---|
| 1 Easy | 180 | Dec 1115 (179) | Jul 1114 (162) | 1.6 | 14 |
| 2 Normal | 144 | Dec 1112 (143) | Jul 1111 (126) | 1.3 | 10 |
| 3 Hard | 108 | Dec 1109 (107) | Jul 1108 (90) | 1.1 | 7 |
| 4 Brutal | 84 | Dec 1107 (83) | Jul 1106 (66) | 0.9 | 5 |

Nothing else differs between difficulties (S-4). `EDICT = 500` Renown for all.
The dated rivals Tian Hu and Wang Qing (1118) and Fang La's rebels (1120) in `data/rivals.json` appear in January of their year (T-1 and Q-6); no difficulty lasts that long, so they never appear in v1. They stay in the data for a longer mode.

## 2. Who owns what at the start
Rule, applied in this order to each prefecture in `data/map.json`:
1. A rival from `data/rivals.json` with `start.year <= 1101` and `stronghold` here owns it. Rival ids are the kebab slug of `faction`: `zhu-family-village`, `zeng-family-fortress`, `old-liangshan`.
2. Else the **court** owns it if a hero of `data/court.json` has `start.prefecture` here, or its `special` contains `capital`, `imperial-garrison` or `western-capital`.
3. Else it is **free** (E-17).

Result (48 prefectures): 13 court, 3 rival, 32 free.

| Owner | Prefectures |
|---|---|
| Court (13) | `dongjing` (capital), `yunzhou`, `daming`, `taiyuan`, `puzhou`, `mengzhou`, `luoyang`, `jingzhao`, `qingzhou`, `qingfeng-zhai`, `dengzhou`, `lingzhou`, `jiangzhou` |
| Zhu Family Village | `zhujiazhuang` |
| Zeng Family Fortress | `zengtou-shi` |
| Old Liangshan (Wang Lun) | `jizhou` |
| Free (32) | `yingtianfu`, `caozhou`, `yanzhou`, `yizhou`, `dongchang`, `zhangde`, `zhongshan`, `zhending`, `cangzhou`, `youzhou`, `jizhou-north`, `shangdang`, `mangdang-shan`, `chenzhou`, `weizhou`, `yanan`, `huazhou`, `shaohua-shan`, `qingfeng-shan`, `erlong-shan`, `taohua-shan`, `duiying-shan`, `dengyun-shan`, `jieyang`, `huangmen-shan`, `xiangyang`, `tanzhou`, `hongzhou`, `luzhou`, `jiankang`, `suzhou`, `hangzhou` |

The chosen start prefecture is then handed to the player (S-8). The three rivals fight only inside the AI phase (A); the court does not fight rivals except by campaign (G-6).

## 3. Heroes at the start
- **Court officials** (`data/court.json`, 19 records, incl. the Emperor who is a figure, not a unit). The governor of a court prefecture is the first court hero in file order whose `start.prefecture` is it (the Emperor never governs). A court hero whose prefecture is not court-owned moves to the nearest court prefecture by link count, ties by id (`gao-lian` and `yin-tianxi` leave `jizhou` for `yunzhou`). Resulting governors: `dongjing` Gao Qiu (with Cai Jing, Tong Guan, Yang Jian, Gao Yanei, Lu Qian, Dong Chao in the capital's reserve, G-7), `yunzhou` Gao Lian (with Cheng Wanli, Yin Tianxi), `daming` Liang Shijie (Li Cheng, Wen Datong), `jiangzhou` Cai Jiu (Huang Wenbing), `qingfeng-zhai` Liu Gao, `qingzhou` Murong Yanda, `mengzhou` Zhang Dutian. Other court prefectures have no named governor and are held by garrison captains (W-2) until a campaign commander is assigned. Graft per G-2.
- **The 108** (Q-6): of 85 non-late heroes, `free` heroes are free in their `start.prefecture`; `official` heroes serve the court there if the court owns it, else are free; `outlaw` heroes belong to the rival or stay free in their stronghold; the 23 `joinsLate` heroes are dormant (section 5).
- **Followers** (S-9) and what each start displaces (S-8):

| Start | Followers (loyalty 60) | Displaced (become free heroes) | Notes |
|---|---|---|---|
| Song Jiang `yunzhou` | Wu Yong, Liu Tang | Cheng Wanli (court governor); Gao Lian and Yin Tianxi are moved there in setup, so they are displaced too | Zhu Tong, Lei Heng (data: official) become free |
| Chao Gai `yunzhou` | Wu Yong, Liu Tang | as Song Jiang: Cheng Wanli, Gao Lian, Yin Tianxi | The Seven Stars band: Wu Yong and Liu Tang with him; the Ruan brothers (`jizhou`, across marsh-water) and Gongsun Sheng (`jizhou-north`) are free heroes to invite. Song Jiang (data: official), Zhu Tong and Lei Heng become free. Old Liangshan keeps `jizhou`. Ruan Xiaoer is an ordinary free hero again. |
| Lin Chong `mengzhou` | Shi En, Zhang Qing (the gardener) | Zhang Dutian (court governor) | Capital one road away; two passes north |
| Wu Song `cangzhou` | Chai Jin | none (free prefecture) | A scripted tiger arrives month 1 (V-6) |
| Lu Zhishen `weizhou` | Li Zhong | none | Two links only (`jingzhao` road, `yanan` mountain pass); the pass is not snowed in because neither end is northern (T-6). |
| Hu Sanniang `zhujiazhuang` | Li Ying | Zhu Chaofeng, Zhu Long, Zhu Hu, Zhu Biao, Luan Tingyu (free) | The Zhu clan rival is removed |

(The follower and displaced lists are computed by rule, not stored.)

## 4. The map facts the rules lean on
- 48 prefectures, 73 links: 45 `road`, 16 `mountain-pass`, 10 `river`, 2 `marsh-water` (`jizhou`-`yunzhou`, `jizhou`-`zhujiazhuang`).
- **Northern prefectures** (`pos.y <= 0.30`, T-6): `zhongshan`, `zhending`, `cangzhou`, `youzhou`, `jizhou-north`, `taiyuan`, `dengzhou`, `dengyun-shan`, `lingzhou`. Snowed-in `mountain-pass` links in Dec-Feb: `taiyuan`-`zhending`, `dengzhou`-`dengyun-shan` (the only passes with a northern end).
- **Capital routes** (G-8): `dongjing` has 5 links: `yingtianfu` (river), `mengzhou`, `chenzhou`, `zhangde`, `luoyang` (roads). To cut all five the player must own all of them. `jizhou` (Liangshan) reaches `dongjing` only through `caozhou`/`yanzhou` -> `yingtianfu` or through `yunzhou` -> `daming`/`dongchang` -> `zhangde`, never directly.
- The marsh-water moat: only marines or swimmers cross `jizhou`'s two marsh-water links (E-15, W-1). `jizhou` can still be attacked by road from `caozhou` and `yanzhou`.
- Largest population: `dongjing` 650,000. Total about 6.9 million.

## 5. Late-joining heroes: triggers (Q-5)
Authoritative table for the 23 `joinsLate` heroes. M2 stores it as `data/triggers.json` (`{ "hero": id, "kind": ..., ...args }`). A hero appears with their `start.status` semantics in their `start.prefecture` when the trigger fires.

| Hero (rank) | Start | Trigger |
|---|---|---|
| `lu-junyi` (2) | `daming` | `battle-won-at zengtou-shi` |
| `guan-sheng` (5) | `puzhou` | `battle-won-at daming` |
| `huyan-zhuo` (8) | `dongjing` | `campaign-announced` (first) |
| `han-tao` (42), `peng-qi` (43) | `chenzhou` | `campaign-announced` (first) |
| `dong-ping` (15) | `yunzhou` | `renown 120` |
| `zhang-qing` (16), `gong-wang` (78), `ding-desun` (79) | `dongchang` | `defeated-hero dong-ping` |
| `xu-ning` (18) | `dongjing` | `brother tang-long` |
| `yan-qing` (36), `cai-fu` (94), `cai-qing` (95) | `daming` | `brother lu-junyi` |
| `xuan-zan` (40), `hao-siwen` (41) | `dongjing`/`puzhou` | `defeated-hero guan-sheng` |
| `shan-tinggui` (44), `wei-dingguo` (45) | `lingzhou` | `attacked lingzhou` |
| `ling-zhen` (52) | `dongjing` | `defeated-hero huyan-zhuo` |
| `an-daoquan` (56) | `jiankang` | `renown 300` |
| `huangfu-duan` (57) | `youzhou` | `renown 200` |
| `tang-long` (88) | `yanan` | `renown 150` |
| `wang-dingliu` (104) | `jiankang` | `brother an-daoquan` |
| `duan-jingzhu` (108) | `youzhou` | `battle-won-at zengtou-shi` |

Chains (`xu-ning` after `tang-long`, `wang-dingliu` after `an-daoquan`, the `daming` three after `lu-junyi`) mean a late hero can be gated by another recruit.

## 6. Starting numbers
Start prefecture numbers come from S-1; every other prefecture from E-3 using the map's `base` values. The court's capital begins with `men = floor(650000 / 90) = 7222`. Nobody starts with a bonus beyond S-1 (S-4).

## 7. Setup procedure (the engine's `createGame` does exactly this, in order)
1. Seed the RNG; build prefectures from the map (E-3).
2. Assign owners (section 2); hand the start prefecture to the player; set the S-1 numbers; displace (S-8).
3. Place heroes (Q-6); court governors (section 3); dormant heroes (Q-5).
4. Apply followers (S-9); set the chieftain.
5. Compute graft (G-2) and court support (E-3); set `commandsLeft` (T-3).
6. Schedule month-0 events: for Wu Song the tiger (V-6); roll nothing else.
7. Compute the first forecast (T-7) and the first advice (S-6). Autosave (Arch).
