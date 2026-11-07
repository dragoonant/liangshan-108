import { useMemo, useState } from 'react'
import { START_HEROES, clientQuery } from '../../engine'
import type { Difficulty } from '../../engine'
import { useGame } from '../store/game'
import { heroRec } from '../data'
import { Modal, Stamp, fmt } from '../ui'

const SITUATION: Record<string, string> = {
  'song-jiang': 'Trusted clerk: the people love him, Wu Yong and Liu Tang follow him from day one, but he has almost no arms.',
  'chao-gai': 'Rich headman and chief of the Seven Stars band. Wu Yong and Liu Tang sit at his table, and the Ruan brothers fish the marsh across the water.',
  'lin-chong': 'Disgraced arms instructor: drilled troops, poor support, and the capital one road away.',
  'wu-song': 'Famous tiger-slayer: Renown from the start, a thin purse, and a tiger abroad in the first month.',
  'lu-zhishen': 'Fugitive officer on a far western seat with two links, one a mountain pass: food and men, no money.',
  'hu-sanniang': 'Rich estate and the best horsemen. The leaderless Zhu clan waits in the same prefecture to be invited.',
}
const DIFF_NAMES: Record<number, string> = { 1: 'Easy', 2: 'Normal', 3: 'Hard', 4: 'Brutal' }

export function StartPicker() {
  const { save, setScreen, newGame } = useGame()
  const [hero, setHero] = useState('song-jiang')
  const [diff, setDiff] = useState<Difficulty>(2)
  const [seed, setSeed] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [brief, setBrief] = useState(false)
  const diffs = useMemo(() => clientQuery.difficulties(), [])
  const infos = useMemo(() => Object.fromEntries(START_HEROES.map((h) => [h, clientQuery.startInfo(h)!])), [])
  const info = infos[hero]!
  const d = diffs[diff - 1]!
  const begin = (): void => newGame({ startHero: hero, difficulty: diff, seed: seed.trim() ? Math.abs(parseInt(seed, 10) || 1) : Math.floor(Math.random() * 1e9) })
  const press = (): void => (save.kind === 'ok' ? setConfirm(true) : setBrief(true))
  return (
    <main className="start" data-testid="start-picker">
      <header className="start-head"><button className="back" type="button" onClick={() => setScreen('title')}>Back</button><h2>Choose your chieftain</h2></header>
      <div className="posters-row" role="radiogroup" aria-label="Chieftain">
        {START_HEROES.map((id) => {
          const r = heroRec(id)!
          const i = infos[id]!
          return (
            <button key={id} type="button" role="radio" aria-checked={id === hero} className={`poster mini${id === hero ? ' chosen' : ''}`} onClick={() => setHero(id)} data-testid={`start-${id}`}>
              <i className="nail tl" /><i className="nail tr" />
              <span className="band">{r.star ? `Star ${r.star.rank}, ${r.star.group === 'heavenly' ? 'Heavenly' : 'Earthly'}` : 'Outside the 108'}</span>
              <span className="portrait" aria-hidden>{r.name.split(' ').map((w) => w[0]).join('')}</span>
              <b className="pname">{r.name}</b>
              <span className="zh">{r.nameZh}</span>
              <em className="nick">{r.nickname}</em>
              <span className="where">Starts at {i.prefectureName}</span>
            </button>
          )
        })}
      </div>
      <section className="start-detail paper" data-testid="start-detail">
        <h3>{heroRec(hero)!.name}: {SITUATION[hero]}</h3>
        <dl className="nums">
          <div><dt>Gold</dt><dd>{fmt(info.gold)}</dd></div><div><dt>Food</dt><dd>{fmt(info.food)}</dd></div><div><dt>Men</dt><dd>{fmt(info.men)}</dd></div>
          <div><dt>Arms</dt><dd>{fmt(info.arms)}</dd></div><div><dt>Training</dt><dd>{info.training}</dd></div><div><dt>Support</dt><dd>{info.support}</dd></div><div><dt>Renown</dt><dd>{info.renown}</dd></div>
        </dl>
        <p><b>Neighbours:</b> {info.neighbours.map((n) => `${n.name} (${n.ownerName})`).join(', ')}.</p>
        {info.followers.length ? <p><b>Followers from day one:</b> {info.followers.join(', ')}.</p> : null}
        {info.pending ? <p><b>First month:</b> a scripted {info.pending} waits for your answer.</p> : null}
        {info.hints.length ? <><p><b>The advisor begins with:</b></p><ul>{info.hints.map((h) => <li key={h}>{h}</li>)}</ul></> : null}
      </section>
      <section className="diffs" role="radiogroup" aria-label="Difficulty">
        {diffs.map((x) => (
          <button key={x.difficulty} type="button" role="radio" aria-checked={x.difficulty === diff} className={`diff paper${x.difficulty === diff ? ' chosen' : ''}`} onClick={() => setDiff(x.difficulty)} data-testid={`diff-${x.difficulty}`}>
            <b>{DIFF_NAMES[x.difficulty]}</b>
            <span>{x.months} months</span>
            <small>Last month {x.lastLabel}. Edict needed by {x.edictByLabel}.</small>
          </button>
        ))}
      </section>
      <p className="fine">Difficulty changes only the deadline and how hard the rivals and the court push (S-3, S-4). Prices, odds and loyalty never change.</p>
      <details className="adv"><summary>Advanced</summary><label>Seed <input value={seed} onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="random" data-testid="seed" /></label></details>
      <div className="start-go"><Stamp kind="confirm" onClick={press} testId="begin">Begin: {heroRec(hero)!.name}, {DIFF_NAMES[diff]}</Stamp></div>
      {confirm ? (
        <Modal title="Replace your saved game?" onClose={() => setConfirm(false)} testId="replace-save">
          <p>Starting a new game replaces the one saved in this browser{save.kind === 'ok' ? ` (${save.env.summary.chieftain}, ${save.env.summary.dateLabel})` : ''}. It cannot be undone.</p>
          <div className="row"><Stamp kind="danger" onClick={() => { setConfirm(false); setBrief(true) }} testId="replace-yes">Replace it</Stamp><Stamp kind="plain" onClick={() => setConfirm(false)}>Keep it</Stamp></div>
        </Modal>
      ) : null}
      {brief ? (
        <Modal title="Briefing" onClose={() => setBrief(false)} testId="briefing">
          <p><b>The goal.</b> Earn the Emperor's Edict, take Dongjing, and capture Gao Qiu.</p>
          <p><b>The deadline.</b> {d.months} months: the last is {d.lastLabel}. The Edict is needed by {d.edictByLabel}, which leaves 18 months to take the capital.</p>
          <p><b>Watch six things:</b> food, support, loyalty, the Renown trend, the forecast and the court's campaigns. Warnings appear a month ahead.</p>
          <div className="row"><Stamp kind="confirm" onClick={begin} testId="briefing-go">Take the oath and begin</Stamp><Stamp kind="plain" onClick={() => setBrief(false)}>Not yet</Stamp></div>
        </Modal>
      ) : null}
    </main>
  )
}
