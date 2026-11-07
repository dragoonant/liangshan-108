import { useMemo, useState } from 'react'
import { clientQuery } from '../../engine'
import type { GameState } from '../../engine'
import { useGame, viewOf } from '../store/game'
import { prefName } from '../data'
import { HelpBody } from './Help'
import { signed } from '../ui'

const COL_NAMES: Record<string, [string, string]> = {
  justice: ['Justice', 'Beating corrupt officials, refusing bribes, taking convoys of the corrupt'],
  relief: ['Relief', 'Feeding the hungry and easing the people'],
  beasts: ['Beasts and bandits', 'Slaying tigers and hunting bandits'],
  battles: ['Battles', 'Won and lost fights, prefectures taken and lost'],
  heroes: ['Heroes', 'Heroes who join, and those who desert'],
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const when = (t: number): string => `${MONTHS[t % 12]} ${1101 + Math.floor(t / 12)}`

export function LedgerTab({ s }: { s: GameState }) {
  const cols = useMemo(() => clientQuery.ledger(s), [s])
  const v = viewOf(s)
  const [open, setOpen] = useState<string | null>(null)
  const max = Math.max(1, ...cols.map((c) => Math.abs(c.total)))
  return (
    <div className="ledger" data-testid="ledger">
      <p className="fine">Every gain and loss of Renown in the last 24 months, by source (R-4). Renown is now <b>{v.renown.renown}</b>; the Edict needs {clientQuery.edictThreshold()}.</p>
      <div className="cols">
        {cols.map((c) => (
          <button key={c.column} type="button" className={`col${open === c.column ? ' on' : ''}`} onClick={() => setOpen(open === c.column ? null : c.column)} data-testid={`ledger-col-${c.column}`}>
            <b>{COL_NAMES[c.column]![0]}</b>
            <span className="bar"><i style={{ height: `${Math.round((Math.abs(c.total) / max) * 100)}%` }} className={c.total < 0 ? 'neg' : ''} /></span>
            <span className="num total" data-testid={`ledger-total-${c.column}`}>{signed(c.total)}</span>
          </button>
        ))}
      </div>
      {cols.map((c) => (open === null || open === c.column) && c.entries.length ? (
        <section key={c.column}>
          <h4>{COL_NAMES[c.column]![0]}<small> {COL_NAMES[c.column]![1]}</small></h4>
          <ul className="entries">{c.entries.map((e, i) => <li key={i}><span className="num">{signed(e.amount)}</span> <span>{e.text} <small>({e.pref ? prefName(e.pref) + ', ' : ''}{when(e.t)}, {e.rule})</small></span></li>)}</ul>
        </section>
      ) : null)}
      {cols.every((c) => c.entries.length === 0) ? <p className="fine">Nothing yet. Relieve the poor, hunt bandits and win fights to build Renown.</p> : null}
    </div>
  )
}

export function LogTab({ s }: { s: GameState }) {
  // The engine keeps the full log in state (up to 600 lines); the store keeps everything it has been told since the game began.
  const [kind, setKind] = useState('all')
  const all = useGame((g) => g.fullLog)
  void s
  const kinds = useMemo(() => ['all', ...[...new Set(all.map((l) => l.kind))].sort()], [all])
  const list = (kind === 'all' ? all : all.filter((l) => l.kind === kind)).slice().reverse()
  return (
    <div className="log" data-testid="log">
      <div className="row"><label>Show <select value={kind} onChange={(e) => setKind(e.target.value)} data-testid="log-filter">{kinds.map((k) => <option key={k} value={k}>{k}</option>)}</select></label><span className="fine"><span data-testid="log-count">{list.length}</span> of {all.length} events</span></div>
      <ol className="log-list" data-testid="log-list">
        {list.map((l, i) => <li key={i} className={`k-${l.kind}`}><span className="num when">{when(l.t)}</span><span>{l.pref ? <b>{prefName(l.pref)}: </b> : null}{l.text} <small>({l.rule})</small></span></li>)}
      </ol>
    </div>
  )
}

export function HelpTab() { return <div className="help-tab"><HelpBody /></div> }
