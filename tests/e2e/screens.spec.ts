// Evidence screenshots for docs/screenshots/m3 (set M3_SHOTS=1 to write them; the checks themselves always run).
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { DESKTOP, PHONE, openGame } from './helpers'

const OUT = 'docs/screenshots/m3'
const save = readFileSync(new URL('./fixtures/edict-save.json', import.meta.url), 'utf8')
const shots = !!process.env['M3_SHOTS']

for (const [name, vp, touch] of [['desktop', DESKTOP, false], ['phone', PHONE, true]] as const) {
  test.describe(`screens ${name}`, () => {
    test.use({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 })

    test('title, start picker, map, roster, battle', async ({ page }) => {
      await page.goto('./')
      await page.getByTestId('title').waitFor()
      await page.waitForTimeout(400)
      if (shots) await page.screenshot({ path: `${OUT}/${name}-title.png` })
      await page.getByTestId('new-game').click()
      await page.getByTestId('start-picker').waitFor()
      await expect(page.getByTestId('diff-2')).toContainText('144 months')
      await expect(page.getByTestId('start-detail')).toContainText('Gold')
      if (shots) await page.screenshot({ path: `${OUT}/${name}-start.png` })

      await openGame(page, { seed: 7 })
      await page.waitForTimeout(500)
      if (shots) await page.screenshot({ path: `${OUT}/${name}-map.png` })
      if (touch && !(await page.getByTestId('tab-heroes').isVisible())) await page.getByTestId('sheet-handle').click()
      await page.getByTestId('tab-heroes').click()
      await expect(page.getByTestId('roster-count')).toHaveText('128')
      await expect(page.locator('[data-testid^=poster-]').first()).toBeVisible()
      // a late joiner shows its story trigger (D19)
      await page.getByTestId('roster-find').fill('Tang Long')
      await expect(page.getByTestId('trigger')).toContainText('Renown')
      await page.getByTestId('roster-find').fill('')
      if (shots) await page.screenshot({ path: `${OUT}/${name}-roster.png` })

      await page.getByTestId('tab-prefecture').click()
      await page.getByTestId('pref-zhujiazhuang').click({ force: true })
      await page.getByTestId('order-attack').click()
      if (shots) await page.screenshot({ path: `${OUT}/${name}-prompt.png` })
      await page.getByTestId('confirm').click()
      await page.getByTestId('battle').waitFor()
      await page.waitForTimeout(1500)
      if (shots) await page.screenshot({ path: `${OUT}/${name}-battle.png` })
      // select a unit so the hover card and move tiles show
      const b = await page.evaluate(() => (window.__ls108 as unknown as { battle(): { units: { id: string; side: string; q: number; r: number }[]; human: string } }).battle())
      const mine = b.units.find((u) => u.side === b.human)!
      const p = await page.evaluate(([q, r]) => (window.__ls108 as unknown as { project(q: number, r: number): { x: number; y: number } }).project(q as number, r as number), [mine.q, mine.r])
      if (touch) await page.touchscreen.tap(p.x, p.y)
      else await page.mouse.click(p.x, p.y)
      await expect(page.getByTestId('uc')).toBeVisible()
      if (shots) await page.screenshot({ path: `${OUT}/${name}-battle-selected.png` })
    })

    test('after the Edict the map shows the capital open and its refuge links open or cut', async ({ page }) => {
      await page.goto('./')
      await page.evaluate((s) => { localStorage.setItem('ls108-save', s); localStorage.setItem('ls108-settings', JSON.stringify({ speed: 'instant', showAiBattles: false })) }, save)
      await page.reload()
      await page.getByTestId('continue').click()
      await page.getByTestId('game').waitFor()
      await expect(page.getByTestId('hud-renown')).toContainText('Edict granted')
      await page.getByTestId('map-fit').click()
      await expect(page.getByTestId('escape-routes')).toBeAttached()
      const states = await page.locator('[data-testid=escape-routes] [data-state]').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
      expect(states).toContain('open')
      expect(states).toContain('cut')
      await page.waitForTimeout(300)
      if (shots) await page.screenshot({ path: `${OUT}/${name}-map-edict.png` })
    })
  })
}
