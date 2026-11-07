import type { ReactNode, CSSProperties } from 'react'
import { useEffect, useState } from 'react'

export const FOOTER = 'Unofficial, non-commercial fan project; not affiliated with Koei Tecmo. By evilgouki.'

export function Footer() { return <p className="footer">{FOOTER}</p> }

interface StampProps {
  children: ReactNode
  onClick?: () => void
  kind?: 'order' | 'confirm' | 'danger' | 'jade' | 'plain'
  disabled?: boolean
  why?: string | null
  tilt?: number
  testId?: string
  small?: boolean
  pressed?: boolean
  'aria-label'?: string
}
/** An ink stamp: the one button vocabulary (spec 5). A disabled stamp keeps its shape and states why. */
export function Stamp({ children, onClick, kind = 'order', disabled, why, tilt, testId, small, pressed, ...rest }: StampProps) {
  const t = tilt ?? ((hash(String(typeof children === 'string' ? children : testId ?? 'x')) % 7) - 4)
  return (
    <span className="stamp-wrap">
      <button type="button" className={`stamp ${kind}${small ? ' small' : ''}${pressed ? ' on' : ''}`} style={{ '--tilt': `${t}deg` } as CSSProperties} onClick={disabled ? undefined : onClick} aria-disabled={disabled || undefined} data-testid={testId} {...rest}>
        {children}
      </button>
      {disabled && why ? <span className="why">{why}</span> : null}
    </span>
  )
}
export function hash(s: string): number { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }

export function Meter({ value, max = 100, label, tone }: { value: number; max?: number; label?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return <span className={`meter ${tone ?? ''}`} role="img" aria-label={label ?? `${value} of ${max}`}><i style={{ width: `${pct}%` }} /></span>
}

/** Custom hover card (rule 8: never a native tooltip). Appears on hover or keyboard focus. */
export function Tip({ text, children }: { text: string; children: ReactNode }) {
  return <span className="tip" tabIndex={0}>{children}<span className="tipbox" role="tooltip">{text}</span></span>
}

export function useIsPhone(): boolean {
  const q = '(max-width: 899px)'
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const f = (): void => setM(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return m
}

export function Modal({ title, children, onClose, wide, testId }: { title: string; children: ReactNode; onClose?: () => void; wide?: boolean; testId?: string }) {
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
      <div className={`modal paper${wide ? ' wide' : ''}`}>
        <header><h2>{title}</h2>{onClose ? <button className="x" type="button" onClick={onClose} aria-label="Close">Close</button> : null}</header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
export const fmt = (n: number): string => n.toLocaleString('en-US')
export const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`)
