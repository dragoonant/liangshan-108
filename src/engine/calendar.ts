import type { GameState, Difficulty } from './types'

export const monthOf = (t: number): number => (t % 12) + 1
export const yearOf = (t: number): number => 1101 + Math.floor(t / 12)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const label = (t: number): string => `${MONTHS[monthOf(t) - 1]} ${yearOf(t)}`
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export function season(t: number): Season {
  const m = monthOf(t)
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}
export const isWinter = (t: number): boolean => season(t) === 'winter'

export const DEADLINE: Record<Difficulty, number> = { 1: 180, 2: 144, 3: 108, 4: 84 }
export const AI_RATIO: Record<Difficulty, number> = { 1: 1.6, 2: 1.3, 3: 1.1, 4: 0.9 }
export const CAMPAIGN_K: Record<Difficulty, number> = { 1: 14, 2: 10, 3: 7, 4: 5 }
export const EDICT = 500
export const lastT = (s: Pick<GameState, 'setup'>): number => DEADLINE[s.setup.difficulty] - 1
export const edictBy = (s: Pick<GameState, 'setup'>): number => lastT(s) - 17
