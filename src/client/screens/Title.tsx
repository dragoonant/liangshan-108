import { useEffect } from 'react'
import { useGame } from '../store/game'
import { Footer, Stamp, Modal } from '../ui'
import { HelpBody } from '../panels/Help'
import { Settings } from '../panels/Settings'

export function Title() {
  const { save, refreshSave, setScreen, continueGame, discardSave, helpOpen, settingsOpen, set2, storageNote } = useGame()
  useEffect(() => { refreshSave() }, [refreshSave])
  const when = save.kind === 'ok' ? new Date(save.env.savedAt) : null
  return (
    <main className="title" data-testid="title">
      <div className="lantern" aria-hidden />
      <section className="scroll paper">
        <div className="brush-zh" aria-hidden>梁山</div>
        <h1><span>Liangshan</span><small>108 Stars</small></h1>
        <p className="lede">A hideout, a ledger and a long list of wronged men. Gather the brothers, earn the Emperor's Edict, and bring down Gao Qiu before the court's patience runs out.</p>
        <div className="title-actions">
          {save.kind === 'ok' ? (
            <div className="continue">
              <Stamp kind="confirm" onClick={continueGame} testId="continue">Continue</Stamp>
              <p className="continue-note" data-testid="continue-note">
                {save.env.summary.chieftain}, {save.env.summary.dateLabel}: {save.env.summary.prefectures} prefecture{save.env.summary.prefectures === 1 ? '' : 's'}, {save.env.summary.heroes} heroes, Renown {save.env.summary.renown} (Edict pace {save.env.summary.edictStatus}).
                {' '}{save.env.summary.phase === 'battle' ? `In a battle, ${save.env.summary.whoseTurn} to act.` : 'Your turn.'}
                {when ? ` Saved ${when.toLocaleString()}.` : ''}
              </p>
            </div>
          ) : null}
          {save.kind === 'corrupt' || save.kind === 'blocked' ? (
            <div className="refused" data-testid="save-problem">
              <span className="refused-stamp">REFUSED</span>
              <p>{save.kind === 'corrupt' ? `The saved game cannot be opened. ${save.reason}` : save.reason}</p>
              {save.kind === 'corrupt' ? <Stamp kind="danger" onClick={discardSave} testId="discard-corrupt">Discard the broken save</Stamp> : null}
            </div>
          ) : null}
          <Stamp kind="order" onClick={() => setScreen('start')} testId="new-game">New game</Stamp>
          <Stamp kind="plain" onClick={() => set2({ helpOpen: true })} testId="open-help">How to play</Stamp>
          <Stamp kind="plain" onClick={() => set2({ settingsOpen: true })} testId="open-settings">Settings</Stamp>
        </div>
        {storageNote ? <p className="note-cinnabar">{storageNote}</p> : null}
        {save.kind === 'ok' ? <p className="fine">New game replaces this save after one more question.</p> : null}
      </section>
      <svg className="marsh-art" viewBox="0 0 600 400" aria-hidden preserveAspectRatio="xMaxYMax meet">
        <g stroke="#2f6b72" strokeWidth="2" opacity="0.55" strokeLinecap="round">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} d={`M${120 + i * 38},${300 + i * 10} h${60 - i * 4}`} />)}
          {[0, 1, 2, 3, 4].map((i) => <path key={`b${i}`} d={`M${250 + i * 30},${340 + i * 8} h${44}`} />)}
        </g>
        <path d="M200 276 q80 34 200 0 l-22 26 q-78 20 -156 0 z" fill="#1a1710" />
        <path d="M300 276 v-96" stroke="#1a1710" strokeWidth="4" />
        <path d="M300 186 q40 -4 60 16 l-60 -6 z" fill="#3a3220" />
        <circle cx="300" cy="166" r="22" fill="#f0a63c" opacity="0.28" />
        <rect x="292" y="152" width="16" height="22" rx="4" fill="#f0a63c" />
        <g fill="none" stroke="#31482a" strokeWidth="3" strokeLinecap="round">
          {[[470, 400, 440, 250], [490, 400, 500, 230], [510, 400, 540, 262], [530, 400, 520, 214], [550, 400, 580, 280], [570, 400, 560, 236], [450, 400, 420, 290]].map(([x0, y0, x1, y1], i) => <path key={i} d={`M${x0},${y0} Q${(x0! + x1!) / 2 + 14},${(y0! + y1!) / 2} ${x1},${y1}`} />)}
        </g>
        <g fill="#4c6a38">{[[440, 250], [500, 230], [540, 262], [520, 214], [580, 280], [560, 236], [420, 290]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="4" ry="13" />)}</g>
      </svg>
      <div className="reeds" aria-hidden />
      <Footer />
      {helpOpen ? <Modal title="How to play" onClose={() => set2({ helpOpen: false })} wide><HelpBody /></Modal> : null}
      {settingsOpen ? <Modal title="Settings" onClose={() => set2({ settingsOpen: false })}><Settings /></Modal> : null}
    </main>
  )
}
