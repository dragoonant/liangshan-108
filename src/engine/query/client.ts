// Queries the client needs that view/query did not expose yet (M3). Pure reads; every number comes from the engine.
import type { GameState, Difficulty, LedgerColumn, LedgerEntry, Terr } from '../types'
import { createGame, STARTS } from '../setup'
import { defaultBundle } from '../data'
import type { DataBundle } from '../../data'
import { mkCtx, heroName, prefName } from '../ctx'
import { DEADLINE, edictBy as edictByOf, label, lastT } from '../calendar'
import { TERR } from '../battle/terrain'
import { query } from './index'
import { TUNE } from '../tuning'
import { tigerOdds } from '../strategic/events'
import { getUnit } from '../battle/core'
import { duelWin } from '../battle/actions'

export interface StartInfo {
  hero: string; prefecture: string; prefectureName: string
  gold: number; food: number; men: number; arms: number; training: number; support: number; renown: number
  neighbours: { id: string; name: string; owner: string; ownerName: string }[]
  followers: string[]
  hints: string[]
  pending: string | null
}
export interface DifficultyInfo { difficulty: Difficulty; months: number; lastLabel: string; edictByLabel: string; edictMonthsFromStart: number }
export interface PendingOption { id: string; label: string; detail: string; pct?: number }
export interface PendingInfo { kind: string; title: string; ask: string; pref?: string; options: PendingOption[] }
export interface LedgerColumnView { column: LedgerColumn; total: number; entries: LedgerEntry[] }

const COLUMNS: LedgerColumn[] = ['justice', 'relief', 'beasts', 'battles', 'heroes']
const OWNER_NAMES: Record<string, string> = { player: 'You', court: "Gao Qiu's court", free: 'Unclaimed' }

export const clientQuery = {
  /** S-1, S-2: the numbers of a start row, its neighbours and the first hints. */
  startInfo(startHero: string, data: DataBundle = defaultBundle): StartInfo | null {
    const row = STARTS[startHero]
    if (!row) return null
    const s = createGame({ startHero, difficulty: 2, seed: 1 }, data)
    const c = mkCtx(s, data)
    const seen = new Set<string>()
    const neighbours: StartInfo['neighbours'] = []
    for (const n of c.x.adj[row.pref] ?? []) {
      if (seen.has(n.to)) continue
      seen.add(n.to)
      const owner = s.prefectures[n.to]!.owner
      const camp = c.x.campOf[owner]
      const rival = c.x.rivals.find((r) => r.id === owner)
      neighbours.push({ id: n.to, name: prefName(c, n.to), owner, ownerName: OWNER_NAMES[owner] ?? camp?.name ?? rival?.name ?? owner })
    }
    const followers = Object.keys(s.heroes).filter((h) => s.heroes[h]!.faction === 'player' && s.heroes[h]!.status === 'ordinary').map((h) => heroName(c, h))
    return {
      hero: startHero, prefecture: row.pref, prefectureName: prefName(c, row.pref),
      gold: row.gold, food: row.food, men: row.men, arms: row.arms, training: row.training, support: row.support, renown: row.renown,
      neighbours, followers, hints: query.advice(s, data).hints.map((h) => h.text), pending: s.pending?.kind ?? null,
    }
  },
  /** S-3, S-5: the deadline each difficulty sets. */
  difficulties(): DifficultyInfo[] {
    return ([1, 2, 3, 4] as Difficulty[]).map((d) => {
      const probe = { setup: { startHero: 'song-jiang', difficulty: d, seed: 1 } }
      return { difficulty: d, months: DEADLINE[d], lastLabel: label(lastT(probe)), edictByLabel: label(edictByOf(probe)), edictMonthsFromStart: edictByOf(probe) }
    })
  },
  /** R-4: the five ledger columns with totals over the last 24 months. */
  ledger(s: GameState): LedgerColumnView[] {
    const from = s.t - 24
    const all = s.factions['player']!.ledger.filter((e) => e.t >= from)
    return COLUMNS.map((column) => {
      const entries = all.filter((e) => e.column === column).sort((a, b) => b.t - a.t)
      return { column, total: entries.reduce((n, e) => n + e.amount, 0), entries }
    })
  },
  /** D19: the story trigger of a late joiner in plain words, or null. */
  triggerText(hero: string, data: DataBundle = defaultBundle): string | null {
    const t = data.triggers.find((x) => x.hero === hero)
    if (!t) return null
    const c = mkCtx(createGame({ startHero: 'song-jiang', difficulty: 2, seed: 1 }, data), data)
    const nm = (id?: string): string => (id ? (c.x.hero[id] ? heroName(c, id) : prefName(c, id)) : '?')
    switch (t.kind) {
      case 'renown': return `Appears when your Renown reaches ${t.min}`
      case 'own': return `Appears when you hold ${nm(t.prefecture)}`
      case 'battle-won-at': return `Appears after you win a battle at ${nm(t.prefecture)}`
      case 'attacked': return `Appears when ${nm(t.prefecture)} is attacked`
      case 'defeated-hero': return `Appears after you defeat ${nm(t.target)}`
      case 'brother': return `Appears after ${nm(t.target)} swears brotherhood with you`
      case 'campaign-announced': return 'Appears when the court announces its first campaign'
    }
    return null
  },
  /** W-6: terrain costs and defence for the hover card and legend. */
  terrain(t: Terr): { move: { infantry: number; cavalry: number; boats: number }; defence: number; burns: boolean; hides: boolean; height: number } {
    const i = TERR[t]
    return { move: { infantry: i.inf, cavalry: i.cav, boats: i.boat }, defence: i.def, burns: i.flammable, hides: i.hides, height: i.height }
  },
  /** R-5: the Edict threshold. */
  edictThreshold(): number { return TUNE.edict },
  /** The open decision: what it decides and every option with the number behind it (Z-4, T-10). */
  pendingInfo(s: GameState, data: DataBundle = defaultBundle): PendingInfo | null {
    const pd = s.pending
    if (!pd) return null
    const c = mkCtx(s, data)
    const d = pd.data as Record<string, unknown>
    const pref = typeof d['pref'] === 'string' ? (d['pref'] as string) : undefined
    const base = { kind: pd.kind, ...(pref ? { pref } : {}) }
    if (pd.kind === 'tiger') {
      return { ...base, title: 'A man-eating tiger', ask: `Decide who hunts the tiger near ${pref ? prefName(c, pref) : 'here'}, or leave it be.`, options: pd.options.map((o) => o === 'ignore'
        ? { id: o, label: 'Leave it be', detail: 'No risk, no reward.' }
        : { id: o, label: `${heroName(c, o)} hunts it`, detail: 'Success earns Renown and support; failure wounds the hunter for 2 months.', pct: tigerOdds(c, o) }) }
    }
    if (pd.kind === 'inspection') {
      return { ...base, title: 'An imperial inspector', ask: 'Decide how to meet the inspector from the court.', options: pd.options.map((o) => o === 'bribe'
        ? { id: o, label: 'Bribe him', detail: 'Costs 300 gold. Nothing else happens.' }
        : { id: o, label: 'Turn him away', detail: "The court's next campaign comes 2 months sooner. Renown +2 if the inspector is corrupt." }) }
    }
    if (pd.kind === 'convoy') {
      return { ...base, title: 'A convoy on the road', ask: 'Decide whether to take the convoy.', options: pd.options.map((o) => o === 'take'
        ? { id: o, label: 'Take it', detail: 'Gold +3000. Renown +3 if it belongs to a corrupt minister.' }
        : { id: o, label: 'Let it pass', detail: 'Nothing happens.' }) }
    }
    if (pd.kind === 'captive') {
      const cap = String(d['captive'])
      const actor = String(d['actor'])
      const odds = ((): number | undefined => { try { return query.recruitOdds(s, actor, cap, 'persuade', data).pct } catch { return undefined } })()
      const L: Record<string, [string, string]> = {
        persuade: ['Persuade him to join', 'Rolled once now; the odds are shown.'],
        release: ['Release him', 'He goes free.'],
        hold: ['Hold him in prison', 'You may try to persuade him in a later month.'],
        execute: ['Execute him', 'Renown -3.'],
      }
      return { ...base, title: `Captive: ${heroName(c, cap)}`, ask: `Decide the fate of ${heroName(c, cap)}.`, options: pd.options.map((o) => ({ id: o, label: L[o]?.[0] ?? o, detail: L[o]?.[1] ?? '', ...(o === 'persuade' && odds !== undefined ? { pct: odds } : {}) })) }
    }
    if (pd.kind === 'duelOffer' && s.battle) {
      const ch = getUnit(s.battle, String(d['unit'])), tg = getUnit(s.battle, String(d['target']))
      const stake = String(d['stake'])
      const win = ch && tg ? duelWin(tg, ch).win : undefined
      return { ...base, title: 'A challenge', ask: `${ch ? heroName(c, ch.hero) : 'An enemy'} challenges ${tg ? heroName(c, tg.hero) : 'your unit'} to a duel for ${stake === 'capture' ? 'capture' : 'honour'}.`, options: pd.options.map((o) => o === 'accept'
        ? { id: o, label: 'Accept the duel', detail: 'The loser is hurt and tired; a capture stake may take him prisoner.', ...(win !== undefined ? { pct: win } : {}) }
        : { id: o, label: 'Decline', detail: 'Declining costs morale.' }) }
    }
    return { ...base, title: 'A decision', ask: 'Choose one.', options: pd.options.map((o) => ({ id: o, label: o, detail: '' })) }
  },
}
