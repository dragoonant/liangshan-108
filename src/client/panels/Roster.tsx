import { useMemo, useState } from 'react'
import type { GameState } from '../../engine'
import { viewOf } from '../store/game'
import { allHeroIds, heroRec } from '../data'
import { Poster } from './Poster'

type Filter = 'all' | 'mine' | 'free' | 'court' | 'unknown'
const FILTERS: [Filter, string][] = [['all', 'All'], ['mine', 'Mine'], ['free', 'Free'], ['court', 'Court'], ['unknown', 'Not yet known']]

export function Roster({ s }: { s: GameState }) {
  const v = viewOf(s)
  const [f, setF] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const ids = useMemo(() => allHeroIds().filter((id) => id !== 'emperor-huizong').sort((a, b) => (heroRec(a)?.star?.rank ?? 500) - (heroRec(b)?.star?.rank ?? 500) || (a < b ? -1 : 1)), [])
  const list = ids.filter((id) => {
    const h = v.heroes[id]
    if (!h) return false
    const r = heroRec(id)!
    if (q && !`${r.name} ${r.nameZh} ${r.nickname ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false
    switch (f) {
      case 'mine': return h.faction === 'player' && ['chieftain', 'sworn', 'ordinary'].includes(h.status)
      case 'free': return h.status === 'free'
      case 'court': return h.faction === 'court'
      case 'unknown': return h.status === 'dormant'
      default: return true
    }
  })
  const mine = ids.filter((id) => v.heroes[id]?.faction === 'player' && ['chieftain', 'sworn', 'ordinary'].includes(v.heroes[id]!.status)).length
  return (
    <div className="roster" data-testid="roster">
      <div className="roster-bar">
        <div className="chips" role="radiogroup" aria-label="Filter">{FILTERS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={f === k} className={`chip${f === k ? ' on' : ''}`} onClick={() => setF(k)} data-testid={`filter-${k}`}>{l}</button>)}</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a hero" aria-label="Find a hero" data-testid="roster-find" />
      </div>
      <p className="fine"><span data-testid="roster-count">{list.length}</span> shown · {mine} serve you · {ids.length} heroes in all</p>
      <div className="poster-grid">{list.map((id) => <Poster key={id} id={id} s={s} />)}</div>
    </div>
  )
}
