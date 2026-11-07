export const pct = (x: number, m: number): number => Math.floor((x * m) / 100)
export const clamp = (lo: number, hi: number, x: number): number => Math.max(lo, Math.min(hi, x))
export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
export const hexKey = (q: number, r: number): string => `${q},${r}`
export function ceilDiv(a: number, b: number): number { return Math.ceil(a / b) }
