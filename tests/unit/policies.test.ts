import { describe, expect, test } from 'vitest'
import { createGame, step, legalActions, checkInvariants } from '../../src/engine'
import { POLICIES, SENSIBLE, policyAction, campaignPhaseNow, CAMPAIGN_PHASES } from '../../src/ai/policies'
import { D } from './helpers'

// PLAN D16: the sim's player policies answer only with an action taken from legalActions, never stall, and keep the invariants.
describe('D16 player policies', () => {
  test('D16 the six policies are campaign, justice, benevolent, warlord, brotherhood, careless and greedy', () => {
    expect([...POLICIES].sort()).toEqual(['benevolent', 'brotherhood', 'campaign', 'careless', 'greedy', 'justice', 'warlord'])
    expect([...SENSIBLE].sort()).toEqual(['benevolent', 'brotherhood', 'campaign', 'justice', 'warlord'])
  })
  for (const p of POLICIES) {
    test(`D16 ${p}: every action is accepted by step, comes from legalActions (greedy excepted) and 40 months keep the invariants`, () => {
      let s = createGame({ startHero: p === 'warlord' ? 'chao-gai' : 'song-jiang', difficulty: 2, seed: 11 }, D)
      let n = 0
      while (s.phase !== 'result' && s.t < 40 && n++ < 3000) {
        const legal = legalActions(s, D)
        expect(legal.length).toBeGreaterThan(0)
        const a = policyAction(p, s, legal, D)
        if (p !== 'greedy') expect(legal.some((x) => JSON.stringify(x) === JSON.stringify(a)), `${p}: ${JSON.stringify(a)} is not legal`).toBe(true)
        const r = step(s, a, D)
        expect(r.ok, `${p}: ${JSON.stringify(a)} ${r.ok ? '' : r.message}`).toBe(true)
        if (!r.ok) return
        s = r.state
        expect(checkInvariants(s, D)).toEqual([])
      }
      expect(n).toBeLessThan(3000)
    })
  }
  test('D23 the campaign policy names five phases and starts in grow', () => {
    expect(CAMPAIGN_PHASES).toEqual(['grow', 'expand', 'renown', 'stage', 'assault'])
    const s = createGame({ startHero: 'song-jiang', difficulty: 2, seed: 5 }, D)
    policyAction('campaign', s, legalActions(s, D), D)
    expect(campaignPhaseNow).toBe(1)
  })
})
