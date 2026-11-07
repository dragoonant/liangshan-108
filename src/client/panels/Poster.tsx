import { useState } from 'react'
import { clientQuery, query } from '../../engine'
import type { GameState } from '../../engine'
import { viewOf } from '../store/game'
import { heroRec, ownerName, prefName, skillEffect, skillName } from '../data'
import { Meter, Modal, Tip } from '../ui'

const initials = (n: string): string => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2)

function statusWords(status: string, faction: string): string {
  if (status === 'chieftain') return 'Your chieftain'
  if (status === 'sworn') return 'Sworn brother'
  if (status === 'ordinary') return faction === 'player' ? 'Serves you' : 'In service'
  if (status === 'captive') return 'Captive'
  if (status === 'dormant') return 'Whereabouts unknown'
  if (status === 'free') return 'Wandering, free to invite'
  return status
}

export function Poster({ id, s }: { id: string; s: GameState }) {
  const r = heroRec(id)
  const v = viewOf(s)
  const hv = v.heroes[id]
  if (!r || !hv) return null
  const mine = hv.faction === 'player' && ['chieftain', 'sworn', 'ordinary'].includes(hv.status)
  const loy = hv.loyalty !== undefined && hv.status === 'ordinary' ? query.loyalty(s, id) : null
  const trig = hv.status === 'dormant' || r.joinsLate ? clientQuery.triggerText(id) : null
  const ab = r.abilities
  return (
    <article className={`poster full${mine ? ' mine' : ''}`} data-testid={`poster-${id}`} data-status={hv.status}>
      <i className="nail tl" /><i className="nail tr" /><i className="nail bl" /><i className="nail br" />
      <div className="band">{r.star ? `Star ${r.star.rank} · ${r.star.group === 'heavenly' ? 'Heavenly Spirit' : 'Earthly Fiend'}` : 'Outside the 108'}</div>
      <div className="head">
        <div className="portrait" aria-hidden><span>{initials(r.name)}</span></div>
        <div className="names">
          <h3 className="pname">{r.name}</h3>
          <div className="zh">{r.nameZh}{r.star ? ` · ${r.star.nameZh}` : ''}</div>
          {r.nickname ? <em className="nick">{r.nickname}{r.nicknameZh ? ` · ${r.nicknameZh}` : ''}</em> : null}
        </div>
      </div>
      <dl className="abil">
        {([['Might', ab.might], ['Command', ab.command], ['Cunning', ab.cunning], ['Vigour', ab.vigour]] as const).map(([k, n]) => (
          <div key={k}><dt>{k}</dt><dd><Meter value={n} label={`${k} ${n}`} /><b className="num">{n}</b></dd></div>
        ))}
      </dl>
      <div className="virt">
        {([['Righteousness', r.virtues.righteousness], ['Compassion', r.virtues.compassion], ['Daring', r.virtues.daring]] as const).map(([k, n]) => (
          <span key={k} className="vrow"><i>{k}</i><span className="dots" role="img" aria-label={`${k} ${n} of 10`}>{Array.from({ length: 10 }, (_, i) => <b key={i} className={i < n ? 'on' : ''} />)}</span></span>
        ))}
      </div>
      <div className="skills">{r.skills.length ? r.skills.map((k) => <Tip key={k} text={skillEffect(k)}><span className="skill-stamp">{skillName(k)}</span></Tip>) : <span className="fine">No special skill.</span>}</div>
      <div className="where-line">
        <b>{statusWords(hv.status, hv.faction)}</b>
        {hv.loc ? ` · ${prefName(hv.loc)}` : ''}{hv.status !== 'dormant' && hv.faction !== 'player' ? ` · ${ownerName(hv.faction)}` : ''}
      </div>
      {hv.loyalty !== undefined && loy ? (
        <div className="loy" data-testid="loyalty">
          <span>Loyalty <b className="num">{hv.loyalty}</b> ({loy.label}{hv.wavering ? ', wavering' : ''}; settles near {loy.resting})</span>
          <Meter value={hv.loyalty} tone={hv.loyalty <= 25 ? 'bad' : hv.loyalty < 40 ? 'warn' : 'ok'} />
          {loy.monthsToDesertion !== null ? <small className="bad">Leaves in {loy.monthsToDesertion} month{loy.monthsToDesertion === 1 ? '' : 's'} unless loyalty rises.</small> : null}
        </div>
      ) : null}
      {trig ? <div className="whereabouts" data-testid="trigger"><b>Whereabouts unknown.</b> {trig}.</div> : null}
    </article>
  )
}

export function HeroTab({ id, s }: { id: string; s: GameState }) {
  const [open, setOpen] = useState(false)
  const v = viewOf(s)
  const hv = v.heroes[id]
  const r = heroRec(id)
  if (!hv || !r) return null
  const tone = hv.faction === 'player' ? 'mine' : hv.status === 'free' ? 'free' : 'other'
  return (
    <>
      <button type="button" className={`hero-tab ${tone}`} onClick={() => setOpen(true)} data-testid={`hero-tab-${id}`}>
        <b>{r.name}</b><small>{r.nameZh}{hv.loyalty !== undefined ? ` · ${hv.loyalty}` : ''}</small>
      </button>
      {open ? <Modal title={r.name} onClose={() => setOpen(false)}><Poster id={id} s={s} /></Modal> : null}
    </>
  )
}
