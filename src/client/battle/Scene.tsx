// The battlefield. Tiles are the only pick target (KB rule 25): figures, bars and effects carry no pointer handlers.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { BUnit } from '../../engine'
import { hexToWorld, TILE_COLOUR, TILE_HEIGHT, worldToHex } from './hexmath'
import { CameraController, camStore } from './CameraController'
import { Figure } from './Figure'

export type Mark = 'move' | 'attack' | 'selected' | 'hover' | 'target'
export interface SceneProps {
  terrain: Record<string, string>
  burning: Record<string, number>
  units: BUnit[]
  humanSide: 'a' | 'd' | null
  marks: Record<string, Mark[]>
  speed: number // 0 = instant
  onTile(q: number, r: number): void
  onHover(q: number | null, r: number): void
}
const noRay = (): void => undefined
const TILE_GEO = (() => { const g = new THREE.CylinderGeometry(0.97, 0.97, 1, 6); g.translate(0, 0.5, 0); return g })()

function Tiles({ terrain, marks, onTile, onHover }: Pick<SceneProps, 'terrain' | 'marks' | 'onTile' | 'onHover'>) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const keys = useMemo(() => Object.keys(terrain).sort(), [terrain])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const col = useMemo(() => new THREE.Color(), [])
  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    keys.forEach((k, i) => {
      const [q, r] = k.split(',').map(Number) as [number, number]
      const w = hexToWorld(q, r)
      tmp.position.set(w.x, 0, w.z)
      tmp.scale.set(1, TILE_HEIGHT[terrain[k]!] ?? 0.2, 1)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [keys, terrain, tmp])
  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    keys.forEach((k, i) => {
      col.set(TILE_COLOUR[terrain[k]!] ?? '#d9c98f')
      const ms = marks[k] ?? []
      if (ms.includes('move')) col.lerp(new THREE.Color('#3f7fe0'), 0.62)
      if (ms.includes('attack')) col.lerp(new THREE.Color('#c0392a'), 0.6)
      if (ms.includes('target')) col.lerp(new THREE.Color('#f0a63c'), 0.45)
      if (ms.includes('selected')) col.lerp(new THREE.Color('#f0a63c'), 0.75)
      if (ms.includes('hover')) col.lerp(new THREE.Color('#ffffff'), 0.28)
      m.setColorAt(i, col)
    })
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [keys, terrain, marks, col])
  return (
    <instancedMesh
      ref={mesh}
      args={[TILE_GEO, undefined, keys.length]}
      key={keys.length}
      onClick={(e) => {
        if (camStore.dragging || e.delta > 6) return
        e.stopPropagation()
        const i = e.instanceId
        if (i === undefined) return
        const [q, r] = keys[i]!.split(',').map(Number) as [number, number]
        onTile(q, r)
      }}
      onPointerMove={(e) => {
        const i = e.instanceId
        if (i === undefined) return
        const [q, r] = keys[i]!.split(',').map(Number) as [number, number]
        onHover(q, r)
      }}
      onPointerOut={() => onHover(null, 0)}
    >
      <meshStandardMaterial roughness={0.95} metalness={0} />
    </instancedMesh>
  )
}

/** Trees, reeds, houses, towers: decoration only, never pickable. */
function Decor({ terrain }: { terrain: Record<string, string> }) {
  const groups = useMemo(() => {
    const trees: THREE.Matrix4[] = [], reeds: THREE.Matrix4[] = [], houses: THREE.Matrix4[] = [], towers: THREE.Matrix4[] = [], peaks: THREE.Matrix4[] = [], blocks: THREE.Matrix4[] = []
    const o = new THREE.Object3D()
    const add = (arr: THREE.Matrix4[], x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0): void => { o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(0, ry, 0); o.updateMatrix(); arr.push(o.matrix.clone()) }
    const rnd = (n: number): number => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }
    for (const [k, t] of Object.entries(terrain)) {
      const [q, r] = k.split(',').map(Number) as [number, number]
      const w = hexToWorld(q, r)
      const h = TILE_HEIGHT[t] ?? 0.2
      const seed = q * 31 + r * 17
      if (t === 'forest') for (let i = 0; i < 3; i++) add(trees, w.x + (rnd(seed + i) - 0.5) * 1.1, h, w.z + (rnd(seed + i + 9) - 0.5) * 1.1, 1, 0.8 + rnd(seed + i + 3) * 0.7, 1)
      if (t === 'reed') for (let i = 0; i < 7; i++) add(reeds, w.x + (rnd(seed + i) - 0.5) * 1.3, h, w.z + (rnd(seed + i + 5) - 0.5) * 1.3, 1, 0.7 + rnd(seed + i + 2) * 0.8, 1)
      if (t === 'village') for (let i = 0; i < 2; i++) add(houses, w.x + (i ? 0.35 : -0.3), h + 0.17, w.z + (i ? -0.2 : 0.2), 1, 1, 1, 0.4 * i)
      if (t === 'keep') add(towers, w.x, h + 0.55, w.z, 1, 1, 1)
      if (t === 'mountain') add(peaks, w.x, h, w.z, 1, 1, 1)
      if (t === 'wall') add(blocks, w.x, h, w.z, 1, 1, 1)
      if (t === 'gate') { add(blocks, w.x - 0.55, 0.3, w.z, 0.35, 1, 0.8); add(blocks, w.x + 0.55, 0.3, w.z, 0.35, 1, 0.8) }
    }
    return { trees, reeds, houses, towers, peaks, blocks }
  }, [terrain])
  const set = (m: THREE.InstancedMesh | null, arr: THREE.Matrix4[]): void => { if (!m) return; arr.forEach((a, i) => m.setMatrixAt(i, a)); m.instanceMatrix.needsUpdate = true }
  const mk = (arr: THREE.Matrix4[], geo: React.ReactNode, colour: string) => arr.length ? (
    <instancedMesh key={`${colour}${arr.length}`} args={[undefined, undefined, arr.length]} ref={(m) => set(m, arr)} raycast={noRay}>{geo}<meshStandardMaterial color={colour} roughness={1} /></instancedMesh>
  ) : null
  return (
    <group>
      {mk(groups.trees, <coneGeometry args={[0.3, 0.9, 6]} />, '#3f5f34')}
      {mk(groups.reeds, <cylinderGeometry args={[0.025, 0.04, 0.9, 4]} />, '#5d7a3a')}
      {mk(groups.houses, <boxGeometry args={[0.45, 0.34, 0.4]} />, '#8a5a3a')}
      {mk(groups.towers, <cylinderGeometry args={[0.42, 0.5, 1.1, 8]} />, '#7a6a52')}
      {mk(groups.peaks, <coneGeometry args={[0.7, 1.2, 5]} />, '#756a58')}
      {mk(groups.blocks, <boxGeometry args={[1.6, 1, 1.0]} />, '#5a5040')}
    </group>
  )
}

function Fires({ burning }: { burning: Record<string, number> }) {
  const refs = useRef<THREE.Mesh[]>([])
  useFrame(({ clock }) => { refs.current.forEach((m, i) => { if (m) { const f = 0.8 + 0.25 * Math.sin(clock.elapsedTime * 9 + i * 2.1); m.scale.set(f, f * 1.2, f) } }) })
  return <group>{Object.keys(burning).map((k, i) => {
    const [q, r] = k.split(',').map(Number) as [number, number]
    const w = hexToWorld(q, r)
    return <mesh key={k} ref={(m) => { if (m) refs.current[i] = m }} position={[w.x, 0.7, w.z]} raycast={noRay}><coneGeometry args={[0.38, 0.9, 6]} /><meshBasicMaterial color="#f0782a" transparent opacity={0.85} /></mesh>
  })}</group>
}

/** Test and tooling hook: camera numbers and screen projection of hexes/figures. Read-only. */
function Hooks({ units }: { units: BUnit[] }) {
  const { camera, gl, scene } = useThree()
  useEffect(() => {
    const el = gl.domElement
    const proj = (x: number, y: number, z: number): { x: number; y: number } => {
      camera.updateMatrixWorld()
      const v = new THREE.Vector3(x, y, z).project(camera)
      const r = el.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    }
    const api = {
      camera: () => ({ ...camStore.cam }),
      project: (q: number, r: number, y = 0.3) => { const w = hexToWorld(q, r); return proj(w.x, y, w.z) },
      /** Screen point on a figure's head, and the hex whose tile lies behind it along that line of sight (first tile hit, tiles only). */
      behind: (unitId: string) => {
        const u = units.find((x) => x.id === unitId)
        if (!u) return null
        const w = hexToWorld(u.pos.q, u.pos.r)
        const head = new THREE.Vector3(w.x, 1.75, w.z)
        const rc = new THREE.Raycaster(camera.position.clone(), head.clone().sub(camera.position).normalize())
        const hit = rc.intersectObjects(scene.children, true).filter((h) => (h.object as THREE.InstancedMesh).isInstancedMesh && h.instanceId !== undefined && (h.object as THREE.Object3D).userData['tiles'])[0]
        const p = hit ? hit.point : null
        const hex = p ? worldToHex(p.x, p.z) : null
        return { screen: proj(head.x, head.y, head.z), hex, own: u.pos }
      },
    }
    ;(window as unknown as { __ls108: Record<string, unknown> }).__ls108 = { ...(window.__ls108 ?? {}), ...api }
  }, [camera, gl, scene, units])
  return null
}

export function Scene(p: SceneProps) {
  const xs = Object.keys(p.terrain).map((k) => { const [q, r] = k.split(',').map(Number) as [number, number]; return hexToWorld(q, r) })
  const bounds = { x0: Math.min(...xs.map((w) => w.x)), x1: Math.max(...xs.map((w) => w.x)), z0: Math.min(...xs.map((w) => w.z)), z1: Math.max(...xs.map((w) => w.z)) }
  const mine = p.units.filter((u) => u.side === p.humanSide)
  const pts = (mine.length ? mine : p.units).map((u) => hexToWorld(u.pos.q, u.pos.r))
  const focus = pts.length ? { x: pts.reduce((a, b) => a + b.x, 0) / pts.length, z: pts.reduce((a, b) => a + b.z, 0) / pts.length } : { x: (bounds.x0 + bounds.x1) / 2, z: (bounds.z0 + bounds.z1) / 2 }
  const centre = { x: (bounds.x0 + bounds.x1) / 2, z: (bounds.z0 + bounds.z1) / 2 }
  return (
    <Canvas className="board-canvas" dpr={[1, 2]} camera={{ fov: 40, near: 0.5, far: 200, position: [0, 20, 20] }} gl={{ antialias: true, preserveDrawingBuffer: true }} data-testid="board" onPointerMissed={() => undefined}>
      <color attach="background" args={['#0d1b1c']} />
      <fog attach="fog" args={['#0d1b1c', 40, 90]} />
      <hemisphereLight args={['#f6e7b8', '#1c2b2a', 1.15]} />
      <directionalLight position={[8, 18, 6]} intensity={1.6} color="#ffd9a0" />
      <pointLight position={[centre.x, 7, centre.z]} intensity={90} distance={40} color="#f0a63c" />
      <group userData={{ tiles: true }}>
        <TilesTagged {...p} />
      </group>
      <Decor terrain={p.terrain} />
      <Fires burning={p.burning} />
      {p.units.map((u) => <Figure key={u.id} unit={u} friendly={u.side === p.humanSide} speed={p.speed} ground={TILE_HEIGHT[p.terrain[`${u.pos.q},${u.pos.r}`] ?? 'plain'] ?? 0.2} />)}
      <mesh position={[centre.x, -0.05, centre.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRay}><planeGeometry args={[220, 220]} /><meshStandardMaterial color="#13302f" roughness={1} /></mesh>
      <CameraController focus={focus} centre={centre} bounds={bounds} />
      <Hooks units={p.units} />
    </Canvas>
  )
}

function TilesTagged(p: SceneProps) {
  const ref = useRef<THREE.Group>(null)
  useEffect(() => { ref.current?.traverse((o) => { o.userData['tiles'] = true }) })
  return <group ref={ref}><Tiles terrain={p.terrain} marks={p.marks} onTile={p.onTile} onHover={p.onHover} /></group>
}
