import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { DESKTOP, PHONE, endMonth, hook, month, openGame, settle, tap } from './helpers'

interface BattleInfo { day: number; myTurn: boolean; human: string; selected: string | null; units: { id: string; hero: string; side: string; q: number; r: number; men: number }[]; moves: { q: number; r: number }[]; foes: string[] }
const info = (page: Page): Promise<BattleInfo> => hook<BattleInfo>(page, '(h) => h.battle()')
const project = (page: Page, q: number, r: number): Promise<{ x: number; y: number }> => page.evaluate(([a, b]) => (window.__ls108 as unknown as { project(q: number, r: number): { x: number; y: number } }).project(a as number, b as number), [q, r])

for (const [name, vp, touch] of [['desktop', DESKTOP, false], ['phone', PHONE, true]] as const) {
  test.describe(name, () => {
    test.use({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 })

    test('start a game and play two months by clicks', async ({ page }) => {
      await openGame(page)
      await expect(page.getByTestId('hud-month')).toHaveText('Jan 1101')
      await expect(page.getByTestId('months-left')).toHaveText('143')
      await expect(page.getByTestId('edict-status')).toBeVisible()
      await expect(page.getByTestId('edict-projection')).toContainText('needed by Jul 1111')
      await expect(page.getByTestId('capital-protected')).toContainText('Protected until the Edict')
      // month 1: a real order by clicks (relieve the poor), with its prompt and odds before committing
      if (touch) await page.getByTestId('sheet-handle').click()
      await page.getByTestId('order-relieve').click()
      await expect(page.getByTestId('prompt-ask')).toContainText('Decide who')
      await page.getByTestId('confirm').click()
      await expect(page.getByTestId('commands-left')).toContainText('1')
      await endMonth(page)
      await expect(page.getByTestId('hud-month')).toHaveText('Feb 1101')
      // month 2: hunt bandits, then end
      if (touch && !(await page.getByTestId('order-hunt').isVisible())) await page.getByTestId('sheet-handle').click()
      await page.getByTestId('order-hunt').click()
      await page.getByTestId('confirm').click()
      await endMonth(page)
      await expect(page.getByTestId('hud-month')).toHaveText('Mar 1101')
      // the event log keeps everything since the start (C8)
      if (touch && !(await page.getByTestId('tab-log').isVisible())) await page.getByTestId('sheet-handle').click()
      await page.getByTestId('tab-log').click()
      const n = Number(await page.getByTestId('log-count').innerText())
      expect(n).toBeGreaterThan(5)
      await page.getByTestId('tab-ledger').click()
      await expect(page.getByTestId('ledger-col-justice')).toBeVisible()
      await expect(page.getByTestId('ledger-col-heroes')).toBeVisible()
    })

    test('fight one battle by clicks to its end', async ({ page }) => {
      await openGame(page, { seed: 7 })
      await page.getByTestId('pref-zhujiazhuang').click({ force: true })
      if (touch) await expect(page.getByTestId('sheet')).toHaveClass(/open/)
      await page.getByTestId('order-attack').click()
      await expect(page.getByTestId('attack-numbers')).toContainText('Defenders')
      await page.getByTestId('confirm').click()
      await page.getByTestId('battle').waitFor()
      await expect(page.getByTestId('battle-day')).toContainText('Day 1 of 20')
      await page.waitForTimeout(800)
      // play a few days by tile clicks: move the commander forward, strike when a foe is in reach, end the day
      let attacked = false
      for (let day = 0; day < 4; day++) {
        let b = await info(page)
        for (const mine of b.units.filter((u) => u.side === b.human)) {
          if (touch || true) {
            const p = await project(page, mine.q, mine.r)
            await tap(page, p.x, p.y, touch)
          }
          b = await info(page)
          if (b.selected !== mine.id) continue
          if (b.foes.length && !attacked) {
            const foe = b.units.find((u) => u.id === b.foes[0])!
            const p = await project(page, foe.q, foe.r)
            await tap(page, p.x, p.y, touch)
            await page.getByTestId('action-menu').waitFor()
            await expect(page.getByTestId('action-menu')).toContainText(/Kills \d+-\d+ men/)
            await page.locator('[data-testid="action-menu"] [role=menuitem]').first().click()
            attacked = true
          } else if (b.moves.length) {
            const foes = b.units.filter((u) => u.side !== b.human)
            const dist = (m: { q: number; r: number }): number => Math.min(...foes.map((f) => Math.abs(f.q - m.q) + Math.abs(f.r - m.r) + Math.abs(f.q + f.r - m.q - m.r)))
            const best = [...b.moves].sort((x, y) => dist(x) - dist(y))[0]!
            const p = await project(page, best.q, best.r)
            await tap(page, p.x, p.y, touch)
          }
        }
        await page.getByTestId('end-day').click()
        await page.waitForTimeout(300)
        if (await page.getByTestId('pending').isVisible().catch(() => false)) await page.locator('[data-testid="pending"] .variant').first().click()
        if (!(await page.getByTestId('battle').isVisible().catch(() => false))) break
      }
      if (await page.getByTestId('battle').isVisible().catch(() => false)) {
        await expect(page.getByTestId('battle-day')).toContainText(/Day [2-9]|Day 1\d/)
        await page.getByTestId('auto').click()
        await page.getByTestId('auto-yes').click()
      }
      await expect(page.getByTestId('battle-report')).toBeVisible()
      await page.getByTestId('report-close').click()
      await expect(page.getByTestId('end-month')).toBeVisible()
    })

    test('a tap on the tile behind a figure reaches that tile', async ({ page }) => {
      await openGame(page, { seed: 7 })
      await page.getByTestId('pref-zhujiazhuang').click({ force: true })
      await page.getByTestId('order-attack').click()
      await page.getByTestId('confirm').click()
      await page.getByTestId('battle').waitFor()
      await page.waitForTimeout(1200)
      const b = await info(page)
      let proved = 0
      for (const u of b.units) {
        const r = await page.evaluate((id) => (window.__ls108 as unknown as { behind(id: string): { screen: { x: number; y: number }; hex: { q: number; r: number } | null; own: { q: number; r: number } } | null }).behind(id), u.id)
        if (!r || !r.hex || (r.hex.q === r.own.q && r.hex.r === r.own.r)) continue
        const vpSize = page.viewportSize()!
        if (r.screen.x < 5 || r.screen.y < 5 || r.screen.x > vpSize.width - 5 || r.screen.y > vpSize.height - 5) continue
        // the figure's head is under the pointer; the tile behind it is what must be picked
        await tap(page, r.screen.x, r.screen.y, touch)
        const pick = await page.evaluate(() => (window.__ls108 as unknown as { lastPick: { q: number; r: number } }).lastPick)
        expect(pick, `figure ${u.id}`).toMatchObject({ q: r.hex.q, r: r.hex.r })
        proved++
        if (proved >= 2) break
      }
      expect(proved).toBeGreaterThan(0)
    })
  })
}

test.describe('desktop mouse (KB rule 27)', () => {
  test.use({ viewport: DESKTOP })
  test('left drag pans until a middle press, middle pans, right rotates, wheel zooms', async ({ page }) => {
    await openGame(page, { seed: 7 })
    await page.getByTestId('pref-zhujiazhuang').click({ force: true })
    await page.getByTestId('order-attack').click()
    await page.getByTestId('confirm').click()
    await page.getByTestId('battle').waitFor()
    await page.waitForTimeout(1000)
    const cam = (): Promise<{ tx: number; tz: number; yaw: number; pitch: number; dist: number }> => page.evaluate(() => (window.__ls108 as unknown as { camera(): { tx: number; tz: number; yaw: number; pitch: number; dist: number } }).camera())
    const drag = async (button: 'left' | 'middle' | 'right', dx: number, dy: number): Promise<void> => {
      await page.mouse.move(720, 450)
      await page.mouse.down({ button })
      await page.mouse.move(720 + dx / 2, 450 + dy / 2, { steps: 4 })
      await page.mouse.move(720 + dx, 450 + dy, { steps: 4 })
      await page.mouse.up({ button })
    }
    await page.evaluate(() => localStorage.removeItem('ls108-mouse-mid')) // a fresh profile: no middle button seen yet
    await page.reload()
    // reopening goes through Continue (autosave)
    await page.getByTestId('continue').click()
    await page.getByTestId('battle').waitFor()
    await page.waitForTimeout(800)
    const c0 = await cam()
    await drag('left', 160, 0)
    const c1 = await cam()
    expect(Math.abs(c1.tx - c0.tx) + Math.abs(c1.tz - c0.tz), 'left drag pans on a fresh profile').toBeGreaterThan(1)
    await drag('middle', -160, 60)
    const c2 = await cam()
    expect(Math.abs(c2.tx - c1.tx) + Math.abs(c2.tz - c1.tz), 'middle drag pans').toBeGreaterThan(1)
    await drag('left', 160, 0)
    const c3 = await cam()
    expect(Math.abs(c3.tx - c2.tx) + Math.abs(c3.tz - c2.tz), 'left drag leaves the camera alone after a middle press').toBeLessThan(0.01)
    await drag('right', 140, 0)
    const c4 = await cam()
    expect(Math.abs(c4.yaw - c3.yaw), 'right drag rotates').toBeGreaterThan(0.3)
    await page.mouse.move(720, 450)
    await page.mouse.wheel(0, -300)
    await page.waitForTimeout(100)
    const c5 = await cam()
    expect(c5.dist, 'wheel zooms in').toBeLessThan(c4.dist)
  })
})
