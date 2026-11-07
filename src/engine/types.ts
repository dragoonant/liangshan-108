// Engine types (docs/spec/00-architecture.md). State is plain JSON: no classes, Maps, Sets, undefined or NaN.
export type Faction = string // 'player' | 'court' | 'free' | rival id
export type Seat = 'player' | 'observer'
export type Difficulty = 1 | 2 | 3 | 4
export interface Hex { q: number; r: number }

export interface Setup { startHero: string; difficulty: Difficulty; seed: number }

export type HeroStatus = 'chieftain' | 'sworn' | 'ordinary' | 'free' | 'captive' | 'dormant'
export interface HeroState {
  faction: Faction // who the hero serves or is held by; 'free' for wanderers; 'dormant' heroes keep their story faction
  status: HeroStatus
  loc: string | null // prefecture id; null while dormant
  loyalty: number // player's ordinary heroes only (H-9)
  wounded: number // cannot act until t >= wounded
  inviteBlock: number // cannot be invited from this prefecture until t >= inviteBlock (Q-2)
  wavering: boolean // marked wavering at the last month-end (H-15)
  flights: number // Gao Qiu's flights (W-26)
  bonus: number // extra invite odds (V-8, Q-4)
  persuadedT: number // last month a persuade was tried (Q-4)
  heldBy: string | null // captive: the faction in whose prison
}

export interface PrefectureState {
  owner: Faction
  pop: number; gold: number; food: number; men: number; arms: number
  training: number; support: number; land: number; dyke: number; bandits: number
  unrest: boolean
  heroes: string[]
  captives: string[]
  governor: string | null
  fought: boolean // T-9
  tiger: number | null // t the tiger arrived (V-6)
  plague: boolean // plague fired last month-end (V-4)
  disasterT: number // t of the last disaster (E-11)
  drought: boolean // next harvest cut 40% (V-2)
  famineT: number // t of last famine, flood or plague event (R-2 relief +3)
  reliefT: number; huntT: number; forgedT: number // renown-cap bookkeeping (R-3)
  graftMod: number // expose lowers graft (E-16)
  spyT: number // t of the last report by the player (Z-5); -99 none
  stormT: number // snowstorm active during month t (V-5)
  starvedT: number // t E-8 fired
}

export type LedgerColumn = 'justice' | 'relief' | 'beasts' | 'battles' | 'heroes'
export interface LedgerEntry { t: number; pref: string; amount: number; rule: string; column: LedgerColumn; text: string }

export interface Campaign { staging: string; objective: string; target: Faction; announcedT: number }
export interface FactionState {
  alive: boolean
  renown: number
  renownStart: number
  renownHistory: number[]
  ledger: LedgerEntry[]
  edict: number | null // t the Edict was granted (R-9)
  edictBuild: number // months of capital garrisoning left (G-4)
  chieftain: string | null
  statusWorst: number // worst Edict status seen: 0 green, 1 amber, 2 red (R-8 toast)
  nextCampaign: number
  campaign: Campaign | null
  inspectionAdvance: number // months by which the next campaign is advanced (V-7)
  allyUntil: number // camps only (K-5): allied with the player while t < allyUntil; 0 = never
  allySince: number // camps only: t the alliance began (K-6 needs 3 months)
}

export interface ScheduledEvent {
  id: 'flood' | 'drought' | 'locusts' | 'snowstorm' | 'inspection'
  pref: string
  fireT: number
  effect: string
}

export interface Pending {
  kind: 'captive' | 'tiger' | 'inspection' | 'convoy' | 'duelOffer' | 'succession' | 'flightChoice'
  options: string[]
  data: Record<string, unknown>
}

export interface LogEntry { t: number; kind: string; rule: string; text: string; pref?: string }
export interface GameEvent { t: number; k: string; rule: string; text: string; pref?: string; n?: number }

export type Terr = 'plain' | 'road' | 'forest' | 'reed' | 'hill' | 'mountain' | 'marsh' | 'water' | 'village' | 'wall' | 'gate' | 'keep'
export type Kind = 'infantry' | 'archers' | 'cavalry' | 'boats'
export type Side = 'a' | 'd'

export interface BUnit {
  id: string
  hero: string // hero id, or a garrison captain id "cap-<pref>-<n>"
  side: Side
  kind: Kind
  skills: string[]
  might: number; command: number; cunning: number; vigour: number; daring: number
  men: number; maxMen: number; guard: number
  armed: number // armedRatio 0-100
  training: number; morale: number; fatigue: number
  pos: Hex
  hidden: boolean
  state: 'active' | 'routed' | 'captured' | 'gone'
  commander: boolean
  moved: boolean; acted: boolean; waited: boolean; dueled: boolean; hurt: boolean
  startedHidable: boolean // stood on forest/reed when the day began (W-24)
  counsel: boolean // strategist bonus pending (H-7)
  fatigueLog: { cause: string; n: number }[]
  specialUsed: boolean // weather, scuttle once per battle
  capturedBy: Side | null
}

export interface BattleState {
  w: number; h: number
  terrain: Record<string, Terr> // "q,r" -> terrain
  burning: Record<string, number> // "q,r" -> dusks left
  weather: { kind: 'rain' | 'fog'; dusks: number } | null
  wind: number // 0-5 (W-13)
  day: number
  toAct: Side
  units: BUnit[]
  origin: string
  target: string
  human: Side | null
  auto: { a: boolean; d: boolean }
  attacker: Faction
  defender: Faction
  imperial: boolean
  walled: boolean
  hungry: { a: boolean; d: boolean }
  hunters: string[]
  result: null | { winner: Side; reason: string }
  burned: number // village hexes burned by the human side (R-3)
  force: string[] // attacker heroes sent
}

export interface FlowState { stage: "commands" | "ai" | "end"; f: number; queue: string[] | null }

export interface GameState {
  schema: 1
  setup: Setup
  t: number
  phase: 'strategic' | 'battle' | 'result'
  pending: Pending | null
  rng: { s: [number, number, number, number]; forced: number[]; draws: number }
  prefectures: Record<string, PrefectureState>
  heroes: Record<string, HeroState>
  factions: Record<string, FactionState>
  scheduled: ScheduledEvent[]
  commandsLeft: Record<string, number>
  battle: BattleState | null
  flow: FlowState
  fired: string[] // story events already fired (V-8) and triggers that have fired (Q-5)
  log: LogEntry[]
  result: null | { outcome: 'victory' | 'defeat'; reason: string; ending: string }
}

export type SpyOp = 'report' | 'steal' | 'discord' | 'expose' | 'burn' | 'forged-order' | 'jailbreak'

export type Action =
  | { t: 'levy' | 'train' | 'forge' | 'dykes' | 'relieve' | 'rest'; pref: string; actor: string }
  | { t: 'trade'; pref: string; actor: string; dir: 'buyFood' | 'sellFood'; amount: number }
  | { t: 'hunt'; pref: string; actor: string; party: string[]; men: number }
  | { t: 'move'; pref: string; to: string; heroes: string[]; men: number }
  | { t: 'send'; pref: string; to: string; gold: number; food: number; arms: number; actor: string }
  | { t: 'spy'; pref: string; actor: string; target: string; op: SpyOp }
  | { t: 'recruit'; pref: string; actor: string; target: string; method: 'invite' | 'persuade' }
  | { t: 'swear'; pref: string; hero: string }
  | { t: 'attack'; pref: string; target: string; heroes: string[]; men: number }
  | { t: 'ally'; pref: string; actor: string; camp: string }
  | { t: 'endPhase' }
  | { t: 'choose'; option: string }
  | { t: 'bMove'; unit: string; to: Hex }
  | { t: 'bAttack' | 'bVolley' | 'bCharge'; unit: string; target: string }
  | { t: 'bFire'; unit: string; at: Hex }
  | { t: 'bHide' | 'bWait' | 'bAmbush' | 'bHeal' | 'bScuttle' | 'bCounsel'; unit: string; target?: string }
  | { t: 'bWeather'; unit: string; kind: 'wind' | 'rain' | 'fog'; dir?: number }
  | { t: 'bDuel'; unit: string; target: string; stake: 'honour' | 'capture' }
  | { t: 'bEndSide' }
  | { t: 'bWithdraw' }
  | { t: 'bAuto' }

export type RejectCode =
  | 'not-your-turn' | 'pending-decision' | 'no-commands-left' | 'not-enough-gold' | 'not-enough-food'
  | 'not-enough-men' | 'not-enough-arms' | 'illegal-target' | 'blocked-link' | 'capital-protected'
  | 'requirement-not-met' | 'unknown-action' | 'game-over'

export type StepResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; code: RejectCode; message: string }
