// Axial hex to world (pointy-top, circumradius 1). Presentation only; the engine owns every rule number.
export const HEX_R = 1
export const hexToWorld = (q: number, r: number): { x: number; z: number } => ({ x: Math.sqrt(3) * HEX_R * (q + r / 2), z: 1.5 * HEX_R * r })
export function worldToHex(x: number, z: number): { q: number; r: number } {
  const r = z / (1.5 * HEX_R)
  const q = x / (Math.sqrt(3) * HEX_R) - r / 2
  // cube rounding
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(-q - r)
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - (-q - r))
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  return { q: rq, r: rr }
}
export const TILE_COLOUR: Record<string, string> = {
  plain: '#d9c98f', road: '#c4ab74', forest: '#7f9a57', hill: '#b59b64', mountain: '#8f8266', reed: '#a9b66a', marsh: '#7fa5a0', water: '#3f7d86', village: '#caa070', wall: '#6b5f4c', gate: '#9a7a4a', keep: '#8a6d4e',
}
export const TILE_HEIGHT: Record<string, number> = { plain: 0.22, road: 0.2, forest: 0.24, hill: 0.55, mountain: 0.95, reed: 0.2, marsh: 0.12, water: 0.04, village: 0.24, wall: 1.05, gate: 0.3, keep: 0.6 }
export const TERRAIN_NAME: Record<string, string> = { plain: 'Plain', road: 'Road', forest: 'Forest', hill: 'Hill', mountain: 'Mountain', reed: 'Reeds', marsh: 'Marsh', water: 'Water', village: 'Village', wall: 'Wall', gate: 'Gate', keep: 'Keep' }
