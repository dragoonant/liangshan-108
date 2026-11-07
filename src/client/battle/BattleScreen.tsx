import { useEffect, useMemo, useState } from 'react'
import { clientQuery, legalActions, query } from '../../engine'
import type { Action, BUnit, GameState } from '../../engine'
import { SPEED_MULT, useGame, viewOf } from '../store/game'
import { heroName, heroRec, prefName, skillName } from '../data'
import { Meter, Modal, Stamp, Tip, useIsPhone } from '../ui'
import { Scene } from './Scene'
import type { Mark } from './Scene'
import { TERRAIN_NAME } from './hexmath'
import { PendingNote } from '../screens/Game'

const kk = (q: number, r: number): string => `${q},${r}`
const KIND: Record<string, string> = { infantry: 'Foot', archers: 'Archers', cavalry: 'Horse', boats: 'Boats' }

interface Opt { id: string; label: string; detail: string; action?: Action; select?: boolean }

export function BattleScreen({ s }: { s: GameState }) {
  const { state, playing, dispatch, skip, feed, feedIdx, settings, reject } = useGame()
  const phone = useIsPhone()
  const b = s.battle!
  const v = viewOf(s)
  const vb = v.battle!
  const clock = query.battleClock(s)!
  const [sel, setSel] = useState<string | null>(null)
  const [hover, setHover] = useState<{ q: number; r: number } | null>(null)
  const [menu, setMenu] = useState<{ q: number; r: number; opts: Opt[]; title: string } | null>(null)
  const [confirm, setConfirm] = useState<null | 'auto' | 'withdraw'>(null)
  const live = !playing && state === s
  const myTurn = live && !!b.human && b.toAct === b.human && !b.auto[b.human] && !s.pending
  const legal = useMemo(() => (myTurn ? legalActions(s) : []), [s, myTurn])
  const units = vb.units.filter((u) => u.state === 'active')
  const byHex = (q: number, r: number): BUnit | undefined => units.find((u) => u.pos.q === q && u.pos.r === r)
  const selUnit = units.find((u) => u.id === sel && u.side === b.human) ?? null
  useEffect(() => { if (sel && !units.some((u) => u.id === sel)) setSel(null) }, [units, sel])
  useEffect(() => { setMenu(null) }, [s])

  const mine = units.filter((u) => u.side === b.human)
  const mineActive = mine.filter((u) => !u.acted || !u.moved)
  const forSel = legal.filter((a) => 'unit' in a && a.unit === sel)

  const marks = useMemo(() => {
    const m: Record<string, Mark[]> = {}
    const add = (k: string, x: Mark): void => { (m[k] ??= []).push(x) }
    if (selUnit) {
      add(kk(selUnit.pos.q, selUnit.pos.r), 'selected')
      for (const a of forSel) {
        if (a.t === 'bMove') add(kk(a.to.q, a.to.r), 'move')
        else if ('target' in a && a.target !== undefined) { const t = units.find((u) => u.id === a.target); if (t && t.side !== b.human && a.t !== 'bHeal' && a.t !== 'bCounsel') add(kk(t.pos.q, t.pos.r), 'attack') }
        else if (a.t === 'bFire') add(kk(a.at.q, a.at.r), 'target')
      }
    }
    if (hover) add(kk(hover.q, hover.r), 'hover')
    return m
  }, [selUnit, forSel, hover, units, b.human])

  const nameOf = (u: BUnit): string => heroName(u.hero)
  function optsFor(a: Action, target?: BUnit): Opt {
    const id = JSON.stringify(a)
    switch (a.t) {
      case 'bAttack': case 'bAmbush': case 'bVolley': case 'bCharge': {
        const p = query.attackPreview(s, a.unit, a.target ?? '')
        const verb = { bAttack: 'Attack', bAmbush: 'Ambush', bVolley: 'Volley at', bCharge: 'Charge' }[a.t]
        return { id, action: a, label: `${verb} ${target ? nameOf(target) : ''}`, detail: p ? `Kills ${p.min}-${p.max} men${p.counter ? `; counter ${p.counter.min}-${p.counter.max}` : ''}${a.t === 'bAmbush' ? '; ambush bonus' : ''}` : '' }
      }
      case 'bDuel': {
        const o = query.duelOdds(s, a.unit, a.target, a.stake)
        const cap = a.stake === 'capture' && target ? query.captureOdds(s, target.id) : null
        return { id, action: a, label: `Duel for ${a.stake === 'capture' ? 'capture' : 'honour'}`, detail: o ? `${target ? nameOf(target) : 'He'} accepts ${o.accept}% of the time; if he does, you win ${o.win}%.${cap !== null && a.stake === 'capture' ? ` A routed unit is captured ${cap}% of the time.` : ''}` : '' }
      }
      case 'bScuttle': return { id, action: a, label: `Scuttle the boat`, detail: 'Once per battle; the swimmer sinks the enemy boat.' }
      case 'bHeal': return { id, action: a, label: `Heal ${target ? nameOf(target) : ''}`, detail: 'Restores men.' }
      case 'bCounsel': return { id, action: a, label: `Counsel ${target ? nameOf(target) : ''}`, detail: 'The strategist gives a bonus to the next action.' }
      case 'bFire': return { id, action: a, label: 'Set fire here', detail: 'Burns this hex and spreads with the wind.' }
      default: return { id, action: a, label: a.t, detail: '' }
    }
  }

  function onTile(q: number, r: number): void {
    const w = window as unknown as { __ls108?: Record<string, unknown> }
    const here = byHex(q, r)
    let kind = 'clear'
    if (!live) { return }
    if (selUnit && myTurn) {
      const cands = forSel.filter((a) => (a.t === 'bMove' && a.to.q === q && a.to.r === r) || ('target' in a && a.target && here && a.target === here.id) || (a.t === 'bFire' && a.at.q === q && a.at.r === r))
      const moves = cands.filter((a) => a.t === 'bMove')
      if (moves.length === 1 && cands.length === 1) { kind = 'move'; w.__ls108 = { ...w.__ls108, lastPick: { q, r, kind } }; dispatch(moves[0]!); return }
      if (cands.length) {
        kind = 'menu'
        const opts = cands.map((a) => optsFor(a, here))
        if (here && here.side === b.human && here.id !== selUnit.id) opts.push({ id: 'select', label: `Select ${nameOf(here)}`, detail: '', select: true })
        setMenu({ q, r, opts, title: here ? nameOf(here) : 'This hex' })
        w.__ls108 = { ...w.__ls108, lastPick: { q, r, kind } }
        return
      }
    }
    if (here && here.side === b.human) { setSel(here.id); kind = 'select' }
    else if (here) { kind = 'inspect'; setHover({ q, r }) }
    else { setSel(null); kind = 'clear' }
    w.__ls108 = { ...w.__ls108, lastPick: { q, r, kind } }
  }

  useEffect(() => {
    const w = window as unknown as { __ls108?: Record<string, unknown> }
    w.__ls108 = {
      ...w.__ls108,
      battle: () => ({
        day: b.day, myTurn, human: b.human, selected: selUnit?.id ?? null,
        units: units.map((u) => ({ id: u.id, hero: u.hero, side: u.side, q: u.pos.q, r: u.pos.r, men: u.men })),
        moves: forSel.filter((a) => a.t === 'bMove').map((a) => (a.t === 'bMove' ? { q: a.to.q, r: a.to.r } : null)),
        foes: forSel.filter((a) => 'target' in a && a.target !== undefined && a.t !== 'bHeal' && a.t !== 'bCounsel').map((a) => ('target' in a ? a.target : null)),
      }),
    }
  })
  const inspectHex = hover
  const inspectUnit = (inspectHex && byHex(inspectHex.q, inspectHex.r)) || selUnit || null
  const hovTerr = inspectHex ? b.terrain[kk(inspectHex.q, inspectHex.r)] : undefined

  const speed = SPEED_MULT[settings.speed]
  const wave = vb.wave
  const stamps: Opt[] = []
  if (selUnit && myTurn) {
    for (const a of forSel) {
      if (a.t === 'bWait') stamps.push({ id: 'wait', label: 'Wait', detail: 'Hold position and rest.', action: a })
      if (a.t === 'bHide') stamps.push({ id: 'hide', label: 'Hide', detail: 'Vanish into cover.', action: a })
      if (a.t === 'bWeather') stamps.push({ id: `w${a.kind}${a.dir ?? ''}`, label: a.kind === 'wind' ? `Wind ${['E', 'NE', 'NW', 'W', 'SW', 'SE'][a.dir ?? 0]}` : `Call ${a.kind}`, detail: 'Once per battle.', action: a })
    }
  }
  const canWithdraw = legal.some((a) => a.t === 'bWithdraw')
  const dayPips = Array.from({ length: clock.days }, (_, i) => i + 1)
  const winSide = b.toAct === 'a' ? 'The attackers' : 'The defenders'
  const lastFeed = feed.slice(Math.max(0, feedIdx - 2), feedIdx)

  return (
    <div className="battle" data-testid="battle">
      <Scene
        terrain={b.terrain}
        burning={vb.burning}
        units={units}
        humanSide={b.human}
        marks={marks}
        speed={speed}
        onTile={onTile}
        onHover={(q, r) => setHover(q === null ? null : { q, r })}
      />
      <header className={`bt-top${clock.lastDays ? ' last' : ''}`} data-testid="battle-top">
        <div className="bt-title"><b>Battle for {prefName(b.target)}</b><small>from {prefName(b.origin)}</small></div>
        <div className="bt-day" data-testid="battle-day">
          <b className="num">Day {clock.day} of {clock.days}</b>
          <span className="pips" aria-hidden>{dayPips.map((d) => <i key={d} className={`${d === clock.day ? 'now' : d < clock.day ? 'past' : ''}${d > clock.days - 3 ? ' last' : ''}`} />)}</span>
          <small data-testid="days-left">{clock.daysLeft} day{clock.daysLeft === 1 ? '' : 's'} left{clock.lastDays ? '' : ''}</small>
          {clock.lastDays ? <span className="last-stamp" data-testid="last-days">LAST DAYS</span> : null}
        </div>
        <div className="bt-side"><span className="num">{b.toAct === b.human ? 'Your side acts' : `${winSide} act`}</span>
          <small>Food: attackers {clock.foodAttacker}, defenders {clock.foodDefender}{clock.hungry.a || clock.hungry.d ? ' (a side is hungry)' : ''}</small></div>
        {wave && wave.applies ? (
          <div className="bt-wave" data-testid="battle-wave">
            <b>Reinforcements</b>
            {wave.arrived.length ? <span> arrived: {wave.arrived.map((a) => `day ${a.day}: ${a.units} units`).join('; ')}.</span> : null}
            {wave.nextDay !== null ? <span> Next wave on day {wave.nextDay} ({Math.max(0, wave.nextDay - clock.day)} day{wave.nextDay - clock.day === 1 ? '' : 's'}): about {wave.forecast.units} units, {wave.forecast.men} men.</span> : <span> No more waves.</span>}
          </div>
        ) : null}
        {vb.weather ? <small className="bt-weather">Weather: {(vb.weather as { kind: string }).kind}. Wind {['east', 'north-east', 'north-west', 'west', 'south-west', 'south-east'][vb.wind] ?? ''}.</small> : null}
      </header>

      {!phone ? (
        <aside className="bt-left" data-testid="unit-list">
          <h4>Your units</h4>
          <ul>{mine.map((u) => (
            <li key={u.id}><button type="button" className={`ul-row${u.id === sel ? ' on' : ''}${u.acted && u.moved ? ' done' : ''}`} onClick={() => { setSel(u.id); setMenu(null) }} data-testid={`unit-${u.id}`}>
              <b>{nameOf(u)}{u.commander ? ' (commander)' : ''}</b><small>{KIND[u.kind]} · {u.men}/{u.maxMen} men</small>
            </button></li>
          ))}</ul>
          <p className="fine">{mineActive.length} unit{mineActive.length === 1 ? '' : 's'} can still act today.</p>
        </aside>
      ) : null}

      <aside className="bt-card" data-testid="unit-card">
        {inspectUnit ? <UnitCard s={s} u={inspectUnit} viewer={selUnit} side={b.human} terr={hovTerr ?? b.terrain[kk(inspectUnit.pos.q, inspectUnit.pos.r)]} /> : (
          <div className="uc-empty"><b>{hovTerr ? TERRAIN_NAME[hovTerr] : 'Tap a hex'}</b>{hovTerr ? <TerrainLine t={hovTerr} /> : <p className="fine">Tap one of your units to select it, then a hex to move or a foe to act.</p>}</div>
        )}
      </aside>

      <footer className="bt-bar">
        <div className="bt-msg" data-testid="battle-msg" aria-live="polite">
          {playing ? lastFeed.map((e, i) => <span key={i}>{e.text}</span>) : reject ? <span className="bad">{reject.message}</span> : <span>{myTurn ? (selUnit ? `${nameOf(selUnit)}: tap a blue hex to move or a ringed foe to act.` : 'Tap one of your units.') : s.pending ? 'Answer the challenge.' : 'The other side is acting.'}</span>}
        </div>
        <div className="bt-stamps">
          {stamps.map((o) => <Stamp key={o.id} small onClick={() => o.action && dispatch(o.action)} testId={`act-${o.id}`}>{o.label}</Stamp>)}
          {playing ? <Stamp kind="plain" onClick={skip} testId="skip">Skip</Stamp> : (
            <>
              <Stamp kind="confirm" disabled={!myTurn} why={null} onClick={() => dispatch({ t: 'bEndSide' })} testId="end-day">End the day</Stamp>
              <Stamp kind="plain" disabled={!live || !b.human || !!b.auto[b.human] || !!s.pending} onClick={() => setConfirm('auto')} testId="auto">Auto-resolve</Stamp>
              {canWithdraw ? <Stamp kind="danger" onClick={() => setConfirm('withdraw')} testId="withdraw">Withdraw</Stamp> : null}
            </>
          )}
        </div>
      </footer>

      {menu ? (
        <div className="bt-menu paper" data-testid="action-menu" role="menu">
          <header><b>{menu.title}</b><button type="button" className="x" onClick={() => setMenu(null)}>Close</button></header>
          {menu.opts.map((o) => (
            <button key={o.id} type="button" role="menuitem" className="variant" data-testid={`opt-${o.action?.t ?? o.id}${o.action && 'stake' in o.action ? `-${o.action.stake}` : ''}`} onClick={() => { if (o.select) { const u = byHex(menu.q, menu.r); if (u) setSel(u.id); setMenu(null) } else if (o.action) { setMenu(null); dispatch(o.action) } }}>
              <span className="vd">{o.label}</span><span className="vp">{o.detail}</span>
            </button>
          ))}
        </div>
      ) : null}
      {confirm === 'auto' ? (
        <Modal title="Auto-resolve this battle?" onClose={() => setConfirm(null)} testId="confirm-auto">
          <p>The AI plays your side to the end (W-28), exactly as it would play its own. You cannot take the battle back afterwards.</p>
          <div className="row"><Stamp kind="confirm" onClick={() => { setConfirm(null); dispatch({ t: 'bAuto' }) }} testId="auto-yes">Auto-resolve</Stamp><Stamp kind="plain" onClick={() => setConfirm(null)}>Keep fighting</Stamp></div>
        </Modal>
      ) : null}
      {confirm === 'withdraw' ? (
        <Modal title="Withdraw from the battle?" onClose={() => setConfirm(null)} testId="confirm-withdraw">
          <p>You lose this battle and Renown falls by 1 (R-3). Your units return to {prefName(b.origin)}.</p>
          <div className="row"><Stamp kind="danger" onClick={() => { setConfirm(null); dispatch({ t: 'bWithdraw' }) }} testId="withdraw-yes">Withdraw</Stamp><Stamp kind="plain" onClick={() => setConfirm(null)}>Stay</Stamp></div>
        </Modal>
      ) : null}
      {live && s.pending ? <PendingNote s={s} /> : null}
    </div>
  )
}

function TerrainLine({ t }: { t: string }) {
  const i = clientQuery.terrain(t as never)
  return <p className="fine">Move cost: foot {i.move.infantry >= 99 ? 'no' : i.move.infantry}, horse {i.move.cavalry >= 99 ? 'no' : i.move.cavalry}, boats {i.move.boats >= 99 ? 'no' : i.move.boats}. Defence {i.defence}%.{i.burns ? ' Burns.' : ''}{i.hides ? ' Hides a unit.' : ''}</p>
}

function UnitCard({ s, u, viewer, side, terr }: { s: GameState; u: BUnit; viewer: BUnit | null; side: string | null; terr?: string }) {
  const r = heroRec(u.hero)
  const fat = query.fatigue(s, u.id)
  const friendly = u.side === side
  const pv = viewer && !friendly ? query.attackPreview(s, viewer.id, u.id) : null
  const cap = !friendly ? query.captureOdds(s, u.id) : null
  return (
    <div className="unit-card" data-testid="uc">
      <h3>{heroName(u.hero)} {r ? <span className="zh">{r.nameZh}</span> : null}</h3>
      <p className="sub">{friendly ? 'Yours' : 'Foe'} · {KIND[u.kind]}{u.commander ? ' · Commander' : ''}{u.hidden ? ' · Hidden' : ''}</p>
      <dl className="uc-nums">
        <div><dt>Men</dt><dd>{u.men} / {u.maxMen} <Meter value={u.men} max={u.maxMen} /></dd></div>
        <div><dt>Morale</dt><dd>{u.morale} <Meter value={u.morale} tone={u.morale < 30 ? 'bad' : u.morale < 50 ? 'warn' : 'ok'} /></dd></div>
        <div><dt>Fatigue</dt><dd data-testid="fatigue">{fat?.value ?? u.fatigue} <Meter value={fat?.value ?? u.fatigue} tone={(fat?.value ?? 0) >= 60 ? 'bad' : (fat?.value ?? 0) >= 30 ? 'warn' : 'ok'} /></dd></div>
        <div><dt>Guard</dt><dd>{u.guard}</dd></div>
        <div><dt>Might / Command</dt><dd>{u.might} / {u.command}</dd></div>
      </dl>
      {fat && fat.causes.length ? <p className="fine" data-testid="fatigue-causes">Fatigue from: {fat.causes.map((c) => `${c.cause} +${c.n}`).join(', ')}.</p> : <p className="fine">No fatigue today.</p>}
      {u.skills.length ? <p className="skills">{u.skills.map((k) => <Tip key={k} text={k}><span className="skill-stamp">{skillName(k)}</span></Tip>)}</p> : null}
      <p className="fine">{u.acted ? 'Has acted. ' : ''}{u.moved ? 'Has moved. ' : ''}{terr ? <>On {TERRAIN_NAME[terr]?.toLowerCase()}. </> : null}</p>
      {terr ? <TerrainLine t={terr} /> : null}
      {pv ? <p className="odds-line" data-testid="hover-odds">If {heroName(viewer!.hero)} attacks: kills {pv.min}-{pv.max} men{pv.counter ? `, counter ${pv.counter.min}-${pv.counter.max}` : ''}.{cap !== null ? ` Captured if routed: ${cap}%.` : ''}</p> : cap !== null && !friendly ? <p className="odds-line">Captured if routed: {cap}%.</p> : null}
    </div>
  )
}
