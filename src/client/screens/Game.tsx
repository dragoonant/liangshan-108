import { useEffect, useState } from 'react'
import { clientQuery } from '../../engine'
import type { GameState } from '../../engine'
import { useGame, viewOf } from '../store/game'
import type { Tab } from '../store/game'
import { Alerts, Hud } from '../panels/Hud'
import { StrategicMap } from '../map/StrategicMap'
import { PrefPanel } from '../panels/PrefPanel'
import { Roster } from '../panels/Roster'
import { HelpTab, LedgerTab, LogTab } from '../panels/Tabs'
import { Footer, Modal, Stamp, useIsPhone } from '../ui'
import { dateLabel } from '../../engine'
import { heroName, prefName } from '../data'
import { BattleScreen } from '../battle/BattleScreen'

const TABS: [Tab, string][] = [['prefecture', 'Prefecture'], ['heroes', 'Heroes'], ['ledger', 'Ledger'], ['log', 'Log'], ['help', 'Help']]

export function Game() {
  const { shown, state, playing, feed, feedIdx, skip, dispatch, sel, select, tab, setTab, settings, report, closeReport } = useGame()
  const phone = useIsPhone()
  const [sheet, setSheet] = useState(false)
  useEffect(() => {
    const f = (e: KeyboardEvent): void => { if (e.code === 'Space' && useGame.getState().playing) { e.preventDefault(); useGame.getState().skip() } }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])
  if (!shown || !state) return null
  const s = shown
  if (s.phase === 'battle') return <BattleScreen s={s} />
  if (s.phase === 'result') return <ResultPage s={s} />
  const v = viewOf(s)
  const targets = tab === 'prefecture' && sel ? [] : []
  const pick = (id?: string): void => { if (id) { select(id); setSheet(true) } }
  const dock = (
    <>
      <nav className="tabs" role="tablist" aria-label="Panels">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setSheet(true) }} data-testid={`tab-${k}`}>{l}</button>)}
      </nav>
      <div className="dock-body" role="tabpanel">
        {tab === 'prefecture' ? <PrefPanel s={s} /> : tab === 'heroes' ? <Roster s={s} /> : tab === 'ledger' ? <LedgerTab s={s} /> : tab === 'log' ? <LogTab s={s} /> : <HelpTab />}
      </div>
    </>
  )
  const last = feed.slice(Math.max(0, feedIdx - 3), feedIdx)
  return (
    <div className="game" data-testid="game" data-speed={settings.speed}>
      <Hud s={s} />
      <div className="stage">
        <div className="mapcol">
          <StrategicMap s={s} sel={sel} onSelect={(id) => pick(id)} targets={targets} />
          <Alerts s={s} onPick={pick} />
        </div>
        {phone ? (
          <aside className={`sheet${sheet ? ' open' : ''}`} data-testid="sheet">
            <button type="button" className="handle" onClick={() => setSheet(!sheet)} aria-label={sheet ? 'Lower the panel' : 'Raise the panel'} data-testid="sheet-handle"><i /></button>
            {dock}
          </aside>
        ) : <aside className="dock paper-dark" data-testid="dock">{dock}</aside>}
      </div>
      <footer className="bar">
        <div className="ticker" data-testid="ticker" aria-live="polite">
          {playing ? last.map((e, i) => <span key={feedIdx - last.length + i} className="tick">{e.text}</span>) : feed.slice(-2).map((e, i) => <span key={i} className="tick done">{e.text}</span>)}
        </div>
        {playing ? <Stamp kind="plain" onClick={skip} testId="skip">Skip</Stamp> : <Stamp kind="confirm" disabled={!!s.pending} why="Answer the open decision first." onClick={() => dispatch({ t: 'endPhase' })} testId="end-month">End the month</Stamp>}
      </footer>
      {playing ? <MonthReport s={state} /> : null}
      {!playing && s.pending ? <PendingNote s={s} /> : null}
      {!playing && !s.pending && report ? (
        <Modal title="Battle report" onClose={closeReport} testId="battle-report">
          <ol className="report-list">{report.slice(-14).map((e, i) => <li key={i}>{e.text}</li>)}</ol>
          <Stamp kind="confirm" onClick={closeReport} testId="report-close">Close the ledger</Stamp>
        </Modal>
      ) : null}
      <p className="sr-only">{v.label}</p>
      {phone ? null : <Footer />}
    </div>
  )
}

function MonthReport({ s }: { s: GameState }) {
  const { feed, feedIdx, skip } = useGame()
  const shown = feed.slice(0, feedIdx)
  return (
    <div className="report paper" data-testid="month-report">
      <header><b>Month report</b> <span className="num">{dateLabel(Math.max(0, s.t - 1))}</span><Stamp small kind="plain" onClick={skip}>Skip</Stamp></header>
      <ol>{shown.slice(-9).map((e, i) => <li key={i} className={`k-${e.k}`}>{e.pref ? <b>{prefName(e.pref)}: </b> : null}{e.text}</li>)}</ol>
    </div>
  )
}

export function PendingNote({ s }: { s: GameState }) {
  const dispatch = useGame((g) => g.dispatch)
  const reject = useGame((g) => g.reject)
  const info = clientQuery.pendingInfo(s)
  if (!info) return null
  return (
    <Modal title={info.title} testId="pending">
      <p className="ask" data-testid="pending-ask">{info.ask}</p>
      <ul className="variants">
        {info.options.map((o) => (
          <li key={o.id}>
            <button type="button" className="variant" onClick={() => dispatch({ t: 'choose', option: o.id })} data-testid={`choose-${o.id}`}>
              <span className="vd">{o.label}{o.pct !== undefined ? <b className="odds"> Odds {o.pct}%</b> : null}</span>
              <span className="vp">{o.detail}</span>
            </button>
          </li>
        ))}
      </ul>
      {reject ? <p className="refused-line" role="alert">{reject.message}</p> : null}
    </Modal>
  )
}

function ResultPage({ s }: { s: GameState }) {
  const { backToTitle } = useGame()
  const r = s.result!
  const v = viewOf(s)
  const mine = Object.values(v.prefectures).filter((p) => p.owner === 'player').length
  const heroes = Object.values(v.heroes).filter((h) => h.faction === 'player' && ['chieftain', 'sworn', 'ordinary'].includes(h.status)).length
  return (
    <main className="result" data-testid="result">
      <section className="paper scroll">
        <div className={`verdict ${r.outcome}`}>{r.outcome === 'victory' ? 'VICTORY' : 'DEFEAT'}</div>
        <h1>{r.ending}</h1>
        <p>{r.reason}</p>
        <dl className="nums"><div><dt>Date</dt><dd>{v.label}</dd></div><div><dt>Renown</dt><dd>{v.renown.renown}</dd></div><div><dt>Heroes</dt><dd>{heroes}</dd></div><div><dt>Prefectures</dt><dd>{mine}</dd></div></dl>
        <Stamp kind="confirm" onClick={backToTitle} testId="result-title">Back to the title</Stamp>
      </section>
      <Footer />
    </main>
  )
}
void heroName
