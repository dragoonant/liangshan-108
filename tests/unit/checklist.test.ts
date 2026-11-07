import { describe, expect, test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// docs/spec/12-rules-test-checklist.md: every rule id needs a test (or test.todo with a reason) whose title starts with it.
const root = join(__dirname, '..', '..')
const ids = [...readFileSync(join(root, 'docs/spec/12-rules-test-checklist.md'), 'utf8').matchAll(/^- \[ \] ([A-Z]-\d+) \[/gm)].map((m) => m[1] as string)
const files = readdirSync(__dirname).filter((f) => f.endsWith('.test.ts') && f !== 'checklist.test.ts')
const titles = new Set<string>()
for (const f of files) {
  const src = readFileSync(join(__dirname, f), 'utf8')
  for (const m of src.matchAll(/\b(?:test|it)(?:\.todo)?\(\s*['"`]([A-Z]-\d+)\b/g)) titles.add(m[1] as string)
}

describe('12 checklist coverage', () => {
  test('the checklist lists 156 rule ids', () => { expect(ids.length).toBe(156) })
  test('every rule id has a test or a test.todo whose title starts with it', () => {
    const missing = ids.filter((i) => !titles.has(i))
    expect(missing).toEqual([])
  })
})
