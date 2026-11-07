// Read-only lookups over the data bundle (names, records). No rules maths lives here.
import { defaultBundle } from '../data'
import type { HeroRecord, PrefectureRecord } from '../data'

const heroes = new Map<string, HeroRecord>()
for (const h of [...defaultBundle.heroes, ...defaultBundle.extra, ...defaultBundle.court, ...defaultBundle.rivals]) heroes.set(h.id, h)
const prefs = new Map<string, PrefectureRecord>(defaultBundle.map.prefectures.map((p) => [p.id, p]))

export const heroRec = (id: string): HeroRecord | undefined => heroes.get(id)
export const heroName = (id: string): string => heroes.get(id)?.name ?? (id.startsWith('cap-') ? 'Garrison captain' : id)
export const prefRec = (id: string): PrefectureRecord | undefined => prefs.get(id)
export const prefName = (id: string): string => prefs.get(id)?.name.replace(/\s*\(.*\)$/, '') ?? id
export const allHeroIds = (): string[] => [...defaultBundle.heroes, ...defaultBundle.extra, ...defaultBundle.court].map((h) => h.id)
export const allPrefectures = (): PrefectureRecord[] => defaultBundle.map.prefectures
export const links = (): typeof defaultBundle.map.links => defaultBundle.map.links
export const skillName = (id: string): string => defaultBundle.skills.find((s) => s.id === id)?.name ?? id
export const skillEffect = (id: string): string => defaultBundle.skills.find((s) => s.id === id)?.effect ?? ''
export const campRec = (id: string) => defaultBundle.camps.find((c) => c.id === id)
export const rivalName = (id: string): string | undefined => {
  const r = defaultBundle.rivals.find((h) => (h.faction ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === id)
  return r?.faction
}
export function ownerName(owner: string): string {
  if (owner === 'player') return 'You'
  if (owner === 'court') return "Gao Qiu's court"
  if (owner === 'free') return 'Unclaimed'
  return campRec(owner)?.name ?? rivalName(owner) ?? owner
}
export const ownerLetter = (owner: string): string => (owner === 'player' ? '' : owner === 'court' ? 'C' : owner === 'free' ? '' : ownerName(owner).charAt(0).toUpperCase())

const CAMP_COLOURS = ['#7a5aa0', '#a8742c', '#3f7fa5', '#9b5c78', '#5d8a3c', '#b0643a', '#4f6f6c', '#6d6a92']
const RIVAL_COLOURS = ['#c08a2b', '#a2512f', '#2f6f9b']
export function ownerColour(owner: string): string {
  if (owner === 'player') return '#2f9c78'
  if (owner === 'court') return '#8c3d33'
  if (owner === 'free') return '#9a9275'
  const ci = defaultBundle.camps.findIndex((c) => c.id === owner)
  if (ci >= 0) return CAMP_COLOURS[ci % CAMP_COLOURS.length]!
  let h = 0
  for (const ch of owner) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return RIVAL_COLOURS[h % RIVAL_COLOURS.length]!
}
