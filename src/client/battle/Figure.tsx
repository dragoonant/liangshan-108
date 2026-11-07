// Procedural turned-wood figures in the house style (KB rule 7): about 2.8 head-heights, head about 35% of the height, broad shoulders,
// short thick legs, covered face, matte finish. No pointer handlers and no hit shapes (KB rule 25). No GLBs yet, so rule 26 has nothing to load.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import type { BUnit } from '../../engine'
import { hexToWorld } from './hexmath'

const noRay = (): void => undefined
const FRIEND = { body: '#2f9c78', dark: '#1f6b53', trim: '#e5d6a2' }
const FOE = { body: '#a2412f', dark: '#6e2a1f', trim: '#cdb98a' }
const SKIN = '#8a6a4a'
export const FIGURE_HEIGHT = 1.45

function Body({ pal, kind, commander }: { pal: typeof FRIEND; kind: BUnit['kind']; commander: boolean }) {
  const lift = kind === 'cavalry' ? 0.55 : kind === 'boats' ? 0.25 : 0
  return (
    <group raycast={noRay}>
      {/* base disc */}
      <mesh position={[0, 0.03, 0]} raycast={noRay}><cylinderGeometry args={[0.56, 0.6, 0.05, 20]} /><meshStandardMaterial color={pal.dark} roughness={0.9} /></mesh>
      {kind === 'cavalry' ? (
        <group raycast={noRay}>
          <mesh position={[0, 0.4, 0]} raycast={noRay}><boxGeometry args={[0.55, 0.5, 1.15]} /><meshStandardMaterial color="#6b4a30" roughness={0.9} /></mesh>
          <mesh position={[0, 0.62, 0.62]} rotation={[0.5, 0, 0]} raycast={noRay}><boxGeometry args={[0.28, 0.5, 0.3]} /><meshStandardMaterial color="#6b4a30" roughness={0.9} /></mesh>
          {[[-0.18, 0.4], [0.18, 0.4], [-0.18, -0.4], [0.18, -0.4]].map(([x, z], i) => <mesh key={i} position={[x!, 0.1, z!]} raycast={noRay}><boxGeometry args={[0.14, 0.2, 0.14]} /><meshStandardMaterial color="#4a3320" roughness={0.9} /></mesh>)}
        </group>
      ) : null}
      {kind === 'boats' ? (
        <mesh position={[0, 0.18, 0]} raycast={noRay}><boxGeometry args={[0.8, 0.3, 1.5]} /><meshStandardMaterial color="#6b4a30" roughness={0.9} /></mesh>
      ) : null}
      <group position={[0, lift, 0]} raycast={noRay}>
        {/* short thick legs, about one head long */}
        {[-0.17, 0.17].map((x) => <mesh key={x} position={[x, 0.2, 0]} raycast={noRay}><boxGeometry args={[0.28, 0.4, 0.3]} /><meshStandardMaterial color={pal.dark} roughness={0.9} /></mesh>)}
        {/* torso with very broad shoulders (about 1.8 head widths) */}
        <mesh position={[0, 0.64, 0]} raycast={noRay}><boxGeometry args={[0.7, 0.5, 0.46]} /><meshStandardMaterial color={pal.body} roughness={0.85} /></mesh>
        <mesh position={[0, 0.86, 0]} raycast={noRay}><boxGeometry args={[0.96, 0.16, 0.5]} /><meshStandardMaterial color={pal.dark} roughness={0.85} /></mesh>
        <mesh position={[0, 0.5, 0.24]} raycast={noRay}><boxGeometry args={[0.72, 0.1, 0.06]} /><meshStandardMaterial color={pal.trim} roughness={0.8} /></mesh>
        {/* head about 35% of the height, face covered by a cloth wrap */}
        <mesh position={[0, 1.2, 0]} raycast={noRay}><sphereGeometry args={[0.26, 16, 12]} /><meshStandardMaterial color={SKIN} roughness={0.9} /></mesh>
        <mesh position={[0, 1.15, 0.06]} raycast={noRay}><sphereGeometry args={[0.265, 16, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.3]} /><meshStandardMaterial color="#2a2a26" roughness={0.9} /></mesh>
        {kind === 'archers' ? (
          <mesh position={[0, 1.4, 0]} raycast={noRay}><coneGeometry args={[0.46, 0.22, 14]} /><meshStandardMaterial color={pal.trim} roughness={0.9} /></mesh>
        ) : (
          <mesh position={[0, 1.3, 0]} raycast={noRay}><sphereGeometry args={[0.285, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} /><meshStandardMaterial color={pal.dark} roughness={0.7} /></mesh>
        )}
        {/* weapon */}
        {kind === 'archers' ? (
          <mesh position={[0.52, 0.8, 0.1]} rotation={[0, 0, 0]} raycast={noRay}><torusGeometry args={[0.45, 0.025, 6, 16, Math.PI]} /><meshStandardMaterial color="#5a3d22" roughness={0.9} /></mesh>
        ) : (
          <mesh position={[0.55, 0.95, 0.1]} rotation={[0.08, 0, -0.06]} raycast={noRay}><cylinderGeometry args={[0.025, 0.025, kind === 'cavalry' ? 2.0 : 1.7, 6]} /><meshStandardMaterial color="#5a3d22" roughness={0.9} /></mesh>
        )}
        {commander ? (
          <group position={[-0.5, 0, -0.2]} raycast={noRay}>
            <mesh position={[0, 1.0, 0]} raycast={noRay}><cylinderGeometry args={[0.025, 0.025, 2.0, 6]} /><meshStandardMaterial color="#3a2a1a" /></mesh>
            <mesh position={[0.24, 1.78, 0]} raycast={noRay}><planeGeometry args={[0.48, 0.34]} /><meshStandardMaterial color={pal.trim} side={THREE.DoubleSide} roughness={0.9} /></mesh>
          </group>
        ) : null}
      </group>
    </group>
  )
}

export function Figure({ unit, friendly, speed, ground }: { unit: BUnit; friendly: boolean; speed: number; ground: number }) {
  const g = useRef<THREE.Group>(null)
  const bar = useRef<THREE.Mesh>(null)
  const w = hexToWorld(unit.pos.q, unit.pos.r)
  const pal = friendly ? FRIEND : FOE
  const prevMen = useRef(unit.men)
  const flash = useRef(0)
  const yaw = useRef(friendly ? Math.PI / 2 : -Math.PI / 2)
  const first = useRef(true)
  useFrame((_, dt) => {
    const o = g.current
    if (!o) return
    const tx = w.x, tz = w.z
    if (first.current || speed === 0) { o.position.set(tx, o.position.y, tz); first.current = false }
    else {
      const dx = tx - o.position.x, dz = tz - o.position.z
      const d = Math.hypot(dx, dz)
      if (d > 0.01) {
        const step = Math.min(d, (1.75 / (0.25 * speed)) * dt)
        o.position.x += (dx / d) * step; o.position.z += (dz / d) * step
        yaw.current = Math.atan2(dx, dz)
        o.position.y = Math.abs(Math.sin(performance.now() / 90)) * 0.12
      } else o.position.y = 0
    }
    o.rotation.y += (((yaw.current - o.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 10)
    if (unit.men < prevMen.current) flash.current = 0.35
    prevMen.current = unit.men
    if (flash.current > 0) flash.current -= dt
    if (bar.current) { const k = Math.max(0.02, unit.men / Math.max(1, unit.maxMen)); bar.current.scale.x = k; bar.current.position.x = -(1 - k) * 0.52 }
    o.traverse((m) => { const mm = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (mm && 'emissive' in mm) { mm.emissive.set(flash.current > 0 ? '#ff6a3a' : '#000000'); mm.emissiveIntensity = flash.current > 0 ? 0.9 : 0 } })
  })
  return (
    <group ref={g} raycast={noRay}>
      <group position={[0, ground, 0]} scale={1.2} raycast={noRay}>
        <Body pal={pal} kind={unit.kind} commander={unit.commander} />
        <Billboard position={[0, 2.45, 0]} raycast={noRay}>
          <mesh raycast={noRay}><planeGeometry args={[1.1, 0.16]} /><meshBasicMaterial color="#1d1911" /></mesh>
          <mesh ref={bar} position={[0, 0, 0.001]} raycast={noRay}><planeGeometry args={[1.04, 0.1]} /><meshBasicMaterial color={friendly ? '#7fd1a8' : '#e0795f'} /></mesh>
        </Billboard>
      </group>
    </group>
  )
}
