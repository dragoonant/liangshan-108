// G rules: muster, host, campaigns, edict garrison.
import { CAMPAIGN_K } from '../calendar'
import { TUNE } from '../tuning'
import type { Ctx } from '../ctx'
import { abil, EMPEROR, emit, GAO_QIU, hs, place, prefName, ps, rank, snowedIn } from '../ctx'
import { startBattle } from '../battle/setup'

export const host = (t: number): number => Math.min(TUNE.hostMax, TUNE.hostBase + TUNE.hostPerMonth * t)

/** G-3, G-4 */
export function musterCourt(c: Ctx): void {
  const s = c.s
  const f = s.factions['court']!
  for (const id of c.x.order) {
    const p = ps(c, id)
    if (p.owner !== 'court') continue
    const cap = Math.floor(p.pop / TUNE.musterCapDiv)
    const add = Math.max(0, Math.min(Math.floor(p.pop / TUNE.musterDiv), cap - p.men))
    p.men += add; p.arms += add
  }
  const capital = ps(c, c.x.capital)
  if (capital.owner === 'court') {
    const want = Math.min(host(s.t), Math.floor(capital.pop / 20))
    if (capital.men < want) { capital.arms += want - capital.men; capital.men = want }
    if (f.edictBuild > 0 && s.factions['player']!.edict !== null) {
      const goal = Math.min(6000, Math.floor(capital.pop / 20))
      if (capital.men < goal) {
        const add = Math.ceil((goal - capital.men) / f.edictBuild)
        capital.men += add; capital.arms += add
      }
      f.edictBuild--
    }
  }
}

export function factionPower(c: Ctx, fid: string): number {
  let men = 0, heroes = 0, prefs = 0
  for (const id of c.x.order) {
    const p = ps(c, id)
    if (p.owner !== fid) continue
    prefs++; men += p.men; heroes += p.heroes.filter((h) => h !== EMPEROR && hs(c, h).faction === fid).length
  }
  return men + 500 * heroes + 300 * prefs
}

/** G-6 announce at month end. */
export function maybeAnnounce(c: Ctx): void {
  const s = c.s
  const f = s.factions['court']!
  if (f.campaign || s.t < f.nextCampaign) return
  const alert = Math.floor(s.factions['player']!.renown / 100)
  const k = Math.max(3, CAMPAIGN_K[s.setup.difficulty] - alert)
  f.nextCampaign = s.t + k
  const cands = ['player', ...Object.keys(s.factions).filter((x) => x !== 'player' && x !== 'court' && s.factions[x]!.alive).sort()]
    .filter((x) => c.x.order.some((p) => ps(c, p).owner === x))
  let target = ''
  let best = -1
  for (const x of cands) { const pw = factionPower(c, x); if (pw > best) { best = pw; target = x } }
  if (!target) return
  let objective = '', staging = '', low = 1e9
  for (const id of c.x.order) {
    if (ps(c, id).owner !== target) continue
    for (const n of c.x.adj[id] ?? []) {
      if (ps(c, n.to).owner !== 'court' || snowedIn(c, n.to, id, s.t + 1)) continue
      const m = ps(c, id).men
      if (m < low || (m === low && id < objective)) { low = m; objective = id; staging = n.to }
      else if (id === objective && ps(c, n.to).men > ps(c, staging).men) staging = n.to
    }
  }
  if (!objective) return
  f.campaign = { staging, objective, target, announcedT: s.t }
  if (!s.fired.includes('campaign')) s.fired.push('campaign')
  emit(c, 'campaign', 'G-6', `The court musters at ${prefName(c, staging)} to march on ${prefName(c, objective)} next month`, objective)
}

/** G-6 march, run in the court's phase the month after the announcement. */
export function marchCampaign(c: Ctx): void {
  const s = c.s
  const cp = s.factions['court']!.campaign
  if (!cp || cp.announcedT >= s.t) return
  const obj = ps(c, cp.objective), stg = ps(c, cp.staging)
  if (obj.owner !== cp.target || stg.owner !== 'court') { s.factions['court']!.campaign = null; emit(c, 'campaignCancelled', 'G-6', 'The campaign is called off: the situation changed'); return }
  if (obj.fought || snowedIn(c, cp.staging, cp.objective)) return
  const gov = new Set(c.x.order.filter((p) => p !== cp.staging && ps(c, p).owner === 'court').map((p) => ps(c, p).governor).filter(Boolean) as string[])
  const pool = Object.keys(s.heroes).filter((h) => {
    const x = s.heroes[h]!
    return x.faction === 'court' && x.status === 'ordinary' && x.loc && h !== EMPEROR && h !== GAO_QIU && !gov.has(h) && c.x.kindOf[h] === 'court' && (x.loc === cp.staging || x.loc === c.x.capital)
  }).sort((p, q) => abil(c, q).command - abil(c, p).command || rank(c, p) - rank(c, q) || (p < q ? -1 : 1)).slice(0, 4)
  const men = Math.min(Math.floor(host(s.t) / 2), stg.men)
  s.factions['court']!.campaign = null
  if (!pool.length || men < 300) { emit(c, 'campaignCancelled', 'G-6', 'The host could not be mustered: the campaign is called off'); return }
  for (const h of pool) if (hs(c, h).loc !== cp.staging) place(c, h, cp.staging)
  emit(c, 'campaignMarch', 'G-6', `The imperial host (${men} men) marches from ${prefName(c, cp.staging)} on ${prefName(c, cp.objective)}`, cp.objective)
  startBattle(c, { attacker: 'court', origin: cp.staging, target: cp.objective, heroes: pool, men, imperial: true })
}
