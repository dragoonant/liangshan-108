import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as RPE } from 'react'
import { query } from '../../engine'
import type { GameState } from '../../engine'
import { viewOf } from '../store/game'
import { allPrefectures, links as allLinks, ownerColour, ownerLetter, ownerName, prefName, prefRec } from '../data'

const W = 1250, H = 1000
const px = (x: number): number => 60 + x * 1130
const py = (y: number): number => 50 + y * 900

function zigzag(ax: number, ay: number, bx: number, by: number): string {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len
  const n = Math.max(4, Math.floor(len / 9))
  let d = `M${ax},${ay}`
  for (let i = 1; i < n; i++) { const t = i / n, o = (i % 2 ? 1 : -1) * 3.2; d += ` L${(ax + dx * t + nx * o).toFixed(1)},${(ay + dy * t + ny * o).toFixed(1)}` }
  return d + ` L${bx},${by}`
}

interface VB { x: number; y: number; w: number }
export function StrategicMap({ s, sel, onSelect, targets }: { s: GameState; sel: string | null; onSelect: (id: string) => void; targets?: string[] }) {
  const v = viewOf(s)
  const wrap = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 900, h: 600 })
  const [vb, setVb] = useState<VB>({ x: 0, y: 0, w: W })
  const prefs = useMemo(() => allPrefectures(), [])
  const lk = useMemo(() => allLinks(), [])
  const snow = new Set([...v.forecast.now.snowedIn])
  const snowNext = new Set(v.forecast.next.snowedIn)
  const esc = v.renown.granted ? query.escapeRoutes(s) : null

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 900, h: el.clientHeight || 600 }))
    ro.observe(el)
    setSize({ w: el.clientWidth || 900, h: el.clientHeight || 600 })
    return () => ro.disconnect()
  }, [])

  // viewBox height follows the container aspect; the world is centred when it is smaller
  const vbh = vb.w * (size.h / size.w)
  const ppu = size.w / vb.w // screen px per user unit
  const ptrs = useRef(new Map<number, { x: number; y: number }>())
  const moved = useRef(0)
  const pinch = useRef<number | null>(null)

  const maxW = Math.max(W, H * (size.w / size.h)) * 1.05
  const clampVb = (n: VB): VB => {
    const w = Math.min(maxW, Math.max(220, n.w))
    const h = w * (size.h / size.w)
    const x = Math.min(W - w * 0.25, Math.max(-w * 0.75, n.x))
    const y = Math.min(H - h * 0.25, Math.max(-h * 0.75, n.y))
    return { x, y, w }
  }
  const zoomAt = (cx: number, cy: number, f: number): void => {
    setVb((o) => {
      const w = Math.min(maxW, Math.max(220, o.w * f))
      const ox = o.x + cx * o.w, oy = o.y + cy * o.w * (size.h / size.w)
      return clampVb({ x: ox - cx * w, y: oy - cy * w * (size.h / size.w), w })
    })
  }
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const f = (e: WheelEvent): void => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, e.deltaY > 0 ? 1.15 : 1 / 1.15)
    }
    el.addEventListener('wheel', f, { passive: false })
    return () => el.removeEventListener('wheel', f)
  })
  // first view: the player's neighbourhood, zoomed to where labels can be read; "Whole map" shows all 48
  const fit = (): void => {
    const w = Math.max(W, H * (size.w / size.h))
    setVb({ x: (W - w) / 2, y: (H - w * (size.h / size.w)) / 2, w })
  }
  const around = (id: string | null, w0: number): void => {
    const p = id ? prefRec(id) : null
    if (!p) return fit()
    const w = Math.min(maxW, w0)
    setVb({ x: px(p.pos.x) - w / 2, y: py(p.pos.y) - (w * (size.h / size.w)) / 2, w })
  }
  const aroundRef = useRef(around)
  aroundRef.current = around
  useEffect(() => { aroundRef.current(sel, size.w < 600 ? 360 : 520) }, [size.w, size.h]) // eslint-disable-line react-hooks/exhaustive-deps

  const down = (e: RPE): void => { ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved.current = 0; pinch.current = null }
  const move = (e: RPE): void => {
    const p = ptrs.current.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    p.x = e.clientX; p.y = e.clientY
    moved.current += Math.abs(dx) + Math.abs(dy)
    if (moved.current < 6) return
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()] as [{ x: number; y: number }, { x: number; y: number }]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.current) {
        const r = wrap.current!.getBoundingClientRect()
        zoomAt(((a.x + b.x) / 2 - r.left) / r.width, ((a.y + b.y) / 2 - r.top) / r.height, pinch.current / d)
      }
      pinch.current = d
    } else if (ptrs.current.size === 1) {
      setVb((o) => clampVb({ ...o, x: o.x - dx / ppu, y: o.y - dy / ppu }))
    }
  }
  const up = (e: RPE): void => { ptrs.current.delete(e.pointerId); pinch.current = null }
  const click = (id: string) => (): void => { if (moved.current < 6) onSelect(id) }

  const fs = 12.5 / ppu
  const showLabel = useMemo(() => {
    const order = [...prefs].sort((a, b) => {
      const pa = (a.id === sel ? 0 : v.prefectures[a.id]?.owner === 'player' ? 1 : a.id === 'dongjing' ? 2 : 3)
      const pb = (b.id === sel ? 0 : v.prefectures[b.id]?.owner === 'player' ? 1 : b.id === 'dongjing' ? 2 : 3)
      return pa - pb
    })
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = []
    const out = new Set<string>()
    for (const p of order) {
      const x = px(p.pos.x) + 12 / ppu, y = py(p.pos.y)
      const w = (prefName(p.id).length * 6.6 + 6) / ppu, h = 15 / ppu
      const b = { x0: x, y0: y - h * 0.6, x1: x + w, y1: y + h * 0.5 }
      if (boxes.some((o) => o.x0 < b.x1 && o.x1 > b.x0 && o.y0 < b.y1 && o.y1 > b.y0)) continue
      boxes.push(b); out.add(p.id)
    }
    return out
  }, [prefs, ppu, sel, v.prefectures])
  const rr = 8.5 / ppu
  const pos = (id: string): { x: number; y: number } => { const p = prefRec(id)!; return { x: px(p.pos.x), y: py(p.pos.y) } }
  const targetSet = new Set(targets ?? [])
  const cap = 'dongjing'

  return (
    <div className="map-wrap" ref={wrap} data-testid="map">
      <svg className="map" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vbh}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label="Map of the marsh country, 48 prefectures">
        <defs>
          <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" /><feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.26  0 0 0 0 0.1  0 0 0 0.22 0" /><feComposite in2="SourceGraphic" operator="in" /></filter>
          <radialGradient id="lamp" cx="50%" cy="45%" r="70%"><stop offset="0" stopColor="#f6ecc2" /><stop offset="0.6" stopColor="#e5d6a2" /><stop offset="1" stopColor="#bda46c" /></radialGradient>
          <radialGradient id="glow"><stop offset="0" stopColor="#f0a63c" stopOpacity="0.8" /><stop offset="1" stopColor="#f0a63c" stopOpacity="0" /></radialGradient>
        </defs>
        <rect x="-400" y="-400" width={W + 800} height={H + 800} fill="#10201f" />
        <rect x="20" y="10" width={W - 40} height={H - 20} rx="10" fill="url(#lamp)" stroke="#1d1911" strokeWidth={3 / ppu * 0.6} />
        <rect x="20" y="10" width={W - 40} height={H - 20} rx="10" fill="#fff" filter="url(#grain)" opacity="0.5" pointerEvents="none" />
        {/* the marsh around Liangshan: a teal wash with reed ticks */}
        {prefs.filter((p) => p.terrain === 'marsh' || p.terrain === 'river-delta').map((p) => (
          <g key={`m${p.id}`} pointerEvents="none">
            <ellipse cx={px(p.pos.x)} cy={py(p.pos.y)} rx="46" ry="30" fill="#2f6b72" opacity="0.18" />
            {[-26, -12, 6, 20, 30].map((o, i) => <path key={i} d={`M${px(p.pos.x) + o},${py(p.pos.y) + 22 - (i % 2) * 6} l-1.5,-9 M${px(p.pos.x) + o},${py(p.pos.y) + 22 - (i % 2) * 6} l2,-8`} stroke="#4d6a3c" strokeWidth="1.4" fill="none" />)}
          </g>
        ))}
        <g className="links">
          {lk.map((l) => {
            const a = pos(l.a), b = pos(l.b)
            const key = `${l.a}-${l.b}`, key2 = `${l.b}-${l.a}`
            const cut = snow.has(key) || snow.has(key2)
            const soon = snowNext.has(key) || snowNext.has(key2)
            const own = prefRec(l.a) && v.prefectures[l.a]?.owner === 'player' && v.prefectures[l.b]?.owner === 'player'
            const cls = `link ${l.kind}${cut ? ' snow' : ''}${soon ? ' snow-soon' : ''}${own ? ' own' : ''}`
            if (l.kind === 'mountain-pass') return <path key={key} className={cls} d={zigzag(a.x, a.y, b.x, b.y)} />
            return <g key={key}>
              {l.kind === 'river' ? <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="river-wash" /> : null}
              <line className={cls} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            </g>
          })}
        </g>
        {esc ? (
          <g data-testid="escape-routes">
            {esc.links.map((l) => {
              const a = pos(esc.at), b = pos(l.to)
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
              return <g key={l.to} className={`refuge ${l.state}`} data-state={l.state}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                {l.state === 'cut' ? <g transform={`translate(${mx} ${my})`}><circle r={7 / ppu} /><path d={`M${-4 / ppu},${-4 / ppu} L${4 / ppu},${4 / ppu} M${4 / ppu},${-4 / ppu} L${-4 / ppu},${4 / ppu}`} /></g> : <circle cx={mx} cy={my} r={4 / ppu} />}
              </g>
            })}
          </g>
        ) : null}
        <g className="nodes">
          {prefs.map((p) => {
            const pv = v.prefectures[p.id]!
            const { x, y } = pos(p.id)
            const colour = ownerColour(pv.owner)
            const isSel = sel === p.id
            const letter = ownerLetter(pv.owner)
            const warn = v.warnings.some((w) => w.pref === p.id)
            return (
              <g key={p.id} className={`node${isSel ? ' sel' : ''}${targetSet.has(p.id) ? ' target' : ''}`} onClick={click(p.id)} data-testid={`pref-${p.id}`} data-owner={pv.owner} role="button" tabIndex={0} aria-label={`${prefName(p.id)}, ${ownerName(pv.owner)}`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(p.id) }}>
                {isSel ? <circle cx={x} cy={y} r={rr * 3.2} fill="url(#glow)" /> : null}
                <circle cx={x} cy={y} r={rr * 1.9} fill="transparent" />
                <circle cx={x} cy={y} r={rr} fill="#f3e8bb" stroke={colour} strokeWidth={3.4 / ppu} />
                <circle cx={x} cy={y} r={rr * 0.42} fill={colour} />
                {p.id === cap ? <path d={`M${x - rr * 0.9},${y - rr * 1.4} h${rr * 1.8} v${-rr * 0.5} l${-rr * 0.9},${-rr * 0.5} l${-rr * 0.9},${rr * 0.5} z`} fill="#1d1911" /> : null}
                {letter ? <text x={x + rr * 0.95} y={y - rr * 0.8} fontSize={fs * 0.75} className="badge" fill={colour}>{letter}</text> : null}
                {warn ? <circle cx={x - rr * 0.95} cy={y - rr * 0.95} r={rr * 0.4} className="warn-dot" /> : null}
                {showLabel.has(p.id) ? <text x={x + rr * 1.5} y={y + fs * 0.33} fontSize={fs} className="plabel">{prefName(p.id)}</text> : null}
                {p.id === cap && pv.protectedCapital ? <text x={x + rr * 1.5} y={y + fs * 1.5} fontSize={fs * 0.78} className="plabel tag" data-testid="capital-protected">Protected until the Edict</text> : null}
                {p.id === cap && v.renown.granted ? <text x={x + rr * 1.5} y={y + fs * 1.5} fontSize={fs * 0.78} className="plabel tag open">Gate open</text> : null}
              </g>
            )
          })}
        </g>
      </svg>
      <div className="map-zoom">
        <button type="button" className="fit" onClick={fit} data-testid="map-fit">All</button>
        <button type="button" onClick={() => zoomAt(0.5, 0.5, 1 / 1.3)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomAt(0.5, 0.5, 1.3)} aria-label="Zoom out">&minus;</button>
      </div>
      <Legend />
    </div>
  )
}

function Legend() {
  return (
    <div className="map-legend" aria-hidden>
      <span><i className="sw road" />road</span><span><i className="sw river" />river</span><span><i className="sw marsh-water" />marsh water</span><span><i className="sw mountain-pass" />pass</span><span><i className="sw snow" />snowed in</span>
    </div>
  )
}
