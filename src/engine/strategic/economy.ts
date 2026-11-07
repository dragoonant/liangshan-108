// E rules: formulas for tax, harvest, planting, upkeep, trade, levy.
import { season } from '../calendar'
import type { Ctx } from '../ctx'
import { ps, has, abil, anyHas, foodUpkeep } from '../ctx'
import { clamp } from '../util'

export const armedRatio = (men: number, arms: number): number => (men <= 0 ? 100 : Math.min(100, Math.floor((100 * arms) / men)))

/** E-4 */
export function taxOf(c: Ctx, pref: string): number {
  const p = ps(c, pref)
  let tax = Math.floor((Math.floor(p.pop / 1000) * p.land * (50 + p.support)) / 5000)
  if (anyHas(c, pref, 'scribe')) tax = Math.floor((tax * 110) / 100)
  return tax
}
/** E-6 (drought and locusts applied by the caller) */
export function harvestOf(c: Ctx, pref: string): number {
  const p = ps(c, pref)
  let h = Math.floor((Math.floor(p.pop / 1000) * p.land * (50 + p.support)) / 450)
  if (p.drought) h = Math.floor((h * 60) / 100)
  return h
}
/** E-7 */
export const seedOf = (c: Ctx, pref: string): number => { const p = ps(c, pref); return Math.floor((Math.floor(p.pop / 1000) * p.land) / 50) }

export function wagesOf(c: Ctx, pref: string): number {
  const p = ps(c, pref)
  const ordinary = p.heroes.filter((h) => c.s.heroes[h]?.faction === 'player' && c.s.heroes[h]?.status === 'ordinary').length
  return Math.ceil(p.men / 20) + 5 * ordinary
}

/** E-9: months of food at the upkeep of the current month (season factor, storm). */
export function runway(c: Ctx, pref: string): number {
  const u = foodUpkeep(c, pref)
  if (u <= 0) return 99
  return Math.round((ps(c, pref).food / u) * 10) / 10
}

/** E-13 price of 10 food in gold when buying. */
export function priceOf(t: number): number {
  const s = season(t)
  return s === 'autumn' ? 3 : s === 'winter' ? 5 : s === 'spring' ? 6 : 5
}
export function tradeBonus(c: Ctx, actor: string): number {
  return Math.floor(abil(c, actor).cunning / 10) + (has(c, actor, 'horse-trader') ? 20 : 0)
}
export function tradeValue(c: Ctx, actor: string, dir: 'buyFood' | 'sellFood', amount: number): number {
  const price = priceOf(c.s.t)
  const bonus = tradeBonus(c, actor)
  if (dir === 'buyFood') return Math.floor((Math.floor((amount * price) / 10) * (100 - bonus)) / 100)
  return Math.floor((Math.floor((amount * price * 7) / 100) * (100 + bonus)) / 100)
}

/** E-12 levy */
export function levyAmount(c: Ctx, pref: string, actor: string): number {
  const p = ps(c, pref)
  let n = Math.floor((Math.floor(p.pop / 200) * (40 + p.support)) / 100)
  n = Math.floor((n * (100 + Math.floor(abil(c, actor).command / 5))) / 100)
  if (has(c, actor, 'spearman')) n = Math.floor((n * 110) / 100)
  n = Math.min(n, Math.floor(p.pop / 20) - p.men, p.gold)
  return Math.max(0, n)
}
export const trainGain = (c: Ctx, actor: string): number => 8 + Math.floor(abil(c, actor).command / 10) + (has(c, actor, 'drillmaster') ? 5 : 0)
export const clampPct = (x: number): number => clamp(0, 100, x)
