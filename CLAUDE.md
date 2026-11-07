# Liangshan: 108 Stars — agent orientation

An original browser strategy game in the world of the public-domain novel *Water Margin*: a spiritual successor to Koei's 1989 *Bandit Kings of Ancient China*, not a port, not affiliated with Koei Tecmo. Owner credit: **evilgouki**. Never write the owner's real name, email or home path into this repo.

- **Read first:** `PLAN.md` (decisions D1-D15, pillars, milestones), `STATUS.md`, `docs/research/original-complaints.md` (C1-C13, each must be answered by a rule), `docs/spec/00-architecture.md` (frozen contracts), `docs/spec/10-rules.md` (rules with ids).
- **Knowledge base:** private repo `dragoonant/tabletop-kb` (submodule at `docs/knowledge-base/`; `git submodule update --init`. This game's entry, `liangshan-108.md`, is on the KB branch `claude/inspiring-hypatia-73p6th` until that is merged). Its `rules.md` lists the owner's standing rules; apply them without re-asking. Update its entry for this game at the end of every milestone.
- **Engine rules:** `src/engine` is pure and deterministic (no DOM, React, three or `Math.random`). `step` never throws, `legalActions` is never empty before the result, and `query.*` owns every number the UI shows. State is plain JSON.
- **Rules changes:** edit `10-rules.md` first, log it in PLAN.md "Rulings / balance log", then change the code. Tests are named by rule id.
- **IP:** people, places and nicknames from the novel; all prose, system names, UI and art are ours. Never use Koei's titles, names, art, music, UI or numbers.
- **Commands:** `npm run dev | typecheck | test | build | e2e | validate:data | sim`. Playwright uses `/opt/pw-browsers/chromium` when it exists. Set `PW_PORT` per worktree.
- **Git:** repo `dragoonant/liangshan-108`. Commit and push to `main` after each stage (PLAN D1; GitHub Pages deploys every push). Gate the commit, not the working tree. While agents run, commit only your own paths (`git commit -- <paths>`). The orphan branch `claude/inspiring-hypatia-73p6th` on three-kingdoms-tactics was the temporary home until 2026-11-07 and is now stale.
