import { useState } from 'react'
import { clientQuery } from '../../engine'
import type { GameState } from '../../engine'
import { useGame, viewOf } from '../store/game'
import { Meter, Tip, signed } from '../ui'

const STATUS_TEXT = { measuring: 'Measuring', green: 'On pace', amber: 'Tight', red: 'Behind' } as const

export function Hud({ s }: { s: GameState }) {
  const { set2, backToTitle, storageNote } = useGame()
  const v = viewOf(s)
  const r = v.renown
  const dl = v.deadline
  const need = clientQuery.edictThreshold()
  const arrow = r.trend > 0 ? '▲' : r.trend < 0 ? '▼' : '▬'
  return (
    <header className="hud" data-testid="hud">
      <div className="hud-cell date" data-testid="hud-date">
        <span className="cap">Month</span>
        <b className="num lamp" data-testid="hud-month">{v.label}</b>
      </div>
      <div className={`hud-cell deadline${dl.banner !== null ? ' banner' : ''}`} data-testid="hud-deadline">
        <span className="cap">Deadline</span>
        <b className="num"><span data-testid="months-left">{dl.monthsLeft}</span> month{dl.monthsLeft === 1 ? '' : 's'} left</b>
        <small>Last month {dl.lastLabel}{dl.banner !== null ? '. The court\'s patience is running out.' : ''}</small>
      </div>
      <div className="hud-cell renown" data-testid="hud-renown">
        <span className="cap">Renown</span>
        {r.granted ? (
          <b className="num"><span className="chop" aria-hidden>詔</span> Edict granted: {r.projectedLabel.replace('granted ', '')}</b>
        ) : (
          <>
            <b className="num"><span data-testid="renown-n">{r.renown}</span> / {need} <span className={`trend ${r.trend > 0 ? 'up' : r.trend < 0 ? 'down' : ''}`}>{arrow} {signed(r.trend)}/mo</span></b>
            <Meter value={r.renown} max={need} label={`Renown ${r.renown} of ${need}`} tone={r.status === 'green' || r.status === 'measuring' ? 'ok' : r.status === 'amber' ? 'warn' : 'bad'} />
            <small data-testid="edict-projection">Edict {r.projectedLabel}; needed by {r.edictByLabel}. Needs {r.required.toFixed(1)}/mo, earning {r.rate.toFixed(1)}/mo.</small>
          </>
        )}
      </div>
      <Tip text={r.granted ? 'The Edict is granted. The capital can now be attacked.' : `Edict pace: ${STATUS_TEXT[r.status]}. Green means the projection lands 6 or more months before the Edict-by date; amber means on or before it; red means later or never; measuring means too few months have passed to judge.`}>
        <span className={`lamp-status ${r.status}`} data-testid="edict-status"><i />{r.granted ? 'Edict' : STATUS_TEXT[r.status]}</span>
      </Tip>
      <div className="hud-menu">
        <button type="button" className="hud-btn" onClick={() => set2({ helpOpen: true })} data-testid="menu-help">Help</button>
        <button type="button" className="hud-btn" onClick={() => set2({ settingsOpen: true })} data-testid="menu-settings">Settings</button>
        <button type="button" className="hud-btn" onClick={backToTitle} data-testid="menu-title">Title</button>
      </div>
      {storageNote ? <p className="storage-note" role="alert">{storageNote}</p> : null}
    </header>
  )
}

export function Alerts({ s, onPick }: { s: GameState; onPick: (p?: string) => void }) {
  const v = viewOf(s)
  const hints = v.advice.hints
  const [open, setOpen] = useState<Set<string>>(new Set())
  const flip = (k: string): void => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n })
  return (
    <div className="alerts" data-testid="alerts">
      {v.warnings.slice(0, 6).map((w, i) => (
        <button key={i} type="button" className={`alert ${w.level}${open.has(`w${i}`) ? ' open' : ''}`} onClick={() => { flip(`w${i}`); onPick(w.pref) }} data-testid="warning">
          <b>{w.level === 'red' ? 'Danger' : 'Warning'}</b> {w.text}
        </button>
      ))}
      {hints.map((h, i) => (
        <div key={i} className={`alert hint${open.has(`h${i}`) ? ' open' : ''}`} onClick={() => flip(`h${i}`)} data-testid="advice"><b>Advisor{v.advice.pinned ? ' (pinned)' : ''}</b> {h.text}</div>
      ))}
      {v.forecast.events.length > 0 ? v.forecast.events.map((e, i) => <div key={i} className="alert amber"><b>Forecast</b> {e.text}</div>) : null}
    </div>
  )
}
