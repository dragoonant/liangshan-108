import { useMemo, useState } from 'react'
import { legalActions, query } from '../../engine'
import type { Action, GameState } from '../../engine'
import { useGame, viewOf } from '../store/game'
import { heroName, heroRec, ownerName, ownerColour, prefName, prefRec, campRec } from '../data'
import { Meter, Modal, Stamp, fmt } from '../ui'
import { HeroTab } from './Poster'

interface OrderSpec { key: string; label: string; group: string; ask: string; match: (a: Action) => boolean }
const O = (key: string, label: string, group: string, ask: string, match: (a: Action) => boolean): OrderSpec => ({ key, label, group, ask, match })
const ORDERS: OrderSpec[] = [
  O('levy', 'Levy troops', 'Govern', 'Decide who raises the men. Each man costs 1 gold and a head of population, and support falls by 3.', (a) => a.t === 'levy'),
  O('train', 'Train the men', 'Govern', 'Decide who drills the garrison. Cost is paid in gold; training rises.', (a) => a.t === 'train'),
  O('forge', 'Forge arms', 'Govern', 'Decide who runs the forge. Gold becomes arms, which decide how well the men are armed.', (a) => a.t === 'forge'),
  O('dykes', 'Mend the dykes', 'Govern', 'Decide who repairs the dykes against floods.', (a) => a.t === 'dykes'),
  O('relieve', 'Relieve the poor', 'Govern', 'Decide who hands out relief. It raises support and earns Renown once a month per prefecture.', (a) => a.t === 'relieve'),
  O('rest', 'Hold a feast', 'Govern', 'Decide who hosts the feast. The heroes present gain loyalty.', (a) => a.t === 'rest'),
  O('trade', 'Trade food', 'Market', 'Decide who trades, whether to buy or sell food, and how much.', (a) => a.t === 'trade'),
  O('hunt', 'Hunt bandits', 'Hunt', 'Decide who leads the hunt and how many men go. A success earns Renown (capped each month).', (a) => a.t === 'hunt'),
  O('invite', 'Invite a hero', 'Recruit', 'Decide who makes the invitation and to whom. The gift costs 100 gold; the odds are shown.', (a) => a.t === 'recruit' && a.method === 'invite'),
  O('persuade', 'Persuade a captive', 'Recruit', 'Decide who talks to the prisoner. One try a month; the odds are shown.', (a) => a.t === 'recruit' && a.method === 'persuade'),
  O('swear', 'Swear brotherhood', 'Recruit', 'Decide which hero swears brotherhood with the chieftain. Sworn brothers command, never leave, and stay for good.', (a) => a.t === 'swear'),
  O('attack', 'March to attack', 'March', 'Decide the target, the heroes and the men who march. A battle follows on the hex board. Nothing is spent until you confirm.', (a) => a.t === 'attack'),
  O('move', 'Move heroes and men', 'March', 'Decide where the heroes and men go. They arrive at once.', (a) => a.t === 'move'),
  O('send', 'Send supplies', 'March', 'Decide what to send to a neighbouring prefecture of yours.', (a) => a.t === 'send'),
  O('ally', 'Offer an alliance', 'March', 'Decide who offers a mountain camp an alliance. It costs gold and lasts a fixed time; the odds are shown.', (a) => a.t === 'ally'),
  O('spy', 'Send a spy', 'Spy', 'Decide who goes, to which prefecture, and what the spy attempts.', (a) => a.t === 'spy'),
]
const GROUPS = ['Govern', 'Market', 'Hunt', 'Recruit', 'March', 'Spy']

const keyOf = (a: Action): string | null => {
  switch (a.t) {
    case 'move': case 'send': return a.to
    case 'attack': case 'spy': return a.target
    case 'ally': return a.camp
    case 'recruit': return a.target
    case 'swear': return a.hero
    default: return null
  }
}
const keyLabel = (a: Action): string => {
  const k = keyOf(a) ?? ''
  if (a.t === 'ally') return campRec(k)?.name ?? k
  if (a.t === 'recruit' || a.t === 'swear') return heroName(k)
  return prefName(k)
}
const ABIL = (id: string): string => { const r = heroRec(id); return r ? `Might ${r.abilities.might}, Command ${r.abilities.command}, Cunning ${r.abilities.cunning}, Vigour ${r.abilities.vigour}` : '' }
const OPS: Record<string, string> = { report: 'Scout report', steal: 'Steal supplies', discord: 'Sow discord', expose: 'Expose graft', burn: 'Burn stores', 'forged-order': 'Forge an order', jailbreak: 'Break out a prisoner' }

function describe(a: Action, withOrigin: boolean): string {
  const origin = withOrigin && 'pref' in a ? `From ${prefName(a.pref)}: ` : ''
  switch (a.t) {
    case 'levy': case 'train': case 'forge': case 'dykes': case 'relieve': case 'rest': return `${heroName(a.actor)} (${ABIL(a.actor)})`
    case 'trade': return `${heroName(a.actor)} ${a.dir === 'buyFood' ? 'buys' : 'sells'} ${fmt(a.amount)} food`
    case 'hunt': return `${heroName(a.actor)} leads${a.party.length ? ` with ${a.party.map(heroName).join(', ')}` : ' alone'}, ${fmt(a.men)} men`
    case 'recruit': return `${heroName(a.actor)} asks ${heroName(a.target)}`
    case 'swear': return heroName(a.hero)
    case 'move': return `${origin}${a.heroes.map(heroName).join(', ')} with ${fmt(a.men)} men`
    case 'send': return `${origin}${[a.gold ? `${fmt(a.gold)} gold` : '', a.food ? `${fmt(a.food)} food` : '', a.arms ? `${fmt(a.arms)} arms` : ''].filter(Boolean).join(', ')}`
    case 'attack': return `${origin}${a.heroes.map(heroName).join(', ')} with ${fmt(a.men)} men`
    case 'ally': return `${origin}${heroName(a.actor)} offers terms`
    case 'spy': return `${origin}${OPS[a.op] ?? a.op} by ${heroName(a.actor)}`
    default: return a.t
  }
}

export function PrefPanel({ s }: { s: GameState }) {
  const { sel, dispatch, tab, reject } = useGame()
  const v = viewOf(s)
  const [open, setOpen] = useState<string | null>(null)
  const legal = useMemo(() => (s.phase === 'strategic' && !s.pending ? legalActions(s) : []), [s])
  if (!sel) return <div className="panel-empty">Select a prefecture on the map.</div>
  const pv = v.prefectures[sel]!
  const rec = prefRec(sel)!
  const mine = pv.owner === 'player'
  const forSel = (a: Action): boolean => ('pref' in a && a.pref === sel)
  const against = (a: Action): boolean => (a.t === 'attack' || a.t === 'spy') && a.target === sel || (a.t === 'ally' && 'camp' in a && a.camp === pv.owner)
  const pool = mine ? legal.filter(forSel) : legal.filter(against)
  const order = open ? ORDERS.find((o) => o.key === open) : null
  const variants = order ? pool.filter(order.match) : []
  void tab
  const exact = pv.exact
  const approx = (n: number): string => (exact ? fmt(n) : `about ${fmt(n)}`)
  return (
    <div className="pref-panel" data-testid="pref-panel" data-pref={sel}>
      <header className="pp-head">
        <h2>{prefName(sel)} <span className="zh">{rec.nameZh}</span></h2>
        <span className="owner" style={{ '--c': ownerColour(pv.owner) } as React.CSSProperties}>{ownerName(pv.owner)}</span>
      </header>
      <p className="note">{rec.note}</p>
      <dl className="nums">
        <div><dt>Population</dt><dd>{approx(pv.pop)}</dd></div>
        <div><dt>Gold</dt><dd>{approx(pv.gold)}</dd></div>
        <div><dt>Food</dt><dd>{approx(pv.food)}</dd></div>
        <div><dt>Men</dt><dd>{approx(pv.men)}</dd></div>
        <div><dt>Arms</dt><dd>{approx(pv.arms)}</dd></div>
        {exact && pv.training !== undefined ? <div><dt>Training</dt><dd>{pv.training}</dd></div> : null}
        {exact && pv.support !== undefined ? <div><dt>Support</dt><dd>{pv.support} <Meter value={pv.support} tone={pv.support <= 25 ? 'bad' : pv.support <= 40 ? 'warn' : 'ok'} /></dd></div> : null}
        {exact && pv.land !== undefined ? <div><dt>Land</dt><dd>{pv.land}</dd></div> : null}
        {exact && pv.dyke !== undefined ? <div><dt>Dykes</dt><dd>{pv.dyke}</dd></div> : null}
        {exact && pv.bandits !== undefined ? <div><dt>Bandits</dt><dd>{pv.bandits}</dd></div> : null}
        {exact && pv.runway !== undefined ? <div><dt>Food lasts</dt><dd className={pv.runway < 2 ? 'bad' : ''}>{pv.runway >= 99 ? 'long' : `${pv.runway.toFixed(1)} months`}</dd></div> : null}
      </dl>
      {!exact ? <p className="fine">Numbers are rounded because no spy has reported here in the last 3 months (Z-5).</p> : null}
      {pv.protectedCapital ? <p className="note-cinnabar">Protected until the Edict: the capital cannot be attacked yet (G-5).</p> : null}
      <h3>Heroes here</h3>
      <div className="hero-tabs">{pv.heroes.length ? pv.heroes.map((h) => <HeroTab key={h} id={h} s={s} />) : <span className="fine">None.</span>}</div>
      {mine ? (
        <p className="cmds" data-testid="commands-left">Orders left this month: <b>{pv.commands ?? 0}</b></p>
      ) : (
        <p className="cmds">Orders against this prefecture come from your neighbouring prefectures.</p>
      )}
      {reject ? <p className="refused-line" role="alert" data-testid="reject"><span className="refused-stamp">REFUSED</span> {reject.message}</p> : null}
      {s.phase === 'strategic' && !s.pending ? (
        <div className="orders" data-testid="orders">
          {GROUPS.map((g) => {
            const os = ORDERS.filter((o) => o.group === g && pool.some(o.match))
            if (!os.length) return null
            return (
              <div key={g} className="order-group">
                <h4>{g}</h4>
                <div className="order-row">{os.map((o) => <Stamp key={o.key} onClick={() => setOpen(o.key)} testId={`order-${o.key}`}>{o.label}</Stamp>)}</div>
              </div>
            )
          })}
          {pool.length === 0 ? <p className="fine" data-testid="no-orders">{mine ? (pv.commands ? 'No order is possible here this month.' : 'No orders left here this month. End the month, or move a hero in to command.') : 'No order of yours can reach this prefecture. March on a neighbour first, or use a spy.'}</p> : null}
        </div>
      ) : null}
      {order && variants.length ? <Prompt s={s} order={order} variants={variants} withOrigin={!mine} onClose={() => setOpen(null)} onDo={(a) => { if (dispatch(a)) setOpen(null) }} /> : null}
    </div>
  )
}

function Prompt({ s, order, variants, withOrigin, onClose, onDo }: { s: GameState; order: OrderSpec; variants: Action[]; withOrigin: boolean; onClose: () => void; onDo: (a: Action) => void }) {
  const keys = [...new Set(variants.map((a) => keyOf(a) ?? ''))]
  const [key, setKey] = useState(keys[0] ?? '')
  const list = variants.filter((a) => (keyOf(a) ?? '') === key)
  const [idx, setIdx] = useState(0)
  const pick = list[Math.min(idx, list.length - 1)]
  const pv = pick ? query.preview(s, pick) : null
  const v = viewOf(s)
  const target = pick && pick.t === 'attack' ? v.prefectures[pick.target] : null
  const origin = pick && 'pref' in pick ? v.prefectures[pick.pref] : null
  const oath = pick && pick.t === 'swear' ? query.oath(s, pick.hero) : null
  const err = pv && 'code' in pv ? pv.message : null
  return (
    <Modal title={order.label} onClose={onClose} testId="prompt">
      <p className="ask" data-testid="prompt-ask">{order.ask}</p>
      {keys.length > 1 ? (
        <div className="chips" role="radiogroup" aria-label="Target">
          {keys.map((k) => {
            const a = variants.find((x) => (keyOf(x) ?? '') === k)!
            return <button key={k} type="button" role="radio" aria-checked={k === key} className={`chip${k === key ? ' on' : ''}`} onClick={() => { setKey(k); setIdx(0) }} data-testid={`target-${k}`}>{keyLabel(a)}</button>
          })}
        </div>
      ) : null}
      <ul className="variants" role="radiogroup" aria-label="Choice">
        {list.map((a, i) => {
          const p = query.preview(s, a)
          return (
            <li key={i}>
              <button type="button" role="radio" aria-checked={i === idx} className={`variant${i === idx ? ' on' : ''}`} onClick={() => setIdx(i)} data-testid={`variant-${i}`}>
                <span className="vd">{describe(a, withOrigin)}</span>
                {'code' in p ? <span className="vp bad">{p.message}</span> : <span className="vp">{p.text}{p.pct !== undefined ? <b className="odds"> Odds {p.pct}%</b> : null}{p.gold ? ` · ${fmt(p.gold)} gold` : ''}{p.food ? ` · ${fmt(p.food)} food` : ''}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {target && origin ? <p className="fine" data-testid="attack-numbers">Defenders: {target.exact ? '' : 'about '}{fmt(target.men)} men, {target.heroes.length} hero{target.heroes.length === 1 ? '' : 'es'} present. Your garrison here: {fmt(origin.men)} men. {target.exact ? '' : 'A spy report would make the numbers exact.'}</p> : null}
      {oath ? <p className="fine" data-testid="oath-note">{oath.ok ? 'Ready to swear.' : `Not yet: ${oath.missing.join('; ')}`}</p> : null}
      {pv && !err ? <p className="decides"><b>This decides:</b> {order.label.toLowerCase()}: {pick ? describe(pick, false) : ''}{pick && withOrigin && 'pref' in pick ? `, from ${prefName(pick.pref)}` : ''}. No undo.</p> : null}
      <div className="row"><Stamp kind="confirm" disabled={!pick || !!err} why={err} onClick={() => pick && onDo(pick)} testId="confirm">Confirm</Stamp><Stamp kind="plain" onClick={onClose} testId="cancel">Cancel</Stamp></div>
    </Modal>
  )
}
