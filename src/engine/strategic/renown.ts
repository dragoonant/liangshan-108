// R rules: ledger, gains and losses (R-1..R-4).
import type { Ctx } from '../ctx'
import { emit } from '../ctx'
import type { LedgerColumn } from '../types'

export function addRenown(c: Ctx, amount: number, pref: string, rule: string, column: LedgerColumn, text: string): void {
  if (amount === 0) return
  const f = c.s.factions['player']!
  f.renown = Math.max(0, f.renown + amount)
  f.ledger.push({ t: c.s.t, pref, amount, rule, column, text })
  const cut = c.s.t - 24
  if (f.ledger.length > 400) f.ledger = f.ledger.filter((e) => e.t >= cut)
  emit(c, 'renown', rule, `Renown ${amount > 0 ? '+' : ''}${amount}: ${text}`, pref, amount)
}
