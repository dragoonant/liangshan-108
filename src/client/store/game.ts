// The store: the only caller of `step`. Holds the true state and a presented-state cursor (the director).
import { create } from 'zustand'
import { createGame, step, view } from '../../engine'
import type { Action, GameEvent, GameState, LogEntry, Setup, GameView } from '../../engine'
import { clearSave, readSave, savedLog, writeSave } from './save'
import type { SaveStatus } from './save'

export type Speed = 'slow' | 'normal' | 'fast' | 'instant'
export const SPEED_MULT: Record<Speed, number> = { slow: 1, normal: 0.55, fast: 0.25, instant: 0 }
export type Screen = 'title' | 'start' | 'game'
export type Tab = 'prefecture' | 'heroes' | 'ledger' | 'log' | 'help'

interface Settings { speed: Speed; showAiBattles: boolean }
const SETTINGS_KEY = 'ls108-settings'
function loadSettings(): Settings {
  try {
    const j = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<Settings> | null
    if (j && ['slow', 'normal', 'fast', 'instant'].includes(j.speed as string)) return { speed: j.speed as Speed, showAiBattles: !!j.showAiBattles }
  } catch { /* defaults */ }
  return { speed: 'normal', showAiBattles: false }
}

export interface Reject { code: string; message: string }
interface Store {
  screen: Screen
  save: SaveStatus
  storageNote: string | null
  state: GameState | null
  shown: GameState | null
  actions: Action[]
  fullLog: LogEntry[]
  feed: GameEvent[]
  feedIdx: number
  playing: boolean
  settings: Settings
  reject: Reject | null
  report: GameEvent[] | null
  sel: string | null // selected prefecture
  tab: Tab
  helpOpen: boolean
  settingsOpen: boolean
  toast: string | null
  setScreen(s: Screen): void
  refreshSave(): void
  newGame(setup: Setup): void
  continueGame(): void
  discardSave(): void
  dispatch(a: Action): boolean
  skip(): void
  select(p: string | null): void
  closeReport(): void
  setTab(t: Tab): void
  setSettings(p: Partial<Settings>): void
  backToTitle(): void
  set2(p: Partial<Store>): void
}

let timer: ReturnType<typeof setTimeout> | null = null
const stop = (): void => { if (timer) { clearTimeout(timer); timer = null } }
const viewCache = new WeakMap<GameState, GameView>()
export function viewOf(s: GameState): GameView {
  let v = viewCache.get(s)
  if (!v) { v = view(s, 'player'); viewCache.set(s, v) }
  return v
}

export const useGame = create<Store>((set, get) => ({
  screen: 'title', save: { kind: 'none' }, storageNote: null, state: null, shown: null, actions: [], fullLog: [], feed: [], feedIdx: 0, playing: false,
  settings: loadSettings(), reject: null, report: null, sel: null, tab: 'prefecture', helpOpen: false, settingsOpen: false, toast: null,
  set2: (p) => set(p as Partial<Store>),
  setScreen: (screen) => set({ screen }),
  refreshSave: () => set({ save: readSave() }),
  closeReport: () => set({ report: null }),
  select: (sel) => set({ sel, tab: 'prefecture' }),
  setTab: (tab) => set({ tab }),
  setSettings: (p) => {
    const settings = { ...get().settings, ...p }
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* convenience only */ }
    set({ settings })
  },
  newGame: (setup) => {
    stop()
    const state = createGame(setup)
    const note = writeSave(state, [], state.log)
    set({ state, shown: state, actions: [], fullLog: [...state.log], feed: [], feedIdx: 0, playing: false, reject: null, sel: state.factions['player']?.chieftain ? (Object.keys(state.prefectures).find((p) => state.prefectures[p]!.owner === 'player') ?? null) : null, tab: 'prefecture', screen: 'game', storageNote: note, save: readSave() })
  },
  continueGame: () => {
    const sv = readSave()
    if (sv.kind !== 'ok') { set({ save: sv }); return }
    stop()
    const state = sv.env.snapshot
    const mine = Object.keys(state.prefectures).find((p) => state.prefectures[p]!.owner === 'player') ?? null
    set({ state, shown: state, actions: sv.env.actions, fullLog: savedLog(sv.env), feed: [], feedIdx: 0, playing: false, reject: null, sel: mine, tab: 'prefecture', screen: 'game', storageNote: null })
  },
  discardSave: () => { clearSave(); set({ save: { kind: 'none' } }) },
  backToTitle: () => { stop(); set({ screen: 'title', playing: false, save: readSave() }) },
  dispatch: (a) => {
    const g = get()
    if (!g.state || g.playing) return false
    const r = step(g.state, a)
    if (!r.ok) { set({ reject: { code: r.code, message: r.message } }); return false }
    const next = r.state
    const actions = [...g.actions, a]
    const fullLog = [...g.fullLog, ...r.events.map((e) => ({ t: e.t, kind: e.k, rule: e.rule, text: e.text, ...(e.pref !== undefined ? { pref: e.pref } : {}) }))]
    const note = next.phase === 'result' ? (clearSave(), null) : writeSave(next, actions, fullLog)
    const mult = SPEED_MULT[g.settings.speed]
    const wasBattle = g.state.phase === 'battle'
    const events = g.settings.showAiBattles ? r.events : r.events.filter((e) => !(e.rule.startsWith('W-') && next.phase !== 'battle' && g.state!.phase !== 'battle' && !['conquered', 'repulsed'].includes(e.k)))
    const nowBattle = next.phase === 'battle'
    const monthEnded = next.t !== g.state.t
    const play = mult > 0 && events.length > 0 && (monthEnded || wasBattle || nowBattle) && next.phase !== 'result'
    const ended = wasBattle && next.phase !== 'battle'
    const base = { state: next, actions, fullLog, reject: null, report: ended ? r.events : g.report, storageNote: note ?? g.storageNote, save: note ? g.save : readSave() }
    if (!play) { set({ ...base, shown: next, feed: events, feedIdx: events.length, playing: false }); return true }
    // battle: figures slide at once (they animate between positions); month: the report plays before the new month is shown
    set({ ...base, shown: nowBattle && wasBattle ? next : g.shown, feed: events, feedIdx: 0, playing: true })
    const per = Math.max(35, Math.min(260 * mult * 2, 7000 / events.length))
    const tick = (): void => {
      const s = get()
      if (!s.playing) return
      if (s.feedIdx >= s.feed.length) { set({ playing: false, shown: s.state }); return }
      set({ feedIdx: s.feedIdx + 1 })
      timer = setTimeout(tick, per)
    }
    timer = setTimeout(tick, per)
    return true
  },
  skip: () => { stop(); const s = get(); if (s.playing) set({ playing: false, shown: s.state, feedIdx: s.feed.length }) },
}))

declare global { interface Window { __ls108?: Record<string, unknown> } }
