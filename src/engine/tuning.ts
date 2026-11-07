// Balance knobs (PLAN D16, B1). The defaults ARE the rules in docs/spec/10-rules.md; tools/sim.ts may override them for an experiment
// with `setTuning` before it creates any game. The engine never changes them, so replays stay exact as long as a run keeps one setting.
export interface Tuning {
  edict: number // R-5 Renown needed for the Edict
  hostBase: number; hostPerMonth: number; hostMax: number // G-4 host(t) = min(max, base + perMonth * t)
  taxPct: number // E-4 tax multiplier, percent
  harvestPct: number // E-6 harvest multiplier, percent
  wagePct: number // E-5 gold wages multiplier, percent
  upkeepPct: number // E-5 food upkeep multiplier, percent
  joinRenown: number // R-2 Renown per hero joined (heavenly: +1 more)
  reliefRenown: number // R-2 relief
  huntRenown: number // R-2 bandits broken
  conquestSupport: number // W-27 support lost by a conquered prefecture
  musterDiv: number // G-3 monthly muster = pop / musterDiv
  musterCapDiv: number // G-3 muster cap = pop / musterCapDiv
  inviteLoyalty: number // H-10 base loyalty of an invited hero (40) or a conquered garrison hero
  inviteOdds: number // Q-2 flat bonus to invite odds
}
export const DEFAULT_TUNING: Tuning = {
  edict: 300, hostBase: 1500, hostPerMonth: 15, hostMax: 9000, taxPct: 100, harvestPct: 100, wagePct: 70, upkeepPct: 70, joinRenown: 4, reliefRenown: 4, huntRenown: 5, conquestSupport: 5, musterDiv: 2000, musterCapDiv: 60, inviteLoyalty: 55, inviteOdds: 10,
}
export const TUNE: Tuning = { ...DEFAULT_TUNING }
export function setTuning(p: Partial<Tuning>): void { Object.assign(TUNE, DEFAULT_TUNING, p) }
