# 50 — Presentation (v0.1, written at the start of M3)

The look and the screens of the first playable. Rules live in `10-rules.md`; this file never changes a number, it says where each number is shown and how it is dressed. Every number on screen comes from `view` or `query.*` (Arch). KB rules 8, 12, 16, 21, 22, 24, 25, 26 and 27 apply (PLAN D13).

## 1. Concept: the outlaw hideout ledger (D3)

The whole game is the account book and wall of a marsh hideout, read by lamplight.

- **The map** is a reed-marsh chart drawn in ink on **oiled paper**, pinned flat on a dark plank table. Paper is translucent amber where the lantern falls and browns toward the edges. Rivers and the marsh are wash strokes in teal; reeds are short ink ticks along the water.
- **Prefectures** are inked ring marks with a small hand-drawn gate glyph, not circles on a board. The owner colours the ring and a flag tab.
- **Heroes** are **wanted posters** nailed to the plank: a torn-edge sheet of paper, a CSS ink-drawn portrait frame (no images yet), the name in heavy slab type, the Chinese name in brush-weight CJK, a **bounty** line, and a star mark.
- **Orders** are **ink stamps**: a command is confirmed by pressing a stamp (flat, slightly rotated, rough-edged, ink-coloured), never a glossy button.
- **Water and reeds** are everywhere: a slow wave line under the HUD, reed ticks in frames, and a drifting lantern-glow vignette. Motion is lantern flicker and brush-in, never spin or bounce.
- **Battles** are the same table seen close: the hex ground is oiled paper on the plank with inked terrain; units are small turned-wood figures with painted bands (house figure style, KB rule 7: about 2.8 head-heights, the head about 35% of the height, broad shoulders, short legs, stern or covered faces, matte finish).

One-line pitch: *a wronged hero's account book, lit by one lantern, where every order is a stamp and every brother is a bounty.*

## 2. Must not look like

Each item is a different game's skin; if a screen could be mistaken for one, it fails (KB rule 21).

| Not this | Their markers | Ours instead |
|---|---|---|
| **three-kingdoms-tactics** | war-council sand table, cloth slips (hanging silk tags), red wax seal, tent and banner framing, vermilion on near-black, gold trim, cream silk | oiled paper and plank, nailed posters, flat indigo ink stamps, no gold trim, no hanging tags, no tent; night teal not brown-black |
| **Koei's UI** (any of its games) | a bevelled blue-grey window with a thick coloured border, a portrait box with a gold frame, a numbered menu list, green command boxes, a flat parchment world map with blocky province tiles | no bevels, no numbered menus, no stat-box portraits; commands are stamps and rows in a ledger |
| **Xross Forge** | broadcast stage, neon, scoreboard, lower-third captions | lamp-lit paper, no neon, no scoreboard chrome |
| **lorecannae / shadowforge** | centred menu dialog, gold filigree frames, star card backs, serif on a dark panel | left-aligned ledger columns; frames are torn paper and ink brush, not filigree |

Also banned: native tooltips (`title` attribute; KB rule 8), emoji as icons, drop shadows that look like glass, gradients that imitate metal. The only red on screen is **cinnabar** for danger and refusals (a small stamp or text), never as the main accent.

## 3. Tokens

All colours are CSS variables on `:root` (`src/client/styles.css`); nothing else hard-codes a colour.

| Token | Value | Use |
|---|---|---|
| `--night` | `#0d1b1c` | page behind everything (marsh at night) |
| `--plank` | `#1a2a27` | table surface, panels' outer ground |
| `--plank-2` | `#243633` | raised plank, hover |
| `--water` | `#2f6b72` | rivers, links on water, focus rings |
| `--reed` | `#8fa85a` | reed ticks, positive trend, "green" status |
| `--paper` | `#e5d6a2` | oiled paper (map, posters, cards) |
| `--paper-lit` | `#f3e8bb` | paper under the lantern |
| `--paper-dim` | `#c9b886` | paper edges, disabled stamps |
| `--ink` | `#1d1911` | text on paper, brush lines |
| `--ink-soft` | `#4d4332` | secondary text on paper |
| `--chalk` | `#d9d2b8` | text on plank |
| `--lantern` | `#f0a63c` | the one warm light: current month, selection glow, amber status |
| `--indigo` | `#27497a` | order stamps, links, confirm |
| `--cinnabar` | `#b0392a` | danger, red status, refusals (small only) |
| `--jade` | `#2f9c78` | the player's colour on the map |
| owner colours | player `--jade`, court `#8c3d33`, free `#9a9275`, camps `#7a5aa0`, `#a8742c`, `#3f7fa5`, `#9b5c78`, `#5d8a3c`, `#b0643a`, `#4f6f6c`, `#6d6a92`; rivals `#c08a2b`, `#a2512f`, `#2f6f9b` | map rings and flags (always with a letter badge so colour is never the only cue) |

Dark mode is the only mode (the game is a lit room at night); contrast of text on `--paper` with `--ink` is above 10:1, of `--chalk` on `--plank` above 9:1.

## 4. Typefaces

All self-hosted through `@fontsource` packages bundled by Vite (Latin subsets only), so they work offline once the page has loaded. Each stack ends in a system fallback.

| Role | Face | Fallback |
|---|---|---|
| Posters, titles, stamps (heavy slab) | Alfa Slab One | `Rockwell, 'Roboto Slab', Georgia, serif` |
| Body and prose | Source Serif 4 (400, 600, italic) | `Georgia, 'Times New Roman', serif` |
| Numbers, ledger columns, dates | Courier Prime (400, 700), tabular | `'Courier New', monospace` |
| Chinese names | system CJK serif/brush, weight 700 | `'Noto Serif CJK SC', 'Songti SC', 'SimSun', 'WenQuanYi Zen Hei', serif` |

Scale (px): 12 caption, 14 body, 16 control, 20 heading, 28 poster name, 44 title wordmark. On phones body stays 14 and tap targets are at least 44 px high.

## 5. Frames, stamps, seals

- **Paper card:** `background: var(--paper)`, ink border 2px, an irregular `clip-path` polygon (four to eight points move by 1-3 px) to read as torn, a fine paper-grain overlay (inline SVG noise at 8% opacity). Four **iron nail heads** (6 px dark dots) at the corners of a poster.
- **Plank panel:** dark `--plank` with a 1px `--plank-2` rule and a reed-tick border-top (repeating short strokes).
- **Ink brush rule:** a 3px line with a tapered end (SVG path) under headings.
- **Wanted poster:** a header band reads `BOUNTY` and shows the hero's star ("Star 23, Heavenly" or "Earthly"; non-star heroes read "Outside the 108"), then the nickname in italic. Below: a portrait frame (CSS, a hand-drawn ink silhouette with the hero's initials in brush weight; no images yet), the name in slab type with the Chinese name beside it, abilities as four ink bars, virtues as three rows of ink dots, skills as small stamps, a loyalty bar with its resting level and status label, and for late joiners a "Whereabouts unknown" strip stating the trigger in plain words (D19).
- **Stamps** (the vocabulary): a stamp is a rectangle or rounded square with a double ink rule, text in Alfa Slab One caps, slightly rotated (-4 to 3 degrees, fixed per stamp so it never jitters), `mix-blend-mode: multiply` on paper. Pressed state: scale 0.96, ink darkens. Variants: **ORDER** (indigo; every command row), **CONFIRM** (indigo, large; the second step of a command), **REFUSED** (cinnabar; a rejected action, with the rule id), **PAID / SWORN / FREED** (indigo or jade; log decorations), **DUSK** (battle end-of-day), **LAST DAYS** (cinnabar, the final 3 battle days).
- **Seals** are limited to one place: the **Edict** chop, a square indigo carved-seal block with the character 詔 shown when the Edict is granted. It is flat, never wax.
- **Disabled orders** keep their shape, lose the ink (paper-dim fill, dashed rule) and show their reason line (`query.why`) under them.

## 6. Motion

- Speed setting: **Slow 1.0, Normal 0.55, Fast 0.25, Instant 0** (a multiplier of every duration). Instant also applies state at once (used by e2e).
- Lantern flicker: 6s opacity breathing on the vignette, 3% amplitude; disabled by `prefers-reduced-motion`.
- Stamp press: 120 ms scale and ink fade. Brush-in for panels: 180 ms clip reveal from the left.
- **Presentation director:** the store applies a step result to `state` at once and queues its events; the screen shows a **presented-state cursor** that trails `state` and advances one event at a time (month report ticker on the map, unit-by-unit moves on the board). A **Skip** button and the Space key jump to the end. Input is locked while the cursor trails, except Skip.
- Battle figures slide between hexes (one hex per 140 ms at Normal), flash on a hit and sink on a rout. Camera never moves on its own except a 400 ms ease to a new focus when the cursor reaches an event.

## 7. Layouts

Breakpoint: **wide** at 900 px and above, **phone** below. The page never scrolls; panels scroll inside themselves.

### 7.1 Title
Wide and phone alike: night marsh, the lantern vignette, a paper scroll in the centre-left with the wordmark "Liangshan" (Alfa Slab One, 44 px) and "108 Stars" beneath, the Chinese 梁山 in brush weight, and a reed line along the bottom. Buttons are stamps stacked in a ledger column: **Continue** (shows what it reopens: chieftain, date, prefectures, heroes, Renown and Edict status, whose turn, saved time; KB rule 22), **New game**, **How to play**, **Settings**. A corrupt or unreadable save replaces Continue with a REFUSED stamp stating why and a **Discard** stamp. Footer: "Unofficial, non-commercial fan project; not affiliated with Koei Tecmo. By evilgouki."

### 7.2 Start picker
Six chieftain posters in a row (wide) or a horizontal snap list (phone). Each shows name, Chinese name, nickname, the start prefecture, the S-1 numbers (gold, food, men, arms, training, support, Renown), a situation line, the neighbouring factions, and the first advisor hints (S-2). Under the posters, a **difficulty** strip of four stamps (Easy, Normal, Hard, Brutal), each stating its deadline in months and its last month and the Edict-by month (S-3, S-5, C2). A seed field is hidden behind "Advanced". **Begin** (CONFIRM) opens the briefing (S-7): goal, deadline, the six systems to watch.

### 7.3 Strategic screen (wide)
```
+--------------------------------------------------------------+
| HUD: month year | deadline N months | Renown n (+t) Edict by.. | menu |
+----------------------------------------------+---------------+
|                                              |  tabs:        |
|        oiled-paper map (SVG, pan/zoom)      |  Prefecture   |
|        48 prefectures, links, flags          |  Heroes       |
|                                              |  Ledger       |
|   [warnings strip]       [advice strip]      |  Log  Help    |
+----------------------------------------------+---------------+
| month ticker (events as they play) | End the month (stamp)   |
+--------------------------------------------------------------+
```
- **HUD (always visible):** month and year; the deadline as "N months left, last month Dec 1112"; Renown with its trend arrow and number, the **projected Edict date**, the required and current rate, and a status lamp (green, amber, red) with the words (R-7, R-8, C2); the R-10 banner when it applies. After the Edict: the chop and "Edict granted <date>".
- **Map:** SVG on oiled paper. Prefecture `pos` (0-1) maps to the view box. Links drawn by kind: road (solid ink), river (teal wash, wave), marsh-water (teal dashed with reed ticks), mountain pass (ink zigzag). Snowed-in links show a pale hatch. The capital label is "Dongjing" with a padlock-less **protected** tag (a paper tab reading "Protected until the Edict") until the Edict, then an open gate. Gao Qiu's refuge links, once the Edict is granted, show **open** (dashed ink arrow) or **cut** (a crossed stamp) (G-8, `query.escapeRoutes`). Selected prefecture glows lantern-amber; targets of a pending attack pulse.
- **Warnings strip:** `view.warnings` a month ahead, red then amber, each clickable to its prefecture (C9). **Advice strip:** `view.advice.hints`, pinned in months 1-3 (S-6).
- **Prefecture panel:** name, Chinese name, owner, the economy numbers with runway (E-9), heroes present as small poster tabs, commands left (T-3), then the **orders** from `legalActions`, grouped: Govern (levy, train, forge, dykes, relieve, rest), Trade, Hunt, Recruit, Oath, March (move, send, attack, ally), Spy. Each order is a stamp row; pressing it opens a **prompt** that names what it decides ("Choose who levies, and see the cost") with the `query.preview` text, cost, odds, and a CONFIRM stamp (T-10). A disabled order shows the `query.why` reason.
- **Roster tab:** a grid of posters, filterable (mine, free, court, all), sortable (star, name, loyalty). All heroes, with the story trigger shown for late joiners (D19).
- **Ledger tab:** Renown ledger grouped in the five columns of R-4 (justice, relief, beasts and bandits, battles, heroes) with column totals over the last 24 months, entries below with rule ids (C1).
- **Log tab:** every event since the game started, newest first, never auto-dismissed, filterable by kind, scrollable (C8, V-9).
- **Help tab:** short in-game help (C13): the goal, the month, the six systems, brotherhood, battles, saving.

### 7.4 Strategic screen (phone)
The map fills the screen. The HUD is two rows (month and deadline; Renown and status lamp). A bottom **sheet** with a drag handle and five icon-less labelled tabs (Prefecture, Heroes, Ledger, Log, Help) rises to 60% height. The End-the-month stamp sits in a fixed bar above the sheet handle. Map: pinch zoom and one-finger pan; tapping a prefecture selects it and raises the sheet.

### 7.5 Decisions and results
A pending decision (`state.pending`: captive, tiger, inspection, convoy, duel offer, flight choice) is a paper note over the map, naming what it decides and listing the options as stamps with the numbers it shows (captive: the persuasion odds). Game end is a full-screen ledger page: outcome, ending name, date, Renown, heroes, prefectures; it clears the save.

### 7.6 Battle screen
Wide: the 3D board fills the window; the left plank column shows the **day clock** ("Day 7 of 20", the last three days with a cinnabar LAST DAYS stamp and a lit lamp strip), food of both sides, weather and wind, the reinforcement-wave line at the capital ("Wave 1 in 3 days", then "arrived: n units"), and the unit list of the acting side. The right column is the **unit card** of the selected unit (men, morale, fatigue with its causes, skills, guard). Along the bottom: the actions of the selected unit as stamps (Move is a tile click, not a button), **Wait**, **End the day** and **Auto-resolve** (W-28, with confirmation), **Withdraw** where legal. Phone: the columns collapse into a top strip (day, side), a bottom card with the selected unit, and a row of stamps.

Interaction (KB rules 25, 27): tiles are the only pick target. A tap resolves in one place: the legal action for that hex first (move there; attack, volley or charge whatever stands there; with a duel stamp armed, duel it), otherwise select the unit standing on it, otherwise clear. Hovering a tile shows the card of the unit on it with odds (`query.attackPreview`, `duelOdds`, `captureOdds`, `fatigue`). Reachable hexes are tinted from `query.moveRange`; attackable hexes carry a cinnabar ring. Figures, bars and rings have no pointer handlers. Mouse: wheel zooms towards the cursor; right drag rotates; middle drag pans; left drag pans until the first middle press proves the mouse has one (stored under `ls108-mouse-mid`), then the left only picks. Touch: one finger pans, two twist and pinch. Duels and captures ask for confirmation with the odds in the prompt before anything is sent (W-17..W-19).

Battle end: a paper result strip (winner, reason, prisoners) then back to the map. The presented-state cursor animates AI sides' moves unit by unit; Skip finishes them.

## 8. Settings, save, footer

- **Settings:** speed (Slow, Normal, Fast, Instant); "Show battles the AI fights without me in the month report" (default off: the engine resolves them inside the month and only the result is listed; there is no per-move record to play back).
- **Autosave** (KB rule 22): after every accepted action and at game start, under `ls108-save` (RULING in PLAN: the Arch file names `liangshan108.save.v1`; the brief fixes `ls108-save`). Refused storage shows a line in the HUD. A finished game clears its save.
- **Footer** on the title, the help tab and the end page: "Unofficial, non-commercial fan project; not affiliated with Koei Tecmo. By evilgouki."
- **Text selection** (KB rule 24): the base stylesheet disables selection, callout and tap highlight, plus `selectstart` and `contextmenu` listeners on `document` except in inputs.

## 9. Evidence checklist (stage 3)

Screenshots at deviceScaleFactor 2 in `docs/screenshots/m3/`: title, start picker, strategic map, roster, battle at desktop 1440x900 and phone 390x844; plus a side-by-side sheet against three-kingdoms-tactics (title, map, battle). If the pairs could be mistaken, the stage is not done (KB rule 21).
