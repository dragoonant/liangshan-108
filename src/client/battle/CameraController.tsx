// Mouse and touch camera (KB rules 25, 27). Wheel zooms towards the cursor; right drag rotates and tilts; middle drag pans;
// the left button drags to pan only until a middle press proves the mouse has one, then it only picks. Touch: one finger pans, two twist and pinch.
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export const MID_KEY = 'ls108-mouse-mid'
export interface Cam { tx: number; tz: number; yaw: number; pitch: number; dist: number }
export const camStore: { cam: Cam; dragging: boolean } = { cam: { tx: 0, tz: 0, yaw: 0, pitch: 0.95, dist: 22 }, dragging: false }

const clampCam = (c: Cam): void => { c.pitch = Math.min(1.35, Math.max(0.35, c.pitch)); c.dist = Math.min(40, Math.max(7, c.dist)) }
function readMid(): boolean { try { return localStorage.getItem(MID_KEY) === '1' } catch { return false } }

export function CameraController({ focus, centre, bounds }: { focus: { x: number; z: number }; centre: { x: number; z: number }; bounds: { x0: number; x1: number; z0: number; z1: number } }) {
  const { camera, gl } = useThree()
  const hasMid = useRef(readMid())
  const ptr = useRef(new Map<number, { x: number; y: number; button: number }>())
  const last = useRef<{ d: number; a: number; cx: number; cy: number } | null>(null)
  const ray = useRef(new THREE.Raycaster())
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))

  // initial framing: once per battle (focus is stable per battle)
  useEffect(() => {
    const aspect = gl.domElement.clientWidth / Math.max(1, gl.domElement.clientHeight)
    // wide screens frame the whole board; portrait phones frame your own units and let you pan
    camStore.cam = aspect >= 1
      ? { tx: centre.x, tz: centre.z, yaw: 0, pitch: 1.0, dist: Math.min(38, 1.22 * (0.5 * (bounds.x1 - bounds.x0) + 3) / (0.364 * aspect)) }
      : { tx: focus.x, tz: focus.z, yaw: 0, pitch: 0.95, dist: 22 }
  }, [focus.x, focus.z, centre.x, centre.z, gl]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const c = camStore.cam
    clampCam(c)
    c.tx = Math.min(bounds.x1 + 4, Math.max(bounds.x0 - 4, c.tx))
    c.tz = Math.min(bounds.z1 + 4, Math.max(bounds.z0 - 4, c.tz))
    const cp = Math.cos(c.pitch)
    camera.position.set(c.tx + c.dist * cp * Math.sin(c.yaw), c.dist * Math.sin(c.pitch), c.tz + c.dist * cp * Math.cos(c.yaw))
    camera.lookAt(c.tx, 0, c.tz)
  })

  useEffect(() => {
    const el = gl.domElement
    el.style.touchAction = 'none'
    const groundAt = (clientX: number, clientY: number): THREE.Vector3 | null => {
      const r = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1))
      ray.current.setFromCamera(ndc, camera)
      const out = new THREE.Vector3()
      return ray.current.ray.intersectPlane(plane.current, out)
    }
    const panBy = (dx: number, dy: number): void => {
      const c = camStore.cam
      const k = (2 * c.dist * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov) / 2)) / el.clientHeight
      const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw)
      const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw)
      c.tx -= rx * dx * k - fx * dy * k * 1.15
      c.tz -= rz * dx * k - fz * dy * k * 1.15
    }
    const down = (e: PointerEvent): void => {
      if (e.button === 1) { e.preventDefault(); if (!hasMid.current) { hasMid.current = true; try { localStorage.setItem(MID_KEY, '1') } catch { /* per-browser convenience */ } } }
      ptr.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.pointerType === 'touch' ? 0 : e.button })
      try { el.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
      last.current = null
      camStore.dragging = false
    }
    const move = (e: PointerEvent): void => {
      const p = ptr.current.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      p.x = e.clientX; p.y = e.clientY
      const c = camStore.cam
      if (e.pointerType === 'touch') {
        const ps = [...ptr.current.values()]
        if (ps.length === 1) panBy(dx, dy)
        else if (ps.length >= 2) {
          const [a, b] = [ps[0]!, ps[1]!]
          const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2
          if (last.current) {
            c.dist *= last.current.d / Math.max(20, d)
            let da = ang - last.current.a
            while (da > Math.PI) da -= 2 * Math.PI
            while (da < -Math.PI) da += 2 * Math.PI
            c.yaw -= da
            panBy(cx - last.current.cx, cy - last.current.cy)
          }
          last.current = { d, a: ang, cx, cy }
        }
        camStore.dragging = true
        return
      }
      if (p.button === 2) { c.yaw -= dx * 0.006; c.pitch += dy * 0.004; camStore.dragging = true }
      else if (p.button === 1) { panBy(dx, dy); camStore.dragging = true }
      else if (p.button === 0 && !hasMid.current) { panBy(dx, dy); camStore.dragging = Math.abs(dx) + Math.abs(dy) > 0 || camStore.dragging }
    }
    const up = (e: PointerEvent): void => { ptr.current.delete(e.pointerId); last.current = null; try { el.releasePointerCapture(e.pointerId) } catch { /* ok */ } setTimeout(() => { if (ptr.current.size === 0) camStore.dragging = false }, 0) }
    const wheel = (e: WheelEvent): void => {
      e.preventDefault()
      const before = groundAt(e.clientX, e.clientY)
      const c = camStore.cam
      c.dist *= e.deltaY > 0 ? 1.12 : 1 / 1.12
      clampCam(c)
      const cp = Math.cos(c.pitch)
      camera.position.set(c.tx + c.dist * cp * Math.sin(c.yaw), c.dist * Math.sin(c.pitch), c.tz + c.dist * cp * Math.cos(c.yaw))
      camera.lookAt(c.tx, 0, c.tz)
      camera.updateMatrixWorld()
      const after = groundAt(e.clientX, e.clientY)
      if (before && after) { c.tx += before.x - after.x; c.tz += before.z - after.z }
    }
    const ctx = (e: Event): void => e.preventDefault()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('contextmenu', ctx)
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel); el.removeEventListener('contextmenu', ctx)
    }
  }, [camera, gl])
  return null
}
