import { describe, expect, test } from 'vitest'
import { defaultBundle as d } from '../../src/data'

describe('data loaders', () => {
  test('Q-5 the trigger table covers exactly the 23 joinsLate heroes', () => {
    const late = d.heroes.filter((h) => h.joinsLate).map((h) => h.id).sort()
    expect(late).toHaveLength(23)
    expect(d.triggers.map((t) => t.hero).sort()).toEqual(late)
  })
  test('loaders: 108 heroes, 48 prefectures, 73 links, 22 skills', () => {
    expect(d.heroes).toHaveLength(108)
    expect(d.map.prefectures).toHaveLength(48)
    expect(d.map.links).toHaveLength(73)
    expect(d.skills).toHaveLength(22)
  })
})
