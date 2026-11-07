// Typed shapes of data/*.json (schemas in data/schema, contract in docs/spec/20-data-schema.md).
export type SkillId =
  | 'spearman' | 'swordsman' | 'archer' | 'horseman' | 'marine' | 'swimmer' | 'scout' | 'thief'
  | 'strategist' | 'scribe' | 'physician' | 'smith' | 'builder' | 'horse-trader' | 'innkeeper'
  | 'monk' | 'sorcerer' | 'drillmaster' | 'firebrand' | 'forger' | 'runner' | 'beast-slayer'

export interface Abilities { might: number; command: number; cunning: number; vigour: number }
export interface Virtues { righteousness: number; compassion: number; daring: number }
export type StartStatus = 'free' | 'official' | 'outlaw' | 'captive-of-court'

export interface HeroRecord {
  id: string
  name: string
  nameZh: string
  nickname?: string
  nicknameZh?: string
  star?: { rank: number; group: 'heavenly' | 'earthly'; nameZh: string; name: string }
  abilities: Abilities
  virtues: Virtues
  skills: SkillId[]
  start: { status: StartStatus; prefecture: string; year: number }
  joinsLate: boolean
  joinTrigger?: string
  office?: string
  faction?: string
  stronghold?: string
  rationale: string
  source: string
}

export interface SkillRecord { id: SkillId; name: string; effect: string; source: string }

export type Terrain = 'plains' | 'hills' | 'mountains' | 'marsh' | 'river-delta' | 'coast'
export type Seat = 'city' | 'town' | 'fortress' | 'stronghold'
export type LinkKind = 'road' | 'river' | 'marsh-water' | 'mountain-pass'

export interface PrefectureRecord {
  id: string
  name: string
  nameZh: string
  circuit: string
  pos: { x: number; y: number }
  lon: number
  lat: number
  terrain: Terrain
  seat: Seat
  base: { population: number; land: number; flood: number }
  special: string[]
  note: string
  source: string
}
export interface LinkRecord { a: string; b: string; kind: LinkKind }
export interface MapRecord { prefectures: PrefectureRecord[]; links: LinkRecord[] }

export type TriggerKind = 'renown' | 'own' | 'battle-won-at' | 'attacked' | 'defeated-hero' | 'brother' | 'campaign-announced'
export interface TriggerRecord { hero: string; kind: TriggerKind; min?: number; prefecture?: string; target?: string; source: string }

/** Everything the engine reads. The engine takes this as an argument (createGame's `data`). */
export interface DataBundle {
  heroes: HeroRecord[]
  court: HeroRecord[]
  rivals: HeroRecord[]
  skills: SkillRecord[]
  map: MapRecord
  triggers: TriggerRecord[]
}
