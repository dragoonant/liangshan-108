// Builds tests/e2e/fixtures/edict-save.json: a game after the Edict with two of the capital's five links held (open and cut refuge links on the map).
// Run: npx tsx tests/e2e/fixtures/make-edict-save.ts
import { writeFileSync } from 'node:fs'
import { buildSave, createGame } from '../../../src/engine'

const s = createGame({ startHero: 'song-jiang', difficulty: 2, seed: 21 })
s.t = 36
s.factions['player']!.edict = 30
s.factions['player']!.renown = 520
s.factions['player']!.renownHistory = Array.from({ length: 36 }, (_, i) => 30 + i * 14)
for (const id of ['yingtianfu', 'zhangde', 'caozhou', 'yanzhou', 'daming']) s.prefectures[id]!.owner = 'player'
writeFileSync(new URL('./edict-save.json', import.meta.url), JSON.stringify(buildSave(s, [], '2026-11-07T00:00:00.000Z')))
console.log('ok')
